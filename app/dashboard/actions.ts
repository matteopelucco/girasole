'use server';

import { requireUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
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

// specs/15 - memo.md, scenario "modifica di un promemoria".
export async function aggiornaPromemoria(
  _stato: EsitoAzione,
  formData: FormData
): Promise<EsitoAzione> {
  const { supabase } = await requireUser();

  const promemoriaId = formData.get('promemoria_id') as string;
  const titolo = (formData.get('titolo') as string)?.trim();
  const testo = (formData.get('testo') as string)?.trim();
  const destinatarioTipo = formData.get('destinatario_tipo') as string;
  const sezioneId = (formData.get('sezione_id') as string) || null;
  const bambinoId = (formData.get('bambino_id') as string) || null;

  if (!promemoriaId || !titolo || !testo) {
    return { ok: false, messaggio: 'Compila titolo e testo del promemoria.' };
  }
  if (!['tutti', 'sezione', 'bambino'].includes(destinatarioTipo)) {
    return { ok: false, messaggio: 'Scegli un destinatario valido.' };
  }

  const { error } = await supabase
    .from('promemoria')
    .update({
      titolo,
      testo,
      destinatario_tipo: destinatarioTipo,
      sezione_id: destinatarioTipo === 'sezione' ? sezioneId : null,
      bambino_id: destinatarioTipo === 'bambino' ? bambinoId : null,
    })
    .eq('id', promemoriaId);
  if (error) {
    return { ok: false, messaggio: 'Impossibile aggiornare il promemoria.', dettaglio: error.message };
  }

  revalidatePath('/dashboard');
  revalidatePath(`/dashboard/promemoria/${promemoriaId}`);
  return { ok: true };
}

// specs/15 - memo.md, scenario "cancellazione di un promemoria".
export async function eliminaPromemoria(
  _stato: EsitoAzione,
  formData: FormData
): Promise<EsitoAzione> {
  const { supabase } = await requireUser();
  const promemoriaId = formData.get('promemoria_id') as string;
  if (!promemoriaId) return { ok: false, messaggio: 'Promemoria non valido.' };

  const { error } = await supabase.from('promemoria').delete().eq('id', promemoriaId);
  if (error) {
    return { ok: false, messaggio: 'Impossibile eliminare il promemoria.', dettaglio: error.message };
  }

  revalidatePath('/dashboard');
  redirect('/dashboard?promemoria=eliminato');
}
