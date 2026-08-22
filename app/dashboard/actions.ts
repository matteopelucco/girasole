'use server';

import { requireUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import type { EsitoAzione } from '@/components/FormConEsito';

export async function creaPromemoria(_stato: EsitoAzione, formData: FormData): Promise<EsitoAzione> {
  const { supabase, user } = await requireUser();

  const titolo = (formData.get('titolo') as string)?.trim();
  const testo = (formData.get('testo') as string)?.trim();
  const destinatarioTipo = formData.get('destinatario_tipo') as string;
  const sezioneId = (formData.get('sezione_id') as string) || null;
  const bambinoId = (formData.get('bambino_id') as string) || null;

  if (!titolo || !testo) {
    return { ok: false, messaggio: 'Compila titolo e testo del promemoria.' };
  }
  if (!['tutti', 'sezione', 'bambino'].includes(destinatarioTipo)) {
    return { ok: false, messaggio: 'Scegli un destinatario valido.' };
  }

  const { error } = await supabase.from('promemoria').insert({
    titolo,
    testo,
    destinatario_tipo: destinatarioTipo,
    sezione_id: destinatarioTipo === 'sezione' ? sezioneId : null,
    bambino_id: destinatarioTipo === 'bambino' ? bambinoId : null,
    autore_id: user.id,
  });
  if (error) {
    return { ok: false, messaggio: 'Impossibile pubblicare il promemoria.', dettaglio: error.message };
  }

  revalidatePath('/dashboard');
  return { ok: true };
}
