import { createClient } from '@supabase/supabase-js';

// Client con la service_role key: bypassa la RLS ed è l'unico modo per
// creare/eliminare utenti in auth.users dall'app, invece di affidarsi al
// dashboard Supabase (vedi specs/03 - utenti-e-ruoli.md). Solo lato
// server (dentro 'use server'): la service_role key non deve MAI
// raggiungere il browser né essere prefissata con NEXT_PUBLIC_.
//
// `cache: 'no-store'` su ogni richiesta: in Next 14 le `fetch` dei GET
// finiscono nella Data Cache persistente, e supabase-js legge il DB con
// `fetch`. Senza questa opzione una lettura come "il report di ieri è già
// stato inviato?" (stesso URL a ogni esecuzione) può restare in cache e
// restituire dati vecchi anche dopo che la riga è cambiata o è stata
// cancellata: il cron risponderebbe `gia_inviato` senza guardare il DB.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
    }
  );
}
