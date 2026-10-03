'use server';

import { revalidatePath } from 'next/cache';
import { PERCORSO_GIORNATA } from '@/lib/giornata';
import { requireProfilo, assicuraScrivibile, assicuraAccessoPasti, puoScrivereData } from '@/lib/auth';
import { assicuraGiornoApribile } from '@/lib/calendarioScolastico';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  contaPastiSiOggiTuttoAsilo,
  bambiniSenzaPresenzaOggiTuttoAsilo,
  bambiniConIncoerenzeOggiTuttoAsilo,
} from '@/lib/pastiRojac';
import { inviaEmail } from '@/lib/email';
import { escapeHtml } from '@/lib/htmlEscape';
import { formattaDataItaliana } from '@/lib/date';
import type { EsitoAzione } from '@/components/FormConEsito';
import type { SupabaseClient } from '@supabase/supabase-js';

type StatoPasto = 'si' | 'no';

// Un bambino "assente" non può avere un pasto segnato (specs/14 -
// segna-pasto.md): controllo esplicito qui per un messaggio d'errore
// chiaro, oltre al trigger DB che è la difesa reale (vedi
// supabase/migrations/0012_pasto_senza_parziale.sql).
async function assicuraNonAssente(supabase: SupabaseClient, bambinoId: string, data: string) {
  const { data: presenza } = await supabase
    .from('presenze')
    .select('stato')
    .eq('bambino_id', bambinoId)
    .eq('data', data)
    .maybeSingle();
  if (presenza?.stato === 'assente') {
    throw new Error('Impossibile segnare il pasto: il bambino è assente in questa data.');
  }
}

// Il pasto non ha più una nota in schermata (issue #109, specs/14): la
// colonna `pasti.note` resta nel DB con le note già salvate. Per questo
// l'upsert non include `note`: sui record esistenti ON CONFLICT
// aggiorna solo le colonne passate, quindi segnare Sì/No non la azzera.
export async function segnaPasto(bambinoId: string, mangiato: StatoPasto, data: string) {
  const { supabase, user, profilo } = await requireProfilo();
  assicuraAccessoPasti(profilo?.ruolo);
  assicuraScrivibile(profilo?.ruolo, data);
  await assicuraGiornoApribile(supabase, data);
  await assicuraNonAssente(supabase, bambinoId, data);

  const { error } = await supabase.from('pasti').upsert(
    { bambino_id: bambinoId, data, mangiato, inserito_da: user.id },
    { onConflict: 'bambino_id,data' }
  );
  if (error) throw new Error(`Impossibile salvare il pasto: ${error.message}`);

  revalidatePath(PERCORSO_GIORNATA);
}

// Comunica a Rojac il totale dei pasti dell'INTERO asilo per una data
// (specs/16 - comunicazione-pasti-rojac.md — corretto in corso d'opera:
// non è un'azione per singola classe, è un'unica comunicazione al
// giorno su tutte le classi). Registra un log immutabile (numero di
// pasti "sì" ricalcolato in quel momento su tutto l'asilo, chi ha
// confermato) che da quel momento blocca la modifica dei pasti per la
// maestra, in qualunque classe (non per l'admin — vedi il trigger
// pasti_blocca_se_comunicato in
// supabase/migrations/0020_pasti_comunicati_globale.sql, che è la
// difesa reale). Conteggio e controlli di blocco sono RPC con la sessione
// dell'utente (migration 0056: una sessione maestra vede via RLS solo le
// proprie sezioni, ma il totale da comunicare è sull'intero asilo; il
// ruolo è verificato dentro la funzione). Solo l'INSERT in
// pasti_comunicati usa ancora la service_role key (sotto-issue #212 di
// #38); l'app stessa (assicuraAccessoPasti + il controllo data sotto)
// resta il gate di autorizzazione per quell'insert.
// Segue la firma di useFormState (FormConEsito/ConfermaAzione), a
// differenza di segnaPasto sopra che non ha bisogno del
// feedback avviato/riuscito/fallita di specs/05.
export async function comunicaPastiRojac(_stato: EsitoAzione, formData: FormData): Promise<EsitoAzione> {
  const { supabase, profilo, user } = await requireProfilo();
  assicuraAccessoPasti(profilo?.ruolo);

  const data = formData.get('data') as string;
  if (!data) return { ok: false, messaggio: 'Dati non validi.' };

  if (!puoScrivereData(profilo?.ruolo, data)) {
    return { ok: false, messaggio: 'Le maestre possono comunicare solo i pasti della giornata odierna.' };
  }

  const numeroSenzaPresenza = (await bambiniSenzaPresenzaOggiTuttoAsilo(supabase, data)).length;
  if (numeroSenzaPresenza > 0) {
    return {
      ok: false,
      messaggio: `Impossibile comunicare i pasti: ${numeroSenzaPresenza} ${numeroSenzaPresenza === 1 ? 'bambino non ha' : 'bambini non hanno'} ancora la presenza segnata per oggi.`,
    };
  }

  // Pasti segnati > presenti (specs/16): la pagina non offre il pulsante
  // in questo caso, ma potrebbe essere stata aperta prima della modifica
  // che ha creato l'incoerenza — il controllo è ripetuto qui, prima di
  // registrare la comunicazione (che è irreversibile).
  const incoerenti = await bambiniConIncoerenzeOggiTuttoAsilo(supabase, data);
  if (incoerenti.length > 0) {
    const elenco = incoerenti.map((b) => `${b.nome} ${b.cognome}`).join(', ');
    return {
      ok: false,
      messaggio: `Impossibile comunicare i pasti: ${incoerenti.length === 1 ? 'un bambino ha' : `${incoerenti.length} bambini hanno`} dati incoerenti (${elenco}). Correggi presenza o pasto e riprova.`,
    };
  }

  const numeroPasti = await contaPastiSiOggiTuttoAsilo(supabase, data);
  const comunicatoDaNome = `${profilo?.nome ?? ''} ${profilo?.cognome ?? ''}`.trim() || user.email || 'Sconosciuto';

  const admin = createAdminClient();
  const { error } = await admin.from('pasti_comunicati').insert({
    data,
    numero_pasti: numeroPasti,
    comunicato_da: user.id,
    comunicato_da_nome: comunicatoDaNome,
  });
  if (error) {
    if (error.code === '23505') {
      return { ok: false, messaggio: 'I pasti di oggi sono già stati comunicati a Rojac.' };
    }
    return { ok: false, messaggio: 'Impossibile comunicare i pasti a Rojac.', dettaglio: error.message };
  }

  // Best-effort (specs/16, "l'email di notifica è un effetto
  // collaterale"): un problema del servizio email non deve invalidare
  // la comunicazione già registrata, che è il dato che conta per il
  // confronto con la fattura Rojac.
  try {
    await inviaEmail({
      a: 'info@asilosartorio.it',
      oggetto: `Pasti comunicati a Rojac — ${formattaDataItaliana(data)}`,
      html: `<p>${escapeHtml(comunicatoDaNome)} ha comunicato a Rojac <strong>${numeroPasti}</strong> pasti per il ${formattaDataItaliana(data)}.</p>`,
    });
  } catch (erroreEmail) {
    console.error('comunicaPastiRojac: invio email di notifica fallito', erroreEmail);
  }

  revalidatePath(PERCORSO_GIORNATA);
  return { ok: true };
}
