'use server';

import { createClient } from '@/lib/supabase/server';
import { oggi } from '@/lib/date';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { EsitoAzione } from '@/components/FormConEsito';

async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { supabase, user };
}

// segnaPresenza/segnaPasto sono azioni diverse legate a bottoni diversi
// dentro allo stesso form (vedi app/dashboard/page.tsx): non c'è
// un'unica action da avvolgere con useFormState, quindi il feedback
// "ko" (specs/05 - feedback.md) qui passa dal sollevare l'errore, che
// viene intercettato da app/error.tsx con il dettaglio tecnico.
export async function segnaPresenza(
  bambinoId: string,
  stato: 'presente' | 'assente' | 'malattia',
  formData: FormData
) {
  const { supabase, user } = await requireUser();
  const note = (formData.get('nota_presenza') as string)?.trim() || null;

  const { error } = await supabase.from('presenze').upsert(
    {
      bambino_id: bambinoId,
      data: oggi(),
      stato,
      note,
      inserita_da: user.id,
    },
    { onConflict: 'bambino_id,data' }
  );
  if (error) throw new Error(`Impossibile salvare la presenza: ${error.message}`);

  revalidatePath('/dashboard');
}

export async function segnaPasto(
  bambinoId: string,
  mangiato: 'si' | 'no' | 'parziale',
  formData: FormData
) {
  const { supabase, user } = await requireUser();
  const note = (formData.get('nota_pasto') as string)?.trim() || null;

  const { error } = await supabase.from('pasti').upsert(
    {
      bambino_id: bambinoId,
      data: oggi(),
      mangiato,
      note,
      inserito_da: user.id,
    },
    { onConflict: 'bambino_id,data' }
  );
  if (error) throw new Error(`Impossibile salvare il pasto: ${error.message}`);

  revalidatePath('/dashboard');
}

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
