'use server';

import { revalidatePath } from 'next/cache';
import { requireStaff, assicuraAccessoOreLavoro } from '@/lib/auth';
import { oggi, giorniSettimana } from '@/lib/date';
import {
  validaGiornoOreLavoro,
  oreOrdinariePreviste,
  settimanaOreLavoroRichiesta,
  utenteBersaglioOreLavoro,
} from '@/lib/oreLavoro';
import { recuperaProfiloOrario } from '@/lib/profiliOrari';
import type { EsitoAzione } from '@/components/FormConEsito';

// Il personale può modificare/confermare qualunque settimana passata,
// oltre a quella corrente (specs/18) — ma mai una settimana futura:
// riusa la stessa risoluzione della pagina (settimanaOreLavoroRichiesta)
// per validare il campo nascosto settimana_inizio inviato dal form,
// invece di duplicare lo stesso controllo qui.
function settimanaValidaPerScrittura(formData: FormData): string | null {
  const richiesta = (formData.get('settimana_inizio') as string) || '';
  const risolta = settimanaOreLavoroRichiesta(richiesta, oggi());
  return risolta === richiesta ? richiesta : null;
}

// Utente su cui scrivere (utenteBersaglioOreLavoro) più il controllo di
// accesso che ne consegue: se si scrive su se stessi serve la propria
// abilitazione (assicuraAccessoOreLavoro, nessun bypass); se si scrive
// sull'utente indicato da un altro (solo un admin può farlo) l'accesso
// dipende dal ruolo, non dall'abilitazione di chi scrive — vedi
// utenteBersaglioOreLavoro. Condivisa da entrambe le server action
// sotto per non ripetere lo stesso controllo due volte (CLAUDE.md,
// jscpd).
function risolviUtenteBersaglio(
  ruolo: string | null | undefined,
  userId: string,
  abilitato: boolean | null | undefined,
  formData: FormData
): string {
  const utenteId = utenteBersaglioOreLavoro(ruolo, userId, formData.get('utente_id') as string | null);
  if (utenteId === userId) {
    assicuraAccessoOreLavoro(abilitato);
  }
  return utenteId;
}

// Salva le ore/lo stato di ogni giorno della settimana indicata
// (specs/18: quella corrente o una passata, mai una futura) — valida
// PRIMA tutti i giorni inviati (funzione pura, nessun I/O) e scrive
// solo se sono tutti validi: nessun salvataggio parziale su un errore
// (specs/05 - feedback.md).
//
// Scrive sull'utente indicato dal campo nascosto `utente_id` SOLO se
// chi invia è admin (specs/18, sezione "Amministrazione" — l'admin può
// correggere le ore di chiunque sia abilitato, anche una settimana già
// confermata); chiunque altro scrive sempre e solo su se stesso,
// qualunque valore arrivi dal client (utenteBersaglioOreLavoro).
export async function salvaSettimanaOreLavoro(_stato: EsitoAzione, formData: FormData): Promise<EsitoAzione> {
  const { supabase, user, profilo, ruolo } = await requireStaff({});
  const utenteId = risolviUtenteBersaglio(ruolo, user.id, profilo?.abilitato_ore_lavoro, formData);

  const settimanaInizio = settimanaValidaPerScrittura(formData);
  if (!settimanaInizio) {
    return { ok: false, messaggio: 'Non puoi modificare una settimana futura.' };
  }

  const giorni = giorniSettimana(settimanaInizio);

  const daScrivere = [];
  for (const data of giorni) {
    const esito = validaGiornoOreLavoro({
      data,
      stato: (formData.get(`stato_${data}`) as string) || 'lavorativo',
      oreOrdinarie: Number(formData.get(`ore_ordinarie_${data}`)) || 0,
      oreStraordinarie: Number(formData.get(`ore_straordinarie_${data}`)) || 0,
      motivoStraordinario: (formData.get(`motivo_straordinario_${data}`) as string) || '',
      codiceMalattia: (formData.get(`codice_malattia_${data}`) as string) || '',
      notaAssenza: (formData.get(`nota_assenza_${data}`) as string) || '',
    });
    if (!esito.ok) {
      return { ok: false, messaggio: esito.errore };
    }
    daScrivere.push(esito.giorno);
  }

  if (!daScrivere.length) {
    return { ok: true };
  }

  const { error } = await supabase.from('ore_lavoro_giorni').upsert(
    daScrivere.map((g) => ({
      utente_id: utenteId,
      data: g.data,
      stato: g.stato,
      ore_ordinarie: g.oreOrdinarie,
      ore_straordinarie: g.oreStraordinarie,
      motivo_straordinario: g.motivoStraordinario,
      codice_malattia: g.codiceMalattia,
      nota_assenza: g.notaAssenza,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: 'utente_id,data' }
  );
  if (error) {
    return { ok: false, messaggio: 'Impossibile salvare le ore della settimana.', dettaglio: error.message };
  }

  revalidatePath('/dashboard/ore-lavoro');
  return { ok: true };
}

// Conferma la settimana indicata (specs/18: quella corrente o una
// passata, mai una futura): prima completa con i valori precaricati dal
// profilo orario ogni giorno non ancora salvato esplicitamente
// (scenario "confermare la settimana"), poi registra la conferma vera e
// propria — l'esistenza della riga in ore_lavoro_settimane È la
// conferma (stesso pattern di report_giornalieri_inviati, specs/52).
//
// Come salvaSettimanaOreLavoro sopra, conferma per conto di un altro
// utente solo se chi invia è admin (specs/18, "Amministrazione") — in
// quel caso usa il profilo orario DI QUELL'UTENTE (non quello di chi
// sta confermando) per precaricare i giorni mancanti.
export async function confermaSettimanaOreLavoro(_stato: EsitoAzione, formData: FormData): Promise<EsitoAzione> {
  const { supabase, user, profilo, ruolo } = await requireStaff({});
  const utenteId = risolviUtenteBersaglio(ruolo, user.id, profilo?.abilitato_ore_lavoro, formData);

  const settimanaInizio = settimanaValidaPerScrittura(formData);
  if (!settimanaInizio) {
    return { ok: false, messaggio: 'Non puoi confermare una settimana futura.' };
  }

  const giorni = giorniSettimana(settimanaInizio);

  const { data: esistenti } = await supabase
    .from('ore_lavoro_giorni')
    .select('data')
    .eq('utente_id', utenteId)
    .in('data', giorni);
  const dateEsistenti = new Set((esistenti ?? []).map((r) => r.data));

  let profiloOrarioId = profilo?.profilo_orario_id ?? null;
  if (utenteId !== user.id) {
    const { data: profiloAltro } = await supabase
      .from('profili')
      .select('profilo_orario_id')
      .eq('id', utenteId)
      .maybeSingle();
    profiloOrarioId = profiloAltro?.profilo_orario_id ?? null;
  }
  const profiloOrario = await recuperaProfiloOrario(supabase, profiloOrarioId);

  const daCompletare = giorni
    .filter((data) => !dateEsistenti.has(data))
    .map((data) => ({
      utente_id: utenteId,
      data,
      stato: 'lavorativo',
      ore_ordinarie: oreOrdinariePreviste(profiloOrario, data),
      ore_straordinarie: 0,
    }));

  if (daCompletare.length) {
    const { error: erroreCompletamento } = await supabase.from('ore_lavoro_giorni').insert(daCompletare);
    if (erroreCompletamento) {
      return {
        ok: false,
        messaggio: 'Impossibile completare i giorni mancanti prima della conferma.',
        dettaglio: erroreCompletamento.message,
      };
    }
  }

  const { error } = await supabase
    .from('ore_lavoro_settimane')
    .insert({ utente_id: utenteId, settimana_inizio: settimanaInizio });
  if (error) {
    if (error.code === '23505') {
      return { ok: false, messaggio: 'Questa settimana risulta già confermata.' };
    }
    return { ok: false, messaggio: 'Impossibile confermare la settimana.', dettaglio: error.message };
  }

  revalidatePath('/dashboard/ore-lavoro');
  return { ok: true };
}
