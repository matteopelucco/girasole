import { describe, expect, it } from 'vitest';
import { destinazioneDopoAccesso } from './destinazioneDopoAccesso';

const ORIGIN = 'https://girasole.example';
const PREDEFINITA = '/dashboard';
const valida = (next: unknown) => destinazioneDopoAccesso(next, ORIGIN);

describe('destinazioneDopoAccesso: destinazioni legittime', () => {
  it.each([
    ['/reimposta-password', '/reimposta-password'],
    ['/dashboard', '/dashboard'],
    ['/dashboard?x=1', '/dashboard?x=1'],
    ['/presenze?data=2026-10-10&sezione=a', '/presenze?data=2026-10-10&sezione=a'],
    ['/bambini/123#note', '/bambini/123#note'],
    ['/', '/'],
  ])('%s resta invariata', (input, atteso) => {
    expect(valida(input)).toBe(atteso);
  });

  it('funziona anche senza origine esplicita', () => {
    expect(destinazioneDopoAccesso('/reimposta-password')).toBe('/reimposta-password');
  });

  it('un percorso con slash codificato resta un percorso interno', () => {
    expect(valida('/%2F%2Fpagina')).toBe('/%2F%2Fpagina');
  });
});

describe('destinazioneDopoAccesso: valori assenti o non validi', () => {
  it.each([
    ['assente (null)', null],
    ['assente (undefined)', undefined],
    ['stringa vuota', ''],
    ['numero', 42],
    ['oggetto', {}],
    ['array', ['/dashboard']],
    ['booleano', true],
  ])('%s -> /dashboard', (_nome, input) => {
    expect(valida(input)).toBe(PREDEFINITA);
  });
});

describe('destinazioneDopoAccesso: valori non ammessi -> /dashboard', () => {
  it.each([
    ['doppio slash', '//esempio.test'],
    ['doppio slash con percorso', '//esempio.test/pagina'],
    ['triplo slash', '///esempio.test'],
    ['slash e backslash', '/\\esempio.test'],
    ['backslash iniziale', '\\esempio.test'],
    ['backslash nel percorso', '/pagina\\altra'],
    ['senza slash iniziale', 'dashboard'],
    ['senza slash iniziale con host', 'esempio.test/pagina'],
    ['URL assoluto https', 'https://esempio.test/pagina'],
    ['URL assoluto http', 'http://esempio.test'],
    ['URL relativo al protocollo con porta', '//esempio.test:8080'],
    ['schema javascript', 'javascript:alert(1)'],
    ['schema data', 'data:text/html,ciao'],
    ['schema mailto', 'mailto:a@esempio.test'],
    ['schema in maiuscolo', 'HTTPS://esempio.test'],
    ['solo @host', '@esempio.test'],
    ['spazio iniziale', ' /dashboard'],
    ['spazio prima di doppio slash', ' //esempio.test'],
    ['spazio nel percorso', '/dash board'],
    ['tab iniziale', '\t/dashboard'],
    ['tab dopo slash', '/\t/esempio.test'],
    ['a capo (LF)', '/dashboard\n'],
    ['a capo (CR)', '/dashboard\r'],
    ['a capo nel mezzo', '/dash\r\nboard'],
    ['slash, a capo, slash', '/\n/esempio.test'],
    ['carattere nullo', '/dash\u0000board'],
    ['carattere di controllo C1', '/dash\u0085board'],
  ])('%s', (_nome, input) => {
    expect(valida(input)).toBe(PREDEFINITA);
  });

  it('percorsi che dopo la normalizzazione diventerebbero "//..." -> /dashboard', () => {
    expect(valida('/.//esempio.test')).toBe(PREDEFINITA);
    expect(valida('/a/..//esempio.test')).toBe(PREDEFINITA);
  });
});

describe("destinazioneDopoAccesso: il risultato non cambia mai origine", () => {
  const candidati = [
    '/dashboard',
    '/@esempio.test',
    '/%2F%2Fesempio.test',
    '/%5Cesempio.test',
    '/..//esempio.test',
    '/a/../../esempio.test',
    '/?x=//esempio.test',
    '/#//esempio.test',
    '//esempio.test',
    '/\\esempio.test',
    'https://esempio.test',
    'javascript:alert(1)',
  ];

  it.each(candidati)('%s: concatenato all origine resta sul sito', (input) => {
    const risultato = valida(input);
    expect(risultato.startsWith('/')).toBe(true);
    expect(risultato.startsWith('//')).toBe(false);
    expect(new URL(`${ORIGIN}${risultato}`).origin).toBe(ORIGIN);
  });
});
