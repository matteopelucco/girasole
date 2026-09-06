import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

// Generazione PDF dei report notturni (specs/52 - report-email-automatico.md).
// Usa pdf-lib (libreria pura JS, nessun binario nativo — vedi la scelta
// discussa con l'utente prima di aggiungerla come dipendenza, CLAUDE.md):
// disegna una tabella semplice per sezione/classe, con interruzione di
// pagina automatica. Nessun I/O qui: chi chiama passa già i dati pronti
// (stessa forma delle tabelle mostrate in app/dashboard/report/).

export type SezionePdf = {
  nome: string;
  intestazioni: string[];
  righe: string[][];
};

// Log delle comunicazioni pasti a Rojac nel periodo (specs/16 -
// comunicazione-pasti-rojac.md), già formattate come stringhe pronte da
// stampare (lib/comunicazionePasti.ts): un'unica sezione per l'intero
// documento (la comunicazione è per l'intero asilo, non per classe),
// non una per sezione.
export type ComunicazionePastiPdf = { righe: string[]; totale: string };

// Primitivi di disegno condivisi da ogni generatore di PDF del progetto
// (report presenze/pasti qui sotto, report ore di lavoro in
// lib/pdfOreLavoro.ts): dimensioni pagina, disegno di una riga di
// celle, gestione di interruzione di pagina automatica — esportati
// invece di duplicati in ogni modulo che genera un PDF (CLAUDE.md,
// jscpd).
export const MARGINE = 40;
export const LARGHEZZA_PAGINA = 595.28; // A4 verticale, punti
export const ALTEZZA_PAGINA = 841.89;
export const ALTEZZA_RIGA = 16;
export const DIMENSIONE_TESTO = 9;

export function larghezzeColonne(numeroColonne: number): number[] {
  const disponibile = LARGHEZZA_PAGINA - MARGINE * 2;
  if (numeroColonne <= 1) return [disponibile];
  // Prima colonna (nome bambino) più larga delle altre (conteggi).
  const primaColonna = disponibile * 0.4;
  const restanti = (disponibile - primaColonna) / (numeroColonne - 1);
  return [primaColonna, ...Array(numeroColonne - 1).fill(restanti)];
}

// Larghezze di colonna proporzionali a `pesi` (es. [2, 1, 1, 1, 1, 3]),
// per tabelle dove la colonna più larga non è necessariamente la prima
// (a differenza di larghezzeColonne sopra, pensata per "nome + conteggi").
export function larghezzeColonnePesate(pesi: number[]): number[] {
  const disponibile = LARGHEZZA_PAGINA - MARGINE * 2;
  const totalePesi = pesi.reduce((somma, peso) => somma + peso, 0);
  return pesi.map((peso) => (disponibile * peso) / totalePesi);
}

export function disegnaRiga(
  page: PDFPage,
  font: PDFFont,
  fontGrassetto: PDFFont,
  celle: string[],
  larghezze: number[],
  y: number,
  grassetto: boolean
) {
  let x = MARGINE;
  for (let i = 0; i < celle.length; i++) {
    page.drawText(celle[i] ?? '', {
      x,
      y,
      size: DIMENSIONE_TESTO,
      font: grassetto ? fontGrassetto : font,
      color: rgb(0.1, 0.1, 0.1),
    });
    x += larghezze[i];
  }
}

// Stato mutabile "pagina corrente / posizione y" incapsulato con la sua
// logica di interruzione automatica, condiviso da ogni generatore di
// PDF multi-pagina del progetto invece di essere reimplementato in ognuno.
export type GestorePagine = {
  doc: PDFDocument;
  pagina: PDFPage;
  y: number;
  nuovaPaginaSeServe(righeNecessarie: number): void;
  nuovaPagina(): void;
};

export function creaGestorePagine(doc: PDFDocument): GestorePagine {
  const gestore: GestorePagine = {
    doc,
    pagina: doc.addPage([LARGHEZZA_PAGINA, ALTEZZA_PAGINA]),
    y: ALTEZZA_PAGINA - MARGINE,
    nuovaPaginaSeServe(righeNecessarie: number) {
      if (gestore.y - righeNecessarie * ALTEZZA_RIGA < MARGINE) {
        gestore.nuovaPagina();
      }
    },
    nuovaPagina() {
      gestore.pagina = doc.addPage([LARGHEZZA_PAGINA, ALTEZZA_PAGINA]);
      gestore.y = ALTEZZA_PAGINA - MARGINE;
    },
  };
  return gestore;
}

// Genera un PDF A4 con una tabella per ogni sezione/classe passata,
// con titolo/sottotitolo in testa e interruzione di pagina quando le
// righe non entrano più nella pagina corrente. `comunicazionePasti`
// (opzionale) aggiunge, in fondo al documento, un'unica sezione col log
// delle comunicazioni pasti a Rojac del periodo e il loro totale
// (specs/16 - comunicazione-pasti-rojac.md) — niente emoji: il font
// standard di pdf-lib (Helvetica, WinAnsi/Latin-1) non li supporta,
// stessa nota già in lib/consistenza.ts.
export async function generaPdfTabellare(
  titolo: string,
  sottotitolo: string,
  sezioni: SezionePdf[],
  comunicazionePasti?: ComunicazionePastiPdf
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontGrassetto = await doc.embedFont(StandardFonts.HelveticaBold);

  const g = creaGestorePagine(doc);

  g.pagina.drawText(titolo, { x: MARGINE, y: g.y, size: 16, font: fontGrassetto, color: rgb(0, 0, 0) });
  g.y -= 22;
  g.pagina.drawText(sottotitolo, { x: MARGINE, y: g.y, size: 11, font, color: rgb(0.3, 0.3, 0.3) });
  g.y -= 28;

  if (!sezioni.length) {
    g.pagina.drawText('Nessuna classe attiva.', { x: MARGINE, y: g.y, size: DIMENSIONE_TESTO, font });
    g.y -= ALTEZZA_RIGA + 12;
  }

  for (const sezione of sezioni) {
    g.nuovaPaginaSeServe(3);
    g.pagina.drawText(sezione.nome, { x: MARGINE, y: g.y, size: 12, font: fontGrassetto });
    g.y -= 18;

    if (!sezione.righe.length) {
      g.pagina.drawText('Nessun bambino in questa classe.', { x: MARGINE, y: g.y, size: DIMENSIONE_TESTO, font });
      g.y -= ALTEZZA_RIGA + 8;
      continue;
    }

    const larghezze = larghezzeColonne(sezione.intestazioni.length);
    g.nuovaPaginaSeServe(1);
    disegnaRiga(g.pagina, font, fontGrassetto, sezione.intestazioni, larghezze, g.y, true);
    g.y -= ALTEZZA_RIGA;

    for (const riga of sezione.righe) {
      g.nuovaPaginaSeServe(1);
      disegnaRiga(g.pagina, font, fontGrassetto, riga, larghezze, g.y, false);
      g.y -= ALTEZZA_RIGA;
    }

    g.y -= 12;
  }

  if (comunicazionePasti?.righe.length) {
    g.nuovaPaginaSeServe(2);
    g.pagina.drawText('Comunicazione pasti', { x: MARGINE, y: g.y, size: 12, font: fontGrassetto });
    g.y -= ALTEZZA_RIGA;

    for (const riga of comunicazionePasti.righe) {
      g.nuovaPaginaSeServe(1);
      g.pagina.drawText(riga, { x: MARGINE, y: g.y, size: DIMENSIONE_TESTO, font, color: rgb(0.1, 0.1, 0.1) });
      g.y -= ALTEZZA_RIGA;
    }

    g.nuovaPaginaSeServe(1);
    g.pagina.drawText(comunicazionePasti.totale, { x: MARGINE, y: g.y, size: DIMENSIONE_TESTO, font: fontGrassetto });
  }

  return doc.save();
}
