import { describe, expect, it } from 'vitest';
import {
  DURATA_BLOCCO_MS,
  MAX_TENTATIVI_FALLITI,
  messaggioBlocco,
  minutiBloccoRimanenti,
  registraTentativo,
  type StatoTentativi,
} from './limiteTentativi';

const T0 = Date.UTC(2026, 9, 11, 10, 0, 0);

function dopoTentativi(n: number, ora = T0): StatoTentativi | undefined {
  let stato: StatoTentativi | undefined;
  for (let i = 0; i < n; i++) stato = registraTentativo(stato, ora);
  return stato;
}

describe('limite tentativi di verifica della password', () => {
  it('nessun tentativo: non bloccato', () => {
    expect(minutiBloccoRimanenti(undefined, T0)).toBe(0);
  });

  it('sotto il limite: non bloccato', () => {
    expect(minutiBloccoRimanenti(dopoTentativi(MAX_TENTATIVI_FALLITI - 1), T0)).toBe(0);
  });

  it('al limite di tentativi falliti: bloccato per tutta la durata del blocco', () => {
    const stato = dopoTentativi(MAX_TENTATIVI_FALLITI);
    expect(minutiBloccoRimanenti(stato, T0)).toBe(DURATA_BLOCCO_MS / 60_000);
    expect(minutiBloccoRimanenti(stato, T0 + DURATA_BLOCCO_MS - 1)).toBe(1);
  });

  it('i minuti rimanenti si arrotondano per eccesso', () => {
    const stato = dopoTentativi(MAX_TENTATIVI_FALLITI);
    expect(minutiBloccoRimanenti(stato, T0 + 60_000 + 1)).toBe(DURATA_BLOCCO_MS / 60_000 - 1);
  });

  it('allo scadere del blocco si riparte da zero', () => {
    const stato = dopoTentativi(MAX_TENTATIVI_FALLITI);
    const dopo = T0 + DURATA_BLOCCO_MS;
    expect(minutiBloccoRimanenti(stato, dopo)).toBe(0);
    const nuovo = registraTentativo(stato, dopo);
    expect(nuovo).toEqual({ falliti: 1, bloccatoFino: null });
  });

  it('il blocco non si allunga se si registrano altri tentativi mentre è attivo', () => {
    const stato = dopoTentativi(MAX_TENTATIVI_FALLITI);
    const ancora = registraTentativo(stato, T0 + 60_000);
    expect(ancora.bloccatoFino).toBe(stato?.bloccatoFino);
  });

  it('il limite è un numero piccolo e il blocco dura qualche minuto', () => {
    expect(MAX_TENTATIVI_FALLITI).toBeGreaterThanOrEqual(3);
    expect(MAX_TENTATIVI_FALLITI).toBeLessThanOrEqual(10);
    expect(DURATA_BLOCCO_MS).toBeGreaterThanOrEqual(5 * 60_000);
  });

  it('messaggio in italiano, singolare e plurale', () => {
    expect(messaggioBlocco(1)).toBe('Troppi tentativi. Riprova tra 1 minuto.');
    expect(messaggioBlocco(15)).toBe('Troppi tentativi. Riprova tra 15 minuti.');
  });
});
