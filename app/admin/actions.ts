'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import type { EsitoAzione } from '@/components/FormConEsito';

export async function creaSezione(_stato: EsitoAzione, formData: FormData): Promise<EsitoAzione> {
  const { supabase } = await requireAdmin();
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
  const { supabase } = await requireAdmin();
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
  const { supabase } = await requireAdmin();
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

// Campi condivisi da creazione e modifica di un bambino (specs/50).
function campiBambino(formData: FormData) {
  return {
    nome: ((formData.get('nome') as string) || '').trim(),
    cognome: ((formData.get('cognome') as string) || '').trim(),
    sezioneId: (formData.get('sezione_id') as string) || null,
    dataNascita: (formData.get('data_nascita') as string) || null,
    sesso: (formData.get('sesso') as string) || null,
    noteAllergie: ((formData.get('note_allergie') as string) || '').trim() || null,
    altreNote: ((formData.get('altre_note') as string) || '').trim() || null,
  };
}

function esitoErroreBambino(error: { code?: string; message: string }): EsitoAzione {
  if (error.code === '23505') {
    return {
      ok: false,
      messaggio: 'Esiste già un alunno con questo nome, cognome e data di nascita.',
    };
  }
  return { ok: false, messaggio: 'Impossibile salvare il bambino.', dettaglio: error.message };
}

export async function creaBambino(_stato: EsitoAzione, formData: FormData): Promise<EsitoAzione> {
  const { supabase } = await requireAdmin();
  const { nome, cognome, sezioneId, dataNascita, sesso, noteAllergie, altreNote } =
    campiBambino(formData);

  if (!nome || !cognome) {
    return { ok: false, messaggio: 'Compila nome e cognome del bambino.' };
  }

  const { error } = await supabase.from('bambini').insert({
    nome,
    cognome,
    sezione_id: sezioneId,
    data_nascita: dataNascita,
    sesso,
    note_allergie: noteAllergie,
    altre_note: altreNote,
  });
  if (error) return esitoErroreBambino(error);

  revalidatePath('/admin');
  return { ok: true };
}

// specs/50 - amministrazione_base.md, scenario "modificare i dati di un bambino".
export async function aggiornaBambino(_stato: EsitoAzione, formData: FormData): Promise<EsitoAzione> {
  const { supabase } = await requireAdmin();
  const bambinoId = formData.get('bambino_id') as string;
  const { nome, cognome, sezioneId, dataNascita, sesso, noteAllergie, altreNote } =
    campiBambino(formData);

  if (!bambinoId || !nome || !cognome) {
    return { ok: false, messaggio: 'Compila nome e cognome del bambino.' };
  }

  const { error } = await supabase
    .from('bambini')
    .update({
      nome,
      cognome,
      sezione_id: sezioneId,
      data_nascita: dataNascita,
      sesso,
      note_allergie: noteAllergie,
      altre_note: altreNote,
    })
    .eq('id', bambinoId);
  if (error) return esitoErroreBambino(error);

  revalidatePath(`/admin/bambini/${bambinoId}`);
  revalidatePath('/admin');
  return { ok: true };
}

// specs/50 - amministrazione_base.md, scenario "disattivare e riattivare
// un bambino": non cancella nulla, filtra solo la sua visibilità
// nell'elenco della classe e nelle funzioni Presenze/Pasto (vedi
// lib/sezioni.ts per lo stesso pattern già usato con sezioni.attiva).
export async function toggleAttivaBambino(
  _stato: EsitoAzione,
  formData: FormData
): Promise<EsitoAzione> {
  const { supabase } = await requireAdmin();
  const bambinoId = formData.get('bambino_id') as string;
  const attivaAttuale = formData.get('attiva_attuale') === 'true';

  if (!bambinoId) return { ok: false, messaggio: 'Bambino non valido.' };

  const { error } = await supabase
    .from('bambini')
    .update({ attiva: !attivaAttuale })
    .eq('id', bambinoId);
  if (error) {
    return {
      ok: false,
      messaggio: 'Impossibile aggiornare lo stato del bambino.',
      dettaglio: error.message,
    };
  }

  revalidatePath(`/admin/bambini/${bambinoId}`);
  revalidatePath('/admin');
  return { ok: true };
}

// specs/50 - amministrazione_base.md, scenario "assegnare rapidamente
// una sezione a un bambino senza classe": riattiva anche il bambino, se
// era disattivato — assegnargli una classe implica volerlo di nuovo
// operativo.
export async function assegnaSezioneBambino(
  _stato: EsitoAzione,
  formData: FormData
): Promise<EsitoAzione> {
  const { supabase } = await requireAdmin();
  const bambinoId = formData.get('bambino_id') as string;
  const sezioneId = formData.get('sezione_id') as string;

  if (!bambinoId || !sezioneId) {
    return { ok: false, messaggio: 'Scegli una sezione da assegnare.' };
  }

  const { error } = await supabase
    .from('bambini')
    .update({ sezione_id: sezioneId, attiva: true })
    .eq('id', bambinoId);
  if (error) {
    return { ok: false, messaggio: 'Impossibile assegnare la sezione.', dettaglio: error.message };
  }

  revalidatePath('/admin');
  return { ok: true };
}
