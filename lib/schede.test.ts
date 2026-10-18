import { describe, expect, it } from 'vitest';
import { ID_PANNELLO_SCHEDE, idTabScheda, indiceDaTasto, schedaDaParametri, type Scheda } from './schede';

const SCHEDE_PROVA: [Scheda<'a' | 'b' | 'c'>, ...Scheda<'a' | 'b' | 'c'>[]] = [
  { id: 'a', etichetta: 'A', href: '/p' },
  { id: 'b', etichetta: 'B', href: '/p?scheda=b' },
  { id: 'c', etichetta: 'C', href: '/p?scheda=c' },
];

describe('schedaDaParametri', () => {
  it('parte dalla prima scheda senza parametro o con un valore sconosciuto', () => {
    expect(schedaDaParametri({}, SCHEDE_PROVA)).toBe('a');
    expect(schedaDaParametri({ scheda: 'boh' }, SCHEDE_PROVA)).toBe('a');
    expect(schedaDaParametri({ scheda: undefined }, SCHEDE_PROVA)).toBe('a');
    expect(schedaDaParametri({ scheda: '' }, SCHEDE_PROVA)).toBe('a');
  });

  it('sceglie la scheda indicata, anche se il parametro è ripetuto (vale il primo)', () => {
    expect(schedaDaParametri({ scheda: 'b' }, SCHEDE_PROVA)).toBe('b');
    expect(schedaDaParametri({ scheda: ['c', 'b'] }, SCHEDE_PROVA)).toBe('c');
    expect(schedaDaParametri({ scheda: ['boh', 'b'] }, SCHEDE_PROVA)).toBe('a');
  });

  it('il nome della scheda iniziale è valido come parametro', () => {
    expect(schedaDaParametri({ scheda: 'a' }, SCHEDE_PROVA)).toBe('a');
  });

  it('non confonde le proprietà ereditate di un oggetto con le schede', () => {
    expect(schedaDaParametri({ scheda: 'constructor' }, SCHEDE_PROVA)).toBe('a');
    expect(schedaDaParametri({ scheda: '__proto__' }, SCHEDE_PROVA)).toBe('a');
  });
});

describe('identificativi ARIA', () => {
  it('ogni scheda ha un id suo e il pannello uno solo', () => {
    expect(idTabScheda('a')).toBe('scheda-a');
    expect(idTabScheda('a')).not.toBe(idTabScheda('b'));
    expect(ID_PANNELLO_SCHEDE).toBe('pannello-schede');
  });
});

describe('indiceDaTasto', () => {
  it('muove di una scheda con le frecce, in modo circolare', () => {
    expect(indiceDaTasto('ArrowRight', 0, 2)).toBe(1);
    expect(indiceDaTasto('ArrowRight', 1, 2)).toBe(0);
    expect(indiceDaTasto('ArrowLeft', 1, 2)).toBe(0);
    expect(indiceDaTasto('ArrowLeft', 0, 2)).toBe(1);
    expect(indiceDaTasto('ArrowRight', 1, 3)).toBe(2);
  });

  it("Home e Fine vanno alla prima e all'ultima scheda", () => {
    expect(indiceDaTasto('Home', 1, 2)).toBe(0);
    expect(indiceDaTasto('End', 0, 2)).toBe(1);
    expect(indiceDaTasto('End', 0, 3)).toBe(2);
  });

  it('ignora gli altri tasti', () => {
    expect(indiceDaTasto('Tab', 0, 2)).toBeNull();
    expect(indiceDaTasto('Enter', 0, 2)).toBeNull();
  });
});
