import { describe, expect, it } from 'vitest';
import { escapeHtml } from './htmlEscape';

describe('escapeHtml', () => {
  it('rende come testo un tag script', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('escapa la e commerciale', () => {
    expect(escapeHtml('Rossi & Figli')).toBe('Rossi &amp; Figli');
  });

  it('escapa virgolette doppie e singole', () => {
    expect(escapeHtml(`"doppie" e 'singole'`)).toBe('&quot;doppie&quot; e &#39;singole&#39;');
  });

  it('restituisce la stringa vuota invariata', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('lascia invariato un nome normale, accenti compresi', () => {
    expect(escapeHtml("Maria Rossi")).toBe('Maria Rossi');
    expect(escapeHtml('Niccolò Perù')).toBe('Niccolò Perù');
  });

  it('escapa sempre una volta: un valore già escapato viene escapato di nuovo', () => {
    // Il chiamante la usa sui dati grezzi; non c'è rilevamento dell'escaping.
    expect(escapeHtml('&lt;b&gt;')).toBe('&amp;lt;b&amp;gt;');
  });
});
