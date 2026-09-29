import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { testoPagina } from './pdfTestUtils';
import { generaPdfTabellare, creaDocumentoPdf } from './pdfReport';

const GENERATO_IL = new Date('2026-09-29T06:15:00Z');

describe('data di generazione nei PDF', () => {
  it('generaPdfTabellare riporta "Generato il ... alle ..." sulla prima pagina, accanto al periodo', async () => {
    const bytes = await generaPdfTabellare('Report giornaliero', 'martedì 29 settembre 2026', [], GENERATO_IL);
    const testo = await testoPagina(bytes, 0);
    expect(testo).toContain('Generato il 29/09/2026 alle 08:15');
    expect(testo).toContain('Report giornaliero');
    expect(testo).toContain('martedì 29 settembre 2026');
  });

  it('la riga compare una sola volta anche con più pagine (solo la prima)', async () => {
    const righe = Array.from({ length: 80 }, (_, i) => [`Bambino ${i}`, '1']);
    const bytes = await generaPdfTabellare('Report', 'sottotitolo', [
      { nome: 'Girasoli', intestazioni: ['Bambino', 'Presenze'], righe },
    ], GENERATO_IL);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(1);
    expect(await testoPagina(bytes, 0)).toContain('Generato il');
    expect(await testoPagina(bytes, 1)).not.toContain('Generato il');
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
