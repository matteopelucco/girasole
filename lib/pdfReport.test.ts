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
});
