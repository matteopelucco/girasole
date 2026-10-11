import { createClient } from '@supabase/supabase-js';

// Verifica che `password` sia quella dell'utente `email` (specs/62 -
// parametri-di-funzionamento.md, issue #287: l'admin reinserisce la propria
// password per vedere i valori delle variabili d'ambiente). Solo lato server.
//
// Usa un client Supabase usa-e-getta con la chiave anon, SENZA cookie e senza
// salvare la sessione: a differenza di lib/supabase/server.ts non tocca i
// cookie della richiesta, quindi la sessione con cui l'admin sta navigando non
// viene sostituita né ruotata. La sessione di verifica creata dal login viene
// chiusa subito con `scope: 'local'`, che revoca solo quella: lo scope di
// default ('global') chiuderebbe anche tutte le altre sessioni dell'utente.
//
// Ritorna solo vero/falso: l'errore di Supabase non esce da qui (il chiamante
// mostra un messaggio generico) e niente viene loggato.
export async function passwordCorretta(email: string, password: string, idUtenteAtteso: string): Promise<boolean> {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
  });

  try {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.user) return false;
    // Difesa in più: la password deve appartenere proprio all'utente della sessione.
    const ok = data.user.id === idUtenteAtteso;
    await client.auth.signOut({ scope: 'local' }).catch(() => undefined);
    return ok;
  } catch {
    return false;
  }
}
