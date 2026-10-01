import { describe, expect, it } from 'vitest';
import { righeMeseOreLavoro, type GiornoSalvatoOreLavoro } from './oreLavoroMese';
import { personaPdfOreLavoro, nomeFilePdfOreLavoroPersona } from './pdfOreLavoroDati';

// Logica pura: specs/52 (layout della pagina per persona), specs/18.

const profilo = { ore_lunedi: 7, ore_martedi: 7, ore_mercoledi: 7, ore_giovedi: 7, ore_venerdi: 4 };

function salvato(s: Partial<GiornoSalvatoOreLavoro> & { data: string }): GiornoSalvatoOreLavoro {
  return {
    stato: 'lavorativo',
    ore_ordinarie: 7,
    ore_straordinarie: 0,
    motivo_straordinario: null,
    codice_malattia: null,
    nota_assenza: null,
    ...s,
  };
}

const chiusure = [{ id: '1', dataInizio: '2026-08-31', dataFine: '2026-08-31', nota: null }];

function costruisci(oggiData: string, salvati: GiornoSalvatoOreLavoro[], confermate: string[]) {
  const righe = righeMeseOreLavoro({ mese: '2026-08', oggiData, salvati, profiloOrario: profilo, chiusure });
  const lunedi = ['2026-07-27', '2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24', '2026-08-31'];
  return personaPdfOreLavoro({
    nome: 'Persona A',
    profiloOrarioNome: 'Full',
    profiloOrarioDettaglio: 'Lun 7h',
    righe,
    settimane: lunedi.map((l) => ({ lunedi: l, confermata: confermate.includes(l) })),
    saldoAttuale: -3,
  });
}

describe('personaPdfOreLavoro', () => {
  const OGGI_FUTURO = '2026-09-20'; // agosto interamente trascorso

  it('una riga per ogni giorno del mese, con data corta e giorno della settimana', () => {
    const p = costruisci(OGGI_FUTURO, [], []);
    expect(p.giorni).toHaveLength(31);
    expect(p.giorni[0].data).toBe('sab 1/8/26');
  });

  it('riepilogo: dovute, erogate e differenza dai soli giorni lavorativi trascorsi', () => {
    // lun 3/8: 7h previste, 8h fatte (+1); mar 4/8: 7h previste, 5h fatte (-2).
    const p = costruisci(
      OGGI_FUTURO,
      [
        salvato({ data: '2026-08-03', ore_ordinarie: 7, ore_straordinarie: 1, motivo_straordinario: 'Riunione' }),
        salvato({ data: '2026-08-04', ore_ordinarie: 5 }),
      ],
      []
    );
    expect(p.riepilogo.differenza).toBe(-1);
    expect(p.riepilogo.oreErogate).toBe(p.riepilogo.oreDovute + p.riepilogo.differenza);
    const lun = p.giorni.find((g) => g.data.endsWith('3/8/26'))!;
    expect(lun).toMatchObject({ oreDovute: '7h', oreErogate: '8h', differenza: '+1h', commento: 'Riunione' });
    const mar = p.giorni.find((g) => g.data.endsWith('4/8/26'))!;
    expect(mar).toMatchObject({ oreDovute: '7h', oreErogate: '5h', differenza: '-2h' });
  });

  it('chiusura, ferie, malattia e assenza: stato e nessuna ora dovuta né differenza', () => {
    const p = costruisci(
      OGGI_FUTURO,
      [
        salvato({ data: '2026-08-05', stato: 'malattia', codice_malattia: 'ABC123' }),
        salvato({ data: '2026-08-06', stato: 'assenza', nota_assenza: 'Visita' }),
        salvato({ data: '2026-08-07', stato: 'ferie' }),
      ],
      []
    );
    const chiusura = p.giorni.find((g) => g.data.endsWith('31/8/26'))!;
    expect(chiusura).toMatchObject({ oreDovute: '-', oreErogate: '-', differenza: '-' });
    expect(chiusura.stato).toContain('Chiusura');
    for (const giorno of ['5/8/26', '6/8/26', '7/8/26']) {
      const g = p.giorni.find((x) => x.data.endsWith(giorno))!;
      expect(g).toMatchObject({ oreDovute: '-', oreErogate: '-', differenza: '-' });
    }
    expect(p.giorni.find((g) => g.data.endsWith('5/8/26'))!.commento).toContain('ABC123');
    expect(p.giorni.find((g) => g.data.endsWith('6/8/26'))!.commento).toContain('Visita');
  });

  it('i giorni di una settimana non confermata compaiono marcati "da confermare"', () => {
    const p = costruisci(OGGI_FUTURO, [], ['2026-08-03']);
    const confermato = p.giorni.find((g) => g.data.endsWith('4/8/26'))!;
    const daConfermare = p.giorni.find((g) => g.data.endsWith('11/8/26'))!;
    expect(confermato.stato).not.toContain('da confermare');
    expect(daConfermare.stato).toContain('da confermare');
  });

  it('prospetto delle settimane: intervallo e stato di conferma', () => {
    const p = costruisci(OGGI_FUTURO, [], ['2026-08-03']);
    expect(p.settimane).toHaveLength(6);
    expect(p.settimane[1].confermata).toBe(true);
    expect(p.settimane[2].confermata).toBe(false);
    expect(p.settimane[1].intervallo).toMatch(/3.*9/);
  });

  it('un giorno lavorativo non ancora trascorso mostra le ore dovute ma nessuna erogata', () => {
    const p = costruisci('2026-08-10', [], []);
    const futuro = p.giorni.find((g) => g.data.endsWith('12/8/26'))!;
    expect(futuro.oreDovute).toBe('7h');
    expect(futuro.oreErogate).toBe('-');
    expect(futuro.differenza).toBe('-');
  });

  it('porta nome, profilo orario e saldo del monte ore', () => {
    const p = costruisci(OGGI_FUTURO, [], []);
    expect(p).toMatchObject({ nome: 'Persona A', profiloOrarioNome: 'Full', saldoAttuale: -3 });
  });
});

describe('nomeFilePdfOreLavoroPersona', () => {
  it('include cognome e nome in minuscolo, senza accenti né simboli', () => {
    expect(nomeFilePdfOreLavoroPersona('2026-09', 'Rossi', 'Maria Chiara')).toBe('ore-lavoro-2026-09-rossi-maria-chiara.pdf');
    expect(nomeFilePdfOreLavoroPersona('2026-09', "D'Angelo", 'Zoë')).toBe('ore-lavoro-2026-09-d-angelo-zoe.pdf');
  });

  it('senza nome utilizzabile cade sul nome del PDF del personale', () => {
    expect(nomeFilePdfOreLavoroPersona('2026-09', '', '')).toBe('ore-lavoro-2026-09.pdf');
  });
});
