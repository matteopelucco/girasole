import { formattaDataItaliana, formattaDataOraItaliana, formattaIntervalloItaliano, lunediSettimana } from '@/lib/date';
import { escapeHtml } from '@/lib/htmlEscape';
import type { RigaReportGiornaliera, StatoGiorno } from '@/lib/report';

// Parti pure (nessun I/O) del report notturno (specs/52 -
// report-email-automatico.md): celle del report giornaliero, anomalie nei
// dati, sintesi testuale in apertura del corpo dell'email. Separate dalla
// route e da lib/reportPresenze.ts (che parla con Supabase) per poterle
// coprire con unit test (CLAUDE.md).

export type TipoReportNotturno = 'giornaliero' | 'settimanale' | 'mensile';

export type SezioneGiornaliera = { nome: string; righe: RigaReportGiornaliera[] };

export const INTESTAZIONI_GIORNALIERO = ['Bambino', 'Presenza', 'Pre-asilo', 'Post-asilo', 'Pasto', 'Nota'];
// Larghezze relative delle colonne del PDF giornaliero: la nota è la più larga.
export const PESI_COLONNE_GIORNALIERO = [3, 2, 1.3, 1.3, 1.2, 4];

export const ETICHETTE_STATO_GIORNO: Record<StatoGiorno, string> = {
  presente: 'Presente',
  assente: 'Assente',
  malattia: 'Malattia',
  non_segnato: 'Non segnato',
};

const siOTrattino = (valore: number) => (valore > 0 ? 'Sì' : '-');
const nomeCompleto = (r: RigaReportGiornaliera) => `${r.nome} ${r.cognome}`;

// Il PDF usa un font standard (Helvetica, codifica WinAnsi/Latin-1): un
// simbolo emoji come "⚠" non è codificabile, quindi il warning va in
// testo semplice, non nella stessa forma usata su schermo/email HTML
// (specs/06 - controllo-consistenza.md).
export function celleGiornaliere(r: RigaReportGiornaliera): string[] {
  return [
    `${nomeCompleto(r)}${r.inconsistenze.length ? ' [!] INCONSISTENZA' : ''}`,
    ETICHETTE_STATO_GIORNO[r.stato],
    siOTrattino(r.preAsilo),
    siOTrattino(r.postAsilo),
    siOTrattino(r.pasti),
    r.nota ?? '',
  ];
}

// Anomalie nei dati del giorno (specs/52, "anomalie nei dati"): testo
// semplice, l'escape HTML lo fa formattaCorpoIntroduttivoHtml.
export function anomalieDati(sezioni: SezioneGiornaliera[], dataReport: string): string[] {
  if (!sezioni.length) return ['Nessuna classe attiva.'];

  const anomalie: string[] = [];
  for (const s of sezioni) {
    if (!s.righe.length) anomalie.push(`La classe ${s.nome} non ha bambini attivi.`);
    for (const r of s.righe) {
      if (r.inconsistenze.length) {
        anomalie.push(`Inconsistenza per ${nomeCompleto(r)} (${s.nome}): ${r.inconsistenze.join(' ')}`);
      }
    }
  }

  const tutte = sezioni.flatMap((s) => s.righe.map((r) => ({ riga: r, classe: s.nome })));
  const nonSegnate = tutte.filter(({ riga }) => riga.stato === 'non_segnato');
  if (tutte.length && nonSegnate.length === tutte.length) {
    anomalie.push(
      `Nessuna presenza registrata per ${formattaDataItaliana(dataReport)} (potrebbe essere una giornata di chiusura).`
    );
  } else {
    for (const { riga, classe } of nonSegnate) {
      anomalie.push(`Presenza non segnata per ${nomeCompleto(riga)} (${classe}).`);
    }
  }
  return anomalie;
}

// Una riga di spiegazione per ogni allegato effettivamente incluso. Il
// PDF mensile delle ore del personale viaggia sempre con il mensile
// (specs/52, "PDF mensile delle ore del personale in allegato").
export function descrizioniAllegati(tipi: TipoReportNotturno[], dataReport: string): string[] {
  const descrizioni: string[] = [];
  if (tipi.includes('giornaliero')) {
    descrizioni.push(
      'Report giornaliero: presenze dei bambini per classe, con pre-asilo, post-asilo, assenze e malattie (con nota) e pasti.'
    );
  }
  if (tipi.includes('settimanale')) {
    descrizioni.push(
      `Report settimanale (${formattaIntervalloItaliano(lunediSettimana(dataReport), dataReport)}): presenze e pasti della settimana fino a oggi.`
    );
  }
  if (tipi.includes('mensile')) {
    descrizioni.push(
      `Report mensile fino a ${formattaDataItaliana(dataReport)}: riepilogo di presenze e pasti del mese fino alla data odierna.`
    );
    descrizioni.push(
      'Report mensile delle ore del personale: ore registrate nel mese fino alla data odierna, con settimane confermate, monte ore e note.'
    );
  }
  return descrizioni;
}

// Sintesi testuale in apertura del corpo (specs/52, "corpo della mail
// con descrizione, data di invio e anomalie"). Ogni testo libero è
// escapato (issue #220).
export function formattaCorpoIntroduttivoHtml({
  dataReport,
  generatoIl,
  descrizioni,
  anomalie,
}: {
  dataReport: string;
  generatoIl: Date;
  descrizioni: string[];
  anomalie: string[];
}): string {
  const [data, ora] = formattaDataOraItaliana(generatoIl).split('_');
  const allegati = descrizioni.length
    ? `<p>Allegati:</p><ul>${descrizioni.map((d) => `<li>${escapeHtml(d)}</li>`).join('')}</ul>`
    : '<p>Nessun allegato in questa mail (vedi le anomalie).</p>';
  const sezioneAnomalie = anomalie.length
    ? `<ul>${anomalie.map((a) => `<li>${escapeHtml(a)}</li>`).join('')}</ul>`
    : '<p>Nessuna anomalia riscontrata.</p>';

  return (
    `<h1>Report automatico dell'asilo</h1>` +
    `<p>Questa è la mail automatica notturna con i report dell'asilo relativi a <strong>${escapeHtml(formattaDataItaliana(dataReport))}</strong>.</p>` +
    allegati +
    `<p>Data di invio: ${data} alle ${ora}.</p>` +
    `<h2>Anomalie riscontrate</h2>${sezioneAnomalie}`
  );
}
