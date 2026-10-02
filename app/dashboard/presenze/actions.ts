'use server';

import { revalidatePath } from 'next/cache';
import { PERCORSO_GIORNATA } from '@/lib/giornata';
import { requireProfilo, assicuraScrivibile } from '@/lib/auth';
import { assicuraGiornoApribile } from '@/lib/calendarioScolastico';
import {
  MESSAGGIO_ASSENZA_BLOCCATA,
  messaggioErroreSalvataggioPresenza,
  prossimaPresenza,
  type AzionePresenza,
  type RigaPresenza,
} from '@/lib/presenza';
import type { SupabaseClient } from '@supabase/supabase-js';

// grant-check: authenticated
async function upsertPresenza(
  supabase: SupabaseClient,
  userId: string,
  bambinoId: string,
  data: string,
  riga: RigaPresenza,
  note: string | null
) {
  const { error } = await supabase.from('presenze').upsert(
    {
      bambino_id: bambinoId,
      data,
      stato: riga.stato,
      pre_asilo: riga.preAsilo,
      post_asilo: riga.postAsilo,
      note,
      inserita_da: userId,
    },
    { onConflict: 'bambino_id,data' }
  );
  // Il trigger di 0052 (niente Assente/Malattia dopo la comunicazione a
  // Rojac, specs/16) rifiuta con un messaggio del database: tradotto qui
  // in una spiegazione comprensibile, mostrata da ErroreAzione.
  if (error) throw new Error(messaggioErroreSalvataggioPresenza(error.message));
}

// Frammento del messaggio del trigger di 0020 (pasti già comunicati a
// Rojac): per un non-admin l'azzeramento del pasto viene rifiutato.
const FRAMMENTO_ERRORE_PASTI_COMUNICATI = 'comunicati a Rojac';

// Azzera il pasto "sì" di un bambino che sta per essere segnato
// Assente/Malattia (specs/13 - segna-presenza.md, issue #186): un
// bambino assente non mangia, e un pasto "sì" rimasto lo farebbe contare
// nel totale comunicato a Rojac. Va fatto PRIMA di scrivere la presenza:
// dopo, il trigger di 0012/0017 rifiuterebbe ogni scrittura del pasto.
// Legge il pasto attuale dal database (non quello mostrato in pagina,
// che potrebbe essere superato). L'assistente non vede né modifica i
// pasti (RLS): per lei non c'è nulla da azzerare, lo intercetta il
// controllo alla comunicazione (specs/16). Restituisce true se ha
// azzerato un pasto, per poterlo ripristinare se la presenza fallisce.
// Il pasto passa a "no" (la RLS non permette alla maestra di eliminare
// la riga) e la colonna `note` non viene toccata.
async function azzeraPastoSeSegnato(
  supabase: SupabaseClient,
  userId: string,
  ruolo: string | null | undefined,
  bambinoId: string,
  data: string
): Promise<boolean> {
  if (ruolo === 'assistente') return false;

  const { data: pasto, error: erroreLettura } = await supabase
    .from('pasti')
    .select('mangiato')
    .eq('bambino_id', bambinoId)
    .eq('data', data)
    .maybeSingle();
  if (erroreLettura) throw new Error(`Impossibile leggere il pasto: ${erroreLettura.message}`);
  if (pasto?.mangiato !== 'si') return false;

  const { error } = await supabase
    .from('pasti')
    .update({ mangiato: 'no', inserito_da: userId })
    .eq('bambino_id', bambinoId)
    .eq('data', data);
  if (error) {
    if (error.message.includes(FRAMMENTO_ERRORE_PASTI_COMUNICATI)) throw new Error(MESSAGGIO_ASSENZA_BLOCCATA);
    throw new Error(`Impossibile azzerare il pasto: ${error.message}`);
  }
  return true;
}

// Rimette il pasto a "sì" se la presenza non è stata salvata dopo
// l'azzeramento (best-effort: l'errore originale resta quello che
// importa all'utente).
async function ripristinaPasto(supabase: SupabaseClient, bambinoId: string, data: string) {
  await supabase.from('pasti').update({ mangiato: 'si' }).eq('bambino_id', bambinoId).eq('data', data);
}

// segnaPresenza/segnaPreAsilo/segnaPostAsilo/salvaNotaPresenza sono
// legate a bottoni diversi dentro allo stesso form (vedi
// app/dashboard/giornata/ColonnaPresenza.tsx): niente useFormState, il feedback
// "ko" (specs/05 - feedback.md) passa dal sollevare l'errore,
// intercettato da app/error.tsx.
async function applicaAzionePresenza(
  bambinoId: string,
  azione: AzionePresenza,
  rigaAttuale: RigaPresenza | null,
  data: string,
  formData: FormData
) {
  const { supabase, user, profilo } = await requireProfilo();
  assicuraScrivibile(profilo?.ruolo, data);
  await assicuraGiornoApribile(supabase, data);

  const note = (formData.get('nota_presenza') as string)?.trim() || null;
  const prossima = prossimaPresenza(rigaAttuale, azione);

  // Assente/Malattia: il pasto "sì" va azzerato (la UI ha già chiesto
  // conferma, vedi ColonnaPresenza), pre/post-asilo li azzera già
  // prossimaPresenza.
  const azzerato =
    azione === 'assente' || azione === 'malattia'
      ? await azzeraPastoSeSegnato(supabase, user.id, profilo?.ruolo, bambinoId, data)
      : false;
  try {
    await upsertPresenza(supabase, user.id, bambinoId, data, prossima, note);
  } catch (errore) {
    if (azzerato) await ripristinaPasto(supabase, bambinoId, data);
    throw errore;
  }

  revalidatePath(PERCORSO_GIORNATA);
}

export async function segnaPresenza(
  bambinoId: string,
  stato: 'presente' | 'assente' | 'malattia',
  data: string,
  formData: FormData
) {
  await applicaAzionePresenza(bambinoId, stato, null, data, formData);
}

// Pre-asilo/post-asilo (specs/13 - segna-presenza.md): toggle che
// dipendono dallo stato attuale (per sapere se attivare o disattivare,
// e per non perdere l'altro indicatore) — richiede la riga attuale,
// passata dalla pagina che l'ha già caricata.
export async function segnaPreAsilo(bambinoId: string, rigaAttuale: RigaPresenza | null, data: string, formData: FormData) {
  await applicaAzionePresenza(bambinoId, 'pre_asilo', rigaAttuale, data, formData);
}

export async function segnaPostAsilo(bambinoId: string, rigaAttuale: RigaPresenza | null, data: string, formData: FormData) {
  await applicaAzionePresenza(bambinoId, 'post_asilo', rigaAttuale, data, formData);
}

// Salva la nota senza richiedere di ripremere lo stato già segnato
// (specs/13 - segna-presenza.md, scenario "salvare una nota senza
// cambiare lo stato"). Richiede uno stato esistente: la colonna `stato`
// non è nullable, quindi non esiste un modo di salvare una nota
// "orfana" prima di aver segnato almeno una volta Presente/Assente/
// Malattia/Pre-asilo/Post-asilo — la UI disabilita il pulsante in quel
// caso.
export async function salvaNotaPresenza(
  bambinoId: string,
  data: string,
  rigaAttuale: RigaPresenza | null,
  formData: FormData
) {
  const { supabase, user, profilo } = await requireProfilo();
  assicuraScrivibile(profilo?.ruolo, data);
  await assicuraGiornoApribile(supabase, data);

  if (!rigaAttuale) {
    throw new Error('Segna prima uno stato di presenza per poter salvare una nota.');
  }

  const note = (formData.get('nota_presenza') as string)?.trim() || null;
  await upsertPresenza(supabase, user.id, bambinoId, data, rigaAttuale, note);

  revalidatePath(PERCORSO_GIORNATA);
}
