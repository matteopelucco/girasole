'use server';

import { revalidatePath } from 'next/cache';
import { requireProfilo, assicuraScrivibile, assicuraAccessoPasti, puoScrivereData } from '@/lib/auth';
import type { EsitoAzione } from '@/components/FormConEsito';
import type { SupabaseClient } from '@supabase/supabase-js';

type StatoPasto = 'si' | 'no';

// Un bambino "assente" non può avere un pasto segnato (specs/14 -
// segna-pasto.md): controllo esplicito qui per un messaggio d'errore
// chiaro, oltre al trigger DB che è la difesa reale (vedi
// supabase/migrations/0012_pasto_senza_parziale.sql).
async function assicuraNonAssente(supabase: SupabaseClient, bambinoId: string, data: string) {
  const { data: presenza } = await supabase
    .from('presenze')
    .select('stato')
    .eq('bambino_id', bambinoId)
    .eq('data', data)
    .maybeSingle();
  if (presenza?.stato === 'assente') {
    throw new Error('Impossibile segnare il pasto: il bambino è assente in questa data.');
  }
}

async function upsertPasto(
  supabase: SupabaseClient,
  userId: string,
  bambinoId: string,
  data: string,
  mangiato: StatoPasto,
  note: string | null
) {
  const { error } = await supabase.from('pasti').upsert(
    { bambino_id: bambinoId, data, mangiato, note, inserito_da: userId },
    { onConflict: 'bambino_id,data' }
  );
  if (error) throw new Error(`Impossibile salvare il pasto: ${error.message}`);
}

export async function segnaPasto(
  bambinoId: string,
  mangiato: StatoPasto,
  sezioneId: string,
  data: string,
  formData: FormData
) {
  const { supabase, user, profilo } = await requireProfilo();
  assicuraAccessoPasti(profilo?.ruolo);
  assicuraScrivibile(profilo?.ruolo, data);
  await assicuraNonAssente(supabase, bambinoId, data);

  const note = (formData.get('nota_pasto') as string)?.trim() || null;
  await upsertPasto(supabase, user.id, bambinoId, data, mangiato, note);

  revalidatePath(`/dashboard/pasti/${sezioneId}`);
}

// Salva la nota senza richiedere di ripremere lo stato già segnato
// (specs/14 - segna-pasto.md, stesso motivo di
// app/dashboard/presenze/actions.ts:salvaNotaPresenza).
export async function salvaNotaPasto(
  bambinoId: string,
  sezioneId: string,
  data: string,
  mangiatoAttuale: StatoPasto | null,
  formData: FormData
) {
  const { supabase, user, profilo } = await requireProfilo();
  assicuraAccessoPasti(profilo?.ruolo);
  assicuraScrivibile(profilo?.ruolo, data);

  if (!mangiatoAttuale) {
    throw new Error('Segna prima uno stato pasto per poter salvare una nota.');
  }
  await assicuraNonAssente(supabase, bambinoId, data);

  const note = (formData.get('nota_pasto') as string)?.trim() || null;
  await upsertPasto(supabase, user.id, bambinoId, data, mangiatoAttuale, note);

  revalidatePath(`/dashboard/pasti/${sezioneId}`);
}

// Comunica a Rojac i pasti di una classe per una data (specs/16 -
// comunicazione-pasti-rojac.md): registra un log immutabile (numero di
// pasti "sì" in quel momento, chi ha comunicato) che da quel momento
// blocca la modifica dei pasti per la maestra (non per l'admin, vedi
// il trigger pasti_blocca_se_comunicato in
// supabase/migrations/0019_pasti_comunicati_rojac.sql, che è la difesa
// reale). Segue la firma di useFormState (FormConEsito/ConfermaAzione),
// a differenza di segnaPasto/salvaNotaPasto sopra che non hanno bisogno
// del feedback avviato/riuscito/fallita di specs/05.
export async function comunicaPastiRojac(_stato: EsitoAzione, formData: FormData): Promise<EsitoAzione> {
  const { supabase, user, profilo } = await requireProfilo();
  assicuraAccessoPasti(profilo?.ruolo);

  const sezioneId = formData.get('sezione_id') as string;
  const data = formData.get('data') as string;
  if (!sezioneId || !data) return { ok: false, messaggio: 'Dati non validi.' };

  if (!puoScrivereData(profilo?.ruolo, data)) {
    return { ok: false, messaggio: 'Le maestre possono comunicare solo i pasti della giornata odierna.' };
  }

  const { data: bambiniSezione } = await supabase
    .from('bambini')
    .select('id')
    .eq('sezione_id', sezioneId)
    .eq('attiva', true);
  const idBambini = (bambiniSezione ?? []).map((b) => b.id);

  let numeroPasti = 0;
  if (idBambini.length) {
    const { count } = await supabase
      .from('pasti')
      .select('id', { count: 'exact', head: true })
      .eq('data', data)
      .eq('mangiato', 'si')
      .in('bambino_id', idBambini);
    numeroPasti = count ?? 0;
  }

  const comunicatoDaNome = `${profilo?.nome ?? ''} ${profilo?.cognome ?? ''}`.trim() || user.email || 'Sconosciuto';

  const { error } = await supabase.from('pasti_comunicati').insert({
    sezione_id: sezioneId,
    data,
    numero_pasti: numeroPasti,
    comunicato_da: user.id,
    comunicato_da_nome: comunicatoDaNome,
  });
  if (error) {
    if (error.code === '23505') {
      return {
        ok: false,
        messaggio: 'I pasti di questa classe per questa data sono già stati comunicati a Rojac.',
      };
    }
    return { ok: false, messaggio: 'Impossibile comunicare i pasti a Rojac.', dettaglio: error.message };
  }

  revalidatePath(`/dashboard/pasti/${sezioneId}`);
  return { ok: true };
}
