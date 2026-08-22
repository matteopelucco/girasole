'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { passwordAbbastanzaComplessa } from '@/lib/password';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { EsitoAzione } from '@/components/FormConEsito';

const RUOLI_VALIDI = ['admin', 'maestra', 'genitore'] as const;

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

  return { supabase, user };
}

export async function creaUtente(formData: FormData) {
  const { supabase } = await requireAdmin();

  const email = ((formData.get('email') as string) || '').trim().toLowerCase();
  const password = (formData.get('password') as string) || '';
  const nome = ((formData.get('nome') as string) || '').trim();
  const cognome = ((formData.get('cognome') as string) || '').trim();
  const telefono = ((formData.get('telefono') as string) || '').trim();
  const ruolo = formData.get('ruolo') as string;
  const indirizzoResidenza = ((formData.get('indirizzo_residenza') as string) || '').trim();
  const note = ((formData.get('note') as string) || '').trim();

  if (
    !email ||
    !nome ||
    !cognome ||
    !telefono ||
    !RUOLI_VALIDI.includes(ruolo as (typeof RUOLI_VALIDI)[number])
  ) {
    redirect('/admin/maestre?errore=campi-mancanti');
  }
  if (!passwordAbbastanzaComplessa(password)) {
    redirect('/admin/maestre?errore=password-debole');
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
      redirect('/admin/maestre?errore=email-duplicata');
    }
    // Errore non atteso (permessi, rete, ...): il dettaglio tecnico
    // resta utile per il troubleshooting, vedi specs/05 - feedback.md.
    redirect(`/admin/maestre?errore=creazione-fallita&dettaglio=${encodeURIComponent(error.message)}`);
  }

  if (indirizzoResidenza || note) {
    await supabase
      .from('profili')
      .update({ indirizzo_residenza: indirizzoResidenza, note })
      .eq('id', data.user!.id);
  }

  revalidatePath('/admin/maestre');
  redirect('/admin/maestre?ok=utente-creato');
}

export async function aggiornaUtente(
  _stato: EsitoAzione,
  formData: FormData
): Promise<EsitoAzione> {
  const { supabase } = await requireAdmin();
  const profiloId = formData.get('profilo_id') as string;
  const nome = ((formData.get('nome') as string) || '').trim();
  const cognome = ((formData.get('cognome') as string) || '').trim();
  const telefono = ((formData.get('telefono') as string) || '').trim();
  const ruolo = formData.get('ruolo') as string;
  const indirizzoResidenza = ((formData.get('indirizzo_residenza') as string) || '').trim();
  const note = ((formData.get('note') as string) || '').trim();

  if (!profiloId || !RUOLI_VALIDI.includes(ruolo as (typeof RUOLI_VALIDI)[number])) {
    return { ok: false, messaggio: 'Dati utente non validi.' };
  }

  const { error } = await supabase
    .from('profili')
    .update({ nome, cognome, telefono, ruolo, indirizzo_residenza: indirizzoResidenza, note })
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
