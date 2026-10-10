import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { destinazioneDopoAccesso } from '@/lib/destinazioneDopoAccesso';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // Solo percorsi interni: altrimenti /dashboard (vedi lib/destinazioneDopoAccesso.ts).
  const next = destinazioneDopoAccesso(searchParams.get('next'), origin);

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?errore=link-non-valido`);
}
