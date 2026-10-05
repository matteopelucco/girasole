import type { SupabaseClient } from '@supabase/supabase-js';
import { chiusurePerPeriodo } from '@/lib/calendarioScolastico';
import { oggi, primoGiornoMese, ultimoGiornoMese } from '@/lib/date';
import { riepilogoMensileRojac, type RiepilogoMensileRojac } from '@/lib/emailRojac';

// Modello della mail a Rojac usato quando la riga manca (non dovrebbe
// succedere: la migration 0060 la inserisce).
const MODELLO_DI_RIPIEGO = { oggetto: 'Pasti {{mese}}', corpo: 'Pasti {{mese}}: {{totale_pasti}}' };

// Legge i dati della mail mensile a Rojac (specs/61): pasti bambini dal
// log delle comunicazioni del mese, giorni di chiusura e modello. Con la
// sessione dell'utente (RLS): pensato per l'admin. Nessuna logica di
// calcolo qui (è in lib/emailRojac.ts, pura e testata): solo letture,
// quindi coperto da e2e. Condiviso da pagina Report e azione di invio.
// grant-check: authenticated
export async function caricaDatiEmailRojac(
  supabase: SupabaseClient,
  mese: string
): Promise<{ riepilogo: RiepilogoMensileRojac; template: { oggetto: string; corpo: string } }> {
  const inizio = primoGiornoMese(mese);
  const fine = ultimoGiornoMese(mese);

  const [{ data: comunicazioni, error: erroreComunicazioni }, { data: template }, chiusure] = await Promise.all([
    supabase.from('pasti_comunicati').select('numero_pasti').gte('data', inizio).lte('data', fine),
    supabase.from('impostazioni_email_rojac').select('oggetto, corpo').eq('id', true).maybeSingle(),
    chiusurePerPeriodo(supabase, inizio, fine),
  ]);
  if (erroreComunicazioni) throw new Error(`lettura pasti comunicati: ${erroreComunicazioni.message}`);

  const pastiBambini = (comunicazioni ?? []).reduce((totale, c) => totale + c.numero_pasti, 0);
  return {
    riepilogo: riepilogoMensileRojac({ mese, pastiBambini, chiusure, oggiData: oggi() }),
    template: template ?? MODELLO_DI_RIPIEGO,
  };
}
