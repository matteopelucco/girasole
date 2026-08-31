import { describe, expect, it } from 'vitest';
import { totaleOreSettimanali } from './profiliOrari';

// totaleOreSettimanali è pura (nessun I/O): copre i casi limite del
// calcolo del totale ore settimanali di specs/54 - profili-orari.md.
describe('totaleOreSettimanali', () => {
  it('35 ore settimanali: 7 ore per 5 giorni', () => {
    const profilo = { ore_lunedi: 7, ore_martedi: 7, ore_mercoledi: 7, ore_giovedi: 7, ore_venerdi: 7 };
    expect(totaleOreSettimanali(profilo)).toBe(35);
  });

  it('32 ore settimanali: 4 giorni a 7 ore, 1 giorno a 4 ore', () => {
    const profilo = { ore_lunedi: 7, ore_martedi: 7, ore_mercoledi: 7, ore_giovedi: 7, ore_venerdi: 4 };
    expect(totaleOreSettimanali(profilo)).toBe(32);
  });

  it('assistente a 3 ore al giorno: 15 ore settimanali', () => {
    const profilo = { ore_lunedi: 3, ore_martedi: 3, ore_mercoledi: 3, ore_giovedi: 3, ore_venerdi: 3 };
    expect(totaleOreSettimanali(profilo)).toBe(15);
  });

  it('somma anche mezz\'ore (decimali) correttamente', () => {
    const profilo = { ore_lunedi: 7.5, ore_martedi: 7.5, ore_mercoledi: 7.5, ore_giovedi: 7.5, ore_venerdi: 4.5 };
    expect(totaleOreSettimanali(profilo)).toBe(34.5);
  });

  it('un profilo con tutti i giorni a zero ha totale zero', () => {
    const profilo = { ore_lunedi: 0, ore_martedi: 0, ore_mercoledi: 0, ore_giovedi: 0, ore_venerdi: 0 };
    expect(totaleOreSettimanali(profilo)).toBe(0);
  });

  it('un giorno non lavorato (0 ore) in mezzo agli altri', () => {
    const profilo = { ore_lunedi: 6, ore_martedi: 6, ore_mercoledi: 0, ore_giovedi: 6, ore_venerdi: 6 };
    expect(totaleOreSettimanali(profilo)).toBe(24);
  });
});
