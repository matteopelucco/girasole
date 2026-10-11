import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { autorizzaCron } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { eseguiConRegistro, type EsitoLavoroCron, type OpzioniLavoroCron } from '@/lib/cronEsecuzioniDati';
import type { NomeCron } from '@/lib/cronEsecuzioni';

// Parte comune delle route dei cron pianificati (Vercel Cron): unico punto che
// verifica il secret dei cron (`autorizzaCron`, Authorization: Bearer
// $CRON_SECRET, fail-closed su Vercel). Il lavoro vero è in lib/cron/,
// condiviso con il lancio a mano dell'admin (specs/63), che non passa di qui.
//
// Ogni lancio autorizzato è registrato in `cron_esecuzioni` (specs/63): il
// registro non ritarda né fa fallire il lavoro (lib/cronEsecuzioniDati.ts,
// eseguiConRegistro). Una chiamata non autorizzata non viene registrata.
export async function eseguiCronPianificato<T>(
  request: Request,
  nome: NomeCron,
  lavoro: (supabase: SupabaseClient, opzioni: OpzioniLavoroCron) => Promise<EsitoLavoroCron<T>>
): Promise<Response> {
  if (!autorizzaCron(request)) {
    return NextResponse.json({ errore: 'non autorizzato' }, { status: 401 });
  }

  // service_role: nessuna sessione utente da cui ereditare i permessi (ADR-0002).
  const supabase = createAdminClient();
  const { dati } = await eseguiConRegistro(supabase, nome, () => lavoro(supabase, { estemporaneo: false }));
  return NextResponse.json(dati);
}
