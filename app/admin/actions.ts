'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profilo } = await supabase
    .from('profili')
    .select('ruolo')
    .eq('id', user.id)
    .single();

  if (profilo?.ruolo !== 'admin') redirect('/dashboard');

  return supabase;
}

export async function creaSezione(formData: FormData) {
  const supabase = await requireAdmin();
  const nome = (formData.get('nome') as string)?.trim();
  const annoScolasticoId = (formData.get('anno_scolastico_id') as string) || null;
  if (!nome) return;

  await supabase.from('sezioni').insert({ nome, anno_scolastico_id: annoScolasticoId });
  revalidatePath('/admin');
}

export async function toggleAttivaSezione(formData: FormData) {
  const supabase = await requireAdmin();
  const sezioneId = formData.get('sezione_id') as string;
  const attivaAttuale = formData.get('attiva_attuale') === 'true';
  if (!sezioneId) return;

  await supabase.from('sezioni').update({ attiva: !attivaAttuale }).eq('id', sezioneId);
  revalidatePath('/admin');
}

export async function creaAnnoScolastico(formData: FormData) {
  const supabase = await requireAdmin();
  const nome = (formData.get('nome') as string)?.trim();
  if (!nome) return;

  await supabase.from('anni_scolastici').insert({ nome });
  revalidatePath('/admin');
}

export async function creaBambino(formData: FormData) {
  const supabase = await requireAdmin();
  const nome = (formData.get('nome') as string)?.trim();
  const cognome = (formData.get('cognome') as string)?.trim();
  const sezioneId = formData.get('sezione_id') as string;
  const dataNascita = (formData.get('data_nascita') as string) || null;
  const sesso = (formData.get('sesso') as string) || null;
  const noteAllergie = (formData.get('note_allergie') as string)?.trim();
  const altreNote = (formData.get('altre_note') as string)?.trim();

  if (!nome || !cognome || !sezioneId) return;

  await supabase.from('bambini').insert({
    nome,
    cognome,
    sezione_id: sezioneId,
    data_nascita: dataNascita,
    sesso,
    note_allergie: noteAllergie || null,
    altre_note: altreNote || null,
  });
  revalidatePath('/admin');
}
