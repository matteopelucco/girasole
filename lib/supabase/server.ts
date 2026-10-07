import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createClient() {
  // In Next 15 cookies() è asincrona: la si attende dentro i metodi di
  // @supabase/ssr (che accettano Promise), così createClient() resta sincrona.
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async getAll() {
          return (await cookieStore).getAll();
        },
        async setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            const store = await cookieStore;
            cookiesToSet.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {
            // Chiamato da un Server Component: ignorabile, ci pensa il middleware
            // a rinfrescare la sessione ad ogni richiesta.
          }
        },
      },
    }
  );
}
