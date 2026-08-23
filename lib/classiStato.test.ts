import { describe, expect, it } from 'vitest';
import { classePulsanteStato } from './classiStato';

describe('classePulsanteStato', () => {
  it('restituisce una classe non selezionata quando selezionato è false', () => {
    expect(classePulsanteStato('presente', false)).toContain('border-stone-300');
  });

  it.each([
    ['presente', 'bg-emerald-700'],
    ['si', 'bg-emerald-700'],
    ['assente', 'bg-stone-600'],
    ['no', 'bg-rose-600'],
    ['malattia', 'bg-rose-600'],
  ])('stato "%s" selezionato usa il colore %s', (stato, colore) => {
    expect(classePulsanteStato(stato, true)).toContain(colore);
  });
});
