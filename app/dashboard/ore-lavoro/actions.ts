'use server';

import { revalidatePath } from 'next/cache';
import { requireStaff, assicuraAccessoOreLavoro } from '@/lib/auth';
import { oggi, giorniSettimana } from '@/lib/date';
import { validaGiornoOreLavoro, oreOrdinariePreviste, settimanaOreLavoroRichiesta } from '@/lib/oreLavoro';
import { recuperaProfiloOrario } from '@/lib/profiliOrari';
import type { EsitoAzione } from '@/components/FormConEsito';

// Il personale può modificare/confermare qualunque settimana passata,
// oltre a quella corrente (specs/18) — ma mai una settimana futura:
// riusa la stessa risoluzione della pagina (settimanaOreLavoroRichiesta)
// per validare il campo nascosto settimana_inizio inviato dal form,
// invece di duplicare lo stesso controllo qui.
function settimanaValidaPerScrittura(formData: FormData): string | null {
  const richiesta = (formData.get('settimana_inizio') as string) || '';
  const risolta = settimanaOreLavoroRichiesta(richiesta, oggi());
  return risolta === richiesta ? richiesta : null;
}

// Salva le ore/lo stato di ogni giorno della settimana indicata
// (specs/18: quella corrente o una passata, mai una futura) — valida
// PRIMA tutti i giorni inviati (funzione pura, nessun I/O) e scrive
// solo se sono tutti validi: nessun salvataggio parziale su un errore
// (specs/05 - feedback.md).
export async function salvaSettimanaOreLavoro(_stato: EsitoAzione, formData: FormData): Promise<EsitoAzione> {
  const { supabase, user, profilo } = await requireStaff({});
  assicuraAccessoOreLavoro(profilo?.abilitato_ore_lavoro);

  const settimanaInizio = settimanaValidaPerScrittura(formData);
  if (!settimanaInizio) {
    return { ok: false, messaggio: 'Non puoi modificare una settimana futura.' };
  }

  const giorni = giorniSettimana(settimanaInizio);

  const daScrivere = [];
  for (const data of giorni) {
    const esito = validaGiornoOreLavoro({
      data,
      stato: (formData.get(`stato_${data}`) as string) || 'lavorativo',
      oreOrdinarie: Number(formData.get(`ore_ordinarie_${data}`)) || 0,
      oreStraordinarie: Number(formData.get(`ore_straordinarie_${data}`)) || 0,
      motivoStraordinario: (formData.get(`motivo_straordinario_${data}`) as string) || '',
      codiceMalattia: (formData.get(`codice_malattia_${data}`) as string) || '',
      notaAssenza: (formData.get(`nota_assenza_${data}`) as string) || '',
    });
    if (!esito.ok) {
      return { ok: false, messaggio: esito.errore };
    }
    daScrivere.push(esito.giorno);
  }

  if (!daScrivere.length) {
    return { ok: true };
  }

  const { error } = await supabase.from('ore_lavoro_giorni').upsert(
    daScrivere.map((g) => ({
      utente_id: user.id,
      data: g.data,
      stato: g.stato,
      ore_ordinarie: g.oreOrdinarie,
      ore_straordinarie: g.oreStraordinarie,
      motivo_straordinario: g.motivoStraordinario,
      codice_malattia: g.codiceMalattia,
      nota_assenza: g.notaAssenza,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: 'utente_id,data' }
  );
  if (error) {
    return { ok: false, messaggio: 'Impossibile salvare le ore della settimana.', dettaglio: error.message };
  }

  revalidatePath('/dashboard/ore-lavoro');
  return { ok: true };
}

// Conferma la settimana indicata (specs/18: quella corrente o una
// passata, mai una futura): prima completa con i valori precaricati dal
// profilo orario ogni giorno non ancora salvato esplicitamente
// (scenario "confermare la settimana"), poi registra la conferma vera e
// propria — l'esistenza della riga in ore_lavoro_settimane È la
// conferma (stesso pattern di report_giornalieri_inviati, specs/52).
export async function confermaSettimanaOreLavoro(_stato: EsitoAzione, formData: FormData): Promise<EsitoAzione> {
  const { supabase, user, profilo } = await requireStaff({});
  assicuraAccessoOreLavoro(profilo?.abilitato_ore_lavoro);

  const settimanaInizio = settimanaValidaPerScrittura(formData);
  if (!settimanaInizio) {
    return { ok: false, messaggio: 'Non puoi confermare una settimana futura.' };
  }

  const giorni = giorniSettimana(settimanaInizio);

  const { data: esistenti } = await supabase
    .from('ore_lavoro_giorni')
    .select('data')
    .eq('utente_id', user.id)
    .in('data', giorni);
  const dateEsistenti = new Set((esistenti ?? []).map((r) => r.data));

  const profiloOrario = await recuperaProfiloOrario(supabase, profilo?.profilo_orario_id);

  const daCompletare = giorni
    .filter((data) => !dateEsistenti.has(data))
    .map((data) => ({
      utente_id: user.id,
      data,
      stato: 'lavorativo',
      ore_ordinarie: oreOrdinariePreviste(profiloOrario, data),
      ore_straordinarie: 0,
    }));

  if (daCompletare.length) {
    const { error: erroreCompletamento } = await supabase.from('ore_lavoro_giorni').insert(daCompletare);
    if (erroreCompletamento) {
      return {
        ok: false,
        messaggio: 'Impossibile completare i giorni mancanti prima della conferma.',
        dettaglio: erroreCompletamento.message,
      };
    }
  }

  const { error } = await supabase
    .from('ore_lavoro_settimane')
    .insert({ utente_id: user.id, settimana_inizio: settimanaInizio });
  if (error) {
    if (error.code === '23505') {
      return { ok: false, messaggio: 'Questa settimana risulta già confermata.' };
    }
    return { ok: false, messaggio: 'Impossibile confermare la settimana.', dettaglio: error.message };
  }

  revalidatePath('/dashboard/ore-lavoro');
  return { ok: true };
}
