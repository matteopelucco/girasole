'use server';

import { revalidatePath } from 'next/cache';
import { requireProfilo, assicuraScrivibile } from '@/lib/auth';
import type { SupabaseClient } from '@supabase/supabase-js';

type StatoPresenza = 'presente' | 'assente' | 'malattia';

async function upsertPresenza(
  supabase: SupabaseClient,
  userId: string,
  bambinoId: string,
  data: string,
  stato: StatoPresenza,
  note: string | null
) {
  const { error } = await supabase.from('presenze').upsert(
    { bambino_id: bambinoId, data, stato, note, inserita_da: userId },
    { onConflict: 'bambino_id,data' }
  );
  if (error) throw new Error(`Impossibile salvare la presenza: ${error.message}`);
}

// segnaPresenza/salvaNotaPresenza sono legate a bottoni diversi dentro
// allo stesso form (vedi app/dashboard/presenze/[sezioneId]/page.tsx):
// niente useFormState, il feedback "ko" (specs/05 - feedback.md) passa
// dal sollevare l'errore, intercettato da app/error.tsx.
export async function segnaPresenza(
  bambinoId: string,
  stato: StatoPresenza,
  sezioneId: string,
  data: string,
  formData: FormData
) {
  const { supabase, user, profilo } = await requireProfilo();
  assicuraScrivibile(profilo?.ruolo, data);

  const note = (formData.get('nota_presenza') as string)?.trim() || null;
  await upsertPresenza(supabase, user.id, bambinoId, data, stato, note);

  revalidatePath(`/dashboard/presenze/${sezioneId}`);
}

// Salva la nota senza richiedere di ripremere lo stato già segnato
// (specs/13 - segna-presenza.md, scenario "salvare una nota senza
// cambiare lo stato"). Richiede uno stato esistente: la colonna `stato`
// non è nullable, quindi non esiste un modo di salvare una nota
// "orfana" prima di aver segnato almeno una volta Presente/Assente/
// Malattia — la UI disabilita il pulsante in quel caso.
export async function salvaNotaPresenza(
  bambinoId: string,
  sezioneId: string,
  data: string,
  statoAttuale: StatoPresenza | null,
  formData: FormData
) {
  const { supabase, user, profilo } = await requireProfilo();
  assicuraScrivibile(profilo?.ruolo, data);

  if (!statoAttuale) {
    throw new Error('Segna prima uno stato di presenza per poter salvare una nota.');
  }

  const note = (formData.get('nota_presenza') as string)?.trim() || null;
  await upsertPresenza(supabase, user.id, bambinoId, data, statoAttuale, note);

  revalidatePath(`/dashboard/presenze/${sezioneId}`);
}
