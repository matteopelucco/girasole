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
import { lavoroReportNotturno } from '@/lib/cron/lavoroReportNotturno';

// Lavoro di ciascun job: lo stesso dei lanci pianificati in app/api/cron/.
const LAVORI: Record<NomeCron, (supabase: SupabaseClient, opzioni: OpzioniLavoroCron) => Promise<EsitoLavoroCron<unknown>>> = {
  'report-presenze': lavoroReportNotturno,
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
