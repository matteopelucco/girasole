'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import type { EsitoAzione } from '@/components/FormConEsito';

// specs/57 - reset-giornata.md: elimina TUTTE le presenze e i pasti di
// una data, di tutte le classi — l'admin ha già visto quante righe sta
// per eliminare e confermato due volte (ConfermaAzione) prima che
// questa azione parta. Non tocca pasti_comunicati/comunicazioni_retta
// (log immutabili di comunicazioni già inviate, vedi Regole del
// requisito): solo presenze/pasti grezzi.
export async function resettaGiornata(_stato: EsitoAzione, formData: FormData): Promise<EsitoAzione> {
  const { supabase } = await requireAdmin();

  const data = (formData.get('data') as string) || '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return { ok: false, messaggio: 'Data non valida.' };
  }

  const [{ error: errorePresenze }, { error: errorePasti }] = await Promise.all([
    supabase.from('presenze').delete().eq('data', data),
    supabase.from('pasti').delete().eq('data', data),
  ]);

  if (errorePresenze || errorePasti) {
    return {
      ok: false,
      messaggio: 'Impossibile completare il reset della giornata.',
      dettaglio: errorePresenze?.message || errorePasti?.message,
    };
  }

  revalidatePath('/admin/reset-giornata');
  return { ok: true };
}
