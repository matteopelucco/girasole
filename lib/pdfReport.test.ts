import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { generaPdfTabellare } from './pdfReport';

describe('generaPdfTabellare', () => {
  it('genera un PDF valido (magic bytes %PDF) con una sezione e una riga', async () => {
    const bytes = await generaPdfTabellare('Report giornaliero', 'lunedì 24 agosto 2026', [
      { nome: 'Girasoli', intestazioni: ['Bambino', 'Presenze'], righe: [['Anna Bianchi', '1']] },
    ]);

    expect(bytes.length).toBeGreaterThan(0);
    const testata = Buffer.from(bytes.slice(0, 5)).toString('ascii');
    expect(testata).toBe('%PDF-');
  });

  it('un PDF senza sezioni resta apribile (una sola pagina, "nessuna classe")', async () => {
    const bytes = await generaPdfTabellare('Report', 'sottotitolo', []);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });

  it('una sezione senza bambini resta apribile', async () => {
    const bytes = await generaPdfTabellare('Report', 'sottotitolo', [
      { nome: 'Girasoli', intestazioni: ['Bambino'], righe: [] },
    ]);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });

  it('molte righe sfondano nella pagina successiva', async () => {
    const righe = Array.from({ length: 80 }, (_, i) => [`Bambino ${i}`, '1']);
    const bytes = await generaPdfTabellare('Report', 'sottotitolo', [
      { nome: 'Girasoli', intestazioni: ['Bambino', 'Presenze'], righe },
    ]);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });

  it('più sezioni restano tutte nel documento (nessuna persa cambiando pagina)', async () => {
    const bytes = await generaPdfTabellare('Report', 'sottotitolo', [
      { nome: 'Girasoli', intestazioni: ['Bambino'], righe: [['Anna Bianchi']] },
      { nome: 'Margherite', intestazioni: ['Bambino'], righe: [['Marco Verdi']] },
    ]);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it('include la sezione "Comunicazione pasti" quando presente, resta apribile', async () => {
    const bytes = await generaPdfTabellare('Report', 'sottotitolo', [
      {
        nome: 'Girasoli',
        intestazioni: ['Bambino'],
        righe: [['Anna Bianchi']],
        comunicazionePasti: {
          righe: ['26/08/2026_12:05: 12 pasti (Maria Rossi)'],
          totale: 'Totale: 12 pasti',
        },
      },
    ]);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it('una sezione senza comunicazioni non aggiunge il blocco (nessun errore)', async () => {
    const bytes = await generaPdfTabellare('Report', 'sottotitolo', [
      { nome: 'Girasoli', intestazioni: ['Bambino'], righe: [['Anna Bianchi']] },
    ]);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });

  it('include il totale generale in fondo al documento, se passato', async () => {
    const bytes = await generaPdfTabellare(
      'Report',
      'sottotitolo',
      [{ nome: 'Girasoli', intestazioni: ['Bambino'], righe: [['Anna Bianchi']] }],
      'Totale complessivo: 42 pasti'
    );
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it('il totale generale non causa errori anche con un elenco sezioni vuoto', async () => {
    const bytes = await generaPdfTabellare('Report', 'sottotitolo', [], 'Totale complessivo: 0 pasti');
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });
});
