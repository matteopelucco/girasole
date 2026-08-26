import { describe, expect, it } from 'vitest';
import { righeOSollevaErrore } from './reportPresenze';

// righeOSollevaErrore è l'unica funzione pura di questo modulo (le altre
// fanno query Supabase, coperte solo da e2e — vedi CLAUDE.md). Copre il
// bug corretto in produzione: un errore di query mascherato da "nessun
// dato" produceva un report vuoto indistinguibile da una notte senza
// dati reali (vedi TASKS.md).
describe('righeOSollevaErrore', () => {
  it('restituisce data quando non c\'è errore', () => {
    const righe = [{ id: '1' }, { id: '2' }];
    expect(righeOSollevaErrore({ data: righe, error: null }, 'lettura sezioni')).toBe(righe);
  });

  it('restituisce un array vuoto se data è null e non c\'è errore', () => {
    expect(righeOSollevaErrore({ data: null, error: null }, 'lettura sezioni')).toEqual([]);
  });

  it('solleva un errore con la descrizione e il messaggio originale se la query è fallita', () => {
    expect(() =>
      righeOSollevaErrore({ data: null, error: { message: 'JWT invalid' } }, 'lettura sezioni')
    ).toThrow('lettura sezioni: JWT invalid');
  });
});
