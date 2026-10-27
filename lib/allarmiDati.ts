import type { SupabaseClient } from '@supabase/supabase-js';
import {
  allarmiDipendentiDa,
  dopoOrarioAllarmePresenzePasti,
  leggiDatiPersonale,
  leggiPresenzeOggi,
  oreDaConfermare,
  settimanaConfermata,
  settimanaDiRiferimentoOre,
  statoPersonaleDa,
  utentiConfermaSettimanaNonRichiesta,
  type StatoPersonaleGiorno,
} from '@/lib/allarmi';
import { calcolaMesiRojacMancanti } from '@/lib/allarmeRojac';
import { calcolaRetteNonComunicate } from '@/lib/allarmeRette';
import { chiusuraPerData, isGiornoChiuso } from '@/lib/calendarioScolastico';
import { oggi } from '@/lib/date';
import type { InputElencoAllarmi } from '@/lib/elencoAllarmi';
import { sezioniAttiveVisibili } from '@/lib/sezioni';

const STATO_VUOTO: StatoPersonaleGiorno = { sezioniPresenzeIncomplete: [], pastiNonConfermati: false };

// Dati degli allarmi attivi dell'utente (specs/07 - allarmi.md): la base
// unica per il numero della campanella (su ogni pagina), per la pagina
// "Allarmi" e per i banner della dashboard, così coincidono (la
// condivisione per richiesta è in app/dashboard/allarmi/dati.ts).
// Restituisce null per chi non ha la campanella (genitore o ruolo non
// impostato): in quel caso non si calcola nulla. Solo lettura con la
// sessione dell'utente (RLS), nessuna service_role key. Fa I/O: coperta da
// e2e; le parti di calcolo sono pure e testate in lib/allarmi.ts e
// lib/elencoAllarmi.ts.
//
// Tutte le letture partono insieme (issue #367): nessuna aspetta l'altra,
// salvo le dipendenze vere dentro leggiPresenzeOggi e leggiDatiPersonale.
export async function calcolaDatiAllarmiUtente(
  supabase: SupabaseClient,
  userId: string,
  profilo: { ruolo: string; abilitato_ore_lavoro: boolean; richiedi_conferma_settimana: boolean } | null
): Promise<InputElencoAllarmi | null> {
  const ruolo = profilo?.ruolo ?? null;
  if (ruolo !== 'admin' && ruolo !== 'maestra' && ruolo !== 'assistente') return null;

  const adesso = new Date();
  const dataOggi = oggi();

  // Il weekend si riconosce senza interrogare il database.
  const weekend = isGiornoChiuso(dataOggi, []);

  // Per non pesare su ogni pagina, presenze e pasti si leggono solo
  // quando l'allarme può scattare (dopo le 10:00 di un giorno aperto).
  // Si leggono insieme alla chiusura del giorno, senza aspettarla: in un
  // giorno di chiusura (raro) la lettura va persa e il risultato si scarta.
  const presenzeOggi = async () => {
    if (weekend || !dopoOrarioAllarmePresenzePasti(adesso)) return null;
    const sezioni = await sezioniAttiveVisibili(supabase, userId, ruolo);
    return leggiPresenzeOggi(supabase, ruolo, sezioni, dataOggi);
  };

  const settimanaRiferimento = settimanaDiRiferimentoOre(adesso, dataOggi);
  const settimanaOre = async () =>
    oreDaConfermare(profilo) && !(await settimanaConfermata(supabase, userId, settimanaRiferimento.inizio))
      ? settimanaRiferimento
      : null;

  // Solo l'admin vede il riepilogo del personale, le rette non comunicate
  // (e i nomi dei bambini) e la mail mensile a Rojac non inviata: per gli
  // altri ruoli non si legge nulla (specs/07). Un errore di lettura del
  // registro Rojac non deve rompere ogni pagina (la campanella è ovunque):
  // si scrive nei log e l'allarme manca.
  const mailRojac = async (): Promise<string[]> => {
    try {
      return await calcolaMesiRojacMancanti(supabase, dataOggi);
    } catch (errore) {
      console.error('Allarme mail Rojac non calcolato:', errore instanceof Error ? errore.message : errore);
      return [];
    }
  };
  const [
    chiusuraOggi,
    presenzeLette,
    settimanaOreNonConfermata,
    datiPersonale,
    retteNonComunicate,
    mailRojacNonInviata,
    confermaSettimanaNonRichiesta,
  ] = await Promise.all([
    weekend ? null : chiusuraPerData(supabase, dataOggi),
    presenzeOggi(),
    settimanaOre(),
    ruolo === 'admin' ? leggiDatiPersonale(supabase, userId, settimanaRiferimento.inizio) : null,
    ruolo === 'admin' ? calcolaRetteNonComunicate(supabase, dataOggi) : [],
    ruolo === 'admin' ? mailRojac() : [],
    // Solo l'admin vede i controlli saltati (specs/07).
    ruolo === 'admin' ? utentiConfermaSettimanaNonRichiesta(supabase) : [],
  ]);

  const giornoAttivo = !isGiornoChiuso(dataOggi, chiusuraOggi ? [chiusuraOggi] : []);
  const presenze = giornoAttivo ? presenzeLette : null;

  return {
    oggi: dataOggi,
    adesso,
    giornoAttivo,
    statoPersonale: presenze ? statoPersonaleDa(presenze) : STATO_VUOTO,
    settimanaOreNonConfermata,
    personale: datiPersonale ? allarmiDipendentiDa(datiPersonale, presenze, settimanaRiferimento) : [],
    retteNonComunicate,
    mailRojacNonInviata,
    confermaSettimanaNonRichiesta,
  };
}
