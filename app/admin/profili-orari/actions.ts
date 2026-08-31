'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import type { EsitoAzione } from '@/components/FormConEsito';

// Campi condivisi da creazione e modifica di un profilo orario
// (specs/54 - profili-orari.md). Numeri non validi (vuoto, negativo,
// non numerico) diventano 0 — coerente con "ore non previste quel
// giorno", non un errore da segnalare.
function campiProfiloOrario(formData: FormData) {
  const ore = (nome: string) => {
    const valore = Number(formData.get(nome));
    return Number.isFinite(valore) && valore >= 0 ? valore : 0;
  };

  return {
    nome: ((formData.get('nome') as string) || '').trim(),
    oreLunedi: ore('ore_lunedi'),
    oreMartedi: ore('ore_martedi'),
    oreMercoledi: ore('ore_mercoledi'),
    oreGiovedi: ore('ore_giovedi'),
    oreVenerdi: ore('ore_venerdi'),
  };
}

export async function creaProfiloOrario(_stato: EsitoAzione, formData: FormData): Promise<EsitoAzione> {
  const { supabase } = await requireAdmin();
  const { nome, oreLunedi, oreMartedi, oreMercoledi, oreGiovedi, oreVenerdi } = campiProfiloOrario(formData);

  if (!nome) {
    return { ok: false, messaggio: 'Inserisci un nome per il profilo orario.' };
  }

  const { error } = await supabase.from('profili_orari').insert({
    nome,
    ore_lunedi: oreLunedi,
    ore_martedi: oreMartedi,
    ore_mercoledi: oreMercoledi,
    ore_giovedi: oreGiovedi,
    ore_venerdi: oreVenerdi,
  });
  if (error) {
    return { ok: false, messaggio: 'Impossibile creare il profilo orario.', dettaglio: error.message };
  }

  revalidatePath('/admin/profili-orari');
  revalidatePath('/admin/maestre');
  return { ok: true };
}

// specs/54 - profili-orari.md, scenario "modificare un profilo orario".
export async function aggiornaProfiloOrario(_stato: EsitoAzione, formData: FormData): Promise<EsitoAzione> {
  const { supabase } = await requireAdmin();
  const profiloId = formData.get('profilo_id') as string;
  const { nome, oreLunedi, oreMartedi, oreMercoledi, oreGiovedi, oreVenerdi } = campiProfiloOrario(formData);

  if (!profiloId || !nome) {
    return { ok: false, messaggio: 'Inserisci un nome per il profilo orario.' };
  }

  const { error } = await supabase
    .from('profili_orari')
    .update({
      nome,
      ore_lunedi: oreLunedi,
      ore_martedi: oreMartedi,
      ore_mercoledi: oreMercoledi,
      ore_giovedi: oreGiovedi,
      ore_venerdi: oreVenerdi,
    })
    .eq('id', profiloId);
  if (error) {
    return { ok: false, messaggio: 'Impossibile aggiornare il profilo orario.', dettaglio: error.message };
  }

  revalidatePath(`/admin/profili-orari/${profiloId}`);
  revalidatePath('/admin/profili-orari');
  return { ok: true };
}

// specs/54 - profili-orari.md, scenario "eliminare un profilo orario":
// gli utenti a cui era assegnato restano semplicemente senza profilo
// (on delete set null sulla colonna profili.profilo_orario_id, vedi
// supabase/migrations/0024_profili_orari.sql) — nessun controllo di
// "profilo in uso" da fare qui.
export async function eliminaProfiloOrario(_stato: EsitoAzione, formData: FormData): Promise<EsitoAzione> {
  const { supabase } = await requireAdmin();
  const profiloId = formData.get('profilo_id') as string;
  if (!profiloId) return { ok: false, messaggio: 'Profilo orario non valido.' };

  const { error } = await supabase.from('profili_orari').delete().eq('id', profiloId);
  if (error) {
    return { ok: false, messaggio: 'Impossibile eliminare il profilo orario.', dettaglio: error.message };
  }

  revalidatePath('/admin/profili-orari');
  revalidatePath('/admin/maestre');
  redirect('/admin/profili-orari');
}
