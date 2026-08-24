'use server';

import { requireUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { EsitoAzione } from '@/components/FormConEsito';

// Campi e validazione condivisi da creazione e modifica di un avviso
// (specs/15 - memo.md): la tabella/colonne restano `promemoria` (non
// rinominate, vedi la nota terminologica in specs/15), solo il testo
// visto dall'utente dice "avviso".
function campiAvviso(formData: FormData):
  | { ok: true; titolo: string; testo: string; destinatarioTipo: string; sezioneId: string | null; bambinoId: string | null }
  | { ok: false; messaggio: string } {
  const titolo = (formData.get('titolo') as string)?.trim();
  const testo = (formData.get('testo') as string)?.trim();
  const destinatarioTipo = formData.get('destinatario_tipo') as string;
  const sezioneId = (formData.get('sezione_id') as string) || null;
  const bambinoId = (formData.get('bambino_id') as string) || null;

  if (!titolo || !testo) {
    return { ok: false, messaggio: "Compila titolo e testo dell'avviso." };
  }
  if (!['tutti', 'sezione', 'bambino'].includes(destinatarioTipo)) {
    return { ok: false, messaggio: 'Scegli un destinatario valido.' };
  }
  if (destinatarioTipo === 'sezione' && !sezioneId) {
    return { ok: false, messaggio: 'Scegli la sezione destinataria.' };
  }
  if (destinatarioTipo === 'bambino' && !bambinoId) {
    return { ok: false, messaggio: 'Scegli il bambino destinatario.' };
  }

  return { ok: true, titolo, testo, destinatarioTipo, sezioneId, bambinoId };
}

export async function creaPromemoria(_stato: EsitoAzione, formData: FormData): Promise<EsitoAzione> {
  const { supabase, user } = await requireUser();

  const campi = campiAvviso(formData);
  if (!campi.ok) return { ok: false, messaggio: campi.messaggio };

  const { error } = await supabase.from('promemoria').insert({
    titolo: campi.titolo,
    testo: campi.testo,
    destinatario_tipo: campi.destinatarioTipo,
    sezione_id: campi.destinatarioTipo === 'sezione' ? campi.sezioneId : null,
    bambino_id: campi.destinatarioTipo === 'bambino' ? campi.bambinoId : null,
    autore_id: user.id,
  });
  if (error) {
    return { ok: false, messaggio: "Impossibile pubblicare l'avviso.", dettaglio: error.message };
  }

  revalidatePath('/dashboard');
  return { ok: true };
}

// specs/15 - memo.md, scenario "modifica di un avviso".
export async function aggiornaPromemoria(
  _stato: EsitoAzione,
  formData: FormData
): Promise<EsitoAzione> {
  const { supabase } = await requireUser();

  const promemoriaId = formData.get('promemoria_id') as string;
  if (!promemoriaId) return { ok: false, messaggio: "Compila titolo e testo dell'avviso." };

  const campi = campiAvviso(formData);
  if (!campi.ok) return { ok: false, messaggio: campi.messaggio };

  const { error } = await supabase
    .from('promemoria')
    .update({
      titolo: campi.titolo,
      testo: campi.testo,
      destinatario_tipo: campi.destinatarioTipo,
      sezione_id: campi.destinatarioTipo === 'sezione' ? campi.sezioneId : null,
      bambino_id: campi.destinatarioTipo === 'bambino' ? campi.bambinoId : null,
    })
    .eq('id', promemoriaId);
  if (error) {
    return { ok: false, messaggio: "Impossibile aggiornare l'avviso.", dettaglio: error.message };
  }

  revalidatePath('/dashboard');
  revalidatePath(`/dashboard/promemoria/${promemoriaId}`);
  return { ok: true };
}

// specs/15 - memo.md, scenario "cancellazione di un avviso".
export async function eliminaPromemoria(_stato: EsitoAzione, formData: FormData): Promise<EsitoAzione> {
  const { supabase } = await requireUser();
  const promemoriaId = formData.get('promemoria_id') as string;
  if (!promemoriaId) return { ok: false, messaggio: 'Avviso non valido.' };

  const { error } = await supabase.from('promemoria').delete().eq('id', promemoriaId);
  if (error) {
    return { ok: false, messaggio: "Impossibile eliminare l'avviso.", dettaglio: error.message };
  }

  revalidatePath('/dashboard');
  redirect('/dashboard?promemoria=eliminato');
}
