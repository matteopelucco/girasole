import { describe, expect, it } from 'vitest';
import { passwordAbbastanzaComplessa } from './password';

describe('passwordAbbastanzaComplessa', () => {
  it('accetta una password che rispetta tutte le regole', () => {
    expect(passwordAbbastanzaComplessa('Abcdefg1!')).toBe(true);
  });

  it('rifiuta una password troppo corta', () => {
    expect(passwordAbbastanzaComplessa('Ab1!')).toBe(false);
  });

  it('rifiuta una password senza maiuscola', () => {
    expect(passwordAbbastanzaComplessa('abcdefg1!')).toBe(false);
  });

  it('rifiuta una password senza minuscola', () => {
    expect(passwordAbbastanzaComplessa('ABCDEFG1!')).toBe(false);
  });

  it('rifiuta una password senza numero', () => {
    expect(passwordAbbastanzaComplessa('Abcdefgh!')).toBe(false);
  });

  it('rifiuta una password senza carattere speciale', () => {
    expect(passwordAbbastanzaComplessa('Abcdefg1')).toBe(false);
  });
});
