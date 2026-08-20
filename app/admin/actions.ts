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
  if (!nome) return;

  await supabase.from('sezioni').insert({ nome });
  revalidatePath('/admin');
}

export async function creaBambino(formData: FormData) {
  const supabase = await requireAdmin();
  const nome = (formData.get('nome') as string)?.trim();
  const cognome = (formData.get('cognome') as string)?.trim();
  const sezioneId = formData.get('sezione_id') as string;
  const noteAllergie = (formData.get('note_allergie') as string)?.trim();

  if (!nome || !cognome || !sezioneId) return;

  await supabase.from('bambini').insert({
    nome,
    cognome,
    sezione_id: sezioneId,
    note_allergie: noteAllergie || null,
  });
  revalidatePath('/admin');
}
