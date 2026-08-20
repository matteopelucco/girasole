'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const RUOLI_VALIDI = ['admin', 'maestra', 'genitore'] as const;

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

export async function cambiaRuolo(formData: FormData) {
  const supabase = await requireAdmin();
  const profiloId = formData.get('profilo_id') as string;
  const ruolo = formData.get('ruolo') as string;

  if (!profiloId || !RUOLI_VALIDI.includes(ruolo as (typeof RUOLI_VALIDI)[number])) return;

  await supabase.from('profili').update({ ruolo }).eq('id', profiloId);
  revalidatePath('/admin/maestre');
}

export async function assegnaSezione(formData: FormData) {
  const supabase = await requireAdmin();
  const maestraId = formData.get('maestra_id') as string;
  const sezioneId = formData.get('sezione_id') as string;

  if (!maestraId || !sezioneId) return;

  await supabase
    .from('maestre_sezioni')
    .upsert({ maestra_id: maestraId, sezione_id: sezioneId }, { onConflict: 'maestra_id,sezione_id' });
  revalidatePath('/admin/maestre');
}

export async function rimuoviSezione(formData: FormData) {
  const supabase = await requireAdmin();
  const maestraId = formData.get('maestra_id') as string;
  const sezioneId = formData.get('sezione_id') as string;

  if (!maestraId || !sezioneId) return;

  await supabase
    .from('maestre_sezioni')
    .delete()
    .eq('maestra_id', maestraId)
    .eq('sezione_id', sezioneId);
  revalidatePath('/admin/maestre');
}
