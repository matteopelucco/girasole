'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function logout() {
  const supabase = createClient();
  // Solo la sessione di questo dispositivo: il default di Supabase
  // (scope 'global') revocherebbe tutte le sessioni dell'account
  // (vedi specs/11 - login.md).
  await supabase.auth.signOut({ scope: 'local' });
  redirect('/login');
}
