import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ErroreCalendario,
  espandiEventiIcal,
  finestraSincronizzazione,
  validaIndirizzoIcal,
  type EventoCalendario,
  type MotivoErroreCalendario,
  type RisultatoSincronizzazione,
} from './calendarioIcal';

// Lettura del feed iCal e salvataggio degli eventi (specs/64 - calendario-eventi.md).
// Il client Supabase arriva da chi chiama: la service_role dei cron
// (app/api/cron/ e il lancio a mano dell'admin). La logica pura è in
// lib/calendarioIcal.ts.
//
// L'indirizzo del feed è un SEGRETO: qui non finisce mai in un log, in un
// messaggio d'errore o nel risultato. Gli errori sono tradotti in un motivo
// scelto da un elenco fisso (ErroreCalendario) e di quelli di rete/database
// si scarta ogni dettaglio, perché potrebbe contenere l'indirizzo.

const TEMPO_MASSIMO_RETE_MS = 8000;
const TEMPO_MASSIMO_SALVATAGGIO_MS = 20_000;
const DIMENSIONE_MASSIMA_BYTE = 5 * 1024 * 1024;

// Indirizzo salvato dall'admin, con la service_role (il cron). Mai loggato.
// grant-check: service_role
async function leggiIndirizzo(supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase.from('impostazioni_calendario').select('ical_url').maybeSingle();
  if (error) throw new ErroreCalendario('impostazione_non_leggibile');
  const valore = (data as { ical_url: string | null } | null)?.ical_url;
  return valore ? valore : null;
}

// Un solo tentativo, tempo massimo breve (vale anche per la lettura del
// corpo), nessun redirect, nessuna cache, dimensione limitata.
async function scaricaFeed(indirizzo: string): Promise<string> {
  const segnale = AbortSignal.timeout(TEMPO_MASSIMO_RETE_MS);
  let risposta: Response;
  try {
    risposta = await fetch(indirizzo, {
      signal: segnale,
      redirect: 'error',
      cache: 'no-store',
      headers: { Accept: 'text/calendar, text/plain;q=0.5' },
    });
  } catch {
    throw new ErroreCalendario('non_raggiungibile');
  }
  if (!risposta.ok || !risposta.body) throw new ErroreCalendario('risposta_non_valida');

  const lunghezzaDichiarata = Number(risposta.headers.get('content-length') ?? 0);
  if (lunghezzaDichiarata > DIMENSIONE_MASSIMA_BYTE) throw new ErroreCalendario('risposta_non_valida');

  const lettore = risposta.body.getReader();
  const pezzi: Uint8Array[] = [];
  let totale = 0;
  try {
    for (;;) {
      const { done, value } = await lettore.read();
      if (done) break;
      totale += value.byteLength;
      if (totale > DIMENSIONE_MASSIMA_BYTE) {
        await lettore.cancel().catch(() => undefined);
        throw new ErroreCalendario('risposta_non_valida');
      }
      pezzi.push(value);
    }
  } catch (errore) {
    if (errore instanceof ErroreCalendario) throw errore;
    throw new ErroreCalendario('non_raggiungibile');
  }
  return new TextDecoder('utf-8').decode(Buffer.concat(pezzi));
}

function numero(valore: unknown): number {
  return typeof valore === 'number' && Number.isFinite(valore) ? valore : 0;
}

// Sostituzione atomica degli eventi (migration 0065): una funzione del database
// che in una sola transazione inserisce/aggiorna e rimuove. Solo service_role.
async function salvaEventi(
  supabase: SupabaseClient,
  eventi: EventoCalendario[]
): Promise<{ inseriti: number; aggiornati: number; rimossi: number; totale: number }> {
  const { data, error } = await supabase
    .rpc('sostituisci_eventi_calendario', { p_eventi: eventi })
    .abortSignal(AbortSignal.timeout(TEMPO_MASSIMO_SALVATAGGIO_MS));
  if (error || !data || typeof data !== 'object') throw new ErroreCalendario('salvataggio');
  const risultato = data as Record<string, unknown>;
  return {
    inseriti: numero(risultato.inseriti),
    aggiornati: numero(risultato.aggiornati),
    rimossi: numero(risultato.rimossi),
    totale: numero(risultato.totale),
  };
}

// Passo di sincronizzazione del cron notturno (specs/64). Non lancia MAI: ogni
// errore diventa `{ stato: 'errore', motivo }`, così il report notturno non
// fallisce per colpa di Google. Gli ultimi eventi salvati restano (la
// sostituzione avviene solo a feed letto e valido).
export async function sincronizzaCalendario(
  supabase: SupabaseClient,
  adesso: Date = new Date()
): Promise<RisultatoSincronizzazione> {
  try {
    const salvato = await leggiIndirizzo(supabase);
    if (!salvato) return { stato: 'disattivata' };

    const indirizzo = validaIndirizzoIcal(salvato, {
      CALENDARIO_ICAL_PROVA_ORIGINE: process.env.CALENDARIO_ICAL_PROVA_ORIGINE,
      VERCEL_ENV: process.env.VERCEL_ENV,
    });
    if (!indirizzo.ok || !indirizzo.indirizzo) throw new ErroreCalendario('indirizzo_non_valido');

    const testo = await scaricaFeed(indirizzo.indirizzo);
    const { da, a } = finestraSincronizzazione(adesso);
    const eventi = espandiEventiIcal(testo, da, a);
    return { stato: 'ok', ...(await salvaEventi(supabase, eventi)) };
  } catch (errore) {
    const motivo: MotivoErroreCalendario = errore instanceof ErroreCalendario ? errore.motivo : 'imprevisto';
    // Solo il motivo: dell'errore originale non si scrive nulla (potrebbe
    // contenere l'indirizzo del feed).
    console.error(`Calendario: sincronizzazione non riuscita (${motivo})`);
    return { stato: 'errore', motivo };
  }
}
