'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { EsitoAzione } from '@/components/FormConEsito';

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profilo } = await supabase
    .from('profili')
    .select('ruolo')
    .eq('id', user.id)
    .single();

  if (profilo?.ruolo !== 'admin') redirect('/dashboard');

  return supabase;
}

export async function creaSezione(_stato: EsitoAzione, formData: FormData): Promise<EsitoAzione> {
  const supabase = await requireAdmin();
  const nome = (formData.get('nome') as string)?.trim();
  const annoScolasticoId = (formData.get('anno_scolastico_id') as string) || null;

  if (!nome) return { ok: false, messaggio: 'Inserisci un nome per la sezione.' };

  const { error } = await supabase
    .from('sezioni')
    .insert({ nome, anno_scolastico_id: annoScolasticoId });
  if (error) {
    return { ok: false, messaggio: 'Impossibile creare la sezione.', dettaglio: error.message };
  }

  revalidatePath('/admin');
  return { ok: true };
}

export async function toggleAttivaSezione(
  _stato: EsitoAzione,
  formData: FormData
): Promise<EsitoAzione> {
  const supabase = await requireAdmin();
  const sezioneId = formData.get('sezione_id') as string;
  const attivaAttuale = formData.get('attiva_attuale') === 'true';

  if (!sezioneId) return { ok: false, messaggio: 'Sezione non valida.' };

  const { error } = await supabase
    .from('sezioni')
    .update({ attiva: !attivaAttuale })
    .eq('id', sezioneId);
  if (error) {
    return {
      ok: false,
      messaggio: 'Impossibile aggiornare lo stato della sezione.',
      dettaglio: error.message,
    };
  }

  revalidatePath('/admin');
  return { ok: true };
}

export async function creaAnnoScolastico(
  _stato: EsitoAzione,
  formData: FormData
): Promise<EsitoAzione> {
  const supabase = await requireAdmin();
  const nome = (formData.get('nome') as string)?.trim();

  if (!nome) return { ok: false, messaggio: "Inserisci un nome per l'anno scolastico." };

  const { error } = await supabase.from('anni_scolastici').insert({ nome });
  if (error) {
    return {
      ok: false,
      messaggio: "Impossibile creare l'anno scolastico.",
      dettaglio: error.message,
    };
  }

  revalidatePath('/admin');
  return { ok: true };
}

export async function creaBambino(_stato: EsitoAzione, formData: FormData): Promise<EsitoAzione> {
  const supabase = await requireAdmin();
  const nome = (formData.get('nome') as string)?.trim();
  const cognome = (formData.get('cognome') as string)?.trim();
  const sezioneId = formData.get('sezione_id') as string;
  const dataNascita = (formData.get('data_nascita') as string) || null;
  const sesso = (formData.get('sesso') as string) || null;
  const noteAllergie = (formData.get('note_allergie') as string)?.trim();
  const altreNote = (formData.get('altre_note') as string)?.trim();

  if (!nome || !cognome || !sezioneId) {
    return { ok: false, messaggio: 'Compila nome, cognome e sezione del bambino.' };
  }

  const { error } = await supabase.from('bambini').insert({
    nome,
    cognome,
    sezione_id: sezioneId,
    data_nascita: dataNascita,
    sesso,
    note_allergie: noteAllergie || null,
    altre_note: altreNote || null,
  });
  if (error) {
    return { ok: false, messaggio: 'Impossibile aggiungere il bambino.', dettaglio: error.message };
  }

  revalidatePath('/admin');
  return { ok: true };
}
