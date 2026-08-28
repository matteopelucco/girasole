'use server';

import { revalidatePath } from 'next/cache';
import { requireProfilo, assicuraScrivibile, assicuraAccessoPasti, puoScrivereData } from '@/lib/auth';
import { assicuraGiornoApribile } from '@/lib/calendarioScolastico';
import { createAdminClient } from '@/lib/supabase/admin';
import { contaPastiSiOggiTuttoAsilo } from '@/lib/pastiRojac';
import { inviaEmail } from '@/lib/email';
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

async function upsertPasto(
  supabase: SupabaseClient,
  userId: string,
  bambinoId: string,
  data: string,
  mangiato: StatoPasto,
  note: string | null
) {
  const { error } = await supabase.from('pasti').upsert(
    { bambino_id: bambinoId, data, mangiato, note, inserito_da: userId },
    { onConflict: 'bambino_id,data' }
  );
  if (error) throw new Error(`Impossibile salvare il pasto: ${error.message}`);
}

export async function segnaPasto(
  bambinoId: string,
  mangiato: StatoPasto,
  sezioneId: string,
  data: string,
  formData: FormData
) {
  const { supabase, user, profilo } = await requireProfilo();
  assicuraAccessoPasti(profilo?.ruolo);
  assicuraScrivibile(profilo?.ruolo, data);
  await assicuraGiornoApribile(supabase, data);
  await assicuraNonAssente(supabase, bambinoId, data);

  const note = (formData.get('nota_pasto') as string)?.trim() || null;
  await upsertPasto(supabase, user.id, bambinoId, data, mangiato, note);

  revalidatePath(`/dashboard/pasti/${sezioneId}`);
}

// Salva la nota senza richiedere di ripremere lo stato già segnato
// (specs/14 - segna-pasto.md, stesso motivo di
// app/dashboard/presenze/actions.ts:salvaNotaPresenza).
export async function salvaNotaPasto(
  bambinoId: string,
  sezioneId: string,
  data: string,
  mangiatoAttuale: StatoPasto | null,
  formData: FormData
) {
  const { supabase, user, profilo } = await requireProfilo();
  assicuraAccessoPasti(profilo?.ruolo);
  assicuraScrivibile(profilo?.ruolo, data);
  await assicuraGiornoApribile(supabase, data);

  if (!mangiatoAttuale) {
    throw new Error('Segna prima uno stato pasto per poter salvare una nota.');
  }
  await assicuraNonAssente(supabase, bambinoId, data);

  const note = (formData.get('nota_pasto') as string)?.trim() || null;
  await upsertPasto(supabase, user.id, bambinoId, data, mangiatoAttuale, note);

  revalidatePath(`/dashboard/pasti/${sezioneId}`);
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
// difesa reale). Usa la service_role key per il conteggio e
// l'inserimento: una sessione maestra vede via RLS solo le proprie
// sezioni, ma il totale da comunicare è sull'intero asilo — l'app
// stessa (assicuraAccessoPasti + il controllo data sotto) resta il
// gate di autorizzazione, dato che qui by-passiamo la RLS di proposito.
// Segue la firma di useFormState (FormConEsito/ConfermaAzione), a
// differenza di segnaPasto/salvaNotaPasto sopra che non hanno bisogno
// del feedback avviato/riuscito/fallita di specs/05.
export async function comunicaPastiRojac(_stato: EsitoAzione, formData: FormData): Promise<EsitoAzione> {
  const { profilo, user } = await requireProfilo();
  assicuraAccessoPasti(profilo?.ruolo);

  const data = formData.get('data') as string;
  if (!data) return { ok: false, messaggio: 'Dati non validi.' };

  if (!puoScrivereData(profilo?.ruolo, data)) {
    return { ok: false, messaggio: 'Le maestre possono comunicare solo i pasti della giornata odierna.' };
  }

  const numeroPasti = await contaPastiSiOggiTuttoAsilo(data);
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
      html: `<p>${comunicatoDaNome} ha comunicato a Rojac <strong>${numeroPasti}</strong> pasti per il ${formattaDataItaliana(data)}.</p>`,
    });
  } catch (erroreEmail) {
    console.error('comunicaPastiRojac: invio email di notifica fallito', erroreEmail);
  }

  revalidatePath('/dashboard/pasti');
  revalidatePath('/dashboard/pasti/[sezioneId]', 'page');
  return { ok: true };
}
