'use server';

import { createClient } from '@/lib/supabase/server';
import { oggi } from '@/lib/date';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { supabase, user };
}

export async function segnaPresenza(
  bambinoId: string,
  stato: 'presente' | 'assente' | 'malattia',
  formData: FormData
) {
  const { supabase, user } = await requireUser();
  const note = (formData.get('nota_presenza') as string)?.trim() || null;

  await supabase.from('presenze').upsert(
    {
      bambino_id: bambinoId,
      data: oggi(),
      stato,
      note,
      inserita_da: user.id,
    },
    { onConflict: 'bambino_id,data' }
  );
  revalidatePath('/dashboard');
}

export async function segnaPasto(
  bambinoId: string,
  mangiato: 'si' | 'no' | 'parziale',
  formData: FormData
) {
  const { supabase, user } = await requireUser();
  const note = (formData.get('nota_pasto') as string)?.trim() || null;

  await supabase.from('pasti').upsert(
    {
      bambino_id: bambinoId,
      data: oggi(),
      mangiato,
      note,
      inserito_da: user.id,
    },
    { onConflict: 'bambino_id,data' }
  );
  revalidatePath('/dashboard');
}

export async function creaPromemoria(formData: FormData) {
  const { supabase, user } = await requireUser();

  const titolo = (formData.get('titolo') as string)?.trim();
  const testo = (formData.get('testo') as string)?.trim();
  const destinatarioTipo = formData.get('destinatario_tipo') as string;
  const sezioneId = (formData.get('sezione_id') as string) || null;
  const bambinoId = (formData.get('bambino_id') as string) || null;

  if (!titolo || !testo) return;
  if (!['tutti', 'sezione', 'bambino'].includes(destinatarioTipo)) return;

  await supabase.from('promemoria').insert({
    titolo,
    testo,
    destinatario_tipo: destinatarioTipo,
    sezione_id: destinatarioTipo === 'sezione' ? sezioneId : null,
    bambino_id: destinatarioTipo === 'bambino' ? bambinoId : null,
    autore_id: user.id,
  });
  revalidatePath('/dashboard');
}
