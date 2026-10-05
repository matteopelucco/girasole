'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { salvaModelloEmail } from '@/lib/modelloEmail';
import type { EsitoAzione } from '@/components/FormConEsito';

// specs/61 - email-pasti-rojac.md, scenario "modificare il modello della
// mail": riga singola già esistente (seed in
// supabase/migrations/0060_impostazioni_email_rojac.sql), quindi sempre un
// update, mai un insert (vedi lib/modelloEmail.ts).
export async function aggiornaTemplateEmailRojac(
  _stato: EsitoAzione,
  formData: FormData
): Promise<EsitoAzione> {
  const { supabase } = await requireAdmin();
  const esito = await salvaModelloEmail(supabase, 'impostazioni_email_rojac', formData);
  if (esito.ok) revalidatePath('/admin/rojac/template');
  return esito;
}
