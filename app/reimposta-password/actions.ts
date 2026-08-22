'use server';

import { createClient } from '@/lib/supabase/server';
import { passwordAbbastanzaComplessa } from '@/lib/password';
import { redirect } from 'next/navigation';

export async function impostaNuovaPassword(formData: FormData) {
  const password = formData.get('password') as string;
  const conferma = formData.get('conferma') as string;

  if (!password || password !== conferma) {
    redirect('/reimposta-password?errore=mismatch');
  }
  if (!passwordAbbastanzaComplessa(password)) {
    redirect('/reimposta-password?errore=debole');
  }

  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(`/reimposta-password?errore=generico&dettaglio=${encodeURIComponent(error.message)}`);
  }

  await supabase.auth.signOut();
  redirect('/login?reset=ok');
}
