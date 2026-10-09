import type { SupabaseClient } from '@supabase/supabase-js';
import {
  allarmiPerDipendenti,
  calcolaStatoPersonaleGiorno,
  dopoOrarioAllarmePresenzePasti,
  settimanaConfermata,
  settimanaDiRiferimentoOre,
  type StatoPersonaleGiorno,
} from '@/lib/allarmi';
import { calcolaRetteNonComunicate } from '@/lib/allarmeRette';
import { chiusuraPerData, isGiornoChiuso } from '@/lib/calendarioScolastico';
import { oggi } from '@/lib/date';
import { componiAllarmi, type Allarme } from '@/lib/elencoAllarmi';
import { sezioniAttiveVisibili } from '@/lib/sezioni';

const STATO_VUOTO: StatoPersonaleGiorno = { sezioniPresenzeIncomplete: [], pastiNonConfermati: false };

// Allarmi attivi dell'utente (specs/07 - allarmi.md): un'unica funzione
// per il numero della campanella (su ogni pagina) e per la pagina
// "Allarmi", così numero ed elenco coincidono (la condivisione per
// richiesta è in app/dashboard/allarmi/dati.ts). Restituisce null per chi non ha la
// campanella (genitore o ruolo non impostato): in quel caso non si
// calcola nulla. Solo lettura con la sessione dell'utente (RLS), nessuna
// service_role key. Fa I/O: coperta da e2e; la composizione dell'elenco
// è pura e testata in lib/elencoAllarmi.ts.
export async function calcolaAllarmiUtente(
  supabase: SupabaseClient,
  userId: string,
  profilo: { ruolo: string; abilitato_ore_lavoro: boolean } | null
): Promise<Allarme[] | null> {
  const ruolo = profilo?.ruolo ?? null;
  if (ruolo !== 'admin' && ruolo !== 'maestra' && ruolo !== 'assistente') return null;

  const adesso = new Date();
  const dataOggi = oggi();

  // Il weekend si riconosce senza interrogare il database.
  const chiusuraOggi = isGiornoChiuso(dataOggi, []) ? null : await chiusuraPerData(supabase, dataOggi);
  const giornoAttivo = !isGiornoChiuso(dataOggi, chiusuraOggi ? [chiusuraOggi] : []);

  // Per non pesare su ogni pagina, presenze e pasti si leggono solo
  // quando l'allarme può scattare (dopo le 10:00 di un giorno aperto).
  const controllaPresenzePasti = giornoAttivo && dopoOrarioAllarmePresenzePasti(adesso);
  const statoPersonale = async (): Promise<StatoPersonaleGiorno> => {
    if (!controllaPresenzePasti) return STATO_VUOTO;
    const sezioni = await sezioniAttiveVisibili(supabase, userId, ruolo);
    return calcolaStatoPersonaleGiorno(supabase, ruolo, sezioni, dataOggi);
  };

  const settimanaRiferimento = settimanaDiRiferimentoOre(adesso, dataOggi);
  const settimanaOre = async () =>
    profilo?.abilitato_ore_lavoro && !(await settimanaConfermata(supabase, userId, settimanaRiferimento.inizio))
      ? settimanaRiferimento
      : null;

  // Solo l'admin vede le rette non comunicate (e i nomi dei bambini):
  // per gli altri ruoli non si legge nulla (specs/07).
  const [statoPersonaleGiorno, settimanaOreNonConfermata, personale, retteNonComunicate] = await Promise.all([
    statoPersonale(),
    settimanaOre(),
    ruolo === 'admin' ? allarmiPerDipendenti(supabase, dataOggi, giornoAttivo, adesso, userId) : [],
    ruolo === 'admin' ? calcolaRetteNonComunicate(supabase, dataOggi) : [],
  ]);

  return componiAllarmi({
    oggi: dataOggi,
    adesso,
    giornoAttivo,
    statoPersonale: statoPersonaleGiorno,
    settimanaOreNonConfermata,
    personale,
    retteNonComunicate,
  });
}
