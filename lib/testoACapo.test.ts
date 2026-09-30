import { describe, expect, it } from 'vitest';
import { altezzaRigaTabella, righeDiTesto, sostituisciNonCodificabili } from './testoACapo';

// Font finto: ogni carattere è largo 1, così le larghezze sono esatte.
const misura = (testo: string) => testo.length;

describe('righeDiTesto', () => {
  it('un testo corto resta su una sola riga', () => {
    expect(righeDiTesto('ciao mondo', 20, misura)).toEqual(['ciao mondo']);
  });

  it('una stringa vuota o di soli spazi dà una riga vuota (la riga esiste comunque)', () => {
    expect(righeDiTesto('', 10, misura)).toEqual(['']);
    expect(righeDiTesto('   ', 10, misura)).toEqual(['']);
  });

  it('un testo lungo va a capo tra le parole, senza superare la larghezza', () => {
    const righe = righeDiTesto('Pre-asilo al posto di Lucia (1.5) + 3h SARA: da definire', 20, misura);
    expect(righe.length).toBeGreaterThan(2);
    for (const riga of righe) expect(misura(riga)).toBeLessThanOrEqual(20);
    // Nessuna parola persa: il testo ricomposto è quello di partenza.
    expect(righe.join(' ')).toBe('Pre-asilo al posto di Lucia (1.5) + 3h SARA: da definire');
  });

  it('una parola più larga della colonna viene spezzata, senza perdere caratteri', () => {
    const righe = righeDiTesto('Supercalifragilistichespiralidoso', 10, misura);
    for (const riga of righe) expect(misura(riga)).toBeLessThanOrEqual(10);
    expect(righe.join('')).toBe('Supercalifragilistichespiralidoso');
  });

  it('una parola lunga dopo altre parole parte da una riga nuova', () => {
    const righe = righeDiTesto('ab Supercalifragilistico', 10, misura);
    expect(righe[0]).toBe('ab');
    expect(righe.slice(1).join('')).toBe('Supercalifragilistico');
    for (const riga of righe) expect(misura(riga)).toBeLessThanOrEqual(10);
  });

  it('spazi multipli e a-capo nel testo sono ridotti a uno spazio', () => {
    expect(righeDiTesto('a  b\nc', 20, misura)).toEqual(['a b c']);
  });

  it('larghezza non positiva: non va in loop, una lettera per riga', () => {
    expect(righeDiTesto('abc', 0, misura)).toEqual(['a', 'b', 'c']);
  });
});

describe('altezzaRigaTabella', () => {
  it('una riga di testo vale l\'altezza standard', () => {
    expect(altezzaRigaTabella(1)).toBe(16);
  });

  it('ogni riga di testo in più aggiunge un\'interlinea', () => {
    expect(altezzaRigaTabella(3)).toBeGreaterThan(altezzaRigaTabella(2));
    expect(altezzaRigaTabella(2) - altezzaRigaTabella(1)).toBe(altezzaRigaTabella(3) - altezzaRigaTabella(2));
  });

  it('zero righe (nessuna cella) vale come una', () => {
    expect(altezzaRigaTabella(0)).toBe(altezzaRigaTabella(1));
  });
});

describe('sostituisciNonCodificabili', () => {
  const supporta = (cp: number) => cp < 0x100;

  it('lascia intatto il testo codificabile (accenti compresi)', () => {
    expect(sostituisciNonCodificabili('perché già', supporta)).toBe('perché già');
  });

  it('sostituisce con "?" ogni carattere non codificabile, emoji incluse', () => {
    expect(sostituisciNonCodificabili('ok ⚠ fatto 😀', supporta)).toBe('ok ? fatto ?');
  });
});
