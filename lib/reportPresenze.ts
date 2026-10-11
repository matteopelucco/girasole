import { createAdminClient } from '@/lib/supabase/admin';
import { escapeHtml } from '@/lib/htmlEscape';
import { aggregaConteggiPresenzePasti, aggiungiDettaglioGiorno, type RigaReportBambino } from '@/lib/report';
import { ETICHETTE_STATO_GIORNO, type SezioneGiornaliera } from '@/lib/reportNotturno';
import type { ComunicazionePasto } from '@/lib/comunicazionePasti';

// Se la query Supabase è fallita (es. service_role key mancante/non
// valida, permessi), solleva un errore invece di trattarla come "nessun
// dato": senza questo controllo un errore di configurazione produceva
// silenziosamente un report vuoto ("Nessuna classe attiva"), identico a
// una notte davvero senza dati — indistinguibile nei log (bug scoperto
// in produzione, vedi docs/tasks-archivio.md).
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

// Esportati per riuso da lib/reportOreLavoro.ts (stesso stile di
// tabella HTML per il riepilogo ore nel corpo dell'email, CLAUDE.md/jscpd).
export const STILE_TABELLA = 'border-collapse:collapse;width:100%';
export const STILE_CELLA = 'border:1px solid #ccc;padding:4px 8px;text-align:left';
export const STILE_CELLA_NUMERO = 'border:1px solid #ccc;padding:4px 8px;text-align:right';

// Riga di una tabella HTML per un bambino, con lo stesso avviso ⚠️
// mostrato accanto al nome nella tabella a schermo
// (components/AvvisoInconsistenza.tsx) quando ci sono inconsistenze
// (specs/06 - controllo-consistenza.md).
function rigaHtml(r: SezioneGiornaliera['righe'][number]): string {
  const avviso = r.inconsistenze.length
    ? ` <span title="${escapeHtml(r.inconsistenze.join(' '))}">⚠️ Inconsistenza</span>`
    : '';
  const siOTrattino = (valore: number) => (valore > 0 ? 'Sì' : '-');
  return (
    `<tr><td style="${STILE_CELLA}">${escapeHtml(r.nome)} ${escapeHtml(r.cognome)}${avviso}</td>` +
    `<td style="${STILE_CELLA}">${ETICHETTE_STATO_GIORNO[r.stato]}</td>` +
    `<td style="${STILE_CELLA}">${siOTrattino(r.preAsilo)}</td>` +
    `<td style="${STILE_CELLA}">${siOTrattino(r.postAsilo)}</td>` +
    `<td style="${STILE_CELLA}">${siOTrattino(r.pasti)}</td>` +
    `<td style="${STILE_CELLA}">${escapeHtml(r.nota ?? '')}</td></tr>`
  );
}

// Corpo HTML del report giornaliero nell'email notturna (specs/52 -
// report-email-automatico.md, "report giornaliero con stato di presenza
// e nota"): una tabella per classe attiva, con stato di presenza e nota
// del giorno oltre a pre/post-asilo e pasto — non un elenco puntato.
// Funzione pura (nessun I/O): chi chiama ha già aggregato i dati
// (aggregaGiornoTutteLeClassi), stessa forma usata per il PDF
// (lib/pdfReport.ts), per non duplicare la logica di presentazione.
export function formattaTabellaReportHtml(titolo: string, sezioni: SezioneGiornaliera[]): string {
  const sezioniHtml = sezioni
    .map((sezione) => {
      const corpo = sezione.righe.length
        ? `<table style="${STILE_TABELLA}"><thead><tr>` +
          `<th style="${STILE_CELLA}">Bambino</th>` +
          `<th style="${STILE_CELLA}">Presenza</th>` +
          `<th style="${STILE_CELLA}">Pre-asilo</th>` +
          `<th style="${STILE_CELLA}">Post-asilo</th>` +
          `<th style="${STILE_CELLA}">Pasto</th>` +
          `<th style="${STILE_CELLA}">Nota</th>` +
          `</tr></thead><tbody>${sezione.righe.map(rigaHtml).join('')}</tbody></table>`
        : '<p>Nessun bambino in questa classe.</p>';
      return `<h2>${escapeHtml(sezione.nome)}</h2>${corpo}`;
    })
    .join('');

  return `<h1>${escapeHtml(titolo)}</h1>${sezioniHtml || '<p>Nessuna classe attiva.</p>'}`;
}

// Aggrega presenze (incluse pre-asilo/post-asilo) e pasti per ogni
// classe attiva, nel periodo [inizio, fine] — usata dal report
// notturno settimanale/mensile (specs/52). Riusa la stessa funzione di
// aggregazione della pagina Report (lib/report.ts:aggregaConteggiPresenzePasti),
// per non duplicare la logica di conteggio (CLAUDE.md, jscpd). Usa la
// service_role key: il cron non ha una sessione utente e deve vedere
// tutte le classi, non solo quelle di un singolo staff.
type PresenzaLetta = {
  bambino_id: string;
  data: string;
  stato: string;
  pre_asilo: boolean;
  post_asilo: boolean;
  note: string | null;
};

async function aggregaPerSezione<R extends RigaReportBambino>(
  inizio: string,
  fine: string,
  arricchisci: (righe: RigaReportBambino[], presenze: PresenzaLetta[]) => R[]
): Promise<{ nome: string; righe: R[] }[]> {
  const supabase = createAdminClient();

  const [rSezioni, rBambini] = await Promise.all([
    supabase.from('sezioni').select('id, nome').eq('attiva', true).order('nome'),
    supabase.from('bambini').select('id, nome, cognome, sezione_id').eq('attiva', true).order('cognome'),
  ]);
  const sezioni = righeOSollevaErrore(rSezioni, 'lettura sezioni');
  const bambini = righeOSollevaErrore(rBambini, 'lettura bambini');

  const idBambini = bambini.map((b) => b.id);
  let presenze: PresenzaLetta[] = [];
  let pasti: { bambino_id: string; data: string; mangiato: string }[] = [];
  if (idBambini.length) {
    const [rPresenze, rPasti] = await Promise.all([
      supabase
        .from('presenze')
        .select('bambino_id, data, stato, pre_asilo, post_asilo, note')
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
    const presenzeSezione = presenze.filter((p) => idBambiniSezione.has(p.bambino_id));
    const righe = aggregaConteggiPresenzePasti(
      bambiniSezione,
      presenzeSezione,
      pasti.filter((p) => idBambiniSezione.has(p.bambino_id))
    );
    return { nome: sezione.nome, righe: arricchisci(righe, presenzeSezione) };
  });
}

export function aggregaReportPeriodoTutteLeClassi(inizio: string, fine: string): Promise<SezioneConRighe[]> {
  return aggregaPerSezione(inizio, fine, (righe) => righe);
}

// Report di un solo giorno: ai conteggi aggiunge stato e nota della
// presenza (specs/52, "report giornaliero con stato di presenza e nota").
export function aggregaGiornoTutteLeClassi(data: string): Promise<SezioneGiornaliera[]> {
  return aggregaPerSezione(data, data, aggiungiDettaglioGiorno);
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
