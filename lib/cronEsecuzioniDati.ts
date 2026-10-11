import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CRON_JOB,
  inizioFinestraInCorso,
  messaggioErroreSicuro,
  type LimitiCron,
  type NomeCron,
  type RigaCronEsecuzione,
} from './cronEsecuzioni';

// Lettura e scrittura del registro dei lanci dei job pianificati
// (`cron_esecuzioni`, specs/63 - cron-job.md). Il client arriva da chi
// chiama: la service_role per la scrittura (i cron in app/api/cron/ e il
// lancio a mano dell'admin in app/admin/cron-job/actions.ts), la sessione
// dell'admin (RLS) per la lettura. La logica pura è in lib/cronEsecuzioni.ts.

const COLONNE = 'id, nome, iniziato_il, finito_il, esito, messaggio_errore, estemporaneo';

// Tempo massimo di ogni scrittura nel registro: oltre, si rinuncia.
const TEMPO_MASSIMO_REGISTRO_MS = 3000;

// Esito del lavoro di un cron: i dati della risposta (la route li restituisce
// in JSON così come sono) e, se una parte non è riuscita senza sollevare
// errori, una frase fissa che la descrive (il lancio risulta KO).
export type EsitoLavoroCron<T> = { dati: T; problema?: string | null };

// `estemporaneo`: lancio a mano dell'admin (specs/63, "Lancio a mano"). Il
// lavoro non legge né scrive i registri che evitano i doppi invii dei lanci
// pianificati, e la riga del registro ha `estemporaneo = true`.
export type OpzioniLavoroCron = { estemporaneo: boolean };

type FineLancio = Pick<RigaCronEsecuzione, 'esito' | 'messaggio_errore'>;

// Una scrittura nel registro non solleva mai errori: un problema finisce nei
// log (solo il codice, nessun dettaglio) e il cron prosegue.
async function scriviNelRegistro(
  descrizione: string,
  scrittura: (segnale: AbortSignal) => PromiseLike<{ error: { code?: string } | null }>
): Promise<void> {
  try {
    const { error } = await scrittura(AbortSignal.timeout(TEMPO_MASSIMO_REGISTRO_MS));
    if (error) console.error(`Registro cron: ${descrizione} non registrato (${error.code ?? 'errore'})`);
  } catch {
    console.error(`Registro cron: ${descrizione} non registrato (timeout o rete)`);
  }
}

// Esegue il lavoro di un cron registrandone inizio e fine (specs/63, Regole):
//   * la scrittura dell'inizio parte insieme al lavoro, non lo precede, quindi
//     non lo ritarda; il lavoro non la aspetta;
//   * la fine si scrive dopo il lavoro con un upsert sullo stesso id: completa
//     la riga dell'inizio, o la crea intera se l'inizio non era stato scritto;
//   * un errore del lavoro viene registrato (messaggio ripulito) e poi
//     rilanciato così com'è: il cron risponde come prima;
//   * un errore del registro non arriva mai al lavoro (scriviNelRegistro).
// Il registro è una tabella a sé: non tocca `allarmi_inviati` né le tabelle
// dei report inviati, quindi non cambia l'idempotenza delle email.
// I lanci pianificati non scrivono la colonna `estemporaneo` (resta il default
// false): funzionano anche prima della migration 0064.
// grant-check: service_role
export async function eseguiConRegistro<T>(
  supabase: SupabaseClient,
  nome: NomeCron,
  lavoro: () => Promise<EsitoLavoroCron<T>>,
  { estemporaneo }: OpzioniLavoroCron = { estemporaneo: false }
): Promise<EsitoLavoroCron<T>> {
  const id = crypto.randomUUID();
  const iniziatoIl = new Date().toISOString();
  const riga = { id, nome, iniziato_il: iniziatoIl, ...(estemporaneo ? { estemporaneo: true } : {}) };
  const inizio = scriviNelRegistro(`inizio di ${nome}`, (segnale) =>
    supabase.from('cron_esecuzioni').insert(riga).abortSignal(segnale)
  );

  const scriviFine = async (fine: FineLancio) => {
    await inizio;
    await scriviNelRegistro(`fine di ${nome}`, (segnale) =>
      supabase
        .from('cron_esecuzioni')
        .upsert({ ...riga, finito_il: new Date().toISOString(), ...fine })
        .abortSignal(segnale)
    );
  };

  let esito: EsitoLavoroCron<T>;
  try {
    esito = await lavoro();
  } catch (errore) {
    await scriviFine({ esito: 'ko', messaggio_errore: messaggioErroreSicuro(errore) });
    throw errore;
  }
  await scriviFine(esito.problema ? { esito: 'ko', messaggio_errore: esito.problema } : { esito: 'ok', messaggio_errore: null });
  return esito;
}

// Ultimi lanci di ogni job, con la sessione dell'admin (la RLS lascia leggere
// solo a lui): per ogni job il suo limite + 1, così chi raggruppa sa se ce ne
// sono altri (lib/cronEsecuzioni.ts, gruppiCron).
// grant-check: authenticated
export async function leggiLanciCron(
  supabase: SupabaseClient,
  limiti: LimitiCron
): Promise<{ righe: RigaCronEsecuzione[]; errore: boolean }> {
  const risultati = await Promise.all(
    CRON_JOB.map(({ nome }) =>
      supabase
        .from('cron_esecuzioni')
        .select(COLONNE)
        .eq('nome', nome)
        .order('iniziato_il', { ascending: false })
        .limit(limiti[nome] + 1)
    )
  );
  const errore = risultati.some((r) => r.error);
  if (errore) console.error('Cron Job: lettura del registro non riuscita');
  return { righe: risultati.flatMap((r) => (r.data ?? []) as RigaCronEsecuzione[]), errore };
}

// Lanci del job senza esito partiti negli ultimi 15 minuti, con la sessione
// dell'admin: servono a rifiutare un lancio a mano mentre un altro è in corso
// (lib/cronEsecuzioni.ts, lancioInCorso). `errore` vero = registro non
// leggibile: chi chiama non lancia (prudenza).
// grant-check: authenticated
export async function leggiLanciSenzaEsito(
  supabase: SupabaseClient,
  nome: NomeCron,
  adesso: Date
): Promise<{ righe: RigaCronEsecuzione[]; errore: boolean }> {
  const { data, error } = await supabase
    .from('cron_esecuzioni')
    .select(COLONNE)
    .eq('nome', nome)
    .is('esito', null)
    .gte('iniziato_il', inizioFinestraInCorso(adesso));
  if (error) console.error('Cron Job: controllo dei lanci in corso non riuscito');
  return { righe: (data ?? []) as RigaCronEsecuzione[], errore: Boolean(error) };
}
