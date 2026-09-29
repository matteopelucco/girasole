import { describe, expect, it } from 'vitest';
import {
  ALLOW_LIST_SENZA_RLS,
  formattaSenzaRls,
  guardiaTabelle,
  normalizzaRighe,
  QUERY_RLS,
  trovaSenzaRls,
  type TabellaRls,
} from './rlsCheck';

const t = (tabella: string, rls: boolean, grantee: string[]): TabellaRls => ({ tabella, rls, grantee });

describe('trovaSenzaRls', () => {
  it('segnala una tabella con grant ad authenticated e RLS disattivata', () => {
    expect(trovaSenzaRls([t('bambini', false, ['authenticated'])])).toEqual([
      t('bambini', false, ['authenticated']),
    ]);
  });

  it('segnala anche il solo grant ad anon', () => {
    expect(trovaSenzaRls([t('x', false, ['anon'])])).toHaveLength(1);
  });

  it('ignora le tabelle con RLS attiva', () => {
    expect(trovaSenzaRls([t('bambini', true, ['authenticated', 'anon'])])).toEqual([]);
  });

  it('ignora le tabelle senza grant ad authenticated/anon', () => {
    expect(trovaSenzaRls([t('interna', false, ['service_role']), t('vuota', false, [])])).toEqual([]);
  });

  it('rispetta l allow-list esplicita', () => {
    expect(trovaSenzaRls([t('pubblica', false, ['anon'])], ['pubblica'])).toEqual([]);
  });

  it('l allow-list di default e vuota', () => {
    expect(ALLOW_LIST_SENZA_RLS).toEqual([]);
  });
});

describe('guardiaTabelle', () => {
  it('errore se non si leggono tabelle (risposta inattesa)', () => {
    expect(guardiaTabelle([])).toMatch(/non affidabile/);
  });
  it('null se ci sono tabelle', () => {
    expect(guardiaTabelle([t('bambini', true, [])])).toBeNull();
  });
  it('errore se manca una tabella nota (DB non migrato o ref sbagliato)', () => {
    expect(guardiaTabelle([t('a', true, [])])).toMatch(/bambini/);
  });
});

describe('formattaSenzaRls', () => {
  it('nomina tabella e ruoli e indica di abilitare RLS e definire policy, non togliere il grant', () => {
    const msg = formattaSenzaRls([t('bambini', false, ['anon', 'authenticated'])]);
    expect(msg).toContain('public.bambini');
    expect(msg).toContain('authenticated');
    expect(msg).toContain('anon');
    expect(msg).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(msg).toMatch(/policy/);
    expect(msg).toMatch(/NON togliere il grant/);
  });
});

describe('QUERY_RLS', () => {
  it('considera anche i grant solo su colonne', () => {
    expect(QUERY_RLS).toContain('has_any_column_privilege');
    expect(QUERY_RLS).toContain('has_table_privilege');
  });
});

describe('normalizzaRighe (fail-closed)', () => {
  it('accetta grantee array e forma testuale', () => {
    const r = normalizzaRighe([
      { tabella: 'a', rls: true, grantee: ['anon'] },
      { tabella: 'b', rls: false, grantee: '{anon,authenticated}' },
    ]);
    expect(r).toEqual({
      tabelle: [t('a', true, ['anon']), t('b', false, ['anon', 'authenticated'])],
    });
  });
  it('errore se grantee non e ne array ne stringa', () => {
    expect(normalizzaRighe([{ tabella: 'a', rls: true }])).toHaveProperty('errore');
    expect(normalizzaRighe([{ tabella: 'a', rls: true, grantee: null }])).toHaveProperty('errore');
  });
  it('errore se rls non e booleano', () => {
    expect(normalizzaRighe([{ tabella: 'a', rls: 'true', grantee: [] }])).toHaveProperty('errore');
    expect(normalizzaRighe([{ tabella: 'a', grantee: [] }])).toHaveProperty('errore');
  });
  it('errore se la risposta non e un array o la tabella non e una stringa', () => {
    expect(normalizzaRighe({})).toHaveProperty('errore');
    expect(normalizzaRighe([{ tabella: 1, rls: true, grantee: [] }])).toHaveProperty('errore');
  });
});
