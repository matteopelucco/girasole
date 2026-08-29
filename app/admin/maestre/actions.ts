'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { passwordAbbastanzaComplessa, REGOLA_PASSWORD } from '@/lib/password';
import { requireAdmin } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import type { EsitoAzione } from '@/components/FormConEsito';

const RUOLI_VALIDI = ['admin', 'maestra', 'assistente', 'genitore'] as const;

// Campi condivisi da creazione e modifica di un utente (specs/03,
// specs/17 - ore-di-lavoro.md per abilitatoOreLavoro).
function campiUtente(formData: FormData) {
  return {
    nome: ((formData.get('nome') as string) || '').trim(),
    cognome: ((formData.get('cognome') as string) || '').trim(),
    telefono: ((formData.get('telefono') as string) || '').trim(),
    ruolo: formData.get('ruolo') as string,
    indirizzoResidenza: ((formData.get('indirizzo_residenza') as string) || '').trim(),
    note: ((formData.get('note') as string) || '').trim(),
    abilitatoOreLavoro: formData.get('abilitato_ore_lavoro') === 'on',
  };
}

// Segue il pattern EsitoAzione/FormConEsito (non un redirect con
// query-string come in passato): un redirect ricarica l'intera pagina,
// svuotando ogni campo del form — bug reale segnalato da un'insegnante
// dopo un errore di password, costretta a reinserire nome/cognome/
// email/telefono da capo. Con FormConEsito un errore lascia i campi
// già compilati (specs/03 - utenti-e-ruoli.md, specs/05 - feedback.md).
export async function creaUtente(_stato: EsitoAzione, formData: FormData): Promise<EsitoAzione> {
  const { supabase } = await requireAdmin();

  const email = ((formData.get('email') as string) || '').trim().toLowerCase();
  const password = (formData.get('password') as string) || '';
  const confermaPassword = (formData.get('conferma_password') as string) || '';
  const { nome, cognome, telefono, ruolo, indirizzoResidenza, note, abilitatoOreLavoro } = campiUtente(formData);

  if (
    !email ||
    !nome ||
    !cognome ||
    !telefono ||
    !RUOLI_VALIDI.includes(ruolo as (typeof RUOLI_VALIDI)[number])
  ) {
    return { ok: false, messaggio: 'Compila tutti i campi (nome, cognome, email, telefono, ruolo).' };
  }
  if (password !== confermaPassword) {
    return { ok: false, messaggio: 'Le due password inserite non coincidono.' };
  }
  if (!passwordAbbastanzaComplessa(password)) {
    return { ok: false, messaggio: REGOLA_PASSWORD };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome, cognome, telefono, ruolo },
  });

  if (error) {
    if (/already|registrat/i.test(error.message)) {
      return { ok: false, messaggio: 'Esiste già un utente con questa email.' };
    }
    // Errore non atteso (permessi, rete, ...): il dettaglio tecnico
    // resta utile per il troubleshooting, vedi specs/05 - feedback.md.
    return { ok: false, messaggio: "Non è stato possibile creare l'utente. Riprova.", dettaglio: error.message };
  }

  if (indirizzoResidenza || note || abilitatoOreLavoro) {
    await supabase
      .from('profili')
      .update({ indirizzo_residenza: indirizzoResidenza, note, abilitato_ore_lavoro: abilitatoOreLavoro })
      .eq('id', data.user!.id);
  }

  revalidatePath('/admin/maestre');
  return { ok: true };
}

export async function aggiornaUtente(
  _stato: EsitoAzione,
  formData: FormData
): Promise<EsitoAzione> {
  const { supabase } = await requireAdmin();
  const profiloId = formData.get('profilo_id') as string;
  const { nome, cognome, telefono, ruolo, indirizzoResidenza, note, abilitatoOreLavoro } = campiUtente(formData);

  if (!profiloId || !RUOLI_VALIDI.includes(ruolo as (typeof RUOLI_VALIDI)[number])) {
    return { ok: false, messaggio: 'Dati utente non validi.' };
  }

  const { error } = await supabase
    .from('profili')
    .update({
      nome,
      cognome,
      telefono,
      ruolo,
      indirizzo_residenza: indirizzoResidenza,
      note,
      abilitato_ore_lavoro: abilitatoOreLavoro,
    })
    .eq('id', profiloId);
  if (error) {
    return { ok: false, messaggio: "Impossibile aggiornare l'utente.", dettaglio: error.message };
  }

  revalidatePath('/admin/maestre');
  return { ok: true };
}

export async function eliminaUtente(_stato: EsitoAzione, formData: FormData): Promise<EsitoAzione> {
  const { user } = await requireAdmin();
  const profiloId = formData.get('profilo_id') as string;
  if (!profiloId) return { ok: false, messaggio: 'Utente non valido.' };

  if (profiloId === user.id) {
    return { ok: false, messaggio: 'Non puoi eliminare il tuo stesso account.' };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(profiloId);
  if (error) {
    return { ok: false, messaggio: "Impossibile eliminare l'utente.", dettaglio: error.message };
  }

  revalidatePath('/admin/maestre');
  return { ok: true };
}

export async function assegnaSezione(
  _stato: EsitoAzione,
  formData: FormData
): Promise<EsitoAzione> {
  const { supabase } = await requireAdmin();
  const maestraId = formData.get('maestra_id') as string;
  const sezioneId = formData.get('sezione_id') as string;

  if (!maestraId || !sezioneId) {
    return { ok: false, messaggio: 'Scegli sia la maestra che la sezione.' };
  }

  const { error } = await supabase
    .from('maestre_sezioni')
    .upsert({ maestra_id: maestraId, sezione_id: sezioneId }, { onConflict: 'maestra_id,sezione_id' });
  if (error) {
    return { ok: false, messaggio: "Impossibile assegnare la sezione.", dettaglio: error.message };
  }

  revalidatePath('/admin/maestre');
  return { ok: true };
}

export async function rimuoviSezione(
  _stato: EsitoAzione,
  formData: FormData
): Promise<EsitoAzione> {
  const { supabase } = await requireAdmin();
  const maestraId = formData.get('maestra_id') as string;
  const sezioneId = formData.get('sezione_id') as string;

  if (!maestraId || !sezioneId) {
    return { ok: false, messaggio: 'Assegnazione non valida.' };
  }

  const { error } = await supabase
    .from('maestre_sezioni')
    .delete()
    .eq('maestra_id', maestraId)
    .eq('sezione_id', sezioneId);
  if (error) {
    return { ok: false, messaggio: "Impossibile rimuovere l'assegnazione.", dettaglio: error.message };
  }

  revalidatePath('/admin/maestre');
  return { ok: true };
}
