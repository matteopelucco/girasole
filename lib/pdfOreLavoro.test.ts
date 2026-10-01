import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { generaPdfOreLavoroMensile, nomeFilePdfOreLavoroMensile, type PersonaPdfOreLavoro } from './pdfOreLavoro';
import { testoPagina } from './pdfTestUtils';

const GENERATO_IL = new Date('2026-09-29T06:15:00Z');

function persona(nome: string, sovrascrizioni: Partial<PersonaPdfOreLavoro> = {}): PersonaPdfOreLavoro {
  return {
    nome,
    profiloOrarioNome: null,
    profiloOrarioDettaglio: null,
    riepilogo: { oreDovute: 0, oreErogate: 0, differenza: 0 },
    settimane: [],
    giorni: [],
    saldoAttuale: 0,
    ...sovrascrizioni,
  };
}

async function testoDelPdf(persone: PersonaPdfOreLavoro[]): Promise<string> {
  const bytes = await generaPdfOreLavoroMensile('settembre 2026', persone, GENERATO_IL);
  const pagine = (await PDFDocument.load(bytes)).getPageCount();
  const testi: string[] = [];
  for (let i = 0; i < pagine; i++) testi.push(await testoPagina(bytes, i));
  return testi.join('\n');
}

describe('generaPdfOreLavoroMensile', () => {
  it('riporta "Generato il ... alle ..." sulla prima pagina, con il mese invariato', async () => {
    const bytes = await generaPdfOreLavoroMensile('settembre 2026', [persona('Persona A')], GENERATO_IL);
    const testo = await testoPagina(bytes, 0);
    expect(testo).toContain('Generato il 29/09/2026 alle 08:15');
    expect(testo).toContain('settembre 2026');
    expect(testo).toContain('Persona A');
  });

  it('riepilogo del mese: ore dovute, erogate e differenza con segno', async () => {
    const testo = await testoDelPdf([
      persona('Persona A', { riepilogo: { oreDovute: 150, oreErogate: 148.5, differenza: -1.5 } }),
    ]);
    expect(testo).toContain('Riepilogo del mese');
    expect(testo).toContain('150h');
    expect(testo).toContain('148.5h');
    expect(testo).toContain('-1.5h');
  });

  it('prospetto delle settimane con lo stato confermata / da confermare', async () => {
    const testo = await testoDelPdf([
      persona('Persona A', {
        settimane: [
          { intervallo: '31 ago – 6 set', confermata: true },
          { intervallo: '7 set – 13 set', confermata: false },
        ],
      }),
    ]);
    expect(testo).toContain('Settimane del mese');
    expect(testo).toContain('31 ago');
    expect(testo).toContain('Confermata');
    expect(testo).toContain('Da confermare');
  });

  it('elenco dei giorni con le colonne richieste, il commento e il totale in fondo', async () => {
    const testo = await testoDelPdf([
      persona('Persona A', {
        riepilogo: { oreDovute: 7, oreErogate: 8, differenza: 1 },
        giorni: [
          { data: 'mer 9/9/26', stato: 'Lavorativo', oreDovute: '7h', oreErogate: '8h', differenza: '+1h', commento: 'Riunione genitori' },
          { data: 'gio 10/9/26', stato: 'Ferie', oreDovute: '-', oreErogate: '-', differenza: '-', commento: '' },
        ],
      }),
    ]);
    for (const intestazione of ['Giorno', 'Stato', 'Ore dovute', 'Ore erogate', 'Differenza', 'Commento']) {
      expect(testo).toContain(intestazione);
    }
    expect(testo).toContain('mer 9/9/26');
    expect(testo).toContain('Riunione genitori');
    expect(testo).toContain('Ferie');
    expect(testo.lastIndexOf('Totale mese')).toBeGreaterThan(testo.indexOf('gio 10/9/26'));
  });

  it('monte ore: saldo con descrizione e legenda del segno', async () => {
    const testo = await testoDelPdf([persona('Persona A', { saldoAttuale: -3 })]);
    expect(testo).toContain('Monte ore');
    expect(testo).toContain('Saldo attuale: -3h da recuperare');
    expect(testo).toContain('ancora da erogare');
  });

  it('il profilo orario assegnato compare accanto al nome', async () => {
    const testo = await testoDelPdf([
      persona('Persona A', { profiloOrarioNome: 'Full', profiloOrarioDettaglio: 'Lun 7h · Mar 7h' }),
    ]);
    expect(testo).toContain('Profilo orario: Full (Lun 7h');
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

  it('un mese intero di giorni occupa più pagine, ciascuna con la riga di generazione', async () => {
    const giorni = Array.from({ length: 31 }, (_, i) => ({
      data: `lun ${i + 1}/9/26`,
      stato: 'Lavorativo',
      oreDovute: '7h',
      oreErogate: '7h',
      differenza: '0h',
      commento: i % 4 === 0 ? 'Pre-asilo al posto di Lucia (1.5) + 3h SARA: da definire' : '',
    }));
    const bytes = await generaPdfOreLavoroMensile('settembre 2026', [persona('A', { giorni })], GENERATO_IL);
    const pagine = (await PDFDocument.load(bytes)).getPageCount();
    expect(pagine).toBeGreaterThan(1);
    for (let i = 0; i < pagine; i++) expect(await testoPagina(bytes, i)).toContain('Generato il');
  });
});

describe('nomeFilePdfOreLavoroMensile', () => {
  it('ore-lavoro-AAAA-MM.pdf, lo stesso nome dell\'allegato del cron', () => {
    expect(nomeFilePdfOreLavoroMensile('2026-09')).toBe('ore-lavoro-2026-09.pdf');
  });
});

describe('commento lungo nella tabella dei giorni (specs/52, issue #142)', () => {
  const COMMENTO = 'Pre-asilo al posto di Lucia (1.5) + 3h SARA: da definire';

  it('il commento del giorno va a capo e nessuna parola viene persa', async () => {
    const testo = await testoDelPdf([
      persona('Persona A', {
        giorni: [{ data: 'mer 9/9/26', stato: 'Lavorativo', oreDovute: '7h', oreErogate: '11.5h', differenza: '+4.5h', commento: COMMENTO }],
      }),
    ]);
    for (const parola of COMMENTO.split(' ')) expect(testo).toContain(parola);
  });
});
