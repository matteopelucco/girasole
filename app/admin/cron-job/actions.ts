'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  eseguiConRegistro,
  leggiLanciSenzaEsito,
  type EsitoLavoroCron,
  type OpzioniLavoroCron,
} from '@/lib/cronEsecuzioniDati';
import {
  MESSAGGIO_GIA_IN_CORSO,
  MESSAGGIO_JOB_SCONOSCIUTO,
  MESSAGGIO_REGISTRO_NON_LEGGIBILE,
  PERCORSO_CRON_JOB,
  esitoLancioFallito,
  esitoLancioManuale,
  lancioInCorso,
  nomeCronValido,
  type EsitoLancioManuale,
  type NomeCron,
} from '@/lib/cronEsecuzioni';
import { lavoroRiepilogoAllarmi } from '@/lib/cron/lavoroAllarmi';
import { lavoroNotturno } from '@/lib/cron/lavoroNotturno';
import { sincronizzaCalendario } from '@/lib/calendarioIcalDati';
import {
  MESSAGGIO_GIA_IN_CORSO as MESSAGGIO_SINCRONIZZAZIONE_GIA_IN_CORSO,
  esitoSincronizzazioneManuale,
  sincronizzazioneInCorso,
  type EsitoSincronizzazioneManuale,
} from '@/lib/sincronizzazioneManuale';

// Lavoro di ciascun job: lo stesso dei lanci pianificati in app/api/cron/.
const LAVORI: Record<NomeCron, (supabase: SupabaseClient, opzioni: OpzioniLavoroCron) => Promise<EsitoLavoroCron<unknown>>> = {
  'report-presenze': lavoroNotturno,
  allarmi: lavoroRiepilogoAllarmi,
};

// Lancio a mano ("estemporaneo") di un job dalla pagina Cron Job (specs/63,
// "Lancio a mano"; issue #302). Ordine dei controlli, tutti sul server:
//   1. requireAdmin(): chi non è admin viene rimandato alla dashboard, prima
//      di qualunque lettura o scrittura;
//   2. il nome del job arriva dal browser: solo quelli dell'elenco;
//   3. un solo lancio alla volta per job: se il registro (letto con la
//      sessione dell'admin) ha un lancio ancora in corso, o non si riesce a
//      leggere, il lancio è rifiutato;
//   4. solo allora il lavoro, con la service_role.
// Nessun secret coinvolto: non si chiama la route /api/cron/*, quindi
// CRON_SECRET resta solo sul server e solo in quelle route. Il lavoro non
// legge né scrive i registri dei doppi invii (allarmi_inviati,
// report_*_inviati): il lancio pianificato successivo parte comunque. Il
// messaggio d'errore restituito e scritto nei log è già ripulito
// (messaggioErroreSicuro). Durata massima: `maxDuration` della pagina.
export async function lanciaCronAMano(
  _statoPrecedente: EsitoLancioManuale | null,
  formData: FormData
): Promise<EsitoLancioManuale> {
  const { supabase } = await requireAdmin();

  const nome = formData.get('nome');
  if (!nomeCronValido(nome)) return { stato: 'rifiutato', messaggio: MESSAGGIO_JOB_SCONOSCIUTO };

  const adesso = new Date();
  const { righe, errore } = await leggiLanciSenzaEsito(supabase, nome, adesso);
  if (errore) return { stato: 'rifiutato', messaggio: MESSAGGIO_REGISTRO_NON_LEGGIBILE };
  if (lancioInCorso(righe, nome, adesso)) return { stato: 'rifiutato', messaggio: MESSAGGIO_GIA_IN_CORSO };

  // service_role (ADR-0002, FILE_AMMESSI in lib/serviceRoleCheck.ts): il
  // lavoro del job copre tutto l'asilo (tutte le sezioni, tutto il personale)
  // e scrive il registro `cron_esecuzioni`, che nessun utente può scrivere con
  // la propria sessione. Usata solo dopo i controlli qui sopra.
  const admin = createAdminClient();
  const opzioni: OpzioniLavoroCron = { estemporaneo: true };
  let esito: EsitoLancioManuale;
  try {
    const { problema } = await eseguiConRegistro(admin, nome, () => LAVORI[nome](admin, opzioni), opzioni);
    esito = esitoLancioManuale(problema);
  } catch (erroreLavoro) {
    esito = esitoLancioFallito(erroreLavoro);
  }
  if (esito.stato === 'KO') console.error(`Cron Job: lancio a mano di ${nome} finito KO: ${esito.messaggio}`);

  revalidatePath(PERCORSO_CRON_JOB);
  return esito;
}

// Istante (ms) di inizio della sincronizzazione a mano in corso su questa
// istanza del server, null se non ce n'è: serve a non lanciarne due insieme.
let sincronizzazioneAMano: number | null = null;

// Sincronizzazione a mano del Google Calendar dalla scheda "Azioni" (specs/64,
// "Sincronizzazione a mano"; issue #326). Il browser non manda nulla (lo stato
// precedente di useActionState è ignorato). Ordine, tutto sul server:
//   1. requireAdmin() prima di qualunque altra cosa: chi non è admin viene
//      rimandato alla dashboard, senza leggere né scrivere nulla;
//   2. un solo lancio alla volta (guardia in memoria, decade dopo 60 secondi);
//   3. solo allora la service_role (ADR-0002, FILE_AMMESSI): serve per leggere
//      l'indirizzo segreto del feed e per la funzione che sostituisce gli
//      eventi, eseguibile solo dalla service_role. Stessa funzione del cron
//      (sincronizzaCalendario): non lancia mai e non mette l'indirizzo in
//      nessun errore.
// L'esito restituito è ricostruito da esitoSincronizzazioneManuale: stato, una
// frase fissa e tre numeri. Non invia email, non tocca il report notturno e non
// scrive nel registro "Cron Job".
export async function sincronizzaCalendarioAMano(
  _statoPrecedente: EsitoSincronizzazioneManuale | null
): Promise<EsitoSincronizzazioneManuale> {
  await requireAdmin();

  const adesso = Date.now();
  if (sincronizzazioneInCorso(sincronizzazioneAMano, adesso)) {
    return { stato: 'ERRORE', messaggio: MESSAGGIO_SINCRONIZZAZIONE_GIA_IN_CORSO };
  }
  sincronizzazioneAMano = adesso;
  try {
    const admin = createAdminClient();
    return esitoSincronizzazioneManuale(await sincronizzaCalendario(admin));
  } catch {
    // sincronizzaCalendario non lancia; qui può fallire solo la creazione del
    // client (variabili d'ambiente): niente dettagli nell'esito né nei log.
    return esitoSincronizzazioneManuale({ stato: 'errore', motivo: 'imprevisto' });
  } finally {
    sincronizzazioneAMano = null;
  }
}
