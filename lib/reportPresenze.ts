import { createAdminClient } from '@/lib/supabase/admin';
import { formattaDataItaliana } from '@/lib/date';
import { aggregaConteggiPresenzePasti, type RigaReportBambino } from '@/lib/report';
import type { ComunicazionePasto } from '@/lib/comunicazionePasti';

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

export type SezioneConRighe = { nome: string; righe: RigaReportBambino[] };

const STILE_TABELLA = 'border-collapse:collapse;width:100%';
const STILE_CELLA = 'border:1px solid #ccc;padding:4px 8px;text-align:left';
const STILE_CELLA_NUMERO = 'border:1px solid #ccc;padding:4px 8px;text-align:right';

// Riga di una tabella HTML per un bambino, con lo stesso avviso ⚠️
// mostrato accanto al nome nella tabella a schermo
// (components/AvvisoInconsistenza.tsx) quando ci sono inconsistenze
// (specs/06 - controllo-consistenza.md).
function rigaHtml(r: RigaReportBambino): string {
  const avviso = r.inconsistenze.length
    ? ` <span title="${r.inconsistenze.join(' ')}">⚠️ Inconsistenza</span>`
    : '';
  return `<tr><td style="${STILE_CELLA}">${r.nome} ${r.cognome}${avviso}</td><td style="${STILE_CELLA_NUMERO}">${r.presenze}</td><td style="${STILE_CELLA_NUMERO}">${r.preAsilo}</td><td style="${STILE_CELLA_NUMERO}">${r.postAsilo}</td><td style="${STILE_CELLA_NUMERO}">${r.pasti}</td></tr>`;
}

// Corpo HTML del report notturno (specs/52 - report-email-automatico.md):
// una tabella per classe attiva, stesse colonne e stesso raggruppamento
// del report a schermo (app/dashboard/report/page.tsx) — non più un
// elenco puntato. Funzione pura (nessun I/O): chi chiama ha già
// aggregato i dati (aggregaReportPeriodoTutteLeClassi), stessa forma
// usata per i PDF (lib/pdfReport.ts), per non duplicare la logica di
// presentazione in più posti (CLAUDE.md, jscpd).
export function formattaTabellaReportHtml(titolo: string, sezioni: SezioneConRighe[]): string {
  const sezioniHtml = sezioni
    .map((sezione) => {
      const corpo = sezione.righe.length
        ? `<table style="${STILE_TABELLA}"><thead><tr>` +
          `<th style="${STILE_CELLA}">Bambino</th>` +
          `<th style="${STILE_CELLA_NUMERO}">Presenze</th>` +
          `<th style="${STILE_CELLA_NUMERO}">Pre-asilo</th>` +
          `<th style="${STILE_CELLA_NUMERO}">Post-asilo</th>` +
          `<th style="${STILE_CELLA_NUMERO}">Pasti</th>` +
          `</tr></thead><tbody>${sezione.righe.map(rigaHtml).join('')}</tbody></table>`
        : '<p>Nessun bambino in questa classe.</p>';
      return `<h2>${sezione.nome}</h2>${corpo}`;
    })
    .join('');

  return `<h1>${titolo}</h1>${sezioniHtml || '<p>Nessuna classe attiva.</p>'}`;
}

// Corpo HTML del report notturno per un solo giorno — usata come corpo
// dell'email dal job notturno (specs/52). Usa la service_role key
// (bypassa la RLS): il cron non ha una sessione utente e deve poter
// leggere tutte le classi. Riusa aggregaReportPeriodoTutteLeClassi (con
// inizio = fine = data) per non duplicare la logica di aggregazione già
// scritta per il settimanale/mensile e per i PDF (CLAUDE.md, jscpd).
export async function generaTabellaGiornalieraHtml(data: string): Promise<string> {
  const sezioni = await aggregaReportPeriodoTutteLeClassi(data, data);
  return formattaTabellaReportHtml(`Presenze del ${formattaDataItaliana(data)}`, sezioni);
}

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
