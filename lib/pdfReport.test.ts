import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { testoPagina } from './pdfTestUtils';
import {
  generaPdfTabellare,
  creaDocumentoPdf,
  disegnaRiga,
  larghezzeColonnePesate,
  LARGHEZZA_PAGINA,
  ALTEZZA_PAGINA,
  MARGINE,
  DIMENSIONE_TESTO,
} from './pdfReport';

const GENERATO_IL = new Date('2026-09-29T06:15:00Z');

describe('data di generazione nei PDF', () => {
  it('generaPdfTabellare riporta "Generato il ... alle ..." sulla prima pagina, accanto al periodo', async () => {
    const bytes = await generaPdfTabellare('Report giornaliero', 'martedì 29 settembre 2026', [], GENERATO_IL);
    const testo = await testoPagina(bytes, 0);
    expect(testo).toContain('Generato il 29/09/2026 alle 08:15');
    expect(testo).toContain('Report giornaliero');
    expect(testo).toContain('martedì 29 settembre 2026');
  });

  it('la riga compare su ogni pagina create dall\'interruzione automatica', async () => {
    const righe = Array.from({ length: 200 }, (_, i) => [`Bambino ${i}`, '1']);
    const bytes = await generaPdfTabellare('Report', 'sottotitolo', [
      { nome: 'Girasoli', intestazioni: ['Bambino', 'Presenze'], righe },
    ], GENERATO_IL);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(2);
    for (let i = 0; i < doc.getPageCount(); i++) {
      const testo = await testoPagina(bytes, i);
      expect(testo).toContain('Generato il 29/09/2026 alle 08:15');
      expect(testo.match(/Generato il/g)).toHaveLength(1);
    }
  });

  it('nuovaPagina() esplicita del gestore disegna la riga sulla nuova pagina', async () => {
    const { g } = await creaDocumentoPdf(GENERATO_IL);
    g.nuovaPagina();
    const bytes = await g.doc.save();
    expect(await testoPagina(bytes, 0)).toContain('Generato il');
    expect(await testoPagina(bytes, 1)).toContain('Generato il 29/09/2026 alle 08:15');
  });

  it('creaDocumentoPdf (primitivo condiviso) disegna la riga sulla prima pagina', async () => {
    const { g } = await creaDocumentoPdf(GENERATO_IL);
    const bytes = await g.doc.save();
    expect(await testoPagina(bytes, 0)).toContain('Generato il 29/09/2026 alle 08:15');
  });
});

describe('generaPdfTabellare', () => {
  it('genera un PDF valido (magic bytes %PDF) con una sezione e una riga', async () => {
    const bytes = await generaPdfTabellare('Report giornaliero', 'lunedì 24 agosto 2026', [
      { nome: 'Girasoli', intestazioni: ['Bambino', 'Presenze'], righe: [['Anna Bianchi', '1']] },
    ], GENERATO_IL);

    expect(bytes.length).toBeGreaterThan(0);
    const testata = Buffer.from(bytes.slice(0, 5)).toString('ascii');
    expect(testata).toBe('%PDF-');
  });

  it('un PDF senza sezioni resta apribile (una sola pagina, "nessuna classe")', async () => {
    const bytes = await generaPdfTabellare('Report', 'sottotitolo', [], GENERATO_IL);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });

  it('una sezione senza bambini resta apribile', async () => {
    const bytes = await generaPdfTabellare('Report', 'sottotitolo', [
      { nome: 'Girasoli', intestazioni: ['Bambino'], righe: [] },
    ], GENERATO_IL);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });

  it('molte righe sfondano nella pagina successiva', async () => {
    const righe = Array.from({ length: 80 }, (_, i) => [`Bambino ${i}`, '1']);
    const bytes = await generaPdfTabellare('Report', 'sottotitolo', [
      { nome: 'Girasoli', intestazioni: ['Bambino', 'Presenze'], righe },
    ], GENERATO_IL);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });

  it('più sezioni restano tutte nel documento (nessuna persa cambiando pagina)', async () => {
    const bytes = await generaPdfTabellare('Report', 'sottotitolo', [
      { nome: 'Girasoli', intestazioni: ['Bambino'], righe: [['Anna Bianchi']] },
      { nome: 'Margherite', intestazioni: ['Bambino'], righe: [['Marco Verdi']] },
    ], GENERATO_IL);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it('include la sezione "Comunicazione pasti" (unica per il documento) quando presente, resta apribile', async () => {
    const bytes = await generaPdfTabellare(
      'Report',
      'sottotitolo',
      [{ nome: 'Girasoli', intestazioni: ['Bambino'], righe: [['Anna Bianchi']] }],
      GENERATO_IL,
      { righe: ['26/08/2026_12:05: 12 pasti (Maria Rossi)'], totale: 'Totale del periodo: 12 pasti' }
    );
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it('senza comunicazioni non aggiunge il blocco (nessun errore)', async () => {
    const bytes = await generaPdfTabellare('Report', 'sottotitolo', [
      { nome: 'Girasoli', intestazioni: ['Bambino'], righe: [['Anna Bianchi']] },
    ], GENERATO_IL);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });

  it('la sezione "Comunicazione pasti" compare anche con un elenco sezioni vuoto', async () => {
    const bytes = await generaPdfTabellare('Report', 'sottotitolo', [], GENERATO_IL, {
      righe: ['26/08/2026_12:05: 5 pasti (Maria Rossi)'],
      totale: 'Totale del periodo: 5 pasti',
    });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });
});

describe('testo lungo nelle celle (specs/52)', () => {
  const DETTAGLIO = 'Pre-asilo al posto di Lucia (1.5) + 3h SARA: da definire, poi recupero concordato con la direzione';

  it('il testo lungo di una cella va a capo: ogni parola resta nel PDF', async () => {
    const bytes = await generaPdfTabellare('Report', 'sottotitolo', [
      { nome: 'Girasoli', intestazioni: ['Bambino', 'Nota'], righe: [['Anna', DETTAGLIO]] },
    ], GENERATO_IL);
    const testo = await testoPagina(bytes, 0);
    const parole = DETTAGLIO.split(' ');
    for (const parola of parole) expect(testo).toContain(parola);
    // Più di una riga di testo disegnata per la cella "Nota".
    expect(testo.split('\n').filter((r) => DETTAGLIO.includes(r) && r.length > 3).length).toBeGreaterThan(1);
  });

  it('nessun pezzo di testo esce dal margine destro', async () => {
    const { doc, font, fontGrassetto, g } = await creaDocumentoPdf(GENERATO_IL);
    const larghezze = larghezzeColonnePesate([1, 3]);
    disegnaRiga(g, font, fontGrassetto, ['Anna', DETTAGLIO + ' ' + 'Supercalifragilistichespiralidosissimo'.repeat(3)], larghezze, false);
    const bytes = await doc.save();
    const testo = await testoPagina(bytes, 0);
    const colonna = larghezze[1];
    for (const riga of testo.split('\n')) {
      expect(font.widthOfTextAtSize(riga, DIMENSIONE_TESTO)).toBeLessThanOrEqual(colonna);
    }
    expect(MARGINE + larghezze[0] + colonna).toBeLessThanOrEqual(LARGHEZZA_PAGINA - MARGINE + 0.001);
  });

  it('una riga alta non viene tagliata a fondo pagina: passa per intero alla pagina successiva', async () => {
    const { doc, font, fontGrassetto, g } = await creaDocumentoPdf(GENERATO_IL);
    const larghezze = larghezzeColonnePesate([1, 1]);
    // Avvicino il cursore al fondo: una riga di una sola riga di testo ci sta ancora...
    g.y = MARGINE + 20;
    disegnaRiga(g, font, fontGrassetto, ['a', 'b'], larghezze, false);
    expect(doc.getPageCount()).toBe(1);
    // ...una riga di molte righe di testo no: va tutta sulla pagina 2.
    g.y = MARGINE + 20;
    disegnaRiga(g, font, fontGrassetto, ['x', DETTAGLIO.repeat(3)], larghezze, false);
    expect(doc.getPageCount()).toBe(2);
    expect(g.y).toBeGreaterThanOrEqual(MARGINE);
    expect(g.y).toBeLessThan(ALTEZZA_PAGINA - MARGINE);
    const bytes = await doc.save();
    expect(await testoPagina(bytes, 1)).toContain('direzione');
  });

  it('le altre celle della riga restano allineate in alto (stessa y della prima riga del testo lungo)', async () => {
    const { doc, font, fontGrassetto, g } = await creaDocumentoPdf(GENERATO_IL);
    const yIniziale = g.y;
    disegnaRiga(g, font, fontGrassetto, ['Anna', DETTAGLIO], larghezzeColonnePesate([1, 1]), false);
    expect(g.y).toBeLessThan(yIniziale - 16);
    const bytes = await doc.save();
    expect(await testoPagina(bytes, 0)).toContain('Anna');
  });

  it('un carattere non codificabile (emoji) non fa fallire la generazione ed è sostituito da "?"', async () => {
    const bytes = await generaPdfTabellare('Report', 'sottotitolo', [
      { nome: 'Girasoli', intestazioni: ['Bambino', 'Nota'], righe: [['Anna ⚠', 'attenzione 😀']] },
    ], GENERATO_IL);
    const testo = await testoPagina(bytes, 0);
    expect(testo).toContain('Anna ?');
    expect(testo).toContain('attenzione ?');
  });
});
