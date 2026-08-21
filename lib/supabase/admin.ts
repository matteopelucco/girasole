import { createClient } from '@supabase/supabase-js';

// Client con la service_role key: bypassa la RLS ed è l'unico modo per
// creare/eliminare utenti in auth.users dall'app, invece di affidarsi al
// dashboard Supabase (vedi specs/03 - utenti-e-ruoli.md). Solo lato
// server (dentro 'use server'): la service_role key non deve MAI
// raggiungere il browser né essere prefissata con NEXT_PUBLIC_.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
