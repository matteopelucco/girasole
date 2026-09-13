import { describe, expect, it } from 'vitest';
import { emailValida } from './retta';

// emailValida è pura (nessun I/O): copre le combinazioni di formato
// dell'email di promemoria di specs/55 - parametri-retta.md.
describe('emailValida', () => {
  it('accetta un indirizzo email semplice', () => {
    expect(emailValida('genitore@example.com')).toBe(true);
  });

  it('accetta un indirizzo con sottodominio e dominio a più livelli', () => {
    expect(emailValida('mario.rossi@posta.esempio.co.uk')).toBe(true);
  });

  it('accetta un indirizzo con punti e più nella parte locale', () => {
    expect(emailValida('mario.rossi+retta@example.com')).toBe(true);
  });

  it('rifiuta una stringa senza @', () => {
    expect(emailValida('non-una-email')).toBe(false);
  });

  it('rifiuta una stringa senza un punto nel dominio', () => {
    expect(emailValida('mario@example')).toBe(false);
  });

  it('rifiuta una stringa con uno spazio', () => {
    expect(emailValida('mario rossi@example.com')).toBe(false);
  });

  it('rifiuta una stringa vuota', () => {
    expect(emailValida('')).toBe(false);
  });

  it('rifiuta una stringa con la parte locale mancante', () => {
    expect(emailValida('@example.com')).toBe(false);
  });

  it('rifiuta una stringa con il dominio mancante', () => {
    expect(emailValida('mario@')).toBe(false);
  });
});
