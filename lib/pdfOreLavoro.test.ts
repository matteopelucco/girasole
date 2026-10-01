import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { generaPdfOreLavoroMensile, nomeFilePdfOreLavoroMensile, type PersonaPdfOreLavoro } from './pdfOreLavoro';
import { testoPagina } from './pdfTestUtils';

const GENERATO_IL = new Date('2026-09-29T06:15:00Z');

function persona(nome: string): PersonaPdfOreLavoro {
  return {
    nome,
    profiloOrarioNome: null,
    profiloOrarioDettaglio: null,
    giorni: [],
    settimaneNonConfermate: [],
    saldoAttuale: 0,
    movimenti: [],
    calcoloMensile: [],
  };
}

describe('generaPdfOreLavoroMensile', () => {
  it('riporta "Generato il ... alle ..." sulla prima pagina, con il mese invariato', async () => {
    const bytes = await generaPdfOreLavoroMensile('settembre 2026', [persona('Persona A')], GENERATO_IL);
    const testo = await testoPagina(bytes, 0);
    expect(testo).toContain('Generato il 29/09/2026 alle 08:15');
    expect(testo).toContain('settembre 2026');
  });

  it('riporta la situazione completa del monte ore: saldo, movimenti e calcolo mese per mese', async () => {
    const conMonteOre: PersonaPdfOreLavoro = {
      ...persona('Persona A'),
      saldoAttuale: 4.5,
      movimenti: [{ data: 'mar 1/9/26', variazione: -2, nota: 'Recupero concordato' }],
      calcoloMensile: [
        { mese: 'agosto 2026', orePreviste: 140, differenza: 3, movimenti: 0, saldo: 0 },
        { mese: 'settembre 2026', orePreviste: 100, differenza: -2, movimenti: -2, saldo: -2 },
      ],
    };
    const bytes = await generaPdfOreLavoroMensile('settembre 2026', [conMonteOre], GENERATO_IL);
    const testo = await testoPagina(bytes, 0);
    expect(testo).toContain('Saldo attuale: +4.5h a credito (ore già erogate in più)');
    expect(testo).toContain('da recuperare');
    expect(testo).toContain('Recupero concordato');
    expect(testo).toContain('-2h');
    expect(testo).toContain('Calcolo mese per mese');
    expect(testo).toContain('agosto 2026');
    expect(testo).toContain('+3h');
  });

  it('senza movimenti né calcolo lo dice esplicitamente', async () => {
    const bytes = await generaPdfOreLavoroMensile('settembre 2026', [persona('Persona A')], GENERATO_IL);
    const testo = await testoPagina(bytes, 0);
    expect(testo).toContain('Nessun movimento registrato.');
    expect(testo).toContain('Nessun dato.');
  });

  it('senza personale abilitato lo dice esplicitamente', async () => {
    const bytes = await generaPdfOreLavoroMensile('settembre 2026', [], GENERATO_IL);
    const testo = await testoPagina(bytes, 0);
    expect(testo).toContain('Nessun membro del personale è abilitato al report ore.');
    expect(testo).toContain('settembre 2026');
  });

  it('con più persone la riga compare su ogni pagina (una per persona)', async () => {
    const bytes = await generaPdfOreLavoroMensile('settembre 2026', [persona('A'), persona('B')], GENERATO_IL);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2);
    expect(await testoPagina(bytes, 0)).toContain('Generato il 29/09/2026 alle 08:15');
    expect(await testoPagina(bytes, 1)).toContain('Generato il 29/09/2026 alle 08:15');
  });
});

describe('nomeFilePdfOreLavoroMensile', () => {
  it('ore-lavoro-AAAA-MM.pdf, lo stesso nome dell\'allegato del cron', () => {
    expect(nomeFilePdfOreLavoroMensile('2026-09')).toBe('ore-lavoro-2026-09.pdf');
  });
});
