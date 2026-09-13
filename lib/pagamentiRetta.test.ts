import { describe, expect, it } from 'vitest';
import { importiPerMese, mesiAnnoScolastico, totaleImporti } from './pagamentiRetta';

// mesiAnnoScolastico è pura (nessun I/O): copre il cambio di anno
// solare a cavallo di dicembre/gennaio di specs/56 - rette.md.
describe('mesiAnnoScolastico', () => {
  it('genera i 10 mesi Settembre-Giugno, con le etichette in ordine', () => {
    const mesi = mesiAnnoScolastico(2025);
    expect(mesi).toHaveLength(10);
    expect(mesi.map((m) => m.etichetta)).toEqual([
      'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
      'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    ]);
  });

  it('Settembre-Dicembre cadono nell\'anno di inizio', () => {
    const mesi = mesiAnnoScolastico(2025);
    expect(mesi[0]).toEqual({ mese: '2025-09-01', etichetta: 'Settembre' });
    expect(mesi[3]).toEqual({ mese: '2025-12-01', etichetta: 'Dicembre' });
  });

  it('Gennaio-Giugno cadono nell\'anno successivo', () => {
    const mesi = mesiAnnoScolastico(2025);
    expect(mesi[4]).toEqual({ mese: '2026-01-01', etichetta: 'Gennaio' });
    expect(mesi[9]).toEqual({ mese: '2026-06-01', etichetta: 'Giugno' });
  });

  it('un anno di inizio diverso sposta entrambi gli anni solari', () => {
    const mesi = mesiAnnoScolastico(2030);
    expect(mesi[0]).toEqual({ mese: '2030-09-01', etichetta: 'Settembre' });
    expect(mesi[9]).toEqual({ mese: '2031-06-01', etichetta: 'Giugno' });
  });
});

describe('totaleImporti', () => {
  it('somma zero per un elenco vuoto', () => {
    expect(totaleImporti([])).toBe(0);
  });

  it('somma importi con decimali', () => {
    expect(totaleImporti([250, 50.5, 0, 199.99])).toBe(500.49);
  });

  it('arrotonda a due decimali eventuali errori di somma in virgola mobile', () => {
    expect(totaleImporti([0.1, 0.2])).toBe(0.3);
  });
});

describe('importiPerMese', () => {
  const mesi = mesiAnnoScolastico(2025);

  it('un mese senza pagamento registrato vale 0', () => {
    const mappa = importiPerMese([], mesi);
    expect(mappa.get('2025-09-01')).toBe(0);
    expect(mappa.get('2026-06-01')).toBe(0);
  });

  it('un mese con pagamento registrato riporta il suo importo', () => {
    const mappa = importiPerMese([{ mese: '2025-10-01', importo: 250 }], mesi);
    expect(mappa.get('2025-10-01')).toBe(250);
    expect(mappa.get('2025-09-01')).toBe(0);
  });

  it('ignora un pagamento per un mese fuori dall\'anno scolastico mostrato', () => {
    const mappa = importiPerMese([{ mese: '2024-07-01', importo: 999 }], mesi);
    expect(mappa.has('2024-07-01')).toBe(false);
    expect(mappa.size).toBe(10);
  });
});
