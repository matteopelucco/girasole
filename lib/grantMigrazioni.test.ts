import { describe, expect, it } from 'vitest';
import {
  analizzaMigrazioni,
  formattaGrantMancanti,
  formattaTabelleSenzaGrant,
  guardiaAnalisi,
  tabelleSenzaGrant,
} from './grantMigrazioni';
import { verificaGrant } from './grantCheck';

const f = (nome: string, contenuto: string) => ({ nome, contenuto });

function privilegi(analisi: ReturnType<typeof analizzaMigrazioni>, ruolo: string, tabella: string): string[] {
  return analisi.grant
    .filter((g) => g.grantee === ruolo && g.tabella === tabella)
    .map((g) => g.privilegio)
    .sort();
}

describe('analizzaMigrazioni', () => {
  it('raccoglie le tabelle create e i grant per ruolo', () => {
    const a = analizzaMigrazioni([
      f(
        '0001.sql',
        `create table public.bambini (id uuid);
         grant select, insert on public.bambini to authenticated;
         grant select on public.bambini to service_role;`,
      ),
    ]);
    expect(a.tabelle).toEqual(['bambini']);
    expect(privilegi(a, 'authenticated', 'bambini')).toEqual(['INSERT', 'SELECT']);
    expect(privilegi(a, 'service_role', 'bambini')).toEqual(['SELECT']);
  });

  it('ignora commenti, funzioni e grant su funzioni o schemi', () => {
    const a = analizzaMigrazioni([
      f(
        '0001.sql',
        `-- grant delete on public.t to authenticated;
         create table if not exists public.t (id int);
         /* grant update on public.t to authenticated; */
         create function public.x() returns void language sql as $$ grant all on public.t to anon; $$;
         grant execute on function public.x() to authenticated;
         grant usage on schema public to authenticated;`,
      ),
    ]);
    expect(a.tabelle).toEqual(['t']);
    expect(a.grant).toEqual([]);
  });

  it('applica le revoke in ordine di nome file, anche con CRLF', () => {
    const a = analizzaMigrazioni([
      f('0002.sql', 'revoke insert, update on public.t from authenticated;\r\n'),
      f('0001.sql', 'create table public.t (id int);\r\ngrant select, insert, update on public.t to authenticated;\r\n'),
    ]);
    expect(privilegi(a, 'authenticated', 't')).toEqual(['SELECT']);
  });

  it('gestisce revoke all seguito da grant mirati', () => {
    const a = analizzaMigrazioni([
      f(
        '0001.sql',
        `create table public.t (id int);
         revoke all on public.t from public, anon, authenticated, service_role;
         grant select on public.t to authenticated;
         grant select, insert, update on public.t to service_role;`,
      ),
    ]);
    expect(privilegi(a, 'authenticated', 't')).toEqual(['SELECT']);
    expect(privilegi(a, 'service_role', 't')).toEqual(['INSERT', 'SELECT', 'UPDATE']);
    expect(privilegi(a, 'anon', 't')).toEqual([]);
  });

  it('conta il grant di colonna come privilegio sulla tabella', () => {
    const a = analizzaMigrazioni([
      f('0001.sql', 'create table public.t (a int, b int); grant update (a, b) on public.t to authenticated;'),
    ]);
    expect(privilegi(a, 'authenticated', 't')).toEqual(['UPDATE']);
  });

  it('gestisce grant su più tabelle nello stesso comando', () => {
    const a = analizzaMigrazioni([
      f('0001.sql', 'create table public.a (i int); create table public.b (i int); grant select on public.a, public.b to service_role;'),
    ]);
    expect(privilegi(a, 'service_role', 'a')).toEqual(['SELECT']);
    expect(privilegi(a, 'service_role', 'b')).toEqual(['SELECT']);
  });

  it('una tabella eliminata e ricreata riparte senza grant', () => {
    const a = analizzaMigrazioni([
      f('0001.sql', 'create table public.t (i int); grant select, insert on public.t to authenticated;'),
      f('0002.sql', 'drop table if exists public.t cascade; create table public.t (i int);'),
    ]);
    expect(a.tabelle).toEqual(['t']);
    expect(a.grant).toEqual([]);
  });

  it('segue il rename di una tabella con i suoi grant', () => {
    const a = analizzaMigrazioni([
      f('0001.sql', 'create table public.vecchia (i int); grant select on public.vecchia to authenticated;'),
      f('0002.sql', 'alter table public.vecchia rename to nuova;'),
    ]);
    expect(a.tabelle).toEqual(['nuova']);
    expect(privilegi(a, 'authenticated', 'nuova')).toEqual(['SELECT']);
  });
});

describe('tabelleSenzaGrant', () => {
  it('segnala una tabella senza grant esplicito', () => {
    const a = analizzaMigrazioni([f('0001.sql', 'create table public.nuova (i int);')]);
    expect(tabelleSenzaGrant(a, {})).toEqual(['nuova']);
  });

  it('non segnala una tabella ammessa né una con almeno un grant', () => {
    const a = analizzaMigrazioni([
      f('0001.sql', 'create table public.riservata (i int); create table public.ok (i int); grant select on public.ok to service_role;'),
    ]);
    expect(tabelleSenzaGrant(a, { riservata: 'solo via funzione' })).toEqual([]);
  });

  it('un grant solo ad anon non basta', () => {
    const a = analizzaMigrazioni([f('0001.sql', 'create table public.t (i int); grant select on public.t to anon;')]);
    expect(tabelleSenzaGrant(a, {})).toEqual(['t']);
  });
});

describe('confronto con le richieste del codice', () => {
  it('trova il grant mancante che il DB di test nasconderebbe con i default', () => {
    const a = analizzaMigrazioni([
      f('0001.sql', 'create table public.t (i int); grant select on public.t to authenticated;'),
    ]);
    const violazioni = verificaGrant(
      [
        { file: 'app/a.ts', ruolo: 'authenticated', tabella: 't', privilegio: 'SELECT' },
        { file: 'lib/cron.ts', ruolo: 'service_role', tabella: 't', privilegio: 'SELECT' },
      ],
      a.grant,
    );
    expect(violazioni).toEqual([{ file: 'lib/cron.ts', ruolo: 'service_role', tabella: 't', privilegio: 'SELECT' }]);
  });
});

describe('guardia e messaggi', () => {
  it('rifiuta un\'analisi vuota', () => {
    expect(guardiaAnalisi(analizzaMigrazioni([]))).not.toBeNull();
    expect(guardiaAnalisi(analizzaMigrazioni([f('0001.sql', 'create table public.t (i int);')]))).not.toBeNull();
    expect(
      guardiaAnalisi(analizzaMigrazioni([f('0001.sql', 'create table public.t (i int); grant select on public.t to authenticated;')])),
    ).toBeNull();
  });

  it('i messaggi nominano tabella e regola', () => {
    expect(formattaTabelleSenzaGrant(['x'])).toContain('public.x');
    expect(formattaGrantMancanti(['riga'])).toContain('riga');
  });
});
