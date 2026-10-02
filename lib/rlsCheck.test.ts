import { describe, expect, it } from 'vitest';
import {
  ALLOW_LIST_ESPOSTI_SENZA_RLS,
  ALLOW_LIST_SENZA_RLS,
  formattaEsposti,
  formattaSenzaRls,
  guardiaTabelle,
  hasSecurityInvoker,
  normalizzaRighe,
  QUERY_RLS,
  trovaEspostiSenzaRls,
  trovaSenzaRls,
  type OggettoRls,
  type Relkind,
} from './rlsCheck';

const o = (
  nome: string,
  relkind: Relkind,
  rls: boolean,
  grantee: string[],
  reloptions: string[] = [],
): OggettoRls => ({ nome, relkind, rls, grantee, reloptions });
const t = (nome: string, rls: boolean, grantee: string[]) => o(nome, 'r', rls, grantee);

describe('trovaSenzaRls (tabelle)', () => {
  it('segnala una tabella con grant ad authenticated e RLS disattivata', () => {
    expect(trovaSenzaRls([t('bambini', false, ['authenticated'])])).toEqual([
      t('bambini', false, ['authenticated']),
    ]);
  });

  it('segnala anche il solo grant ad anon e le tabelle partizionate', () => {
    expect(trovaSenzaRls([t('x', false, ['anon'])])).toHaveLength(1);
    expect(trovaSenzaRls([o('p', 'p', false, ['anon'])])).toHaveLength(1);
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

  it('non tratta viste, matview e tabelle esterne (relrowsecurity non si applica)', () => {
    expect(
      trovaSenzaRls([o('v', 'v', false, ['anon']), o('m', 'm', false, ['anon']), o('f', 'f', false, ['anon'])]),
    ).toEqual([]);
  });
});

describe('hasSecurityInvoker', () => {
  it('vero per security_invoker=true / on / yes / 1 (qualsiasi maiuscola)', () => {
    for (const v of ['true', 'on', 'yes', '1', 'TRUE', 'On', 't', 'y']) {
      expect(hasSecurityInvoker([`security_invoker=${v}`])).toBe(true);
    }
  });
  it('falso per =false / =off / valore ignoto / vuoto', () => {
    for (const v of ['false', 'off', 'no', '0', '', 'boh']) {
      expect(hasSecurityInvoker([`security_invoker=${v}`])).toBe(false);
    }
  });
  it('falso senza l opzione o con altre opzioni', () => {
    expect(hasSecurityInvoker([])).toBe(false);
    expect(hasSecurityInvoker(['security_barrier=true', 'check_option=local'])).toBe(false);
  });
  it('vero se security_invoker e tra piu opzioni', () => {
    expect(hasSecurityInvoker(['security_barrier=true', 'security_invoker=true'])).toBe(true);
  });
  it('non si fa ingannare da un nome opzione simile', () => {
    expect(hasSecurityInvoker(['xsecurity_invoker=true'])).toBe(false);
    expect(hasSecurityInvoker(['security_invoker_x=true'])).toBe(false);
  });
  it('se l opzione e ripetuta vale l ultima (fail-closed in caso di dubbio)', () => {
    expect(hasSecurityInvoker(['security_invoker=true', 'security_invoker=false'])).toBe(false);
  });
});

describe('trovaEspostiSenzaRls (viste, matview, tabelle esterne)', () => {
  it('segnala una vista con grant e senza security_invoker', () => {
    const v = o('v_bambini', 'v', false, ['authenticated']);
    expect(trovaEspostiSenzaRls([v])).toEqual([v]);
  });

  it('segnala una vista con security_invoker=false o altre opzioni', () => {
    expect(trovaEspostiSenzaRls([o('v', 'v', false, ['anon'], ['security_invoker=false'])])).toHaveLength(1);
    expect(trovaEspostiSenzaRls([o('v', 'v', false, ['anon'], ['security_barrier=true'])])).toHaveLength(1);
  });

  it('accetta una vista con security_invoker=true (o on)', () => {
    expect(trovaEspostiSenzaRls([o('v', 'v', false, ['anon', 'authenticated'], ['security_invoker=true'])])).toEqual(
      [],
    );
    expect(trovaEspostiSenzaRls([o('v', 'v', false, ['anon'], ['security_invoker=on'])])).toEqual([]);
  });

  it('segnala viste materializzate e tabelle esterne con grant, anche con security_invoker', () => {
    expect(trovaEspostiSenzaRls([o('m', 'm', false, ['anon'])])).toHaveLength(1);
    expect(trovaEspostiSenzaRls([o('f', 'f', false, ['authenticated'])])).toHaveLength(1);
    expect(trovaEspostiSenzaRls([o('m', 'm', false, ['anon'], ['security_invoker=true'])])).toHaveLength(1);
    expect(trovaEspostiSenzaRls([o('f', 'f', false, ['anon'], ['security_invoker=true'])])).toHaveLength(1);
  });

  it('ignora gli oggetti senza grant ad anon/authenticated', () => {
    expect(
      trovaEspostiSenzaRls([
        o('v', 'v', false, []),
        o('m', 'm', false, ['service_role']),
        o('f', 'f', false, ['postgres']),
      ]),
    ).toEqual([]);
  });

  it('ignora le tabelle (le copre trovaSenzaRls)', () => {
    expect(trovaEspostiSenzaRls([t('x', false, ['anon'])])).toEqual([]);
  });

  it('rispetta l allow-list esplicita', () => {
    expect(trovaEspostiSenzaRls([o('pubblica', 'v', false, ['anon'])], ['pubblica'])).toEqual([]);
  });

  it('l allow-list di default e vuota', () => {
    expect(ALLOW_LIST_ESPOSTI_SENZA_RLS).toEqual([]);
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
  it('errore se la tabella nota e presente solo come vista', () => {
    expect(guardiaTabelle([o('bambini', 'v', false, [])])).toMatch(/bambini/);
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

describe('formattaEsposti', () => {
  it('per una vista indica security_invoker o togliere il grant', () => {
    const msg = formattaEsposti([o('v_x', 'v', false, ['anon', 'authenticated'])]);
    expect(msg).toContain('public.v_x');
    expect(msg).toContain('vista');
    expect(msg).toContain('anon');
    expect(msg).toContain('authenticated');
    expect(msg).toMatch(/security_invoker = true/);
    expect(msg).toMatch(/REVOKE/);
    expect(msg).toMatch(/ALLOW_LIST_ESPOSTI_SENZA_RLS/);
  });
  it('distingue vista materializzata e tabella esterna', () => {
    const msg = formattaEsposti([o('m_x', 'm', false, ['anon']), o('f_x', 'f', false, ['authenticated'])]);
    expect(msg).toMatch(/vista materializzata/);
    expect(msg).toMatch(/tabella esterna/);
  });
});

describe('QUERY_RLS', () => {
  it('considera anche i grant solo su colonne', () => {
    expect(QUERY_RLS).toContain('has_any_column_privilege');
    expect(QUERY_RLS).toContain('has_table_privilege');
  });
  it('legge tabelle, viste, matview e tabelle esterne con relkind e reloptions', () => {
    for (const k of ["'r'", "'p'", "'v'", "'m'", "'f'"]) expect(QUERY_RLS).toContain(k);
    expect(QUERY_RLS).toContain('c.relkind');
    expect(QUERY_RLS).toContain('c.reloptions');
  });
  it('e di sola lettura', () => {
    expect(QUERY_RLS.trim().toLowerCase().startsWith('select')).toBe(true);
    expect(QUERY_RLS).not.toContain(';');
  });
});

describe('normalizzaRighe (fail-closed)', () => {
  const riga = (extra: Record<string, unknown> = {}) => ({
    nome: 'a',
    relkind: 'r',
    rls: true,
    grantee: ['anon'],
    reloptions: null,
    ...extra,
  });

  it('accetta grantee array e forma testuale', () => {
    const r = normalizzaRighe([
      riga(),
      riga({ nome: 'b', rls: false, grantee: '{anon,authenticated}' }),
    ]);
    expect(r).toEqual({
      oggetti: [o('a', 'r', true, ['anon']), o('b', 'r', false, ['anon', 'authenticated'])],
    });
  });
  it('accetta tutti i relkind attesi', () => {
    for (const k of ['r', 'p', 'v', 'm', 'f']) {
      expect(normalizzaRighe([riga({ relkind: k })])).toHaveProperty('oggetti');
    }
  });
  it('errore per relkind ignoto, mancante o non stringa', () => {
    expect(normalizzaRighe([riga({ relkind: 'S' })])).toHaveProperty('errore');
    expect(normalizzaRighe([riga({ relkind: undefined })])).toHaveProperty('errore');
    expect(normalizzaRighe([riga({ relkind: 1 })])).toHaveProperty('errore');
  });
  it('errore se grantee non e ne array ne stringa', () => {
    expect(normalizzaRighe([riga({ grantee: undefined })])).toHaveProperty('errore');
    expect(normalizzaRighe([riga({ grantee: null })])).toHaveProperty('errore');
    expect(normalizzaRighe([riga({ grantee: [1] })])).toHaveProperty('errore');
  });
  it('errore se rls non e booleano', () => {
    expect(normalizzaRighe([riga({ rls: 'true' })])).toHaveProperty('errore');
    expect(normalizzaRighe([riga({ rls: undefined })])).toHaveProperty('errore');
  });
  it('errore se la risposta non e un array, la riga non e un oggetto o il nome non e una stringa', () => {
    expect(normalizzaRighe({})).toHaveProperty('errore');
    expect(normalizzaRighe([null])).toHaveProperty('errore');
    expect(normalizzaRighe(['x'])).toHaveProperty('errore');
    expect(normalizzaRighe([riga({ nome: 1 })])).toHaveProperty('errore');
  });

  describe('reloptions', () => {
    const opt = (reloptions: unknown) => {
      const r = normalizzaRighe([riga({ relkind: 'v', rls: false, reloptions })]);
      return 'oggetti' in r ? r.oggetti[0].reloptions : r;
    };
    it('array di stringhe', () => {
      expect(opt(['security_invoker=true', 'security_barrier=false'])).toEqual([
        'security_invoker=true',
        'security_barrier=false',
      ]);
      expect(opt(['security_invoker=on'])).toEqual(['security_invoker=on']);
      expect(opt(['security_invoker=false'])).toEqual(['security_invoker=false']);
    });
    it('null o mancante = nessuna opzione (la vista risultera senza security_invoker)', () => {
      expect(opt(null)).toEqual([]);
      expect(opt(undefined)).toEqual([]);
      expect(opt([])).toEqual([]);
    });
    it('forma testuale di un array Postgres', () => {
      expect(opt('{security_invoker=true,security_barrier=false}')).toEqual([
        'security_invoker=true',
        'security_barrier=false',
      ]);
      expect(opt('{"security_invoker=true"}')).toEqual(['security_invoker=true']);
      expect(opt('{}')).toEqual([]);
    });
    it('errore per forme inattese', () => {
      expect(opt('security_invoker=true')).toHaveProperty('errore');
      expect(opt({})).toHaveProperty('errore');
      expect(opt(true)).toHaveProperty('errore');
      expect(opt([1])).toHaveProperty('errore');
    });
  });

  it('una vista senza reloptions nella risposta viene poi segnalata (mai accettata in silenzio)', () => {
    const r = normalizzaRighe([riga({ nome: 'v', relkind: 'v', rls: false, reloptions: undefined })]);
    expect('oggetti' in r && trovaEspostiSenzaRls(r.oggetti)).toHaveLength(1);
  });
});
