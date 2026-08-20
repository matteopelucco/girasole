'use server';

import { createClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

function ipRichiedente(): string {
  const elenco = headers().get('x-forwarded-for');
  return elenco?.split(',')[0]?.trim() || 'sconosciuto';
}

export async function richiediResetPassword(formData: FormData) {
  const email = (formData.get('email') as string)?.trim().toLowerCase();

  if (email) {
    const supabase = createClient();
    const ip = ipRichiedente();

    const { data: consentito } = await supabase.rpc('puo_richiedere_reset_password', {
      p_email: email,
      p_ip: ip,
    });

    if (consentito) {
      const origine = headers().get('origin') ?? '';
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origine}/auth/callback?next=/reimposta-password`,
      });
    }
    // Se non consentito (rate limit) o l'email non esiste, non facciamo
    // nulla: la risposta all'utente è identica in ogni caso, per non
    // rivelare né l'esistenza dell'account né il rate limiting.
  }

  redirect('/recupera-password?inviato=1');
}
