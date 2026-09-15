import { describe, expect, it } from 'vitest';
import { emailListaValida, emailValida, emailsDaCampo } from './costiBambino';

// emailValida è pura (nessun I/O): copre le combinazioni di formato
// dell'email di promemoria di specs/55 - costi-bambino.md.
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

describe('emailsDaCampo', () => {
  it('un singolo indirizzo diventa un elenco di uno', () => {
    expect(emailsDaCampo('genitore@esempio.it')).toEqual(['genitore@esempio.it']);
  });

  it('separa più indirizzi su ";", ignorando gli spazi intorno', () => {
    expect(emailsDaCampo('genitore1@esempio.it; genitore2@esempio.it')).toEqual([
      'genitore1@esempio.it',
      'genitore2@esempio.it',
    ]);
  });

  it('scarta le parti vuote (es. un ";" finale)', () => {
    expect(emailsDaCampo('genitore1@esempio.it; genitore2@esempio.it;')).toEqual([
      'genitore1@esempio.it',
      'genitore2@esempio.it',
    ]);
  });

  it('un campo vuoto produce un elenco vuoto', () => {
    expect(emailsDaCampo('')).toEqual([]);
  });
});

describe('emailListaValida', () => {
  it('un singolo indirizzo valido', () => {
    expect(emailListaValida('genitore@esempio.it')).toBe(true);
  });

  it('più indirizzi validi separati da ";"', () => {
    expect(emailListaValida('genitore1@esempio.it; genitore2@esempio.it')).toBe(true);
  });

  it('rifiuta se anche un solo indirizzo non è valido', () => {
    expect(emailListaValida('genitore1@esempio.it; non-una-email')).toBe(false);
  });

  it('rifiuta un campo vuoto', () => {
    expect(emailListaValida('')).toBe(false);
  });

  it('rifiuta un campo con solo ";" (nessun indirizzo dopo la pulizia)', () => {
    expect(emailListaValida(';;')).toBe(false);
  });
});
