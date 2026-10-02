import { describe, expect, it } from 'vitest';
import {
  deltaGiornoOreLavoro,
  deltaGiornoPerStatoOreLavoro,
  ETICHETTE_STATO_ORE_LAVORO,
  isStatoNeutroOreLavoro,
  statoPredefinitoGiornoOreLavoro,
  arrotondaAQuartiDora,
  descrizioneDifferenzaOre,
  totaleOreErogate,
  differenzaGiornoOreLavoro,
  oreDaDifferenza,
  sonoQuartiDora,
  formattaOreConSegno,
  notaGiornoChiusoOreLavoro,
  oreOrdinariePreviste,
  normalizzaSettimanaScelta,
  settimanaOreLavoroRichiesta,
  totaliSettimanaOreLavoro,
  utenteBersaglioOreLavoro,
  validaGiornoOreLavoro,
  type InputGiornoOreLavoro,
} from './oreLavoro';
import type { GiornoChiusura } from './calendarioScolastico';

// Tutte funzioni pure (nessun I/O): specs/18 - report-ore-lavoro.md.

describe('oreOrdinariePreviste', () => {
  const profilo = {
    ore_lunedi: 7,
    ore_martedi: 7,
    ore_mercoledi: 7,
    ore_giovedi: 7,
    ore_venerdi: 4,
  };

  it('restituisce le ore del giorno della settimana corrispondente', () => {
    expect(oreOrdinariePreviste(profilo, '2026-08-31')).toBe(7); // lunedì
    expect(oreOrdinariePreviste(profilo, '2026-09-04')).toBe(4); // venerdì
  });

  it('restituisce 0 senza profilo assegnato', () => {
    expect(oreOrdinariePreviste(null, '2026-08-31')).toBe(0);
    expect(oreOrdinariePreviste(undefined, '2026-08-31')).toBe(0);
  });

  it('funziona anche con valori stringa (numeric via PostgREST)', () => {
    const profiloStringa = { ...profilo, ore_lunedi: '7.50' };
    expect(oreOrdinariePreviste(profiloStringa, '2026-08-31')).toBe(7.5);
  });
});

describe('deltaGiornoOreLavoro', () => {
  it('zero se le ore effettuate coincidono con quelle dovute e non c\'è straordinario', () => {
    expect(deltaGiornoOreLavoro(7, 7, 0)).toBe(0);
  });

  it('positivo se sono state effettuate più ore ordinarie del dovuto', () => {
    expect(deltaGiornoOreLavoro(7, 8, 0)).toBe(1);
  });

  it('negativo se sono state effettuate meno ore ordinarie del dovuto (es. malattia/assenza, 0 ore)', () => {
    expect(deltaGiornoOreLavoro(7, 0, 0)).toBe(-7);
  });

  it('lo straordinario si somma al delta', () => {
    expect(deltaGiornoOreLavoro(7, 7, 2)).toBe(2);
    expect(deltaGiornoOreLavoro(7, 5, 1)).toBe(-1);
  });

  it('senza profilo orario (dovute a zero) il delta è quanto effettuato', () => {
    expect(deltaGiornoOreLavoro(0, 3, 0)).toBe(3);
  });
});

describe('formattaOreConSegno', () => {
  it('un valore positivo ha il segno "+"', () => {
    expect(formattaOreConSegno(1.5)).toBe('+1.5');
  });

  it('un valore negativo mantiene il proprio segno "-"', () => {
    expect(formattaOreConSegno(-2)).toBe('-2');
  });

  it('zero non ha segno', () => {
    expect(formattaOreConSegno(0)).toBe('0');
  });

  it('arrotonda a due decimali i residui dell\'aritmetica in virgola mobile', () => {
    expect(formattaOreConSegno(3.5 - 3.3)).toBe('+0.2');
  });
});

describe('utenteBersaglioOreLavoro', () => {
  it('un admin che indica un altro utente scrive su quell\'utente', () => {
    expect(utenteBersaglioOreLavoro('admin', 'admin-1', 'dipendente-1')).toBe('dipendente-1');
  });

  it('un admin senza campo utente_id scrive su se stesso', () => {
    expect(utenteBersaglioOreLavoro('admin', 'admin-1', null)).toBe('admin-1');
    expect(utenteBersaglioOreLavoro('admin', 'admin-1', undefined)).toBe('admin-1');
    expect(utenteBersaglioOreLavoro('admin', 'admin-1', '')).toBe('admin-1');
  });

  it('una maestra scrive sempre su se stessa, anche forzando utente_id', () => {
    expect(utenteBersaglioOreLavoro('maestra', 'maestra-1', 'dipendente-1')).toBe('maestra-1');
  });

  it('un assistente scrive sempre su se stesso, anche forzando utente_id', () => {
    expect(utenteBersaglioOreLavoro('assistente', 'assistente-1', 'dipendente-1')).toBe('assistente-1');
  });

  it('nessun ruolo riconosciuto scrive sempre su se stesso', () => {
    expect(utenteBersaglioOreLavoro(null, 'utente-1', 'dipendente-1')).toBe('utente-1');
  });
});

function inputBase(sovrascrizioni: Partial<InputGiornoOreLavoro> = {}): InputGiornoOreLavoro {
  return {
    data: '2026-08-31',
    stato: 'lavorativo',
    orePreviste: 7,
    differenzaOre: 0,
    motivo: '',
    codiceMalattia: '',
    notaAssenza: '',
    ...sovrascrizioni,
  };
}

describe('oreDaDifferenza', () => {
  it('differenza positiva: ordinarie = previste, straordinarie = differenza', () => {
    expect(oreDaDifferenza(7, 2)).toEqual({ oreOrdinarie: 7, oreStraordinarie: 2 });
  });
  it('differenza negativa: ordinarie = previste + differenza, nessuno straordinario', () => {
    expect(oreDaDifferenza(7, -1.5)).toEqual({ oreOrdinarie: 5.5, oreStraordinarie: 0 });
  });
  it('differenza zero: ordinarie = previste', () => {
    expect(oreDaDifferenza(7, 0)).toEqual({ oreOrdinarie: 7, oreStraordinarie: 0 });
  });
  it('senza profilo (previste 0) una differenza positiva diventa straordinario', () => {
    expect(oreDaDifferenza(0, 3.25)).toEqual({ oreOrdinarie: 0, oreStraordinarie: 3.25 });
  });
});

describe('differenzaGiornoOreLavoro', () => {
  it('è (ordinarie + straordinarie) - previste', () => {
    expect(differenzaGiornoOreLavoro(7, 7, 2)).toBe(2);
    expect(differenzaGiornoOreLavoro(7, 5.5, 0)).toBe(-1.5);
    expect(differenzaGiornoOreLavoro(7, 7, 0)).toBe(0);
  });
  it('dato storico con ordinarie diverse dal previsto', () => {
    expect(differenzaGiornoOreLavoro(7, 9, 0)).toBe(2);
    expect(differenzaGiornoOreLavoro(7, 5, 1)).toBe(-1);
  });
  it('coincide con deltaGiornoOreLavoro (stessa formula di report e monte ore)', () => {
    expect(differenzaGiornoOreLavoro(7, 6, 0.5)).toBe(deltaGiornoOreLavoro(7, 6, 0.5));
  });
  it('senza profilo', () => {
    expect(differenzaGiornoOreLavoro(0, 0, 4)).toBe(4);
  });
  it('ripulisce i residui della virgola mobile', () => {
    expect(differenzaGiornoOreLavoro(3.3, 3.5, 0)).toBe(0.2);
  });
  it('ricomposizione: salvare e rileggere restituisce la stessa differenza', () => {
    for (const d of [-7, -1.25, 0, 0.25, 4.75]) {
      const { oreOrdinarie, oreStraordinarie } = oreDaDifferenza(7, d);
      expect(differenzaGiornoOreLavoro(7, oreOrdinarie, oreStraordinarie)).toBe(d);
    }
  });
});

describe('sonoQuartiDora', () => {
  it('accetta multipli di 0,25, anche negativi', () => {
    for (const v of [0, 1, 2.5, 4.25, 8.75, -0.5, -1.25]) expect(sonoQuartiDora(v)).toBe(true);
  });
  it('rifiuta gli altri valori e i non numeri', () => {
    for (const v of [8.2, 7.15, 0.1, -0.3, NaN, Infinity]) expect(sonoQuartiDora(v)).toBe(false);
  });
});

describe('validaGiornoOreLavoro', () => {
  it('un giorno lavorativo senza differenza è valido, senza motivo', () => {
    const esito = validaGiornoOreLavoro(inputBase());
    expect(esito.ok).toBe(true);
    if (esito.ok) {
      expect(esito.giorno).toEqual({
        data: '2026-08-31',
        stato: 'lavorativo',
        oreOrdinarie: 7,
        oreStraordinarie: 0,
        motivoStraordinario: null,
        codiceMalattia: null,
        notaAssenza: null,
      });
    }
  });

  it('differenza positiva con motivo: straordinarie = differenza', () => {
    const esito = validaGiornoOreLavoro(inputBase({ differenzaOre: 2, motivo: 'Riunione genitori' }));
    expect(esito.ok).toBe(true);
    if (esito.ok) {
      expect(esito.giorno.oreOrdinarie).toBe(7);
      expect(esito.giorno.oreStraordinarie).toBe(2);
      expect(esito.giorno.motivoStraordinario).toBe('Riunione genitori');
    }
  });

  it('differenza negativa con motivo: ordinarie ridotte, motivo salvato', () => {
    const esito = validaGiornoOreLavoro(inputBase({ differenzaOre: -1.25, motivo: 'Uscita anticipata' }));
    expect(esito.ok).toBe(true);
    if (esito.ok) {
      expect(esito.giorno.oreOrdinarie).toBe(5.75);
      expect(esito.giorno.oreStraordinarie).toBe(0);
      expect(esito.giorno.motivoStraordinario).toBe('Uscita anticipata');
    }
  });

  it('differenza diversa da zero senza motivo è rifiutata (in più e in meno)', () => {
    for (const differenzaOre of [2, -1]) {
      const esito = validaGiornoOreLavoro(inputBase({ differenzaOre }));
      expect(esito.ok).toBe(false);
      if (!esito.ok) expect(esito.errore).toContain('motivo');
    }
  });

  it('un motivo tutto spazi conta come mancante', () => {
    expect(validaGiornoOreLavoro(inputBase({ differenzaOre: 1, motivo: '   ' })).ok).toBe(false);
  });

  it('con differenza zero il motivo eventuale non viene salvato', () => {
    const esito = validaGiornoOreLavoro(inputBase({ motivo: 'residuo' }));
    expect(esito.ok).toBe(true);
    if (esito.ok) expect(esito.giorno.motivoStraordinario).toBeNull();
  });

  it('senza profilo una differenza positiva è valida con motivo', () => {
    const esito = validaGiornoOreLavoro(inputBase({ orePreviste: 0, differenzaOre: 4, motivo: 'Pulizie' }));
    expect(esito.ok).toBe(true);
    if (esito.ok) {
      expect(esito.giorno.oreOrdinarie).toBe(0);
      expect(esito.giorno.oreStraordinarie).toBe(4);
    }
  });

  it('rifiuta valori che non sono multipli di un quarto d\'ora', () => {
    for (const differenzaOre of [0.2, -0.3, 1.15]) {
      const esito = validaGiornoOreLavoro(inputBase({ differenzaOre, motivo: 'x' }));
      expect(esito.ok).toBe(false);
      if (!esito.ok) expect(esito.errore).toContain('quarto d');
    }
  });

  it('rifiuta una differenza non numerica', () => {
    const esito = validaGiornoOreLavoro(inputBase({ differenzaOre: NaN, motivo: 'x' }));
    expect(esito.ok).toBe(false);
  });

  it('limite inferiore: -ordinarie è ammesso, oltre no (totale mai negativo)', () => {
    const limite = validaGiornoOreLavoro(inputBase({ differenzaOre: -7, motivo: 'Permesso' }));
    expect(limite.ok).toBe(true);
    if (limite.ok) expect(limite.giorno.oreOrdinarie).toBe(0);
    const oltre = validaGiornoOreLavoro(inputBase({ differenzaOre: -7.25, motivo: 'Permesso' }));
    expect(oltre.ok).toBe(false);
    if (!oltre.ok) expect(oltre.errore).toContain('negativo');
  });

  it('senza profilo una differenza negativa è rifiutata', () => {
    expect(validaGiornoOreLavoro(inputBase({ orePreviste: 0, differenzaOre: -1, motivo: 'x' })).ok).toBe(false);
  });

  it('malattia con codice è valida e azzera le ore', () => {
    const esito = validaGiornoOreLavoro(inputBase({ stato: 'malattia', differenzaOre: 3, codiceMalattia: 'ABC123' }));
    expect(esito.ok).toBe(true);
    if (esito.ok) {
      expect(esito.giorno.stato).toBe('malattia');
      expect(esito.giorno.oreOrdinarie).toBe(0);
      expect(esito.giorno.oreStraordinarie).toBe(0);
      expect(esito.giorno.codiceMalattia).toBe('ABC123');
    }
  });

  it('malattia senza codice è rifiutata', () => {
    const esito = validaGiornoOreLavoro(inputBase({ stato: 'malattia' }));
    expect(esito.ok).toBe(false);
    if (!esito.ok) expect(esito.errore).toContain('codice malattia');
  });

  it('assenza con nota è valida e azzera le ore', () => {
    const esito = validaGiornoOreLavoro(inputBase({ stato: 'assenza', notaAssenza: 'Visita medica' }));
    expect(esito.ok).toBe(true);
    if (esito.ok) {
      expect(esito.giorno.stato).toBe('assenza');
      expect(esito.giorno.oreOrdinarie).toBe(0);
      expect(esito.giorno.notaAssenza).toBe('Visita medica');
    }
  });

  it('assenza senza nota è rifiutata', () => {
    const esito = validaGiornoOreLavoro(inputBase({ stato: 'assenza' }));
    expect(esito.ok).toBe(false);
    if (!esito.ok) expect(esito.errore).toContain('nota giustificativa');
  });

  it('uno stato sconosciuto viene trattato come lavorativo', () => {
    const esito = validaGiornoOreLavoro(inputBase({ stato: 'boh' }));
    expect(esito.ok).toBe(true);
    if (esito.ok) expect(esito.giorno.stato).toBe('lavorativo');
  });
});

describe('totaliSettimanaOreLavoro', () => {
  it('somma ore ordinarie e straordinarie di tutti i giorni', () => {
    const giorni = [
      { oreOrdinarie: 7, oreStraordinarie: 0 },
      { oreOrdinarie: 7, oreStraordinarie: 1.5 },
      { oreOrdinarie: 7, oreStraordinarie: 0 },
      { oreOrdinarie: 7, oreStraordinarie: 0 },
      { oreOrdinarie: 4, oreStraordinarie: 0 },
    ];
    expect(totaliSettimanaOreLavoro(giorni)).toEqual({ ordinarie: 32, straordinarie: 1.5, totale: 33.5 });
  });

  it('un giorno di malattia/assenza (ore a zero) non altera il totale', () => {
    const giorni = [
      { oreOrdinarie: 7, oreStraordinarie: 0 },
      { oreOrdinarie: 0, oreStraordinarie: 0 }, // malattia
      { oreOrdinarie: 7, oreStraordinarie: 0 },
    ];
    expect(totaliSettimanaOreLavoro(giorni)).toEqual({ ordinarie: 14, straordinarie: 0, totale: 14 });
  });

  it('nessun giorno dà totale zero', () => {
    expect(totaliSettimanaOreLavoro([])).toEqual({ ordinarie: 0, straordinarie: 0, totale: 0 });
  });
});

describe('notaGiornoChiusoOreLavoro', () => {
  it('null per un giorno feriale normale', () => {
    expect(notaGiornoChiusoOreLavoro('2026-08-31', [])).toBeNull(); // lunedì
  });

  it('un sabato: nota generica "(weekend)", nessun blocco menzionato', () => {
    const nota = notaGiornoChiusoOreLavoro('2026-09-05', []); // sabato
    expect(nota).toContain('weekend');
    expect(nota).toContain('puoi comunque registrare le ore');
  });

  it('un giorno di chiusura registrata senza nota', () => {
    const chiusure: GiornoChiusura[] = [
      { id: '1', dataInizio: '2026-12-23', dataFine: '2026-12-31', nota: null },
    ];
    const nota = notaGiornoChiusoOreLavoro('2026-12-27', chiusure);
    expect(nota).toContain('Giorno di chiusura scolastica');
    expect(nota).toContain('puoi comunque registrare le ore');
  });

  it('un giorno di chiusura registrata con nota la include', () => {
    const chiusure: GiornoChiusura[] = [
      { id: '1', dataInizio: '2026-12-23', dataFine: '2026-12-31', nota: 'Vacanze di Natale' },
    ];
    const nota = notaGiornoChiusoOreLavoro('2026-12-27', chiusure);
    expect(nota).toContain('Vacanze di Natale');
  });
});

// 2026-08-31 è un lunedì (settimana corrente per questi test).
describe('settimanaOreLavoroRichiesta', () => {
  const OGGI = '2026-08-31';

  it('senza richiesta restituisce la settimana corrente', () => {
    expect(settimanaOreLavoroRichiesta(undefined, OGGI)).toBe('2026-08-31');
  });

  it('la settimana corrente richiesta esplicitamente resta invariata', () => {
    expect(settimanaOreLavoroRichiesta('2026-08-31', OGGI)).toBe('2026-08-31');
  });

  it('una settimana passata valida viene accettata', () => {
    expect(settimanaOreLavoroRichiesta('2026-08-24', OGGI)).toBe('2026-08-24');
  });

  it('una settimana molto passata viene accettata comunque (nessun limite)', () => {
    expect(settimanaOreLavoroRichiesta('2025-01-06', OGGI)).toBe('2025-01-06');
  });

  it('una settimana futura viene riportata a quella corrente', () => {
    expect(settimanaOreLavoroRichiesta('2026-09-07', OGGI)).toBe('2026-08-31');
  });

  it('una data che non è un lunedì viene riportata alla settimana corrente', () => {
    expect(settimanaOreLavoroRichiesta('2026-08-25', OGGI)).toBe('2026-08-31'); // martedì
  });

  it('una stringa non valida viene riportata alla settimana corrente, senza errori', () => {
    expect(settimanaOreLavoroRichiesta('non-una-data', OGGI)).toBe('2026-08-31');
    expect(settimanaOreLavoroRichiesta('', OGGI)).toBe('2026-08-31');
  });
});

describe('normalizzaSettimanaScelta', () => {
  const OGGI = '2026-08-31'; // lunedì

  it('una data passata qualunque è portata al lunedì della sua settimana', () => {
    expect(normalizzaSettimanaScelta('2024-03-13', OGGI)).toBe('2024-03-11'); // mercoledì
    expect(normalizzaSettimanaScelta('2024-03-17', OGGI)).toBe('2024-03-11'); // domenica
    expect(normalizzaSettimanaScelta('2024-03-11', OGGI)).toBe('2024-03-11'); // già lunedì
  });

  it('nessun limite verso il passato', () => {
    expect(normalizzaSettimanaScelta('2019-01-02', OGGI)).toBe('2018-12-31');
  });

  it('oggi o un giorno della settimana corrente porta alla settimana corrente', () => {
    expect(normalizzaSettimanaScelta('2026-08-31', OGGI)).toBe('2026-08-31');
    expect(normalizzaSettimanaScelta('2026-09-06', OGGI)).toBe('2026-08-31');
    expect(normalizzaSettimanaScelta('2026-09-02', '2026-09-03')).toBe('2026-08-31');
  });

  it('una data futura è riportata alla settimana corrente (mai una settimana futura)', () => {
    expect(normalizzaSettimanaScelta('2026-09-07', OGGI)).toBe('2026-08-31');
    expect(normalizzaSettimanaScelta('2099-01-05', OGGI)).toBe('2026-08-31');
  });

  it('un valore mancante o non valido restituisce null (la pagina userà la settimana corrente)', () => {
    expect(normalizzaSettimanaScelta(undefined, OGGI)).toBeNull();
    expect(normalizzaSettimanaScelta('', OGGI)).toBeNull();
    expect(normalizzaSettimanaScelta('non-una-data', OGGI)).toBeNull();
    expect(normalizzaSettimanaScelta('2024-3-13', OGGI)).toBeNull();
    expect(normalizzaSettimanaScelta('2024-02-31', OGGI)).toBeNull(); // giorno inesistente
    expect(normalizzaSettimanaScelta('2024-13-01', OGGI)).toBeNull();
  });
});

describe('arrotondaAQuartiDora', () => {
  it('lascia invariati i valori già a quarti d\'ora', () => {
    for (const v of [0, 0.25, 0.5, 0.75, 1, 2.5, -0.25, -1.25, 4.75]) {
      expect(arrotondaAQuartiDora(v)).toBe(v);
    }
  });
  it('arrotonda al quarto d\'ora più vicino', () => {
    expect(arrotondaAQuartiDora(0.1)).toBe(0);
    expect(arrotondaAQuartiDora(0.2)).toBe(0.25);
    expect(arrotondaAQuartiDora(0.37)).toBe(0.25);
    expect(arrotondaAQuartiDora(0.4)).toBe(0.5);
  });
  it('a metà strada arrotonda per eccesso', () => {
    expect(arrotondaAQuartiDora(0.125)).toBe(0.25);
    expect(arrotondaAQuartiDora(0.375)).toBe(0.5);
  });
  it('negativi: metà strada verso +infinito, senza -0', () => {
    expect(arrotondaAQuartiDora(-0.2)).toBe(-0.25);
    expect(arrotondaAQuartiDora(-0.125)).toBe(0);
    expect(Object.is(arrotondaAQuartiDora(-0.125), -0)).toBe(false);
    expect(Object.is(arrotondaAQuartiDora(-0.1), -0)).toBe(false);
    expect(arrotondaAQuartiDora(-0.375)).toBe(-0.25);
  });
  it('valori grandi', () => {
    expect(arrotondaAQuartiDora(1234.37)).toBe(1234.25);
    expect(arrotondaAQuartiDora(-1234.4)).toBe(-1234.5);
  });
  it('il risultato è sempre accettato dalla validazione (sonoQuartiDora)', () => {
    for (const v of [0.1, 0.125, 0.2, 0.37, 0.4, -0.2, -0.125, 3.3, 1e6 + 0.13]) {
      expect(sonoQuartiDora(arrotondaAQuartiDora(v))).toBe(true);
    }
  });
});

describe('descrizioneDifferenzaOre', () => {
  it('differenza 0: ore come previsto', () => {
    expect(descrizioneDifferenzaOre(0)).toEqual({ inRegola: true, testo: '✓ Ore come previsto' });
  });
  it('differenza positiva: in più', () => {
    expect(descrizioneDifferenzaOre(1.5)).toEqual({ inRegola: false, testo: '⚠ 1.5h in più del previsto' });
  });
  it('differenza negativa: in meno, valore assoluto', () => {
    expect(descrizioneDifferenzaOre(-0.25)).toEqual({ inRegola: false, testo: '⚠ 0.25h in meno del previsto' });
  });
  it('ripulisce i residui della virgola mobile', () => {
    expect(descrizioneDifferenzaOre(0.1 + 0.2).testo).toBe('⚠ 0.3h in più del previsto');
  });
});

describe('totaleOreErogate', () => {
  it('previste + differenza', () => {
    expect(totaleOreErogate(7, 0)).toBe(7);
    expect(totaleOreErogate(7, 1.5)).toBe(8.5);
    expect(totaleOreErogate(7, -0.25)).toBe(6.75);
  });
  it('senza profilo', () => {
    expect(totaleOreErogate(0, 4)).toBe(4);
  });
  it('ripulisce i residui della virgola mobile', () => {
    expect(totaleOreErogate(3.3, 0.2)).toBe(3.5);
  });
});

// Chiusura e Ferie (specs/18): stati "di vacanza", neutri per il calcolo.
describe('Chiusura e Ferie', () => {
  const chiusure: GiornoChiusura[] = [
    { id: '1', dataInizio: '2026-08-10', dataFine: '2026-08-31', nota: 'Chiusura Estiva 2026' },
  ];

  it('hanno un\'etichetta italiana nel selettore', () => {
    expect(ETICHETTE_STATO_ORE_LAVORO.chiusura).toBe('Chiusura');
    expect(ETICHETTE_STATO_ORE_LAVORO.ferie).toBe('Ferie');
  });

  it('solo chiusura e ferie sono stati neutri', () => {
    expect(isStatoNeutroOreLavoro('chiusura')).toBe(true);
    expect(isStatoNeutroOreLavoro('ferie')).toBe(true);
    expect(isStatoNeutroOreLavoro('lavorativo')).toBe(false);
    expect(isStatoNeutroOreLavoro('malattia')).toBe(false);
    expect(isStatoNeutroOreLavoro('assenza')).toBe(false);
  });

  it('lo stato predefinito di un giorno di chiusura scolastica è "chiusura"', () => {
    expect(statoPredefinitoGiornoOreLavoro('2026-08-31', chiusure)).toBe('chiusura'); // in un intervallo
    expect(statoPredefinitoGiornoOreLavoro('2026-09-05', [])).toBe('chiusura'); // sabato
    expect(statoPredefinitoGiornoOreLavoro('2026-09-06', [])).toBe('chiusura'); // domenica
  });

  it('lo stato predefinito di un giorno normale è "lavorativo"', () => {
    expect(statoPredefinitoGiornoOreLavoro('2026-09-07', chiusure)).toBe('lavorativo');
  });

  it.each(['chiusura', 'ferie'] as const)('%s è valido senza campi, con ore a zero', (stato) => {
    const esito = validaGiornoOreLavoro(inputBase({ stato }));
    expect(esito).toEqual({
      ok: true,
      giorno: {
        data: '2026-08-31',
        stato,
        oreOrdinarie: 0,
        oreStraordinarie: 0,
        motivoStraordinario: null,
        codiceMalattia: null,
        notaAssenza: null,
      },
    });
  });

  it.each(['chiusura', 'ferie'] as const)('%s ignora differenza, motivo, codice e nota inviati', (stato) => {
    const esito = validaGiornoOreLavoro(
      inputBase({ stato, differenzaOre: 3, motivo: 'x', codiceMalattia: 'ABC', notaAssenza: 'y' })
    );
    expect(esito.ok).toBe(true);
    if (esito.ok) {
      expect(esito.giorno.oreOrdinarie).toBe(0);
      expect(esito.giorno.oreStraordinarie).toBe(0);
      expect(esito.giorno.motivoStraordinario).toBeNull();
      expect(esito.giorno.codiceMalattia).toBeNull();
      expect(esito.giorno.notaAssenza).toBeNull();
    }
  });

  it('il delta di un giorno neutro è sempre 0, anche con un profilo che prevede ore', () => {
    expect(deltaGiornoPerStatoOreLavoro('chiusura', 7, 0, 0)).toBe(0);
    expect(deltaGiornoPerStatoOreLavoro('ferie', 7, 0, 0)).toBe(0);
  });

  it('il delta degli altri stati resta quello di deltaGiornoOreLavoro', () => {
    expect(deltaGiornoPerStatoOreLavoro('lavorativo', 7, 7, 1)).toBe(1);
    expect(deltaGiornoPerStatoOreLavoro('malattia', 7, 0, 0)).toBe(-7);
    expect(deltaGiornoPerStatoOreLavoro('assenza', 7, 0, 0)).toBe(-7);
  });
});
