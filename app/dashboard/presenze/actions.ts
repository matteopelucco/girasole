'use server';

import { revalidatePath } from 'next/cache';
import { requireProfilo, assicuraScrivibile } from '@/lib/auth';
import { assicuraGiornoApribile } from '@/lib/calendarioScolastico';
import { prossimaPresenza, type AzionePresenza, type RigaPresenza } from '@/lib/presenza';
import type { SupabaseClient } from '@supabase/supabase-js';

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
  if (error) throw new Error(`Impossibile salvare la presenza: ${error.message}`);
}

// segnaPresenza/segnaPreAsilo/segnaPostAsilo/salvaNotaPresenza sono
// legate a bottoni diversi dentro allo stesso form (vedi
// app/dashboard/presenze/[sezioneId]/page.tsx): niente useFormState, il
// feedback "ko" (specs/05 - feedback.md) passa dal sollevare l'errore,
// intercettato da app/error.tsx.
async function applicaAzionePresenza(
  bambinoId: string,
  azione: AzionePresenza,
  rigaAttuale: RigaPresenza | null,
  sezioneId: string,
  data: string,
  formData: FormData
) {
  const { supabase, user, profilo } = await requireProfilo();
  assicuraScrivibile(profilo?.ruolo, data);
  await assicuraGiornoApribile(supabase, data);

  const note = (formData.get('nota_presenza') as string)?.trim() || null;
  const prossima = prossimaPresenza(rigaAttuale, azione);
  await upsertPresenza(supabase, user.id, bambinoId, data, prossima, note);

  revalidatePath(`/dashboard/presenze/${sezioneId}`);
}

export async function segnaPresenza(
  bambinoId: string,
  stato: 'presente' | 'assente' | 'malattia',
  sezioneId: string,
  data: string,
  formData: FormData
) {
  await applicaAzionePresenza(bambinoId, stato, null, sezioneId, data, formData);
}

// Pre-asilo/post-asilo (specs/13 - segna-presenza.md): toggle che
// dipendono dallo stato attuale (per sapere se attivare o disattivare,
// e per non perdere l'altro indicatore) — richiede la riga attuale,
// passata dalla pagina che l'ha già caricata.
export async function segnaPreAsilo(
  bambinoId: string,
  rigaAttuale: RigaPresenza | null,
  sezioneId: string,
  data: string,
  formData: FormData
) {
  await applicaAzionePresenza(bambinoId, 'pre_asilo', rigaAttuale, sezioneId, data, formData);
}

export async function segnaPostAsilo(
  bambinoId: string,
  rigaAttuale: RigaPresenza | null,
  sezioneId: string,
  data: string,
  formData: FormData
) {
  await applicaAzionePresenza(bambinoId, 'post_asilo', rigaAttuale, sezioneId, data, formData);
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
  sezioneId: string,
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

  revalidatePath(`/dashboard/presenze/${sezioneId}`);
}
