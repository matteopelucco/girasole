'use server';

import { revalidatePath } from 'next/cache';
import { requireProfilo, assicuraScrivibile } from '@/lib/auth';
import type { SupabaseClient } from '@supabase/supabase-js';

type StatoPasto = 'si' | 'no' | 'parziale';

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
  assicuraScrivibile(profilo?.ruolo, data);

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
  assicuraScrivibile(profilo?.ruolo, data);

  if (!mangiatoAttuale) {
    throw new Error('Segna prima uno stato pasto per poter salvare una nota.');
  }

  const note = (formData.get('nota_pasto') as string)?.trim() || null;
  await upsertPasto(supabase, user.id, bambinoId, data, mangiatoAttuale, note);

  revalidatePath(`/dashboard/pasti/${sezioneId}`);
}
