'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import type { EsitoAzione } from '@/components/FormConEsito';

// Campi condivisi da creazione e modifica di un giorno di chiusura
// (specs/53 - calendario-scolastico.md).
function campiGiornoChiusura(formData: FormData) {
  return {
    dataInizio: (formData.get('data_inizio') as string) || '',
    dataFine: (formData.get('data_fine') as string) || '',
    nota: ((formData.get('nota') as string) || '').trim() || null,
  };
}

export async function creaGiornoChiusura(_stato: EsitoAzione, formData: FormData): Promise<EsitoAzione> {
  const { supabase } = await requireAdmin();
  const { dataInizio, dataFine, nota } = campiGiornoChiusura(formData);

  if (!dataInizio || !dataFine) {
    return { ok: false, messaggio: 'Inserisci sia la data di inizio sia la data di fine.' };
  }
  if (dataFine < dataInizio) {
    return { ok: false, messaggio: 'La data di fine non può precedere la data di inizio.' };
  }

  const { error } = await supabase
    .from('giorni_chiusura')
    .insert({ data_inizio: dataInizio, data_fine: dataFine, nota });
  if (error) {
    return { ok: false, messaggio: 'Impossibile creare il giorno di chiusura.', dettaglio: error.message };
  }

  revalidatePath('/admin/calendario');
  return { ok: true };
}

// specs/53 - calendario-scolastico.md, scenario "modificare un giorno di chiusura".
export async function aggiornaGiornoChiusura(_stato: EsitoAzione, formData: FormData): Promise<EsitoAzione> {
  const { supabase } = await requireAdmin();
  const giornoId = formData.get('giorno_id') as string;
  const { dataInizio, dataFine, nota } = campiGiornoChiusura(formData);

  if (!giornoId || !dataInizio || !dataFine) {
    return { ok: false, messaggio: 'Inserisci sia la data di inizio sia la data di fine.' };
  }
  if (dataFine < dataInizio) {
    return { ok: false, messaggio: 'La data di fine non può precedere la data di inizio.' };
  }

  const { error } = await supabase
    .from('giorni_chiusura')
    .update({ data_inizio: dataInizio, data_fine: dataFine, nota })
    .eq('id', giornoId);
  if (error) {
    return { ok: false, messaggio: 'Impossibile aggiornare il giorno di chiusura.', dettaglio: error.message };
  }

  revalidatePath(`/admin/calendario/${giornoId}`);
  revalidatePath('/admin/calendario');
  return { ok: true };
}

// specs/53 - calendario-scolastico.md, scenario "eliminare un giorno di chiusura".
export async function eliminaGiornoChiusura(_stato: EsitoAzione, formData: FormData): Promise<EsitoAzione> {
  const { supabase } = await requireAdmin();
  const giornoId = formData.get('giorno_id') as string;
  if (!giornoId) return { ok: false, messaggio: 'Giorno di chiusura non valido.' };

  const { error } = await supabase.from('giorni_chiusura').delete().eq('id', giornoId);
  if (error) {
    return { ok: false, messaggio: 'Impossibile eliminare il giorno di chiusura.', dettaglio: error.message };
  }

  revalidatePath('/admin/calendario');
  redirect('/admin/calendario');
}
