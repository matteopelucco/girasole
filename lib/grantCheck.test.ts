import { describe, expect, it } from 'vitest';
import {
  estraiRichieste,
  guardiaRichieste,
  formattaViolazioni,
  verificaGrant,
  type GrantDb,
} from './grantCheck';

describe('estraiRichieste', () => {
  it('attribuisce ad authenticated le query col client utente', () => {
    const src = `
export async function leggi() {
  const supabase = createClient();
  const { data } = await supabase.from('bambini').select('*');
}
`;
    expect(estraiRichieste('a.ts', src)).toEqual([
      { file: 'a.ts', ruolo: 'authenticated', tabella: 'bambini', privilegio: 'SELECT' },
    ]);
  });

  it('attribuisce a service_role le funzioni che usano createAdminClient', () => {
    const src = `
export async function scrivi() {
  const admin = createAdminClient();
  await admin.from('pasti_comunicati').insert({ a: 1 });
}
`;
    expect(estraiRichieste('b.ts', src)).toEqual([
      { file: 'b.ts', ruolo: 'service_role', tabella: 'pasti_comunicati', privilegio: 'INSERT' },
    ]);
  });

  it('separa i ruoli in funzioni diverse dello stesso file', () => {
    const src = `
export async function utente() {
  const supabase = createClient();
  await supabase.from('presenze').select('id');
}

export async function cron() {
  const admin = createAdminClient();
  await admin.from('presenze').update({ a: 1 }).eq('id', 1);
}
`;
    const r = estraiRichieste('c.ts', src);
    expect(r).toContainEqual({ file: 'c.ts', ruolo: 'authenticated', tabella: 'presenze', privilegio: 'SELECT' });
    expect(r).toContainEqual({ file: 'c.ts', ruolo: 'service_role', tabella: 'presenze', privilegio: 'UPDATE' });
    expect(r).toHaveLength(2);
  });

  it('nella stessa funzione distingue il client admin dal client utente', () => {
    const src = `
export async function mista() {
  const { supabase } = await requireAdmin();
  const admin = createAdminClient();
  await admin.auth.admin.createUser({});
  await supabase.from('profili').update({ a: 1 });
  await admin
    .from('pasti')
    .select('id');
}
`;
    const r = estraiRichieste('m.ts', src);
    expect(r).toContainEqual({ file: 'm.ts', ruolo: 'authenticated', tabella: 'profili', privilegio: 'UPDATE' });
    expect(r).toContainEqual({ file: 'm.ts', ruolo: 'service_role', tabella: 'pasti', privilegio: 'SELECT' });
    expect(r).toHaveLength(2);
  });

  it('riconosce insert, update, delete e upsert (insert + update) su catene multilinea', () => {
    const src = `
export async function f() {
  const supabase = createClient();
  await supabase
    .from('sezioni')
    .insert({ a: 1 })
    .select();
  await supabase.from('bambini').delete().eq('id', 1);
  await supabase.from('profili').upsert({ a: 1 });
}
`;
    const r = estraiRichieste('d.ts', src).map((x) => `${x.tabella}:${x.privilegio}`).sort();
    expect(r).toEqual(['bambini:DELETE', 'profili:INSERT', 'profili:UPDATE', 'sezioni:INSERT']);
  });

  it('un parametro SupabaseClient generico richiede il grant per entrambi i ruoli', () => {
    const src = `
export async function chiusuraPerData(supabase: SupabaseClient, data: string) {
  const { data: r } = await supabase.from('giorni_chiusura').select('*');
}
`;
    const r = estraiRichieste('g.ts', src);
    expect(r).toContainEqual({ file: 'g.ts', ruolo: 'authenticated', tabella: 'giorni_chiusura', privilegio: 'SELECT' });
    expect(r).toContainEqual({ file: 'g.ts', ruolo: 'service_role', tabella: 'giorni_chiusura', privilegio: 'SELECT' });
    expect(r).toHaveLength(2);
  });

  it('un parametro SupabaseClient<Database> generico conta per entrambi i ruoli', () => {
    const src = `
async function f(sb: SupabaseClient<Database>) {
  await sb.from('pasti').select();
}
`;
    expect(estraiRichieste('g2.ts', src).map((x) => x.ruolo).sort()).toEqual(['authenticated', 'service_role']);
  });

  it('l\'annotazione grant-check: service_role attribuisce la funzione solo a service_role', () => {
    const src = `
export async function utente(supabase: SupabaseClient) {
  await supabase.from('bambini').select();
}

// grant-check: service_role
export async function soloCron(supabase: SupabaseClient) {
  await supabase.from('allarmi').insert({});
}

export async function altra(supabase: SupabaseClient) {
  await supabase.from('profili').select();
}
`;
    const r = estraiRichieste('h.ts', src);
    expect(r.filter((x) => x.tabella === 'allarmi')).toEqual([
      { file: 'h.ts', ruolo: 'service_role', tabella: 'allarmi', privilegio: 'INSERT' },
    ]);
    expect(r.filter((x) => x.tabella === 'bambini')).toHaveLength(2);
    expect(r.filter((x) => x.tabella === 'profili')).toHaveLength(2);
  });

  it('l\'annotazione grant-check: authenticated attribuisce la funzione solo ad authenticated', () => {
    const src = `
// grant-check: authenticated
async function soloUtente(supabase: SupabaseClient) {
  await supabase.from('presenze').upsert({});
}
`;
    expect(estraiRichieste('j.ts', src).map((x) => x.ruolo)).toEqual(['authenticated', 'authenticated']);
  });

  it('la stessa annotazione vale anche con async arrow const', () => {
    const src = `
// grant-check: service_role
export const cron = async (supabase: SupabaseClient) => {
  await supabase.from('allarmi').select();
};
`;
    expect(estraiRichieste('i.ts', src).map((x) => x.ruolo)).toEqual(['service_role']);
  });

  it('ignora i commenti e Array.from/Buffer.from', () => {
    const src = `
// supabase.from('finta').select()
/* .from('finta2') */
 * .from('finta3')
export function f() {
  return Array.from(x) + Buffer.from('abc');
}
`;
    expect(estraiRichieste('e.ts', src)).toEqual([]);
  });
});

describe('verificaGrant', () => {
  const richieste = estraiRichieste(
    'app/x.ts',
    `
export async function f() {
  const supabase = createClient();
  await supabase.from('bambini').select();
  await supabase.from('bambini').insert({});
}
`,
  );

  it('nessuna violazione se i grant ci sono', () => {
    const grant: GrantDb = [
      { grantee: 'authenticated', tabella: 'bambini', privilegio: 'SELECT' },
      { grantee: 'authenticated', tabella: 'bambini', privilegio: 'INSERT' },
    ];
    expect(verificaGrant(richieste, grant)).toEqual([]);
  });

  it('segnala tabella, ruolo e privilegio mancanti', () => {
    const grant: GrantDb = [{ grantee: 'authenticated', tabella: 'bambini', privilegio: 'SELECT' }];
    const v = verificaGrant(richieste, grant);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ ruolo: 'authenticated', tabella: 'bambini', privilegio: 'INSERT' });
    expect(formattaViolazioni(v)).toContain('bambini');
    expect(formattaViolazioni(v)).toContain('INSERT');
    expect(formattaViolazioni(v)).toContain('app/x.ts');
  });

  it('un grant a un altro ruolo non conta', () => {
    const grant: GrantDb = [
      { grantee: 'service_role', tabella: 'bambini', privilegio: 'SELECT' },
      { grantee: 'service_role', tabella: 'bambini', privilegio: 'INSERT' },
    ];
    expect(verificaGrant(richieste, grant)).toHaveLength(2);
  });

  it('deduplica le richieste identiche', () => {
    const doppie = [...richieste, ...richieste];
    expect(verificaGrant(doppie, [])).toHaveLength(2);
  });
});


describe('formattaViolazioni: rimedio', () => {
  it('indica di attribuire il client a service_role, non di concedere ad authenticated', () => {
    const v = verificaGrant(
      [{ file: 'a.ts', ruolo: 'authenticated', tabella: 't', privilegio: 'SELECT' }],
      [],
    );
    const msg = formattaViolazioni(v);
    expect(msg).toContain('grant-check: service_role');
    expect(msg).toContain('NON');
    expect(msg).toContain('verifica RLS');
    expect(msg).toContain('anti permission-denied');
  });
});

describe('guardiaRichieste', () => {
  it('segnala un elenco vuoto (parser rotto)', () => {
    expect(guardiaRichieste([])).toMatch(/nessuna richiesta/i);
  });
  it('ok se ci sono richieste', () => {
    expect(
      guardiaRichieste([{ file: 'a.ts', ruolo: 'authenticated', tabella: 't', privilegio: 'SELECT' }]),
    ).toBeNull();
  });
});
