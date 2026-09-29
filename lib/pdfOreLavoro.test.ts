import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { generaPdfOreLavoroMensile, type PersonaPdfOreLavoro } from './pdfOreLavoro';
import { testoPagina } from './pdfTestUtils';

const GENERATO_IL = new Date('2026-09-29T06:15:00Z');

function persona(nome: string): PersonaPdfOreLavoro {
  return {
    nome,
    profiloOrarioNome: null,
    profiloOrarioDettaglio: null,
    giorni: [],
    settimaneNonConfermate: [],
    variazioneMese: 0,
    saldoAttuale: 0,
  };
}

describe('generaPdfOreLavoroMensile', () => {
  it('riporta "Generato il ... alle ..." sulla prima pagina, con il mese invariato', async () => {
    const bytes = await generaPdfOreLavoroMensile('settembre 2026', [persona('Persona A')], GENERATO_IL);
    const testo = await testoPagina(bytes, 0);
    expect(testo).toContain('Generato il 29/09/2026 alle 08:15');
    expect(testo).toContain('settembre 2026');
  });

  it('con più persone la riga compare solo sulla prima pagina', async () => {
    const bytes = await generaPdfOreLavoroMensile('settembre 2026', [persona('A'), persona('B')], GENERATO_IL);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2);
    expect(await testoPagina(bytes, 1)).not.toContain('Generato il');
  });
});
