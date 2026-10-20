import type { SupabaseClient } from '@supabase/supabase-js';
import { chiusurePerPeriodo, type GiornoChiusura } from './calendarioScolastico';
import { giorniAperturaMese } from './comunicazioneRetta';
import { formattaMeseItaliano, mesePrecedente, meseDaData, meseSuccessivo, primoGiornoMese, ultimoGiornoMese } from './date';

// Allarme "mail mensile a Rojac non inviata" (specs/07 - allarmi.md,
// specs/61): dal primo giorno del mese dopo, se per un mese concluso non
// c'è nessuna riga nel registro degli invii (`invii_rojac`), l'admin viene
// avvisato (pagina Allarmi, campanella, banner in dashboard, email di
// riepilogo del cron). Le funzioni pure ricevono sempre la data
// dall'esterno (niente `new Date()` qui dentro), per restare testabili.

// Primo mese da controllare ("YYYY-MM"): il mese del rilascio della
// funzione. I mesi precedenti non si considerano mai. Fisso: si cambia qui.
export const MESE_PARTENZA_ROJAC = '2026-10';

// Identificativo dell'allarme: la dashboard lo cerca nell'elenco invece di
// ricalcolarlo (specs/07).
export const ID_ALLARME_ROJAC = 'rojac-non-inviata';

// Valore di `allarmi_inviati.tipo` per l'email di questo allarme (chiave =
// mese "YYYY-MM"): già ammesso dal vincolo CHECK dalla migration 0062.
export const TIPO_ALLARME_ROJAC = 'rojac_non_inviata';

// Mesi conclusi da controllare alla data `oggi` ("YYYY-MM-DD", fuso
// Europe/Rome): dal mese di partenza (incluso) al mese precedente a quello
// di `oggi`. Il mese corrente non c'è mai: un mese diventa mancante dal
// primo giorno del mese successivo. Vuoto se la partenza non è ancora
// finita. Dal più vecchio al più recente.
export function mesiRojacDaControllare(oggi: string, mesePartenza: string = MESE_PARTENZA_ROJAC): string[] {
  const ultimo = mesePrecedente(meseDaData(oggi));
  const mesi: string[] = [];
  for (let mese = mesePartenza; mese <= ultimo; mese = meseSuccessivo(mese)) mesi.push(mese);
  return mesi;
}

// Un mese "conta" se ha almeno un pasto comunicato oppure almeno un giorno
// di scuola aperto (weekend e chiusure registrate esclusi, specs/53).
export function meseRojacConta(parametri: {
  haPastiComunicati: boolean;
  mese: string;
  chiusure: GiornoChiusura[];
}): boolean {
  return parametri.haPastiComunicati || giorniAperturaMese(parametri.mese, parametri.chiusure) > 0;
}

// I mesi senza invio registrato, tra quelli da controllare, che contano.
// Dal più vecchio al più recente. Più invii dello stesso mese non cambiano
// nulla: basta una riga.
export function mesiRojacMancanti(parametri: {
  mesiDaControllare: string[];
  mesiInviati: Iterable<string>;
  mesiConPastiComunicati: Iterable<string>;
  chiusure: GiornoChiusura[];
}): string[] {
  const inviati = new Set(parametri.mesiInviati);
  const conPasti = new Set(parametri.mesiConPastiComunicati);
  return parametri.mesiDaControllare.filter(
    (mese) =>
      !inviati.has(mese) &&
      meseRojacConta({ haPastiComunicati: conPasti.has(mese), mese, chiusure: parametri.chiusure })
  );
}

// I mesi mancanti per cui l'email non è ancora partita (specs/07: una sola
// email per mese mancante). `mesiGiaAvvisati` sono le chiavi già presenti in
// `allarmi_inviati` con tipo `rojac_non_inviata`.
export function mesiRojacDaAvvisare(mancanti: string[], mesiGiaAvvisati: Iterable<string>): string[] {
  const avvisati = new Set(mesiGiaAvvisati);
  return mancanti.filter((mese) => !avvisati.has(mese));
}

// Dove l'admin invia la mail di quel mese: Report mensile del mese.
export function hrefReportRojac(mese: string): string {
  return `/dashboard/report?tipo=mensile&periodo=${mese}`;
}

// "ottobre 2026": come si legge nell'allarme e nell'email. Testo semplice.
export function descrizioneMeseRojac(mese: string): string {
  return formattaMeseItaliano(mese);
}

// Fa I/O, coperta solo da e2e (vedi CLAUDE.md, criterio unit test). Legge
// con la sessione dell'admin (pagina Allarmi, campanella: RLS admin-only su
// `invii_rojac`) o con la service_role key del cron (migration 0066: solo
// SELECT). Non legge nulla dal database se non c'è nessun mese da
// controllare. Se la lettura del registro fallisce lancia un errore: un
// elenco vuoto nasconderebbe l'allarme, uno pieno lo darebbe falso.
export async function calcolaMesiRojacMancanti(supabase: SupabaseClient, oggi: string): Promise<string[]> {
  const mesiDaControllare = mesiRojacDaControllare(oggi);
  if (mesiDaControllare.length === 0) return [];

  const inizio = primoGiornoMese(mesiDaControllare[0]);
  const fine = ultimoGiornoMese(mesiDaControllare[mesiDaControllare.length - 1]);

  const [invii, pasti, chiusure] = await Promise.all([
    supabase.from('invii_rojac').select('mese').in('mese', mesiDaControllare),
    supabase.from('pasti_comunicati').select('data').gte('data', inizio).lte('data', fine),
    chiusurePerPeriodo(supabase, inizio, fine),
  ]);
  if (invii.error) throw new Error(`lettura registro invii Rojac: ${invii.error.message}`);
  if (pasti.error) throw new Error(`lettura pasti comunicati: ${pasti.error.message}`);

  return mesiRojacMancanti({
    mesiDaControllare,
    mesiInviati: (invii.data ?? []).map((r) => r.mese as string),
    mesiConPastiComunicati: (pasti.data ?? []).map((r) => meseDaData(r.data as string)),
    chiusure,
  });
}
