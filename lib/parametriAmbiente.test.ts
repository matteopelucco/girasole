import { describe, expect, it } from 'vitest';
import { nomiParametriPresenti, SEGNAPOSTO_VALORE, valoriParametriPresenti } from './parametriAmbiente';
import { PARAMETRI_VISIBILI } from './parametriVisibili';

// I segreti critici che la lista NON deve contenere (decisione di Matteo,
// issue #287): abilitarli richiede di toglierli da qui, di proposito.
const SEGRETI_ESCLUSI = ['SUPABASE_SERVICE_ROLE_KEY', 'CRON_SECRET', 'RESEND_API_KEY', 'TURNSTILE_SECRET_KEY'];

// Ambiente finto che registra quali chiavi vengono lette: serve a
// dimostrare che le variabili fuori dalla lista non vengono mai toccate.
function ambienteTracciato(valori: Record<string, string>) {
  const lette: string[] = [];
  const env = new Proxy(valori, {
    get(target, chiave) {
      if (typeof chiave === 'string') lette.push(chiave);
      return Reflect.get(target, chiave);
    },
    ownKeys() {
      throw new Error("l'ambiente non va mai elencato per intero");
    },
  }) as Record<string, string | undefined>;
  return { env, lette };
}

describe('nomiParametriPresenti', () => {
  it('tiene solo i nomi della lista presenti nell\'ambiente, in ordine alfabetico', () => {
    const env = { ZETA: 'z', ALFA: 'a', MEZZO: 'm', FUORI_LISTA: 'x' };
    expect(nomiParametriPresenti(['ZETA', 'ALFA', 'MANCANTE', 'MEZZO'], env)).toEqual(['ALFA', 'MEZZO', 'ZETA']);
  });

  it('legge solo le chiavi della lista, mai il resto dell\'ambiente', () => {
    const { env, lette } = ambienteTracciato({ ALFA: 'a', SEGRETO: 's' });
    nomiParametriPresenti(['ALFA', 'BETA'], env);
    expect([...new Set(lette)].sort()).toEqual(['ALFA', 'BETA']);
  });

  it('ignora i doppioni e i nomi non validi', () => {
    const env = { ALFA: 'a', 'nome con spazi': 'x', __proto__x: 'y' };
    expect(nomiParametriPresenti(['ALFA', 'ALFA', 'nome con spazi', '', '__proto__'], env)).toEqual(['ALFA']);
  });

  it('una variabile definita ma vuota è presente', () => {
    expect(nomiParametriPresenti(['VUOTA'], { VUOTA: '' })).toEqual(['VUOTA']);
  });

  it('lista vuota o nessun nome presente: elenco vuoto (messaggio di cortesia)', () => {
    expect(nomiParametriPresenti([], { ALFA: 'a' })).toEqual([]);
    expect(nomiParametriPresenti(['BETA'], { ALFA: 'a' })).toEqual([]);
  });
});

describe('valoriParametriPresenti', () => {
  it('restituisce nome e valore dei soli nomi della lista, ordinati per nome', () => {
    const env = { ZETA: 'valore-z', ALFA: 'valore-a', FUORI_LISTA: 'segreto' };
    expect(valoriParametriPresenti(['ZETA', 'ALFA'], env)).toEqual([
      { nome: 'ALFA', valore: 'valore-a' },
      { nome: 'ZETA', valore: 'valore-z' },
    ]);
  });

  it('non legge le chiavi fuori dalla lista', () => {
    const { env, lette } = ambienteTracciato({ ALFA: 'a', SEGRETO: 's' });
    expect(valoriParametriPresenti(['ALFA'], env)).toEqual([{ nome: 'ALFA', valore: 'a' }]);
    expect(lette.includes('SEGRETO')).toBe(false);
  });
});

describe('SEGNAPOSTO_VALORE', () => {
  it('è fisso e non dipende dal valore (non ne rivela la lunghezza)', () => {
    expect(SEGNAPOSTO_VALORE.length).toBeGreaterThan(0);
    expect(SEGNAPOSTO_VALORE).not.toMatch(/[A-Za-z0-9]/);
  });
});

describe('PARAMETRI_VISIBILI (lista nel codice)', () => {
  it('contiene solo nomi validi, senza doppioni', () => {
    for (const nome of PARAMETRI_VISIBILI) expect(nome).toMatch(/^[A-Z][A-Z0-9_]*$/);
    expect(new Set(PARAMETRI_VISIBILI).size).toBe(PARAMETRI_VISIBILI.length);
  });

  it('non contiene i segreti critici esclusi di proposito', () => {
    for (const segreto of SEGRETI_ESCLUSI) expect(PARAMETRI_VISIBILI).not.toContain(segreto);
  });
});
