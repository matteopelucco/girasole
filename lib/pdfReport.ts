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
  // Log delle comunicazioni pasti a Rojac per questa sezione nel
  // periodo (specs/16 - comunicazione-pasti-rojac.md), già formattate
  // come stringhe pronte da stampare (lib/comunicazionePasti.ts) —
  // assente/vuoto se nessuna comunicazione nel periodo.
  comunicazionePasti?: { righe: string[]; totale: string };
};

const MARGINE = 40;
const LARGHEZZA_PAGINA = 595.28; // A4 verticale, punti
const ALTEZZA_PAGINA = 841.89;
const ALTEZZA_RIGA = 16;
const DIMENSIONE_TESTO = 9;

function larghezzeColonne(numeroColonne: number): number[] {
  const disponibile = LARGHEZZA_PAGINA - MARGINE * 2;
  if (numeroColonne <= 1) return [disponibile];
  // Prima colonna (nome bambino) più larga delle altre (conteggi).
  const primaColonna = disponibile * 0.4;
  const restanti = (disponibile - primaColonna) / (numeroColonne - 1);
  return [primaColonna, ...Array(numeroColonne - 1).fill(restanti)];
}

function disegnaRiga(
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

// Genera un PDF A4 con una tabella per ogni sezione/classe passata,
// con titolo/sottotitolo in testa e interruzione di pagina quando le
// righe non entrano più nella pagina corrente. `totaleGeneralePasti`
// (opzionale) aggiunge, in fondo al documento, il totale complessivo
// dei pasti comunicati a Rojac su tutte le sezioni nel periodo
// (specs/16 - comunicazione-pasti-rojac.md) — niente emoji: il font
// standard di pdf-lib (Helvetica, WinAnsi/Latin-1) non li supporta,
// stessa nota già in lib/consistenza.ts.
export async function generaPdfTabellare(
  titolo: string,
  sottotitolo: string,
  sezioni: SezionePdf[],
  totaleGeneralePasti?: string
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontGrassetto = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([LARGHEZZA_PAGINA, ALTEZZA_PAGINA]);
  let y = ALTEZZA_PAGINA - MARGINE;

  const nuovaPaginaSeServe = (righeNecessarie: number) => {
    if (y - righeNecessarie * ALTEZZA_RIGA < MARGINE) {
      page = doc.addPage([LARGHEZZA_PAGINA, ALTEZZA_PAGINA]);
      y = ALTEZZA_PAGINA - MARGINE;
    }
  };

  page.drawText(titolo, { x: MARGINE, y, size: 16, font: fontGrassetto, color: rgb(0, 0, 0) });
  y -= 22;
  page.drawText(sottotitolo, { x: MARGINE, y, size: 11, font, color: rgb(0.3, 0.3, 0.3) });
  y -= 28;

  if (!sezioni.length) {
    page.drawText('Nessuna classe attiva.', { x: MARGINE, y, size: DIMENSIONE_TESTO, font });
    return doc.save();
  }

  for (const sezione of sezioni) {
    nuovaPaginaSeServe(3);
    page.drawText(sezione.nome, { x: MARGINE, y, size: 12, font: fontGrassetto });
    y -= 18;

    if (!sezione.righe.length) {
      page.drawText('Nessun bambino in questa classe.', { x: MARGINE, y, size: DIMENSIONE_TESTO, font });
      y -= ALTEZZA_RIGA + 8;
      continue;
    }

    const larghezze = larghezzeColonne(sezione.intestazioni.length);
    nuovaPaginaSeServe(1);
    disegnaRiga(page, font, fontGrassetto, sezione.intestazioni, larghezze, y, true);
    y -= ALTEZZA_RIGA;

    for (const riga of sezione.righe) {
      nuovaPaginaSeServe(1);
      disegnaRiga(page, font, fontGrassetto, riga, larghezze, y, false);
      y -= ALTEZZA_RIGA;
    }

    y -= 12;

    if (sezione.comunicazionePasti?.righe.length) {
      nuovaPaginaSeServe(2);
      page.drawText('Comunicazione pasti', { x: MARGINE, y, size: 10, font: fontGrassetto });
      y -= ALTEZZA_RIGA;

      for (const riga of sezione.comunicazionePasti.righe) {
        nuovaPaginaSeServe(1);
        page.drawText(riga, { x: MARGINE, y, size: DIMENSIONE_TESTO, font, color: rgb(0.1, 0.1, 0.1) });
        y -= ALTEZZA_RIGA;
      }

      nuovaPaginaSeServe(1);
      page.drawText(sezione.comunicazionePasti.totale, {
        x: MARGINE,
        y,
        size: DIMENSIONE_TESTO,
        font: fontGrassetto,
      });
      y -= ALTEZZA_RIGA + 12;
    }
  }

  if (totaleGeneralePasti) {
    nuovaPaginaSeServe(1);
    page.drawText(totaleGeneralePasti, { x: MARGINE, y, size: 11, font: fontGrassetto });
  }

  return doc.save();
}
