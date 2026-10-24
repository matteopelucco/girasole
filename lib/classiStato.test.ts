import { describe, expect, it } from 'vitest';
import { tonoPulsanteStato, tonoPulsanteToggle } from './classiStato';

describe('tonoPulsanteStato', () => {
  it.each(['presente', 'si', 'assente', 'no', 'malattia'])('stato "%s" non selezionato è "spento"', (stato) => {
    expect(tonoPulsanteStato(stato, false)).toBe('spento');
  });

  it.each([
    ['presente', 'successo'],
    ['si', 'successo'],
    ['assente', 'neutro'],
    ['no', 'negativo'],
    ['malattia', 'negativo'],
  ])('stato "%s" selezionato ha il tono %s', (stato, tono) => {
    expect(tonoPulsanteStato(stato, true)).toBe(tono);
  });

  it('uno stato sconosciuto selezionato ricade su "spento"', () => {
    expect(tonoPulsanteStato('altro', true)).toBe('spento');
  });
});

describe('tonoPulsanteToggle', () => {
  it('non selezionato è "spento"', () => {
    expect(tonoPulsanteToggle(false)).toBe('spento');
  });

  it('selezionato ha il tono "info" (azzurro, distinto dal verde di Presente)', () => {
    expect(tonoPulsanteToggle(true)).toBe('info');
  });
});
