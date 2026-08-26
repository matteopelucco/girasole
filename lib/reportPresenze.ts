import { createAdminClient } from '@/lib/supabase/admin';
import { formattaDataItaliana } from '@/lib/date';
import { aggregaConteggiPresenzePasti, type RigaReportBambino } from '@/lib/report';
import { inconsistenzeGiorno, type StatoPasto, type StatoPresenza } from '@/lib/consistenza';
import type { ComunicazionePasto } from '@/lib/comunicazionePasti';

const ETICHETTE_STATO: Record<string, string> = {
  presente: 'Presente',
  assente: 'Assente',
  malattia: 'Malattia',
};

// Se la query Supabase è fallita (es. service_role key mancante/non
// valida, permessi), solleva un errore invece di trattarla come "nessun
// dato": senza questo controllo un errore di configurazione produceva
// silenziosamente un report vuoto ("Nessuna classe attiva"), identico a
// una notte davvero senza dati — indistinguibile nei log (bug scoperto
// in produzione, vedi TASKS.md).
export function righeOSollevaErrore<T>(
  risultato: { data: T[] | null; error: { message: string } | null },
  descrizione: string
): T[] {
  if (risultato.error) {
    throw new Error(`${descrizione}: ${risultato.error.message}`);
  }
  return risultato.data ?? [];
}

// Scheda HTML delle presenze/assenze/malattie di una data, raggruppata
// per classe attiva — usata dal report notturno (specs/52 -
// report-email-automatico.md). Usa la service_role key (bypassa la
// RLS): il cron non ha una sessione utente e deve poter leggere tutte
// le classi.
export async function generaSchedaGiornalieraHtml(data: string): Promise<string> {
  const supabase = createAdminClient();

  const [rSezioni, rBambini, rPresenze, rPasti] = await Promise.all([
    supabase.from('sezioni').select('id, nome').eq('attiva', true).order('nome'),
    supabase.from('bambini').select('id, nome, cognome, sezione_id').order('cognome'),
    supabase.from('presenze').select('bambino_id, stato, note, pre_asilo, post_asilo').eq('data', data),
    supabase.from('pasti').select('bambino_id, mangiato').eq('data', data),
  ]);
  const sezioni = righeOSollevaErrore(rSezioni, 'lettura sezioni');
  const bambini = righeOSollevaErrore(rBambini, 'lettura bambini');
  const presenze = righeOSollevaErrore(rPresenze, 'lettura presenze');
  const pasti = righeOSollevaErrore(rPasti, 'lettura pasti');

  const presenzaPerBambino = new Map(presenze.map((p) => [p.bambino_id, p]));
  const pastoPerBambino = new Map(pasti.map((p) => [p.bambino_id, p.mangiato]));

  const sezioniHtml = sezioni
    .map((sezione) => {
      const bambiniSezione = bambini.filter((b) => b.sezione_id === sezione.id);
      if (!bambiniSezione.length) return '';

      const righe = bambiniSezione
        .map((b) => {
          const presenza = presenzaPerBambino.get(b.id);
          const stato = presenza ? ETICHETTE_STATO[presenza.stato] ?? presenza.stato : 'Non segnato';
          const extra: string[] = [];
          if (presenza?.pre_asilo) extra.push('pre-asilo');
          if (presenza?.post_asilo) extra.push('post-asilo');
          const pasto = pastoPerBambino.get(b.id);
          if (pasto) extra.push(`pasto: ${pasto === 'si' ? 'sì' : 'no'}`);
          const dettaglio = extra.length ? ` (${extra.join(', ')})` : '';
          const nota = presenza?.note ? ` — ${presenza.note}` : '';
          const problemi = inconsistenzeGiorno({
            stato: presenza?.stato as StatoPresenza | undefined,
            preAsilo: presenza?.pre_asilo,
            postAsilo: presenza?.post_asilo,
            mangiato: pasto as StatoPasto | undefined,
          });
          const avviso = problemi.length ? ` ⚠️ <em>${problemi.join(' ')}</em>` : '';
          return `<li>${b.nome} ${b.cognome}: <strong>${stato}</strong>${dettaglio}${nota}${avviso}</li>`;
        })
        .join('');

      return `<h2>${sezione.nome}</h2><ul>${righe}</ul>`;
    })
    .join('');

  return `<h1>Presenze del ${formattaDataItaliana(data)}</h1>${
    sezioniHtml || '<p>Nessuna classe attiva.</p>'
  }`;
}

export type SezioneConRighe = { nome: string; righe: RigaReportBambino[] };

// Aggrega presenze (incluse pre-asilo/post-asilo) e pasti per ogni
// classe attiva, nel periodo [inizio, fine] — usata dal report
// notturno settimanale/mensile (specs/52). Riusa la stessa funzione di
// aggregazione della pagina Report (lib/report.ts:aggregaConteggiPresenzePasti),
// per non duplicare la logica di conteggio (CLAUDE.md, jscpd). Usa la
// service_role key: il cron non ha una sessione utente e deve vedere
// tutte le classi, non solo quelle di un singolo staff.
export async function aggregaReportPeriodoTutteLeClassi(
  inizio: string,
  fine: string
): Promise<SezioneConRighe[]> {
  const supabase = createAdminClient();

  const [rSezioni, rBambini] = await Promise.all([
    supabase.from('sezioni').select('id, nome').eq('attiva', true).order('nome'),
    supabase.from('bambini').select('id, nome, cognome, sezione_id').eq('attiva', true).order('cognome'),
  ]);
  const sezioni = righeOSollevaErrore(rSezioni, 'lettura sezioni');
  const bambini = righeOSollevaErrore(rBambini, 'lettura bambini');

  const idBambini = bambini.map((b) => b.id);
  let presenze: { bambino_id: string; data: string; stato: string; pre_asilo: boolean; post_asilo: boolean }[] = [];
  let pasti: { bambino_id: string; data: string; mangiato: string }[] = [];
  if (idBambini.length) {
    const [rPresenze, rPasti] = await Promise.all([
      supabase
        .from('presenze')
        .select('bambino_id, data, stato, pre_asilo, post_asilo')
        .in('bambino_id', idBambini)
        .gte('data', inizio)
        .lte('data', fine),
      supabase
        .from('pasti')
        .select('bambino_id, data, mangiato')
        .in('bambino_id', idBambini)
        .gte('data', inizio)
        .lte('data', fine),
    ]);
    presenze = righeOSollevaErrore(rPresenze, 'lettura presenze');
    pasti = righeOSollevaErrore(rPasti, 'lettura pasti');
  }

  return sezioni.map((sezione) => {
    const bambiniSezione = bambini.filter((b) => b.sezione_id === sezione.id);
    const idBambiniSezione = new Set(bambiniSezione.map((b) => b.id));
    const righe = aggregaConteggiPresenzePasti(
      bambiniSezione,
      presenze.filter((p) => idBambiniSezione.has(p.bambino_id)),
      pasti.filter((p) => idBambiniSezione.has(p.bambino_id))
    );
    return { nome: sezione.nome, righe };
  });
}

// Comunicazioni pasti a Rojac nel periodo (specs/16 -
// comunicazione-pasti-rojac.md): un'unica cosa al giorno per l'intero
// asilo, non per classe — elenco piatto, nessun raggruppamento per
// sezione. Usata dal report notturno per la sezione "Comunicazione
// pasti" degli allegati PDF.
export async function recuperaComunicazioniPastiPeriodo(inizio: string, fine: string): Promise<ComunicazionePasto[]> {
  const supabase = createAdminClient();

  const rComunicazioni = await supabase
    .from('pasti_comunicati')
    .select('comunicato_at, numero_pasti, comunicato_da_nome')
    .gte('data', inizio)
    .lte('data', fine)
    .order('data', { ascending: true });

  return righeOSollevaErrore(rComunicazioni, 'lettura comunicazioni pasti').map((c) => ({
    comunicatoAt: c.comunicato_at,
    numeroPasti: c.numero_pasti,
    comunicatoDaNome: c.comunicato_da_nome,
  }));
}
