'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import type { EsitoAzione } from '@/components/FormConEsito';

// specs/56 - comunicazione-retta-mensile.md, scenario "configurare il
// template della mail": riga singola già esistente (seed in
// supabase/migrations/0036_comunicazione_retta.sql), quindi sempre un
// update, mai un insert.
export async function aggiornaTemplateEmailRetta(
  _stato: EsitoAzione,
  formData: FormData
): Promise<EsitoAzione> {
  const { supabase } = await requireAdmin();
  const oggetto = ((formData.get('oggetto') as string) || '').trim();
  const corpo = ((formData.get('corpo') as string) || '').trim();

  if (!oggetto || !corpo) {
    return { ok: false, messaggio: "Compila sia l'oggetto che il corpo del modello." };
  }

  const { error } = await supabase
    .from('impostazioni_email_retta')
    .update({ oggetto, corpo, updated_at: new Date().toISOString() })
    .eq('id', true);
  if (error) {
    return { ok: false, messaggio: 'Impossibile salvare il modello.', dettaglio: error.message };
  }

  revalidatePath('/admin/rette/template');
  return { ok: true };
}
