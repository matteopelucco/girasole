-- Girasole — test pgTAP sulla conferma del mese del monte ore
-- (issue #403; specs/19 - monte-ore.md, scenari MOR-04, MOR-05, MOR-06, MOR-09;
-- migration prevista 0072).
--
-- Comportamento atteso dalla migration 0072 su public.monte_ore_movimenti:
--   * colonna `mese_competenza` di tipo date (primo giorno del mese);
--   * nuovo valore `conferma_mese` nel check di `tipo`, con vincoli: mese di
--     competenza sempre valorizzato e nessuna `settimana_inizio`;
--   * indice unico parziale su (utente_id, mese_competenza) dove
--     tipo = 'conferma_mese': una sola conferma per persona e mese, anche con
--     richieste simultanee (MOR-06);
--   * nessuna nuova policy e nessun GRANT in più: insert/update/delete restano
--     solo admin (MOR-04), select al diretto interessato e all'admin.
-- Il backfill dei movimenti esistenti (competenza = mese di `created_at` nel
-- fuso Europe/Rome, MOR-09) vive nella migration e si esercita col `db reset`
-- della CI; qui si verifica che il saldo resti la somma delle `variazione`
-- qualunque sia la competenza.
--
-- Tutto dentro una transazione chiusa da `rollback`. Dati fittizi. Si esegue
-- con `supabase test db`. Mai sulla produzione.

begin;

create extension if not exists pgtap with schema extensions;

do $$
begin
  set local role postgres;
exception when others then
  raise notice 'set local role postgres non riuscito: % (%)', sqlerrm, sqlstate;
end;
$$;

do $$
begin
  execute format(
    'set local search_path to public, %s, pg_temp',
    (select quote_ident(n.nspname)
       from pg_extension e join pg_namespace n on n.oid = e.extnamespace
      where e.extname = 'pgtap')
  );
end;
$$;

select plan(30);

-- Helper (temporanei: spariscono con la transazione) ----------------------
create function pg_temp.impersona(p_uid uuid) returns void
language plpgsql as $$
begin
  if p_uid is null then
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    perform set_config('role', 'anon', true);
  else
    perform set_config(
      'request.jwt.claims',
      json_build_object('sub', p_uid, 'role', 'authenticated')::text,
      true
    );
    perform set_config('role', 'authenticated', true);
  end if;
end;
$$;

-- Esegue uno statement come p_uid e restituisce lo SQLSTATE dell'errore
-- ('ok' se non ne ha dati; UPDATE/DELETE bloccati dalla RLS non danno errore
-- ma zero righe).
create function pg_temp.write_as(p_uid uuid, p_sql text) returns text
language plpgsql as $$
declare
  v_prev text := current_user;
  v_state text := 'ok';
begin
  perform pg_temp.impersona(p_uid);
  begin
    execute p_sql;
  exception when others then
    v_state := sqlstate;
  end;
  perform set_config('role', v_prev, true);
  return v_state;
end;
$$;

-- INSERT di un movimento con tutti i campi obbligatori espliciti.
create function pg_temp.insert_sql(
  p_utente uuid, p_tipo text, p_settimana text, p_variazione numeric, p_nota text, p_competenza text
) returns text
language sql as $$
  select format(
    $q$insert into public.monte_ore_movimenti
         (utente_id, tipo, settimana_inizio, variazione, nota, mese_competenza)
       values (%L, %L, %L, %s, %L, %L)$q$,
    p_utente, p_tipo, p_settimana, p_variazione, p_nota, p_competenza
  );
$$;

-- Fixture (come postgres, con bypass RLS) ----------------------------------
--   admin a0..01, maestra a0..02 (dipendente interessata), assistente a0..03,
--   genitore a0..04, seconda maestra a0..05
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-0000-0000-000000000001', 'pgtap.admin@example.test', '{"ruolo":"admin"}'),
  ('a0000000-0000-0000-0000-000000000002', 'pgtap.maestra@example.test', '{"ruolo":"maestra"}'),
  ('a0000000-0000-0000-0000-000000000003', 'pgtap.assistente@example.test', '{"ruolo":"assistente"}'),
  ('a0000000-0000-0000-0000-000000000004', 'pgtap.genitore@example.test', '{"ruolo":"genitore"}'),
  ('a0000000-0000-0000-0000-000000000005', 'pgtap.maestra2@example.test', '{"ruolo":"maestra"}');

-- Movimenti di partenza della maestra a0..02: un precarico di ottobre registrato
-- a novembre (competenza ottobre) e un precarico di novembre.
insert into public.monte_ore_movimenti
  (id, utente_id, tipo, settimana_inizio, variazione, nota, mese_competenza, created_at)
values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002',
   'precarico', null, 3, 'Precarico ottobre', '2026-10-01', '2026-11-02 10:00:00+00'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002',
   'precarico', null, -1, 'Precarico novembre', '2026-11-01', '2026-11-03 10:00:00+00');

-- =========================================================================
-- Schema: colonna, tipo, indice unico parziale
-- =========================================================================
select has_column('public', 'monte_ore_movimenti', 'mese_competenza', 'mese_competenza: colonna presente');
select col_type_is('public', 'monte_ore_movimenti', 'mese_competenza', 'date', 'mese_competenza: tipo date');

select ok(
  exists (
    select 1
      from pg_index i
      join pg_class c on c.oid = i.indrelid
     where c.oid = 'public.monte_ore_movimenti'::regclass
       and i.indisunique
       and i.indpred is not null
       and pg_get_expr(i.indpred, i.indrelid) like '%conferma_mese%'
       and (select array_agg(a.attname::text order by k.ord)
              from unnest(i.indkey::int2[]) with ordinality as k(attnum, ord)
              join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum)
           = array['utente_id', 'mese_competenza']
  ),
  'indice unico parziale su (utente_id, mese_competenza) solo per tipo conferma_mese'
);

-- =========================================================================
-- MOR-06: una sola conferma per persona e mese
-- =========================================================================
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
    pg_temp.insert_sql('a0000000-0000-0000-0000-000000000002', 'conferma_mese', null, 14.5,
                       'Conferma differenza ore di ottobre 2026', '2026-10-01')),
  'ok',
  'MOR-02: l''admin registra una conferma_mese con competenza ottobre (registrata a novembre)'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
    pg_temp.insert_sql('a0000000-0000-0000-0000-000000000002', 'conferma_mese', null, 14.5,
                       'Conferma differenza ore di ottobre 2026 (doppione)', '2026-10-01')),
  '23505',
  'MOR-06: una seconda conferma per lo stesso utente e mese viola l''indice unico'
);
select is(
  (select count(*)::int from public.monte_ore_movimenti
    where utente_id = 'a0000000-0000-0000-0000-000000000002'
      and tipo = 'conferma_mese' and mese_competenza = '2026-10-01'),
  1,
  'MOR-06: resta una sola conferma per quella persona e quel mese'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
    pg_temp.insert_sql('a0000000-0000-0000-0000-000000000002', 'conferma_mese', null, -6,
                       'Conferma differenza ore di settembre 2026: da recuperare', '2026-09-01')),
  'ok',
  'MOR-03: la stessa persona può avere una conferma (negativa) in un mese diverso'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
    pg_temp.insert_sql('a0000000-0000-0000-0000-000000000005', 'conferma_mese', null, 14.5,
                       'Conferma differenza ore di ottobre 2026', '2026-10-01')),
  'ok',
  'MOR-06: un''altra persona può avere la conferma dello stesso mese'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
    pg_temp.insert_sql('a0000000-0000-0000-0000-000000000002', 'precarico', null, 1,
                       'Altro precarico di ottobre', '2026-10-01')),
  'ok',
  'l''indice unico non riguarda i precarichi: più movimenti manuali nello stesso mese restano ammessi'
);

-- =========================================================================
-- Vincoli sulla conferma e sul tipo
-- =========================================================================
select ok(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
    pg_temp.insert_sql('a0000000-0000-0000-0000-000000000005', 'conferma_mese', null, 2,
                       'Conferma senza competenza', null)) in ('23502', '23514'),
  'una conferma_mese senza mese di competenza viene rifiutata'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
    pg_temp.insert_sql('a0000000-0000-0000-0000-000000000005', 'conferma_mese', '2026-10-05', 2,
                       'Conferma con settimana', '2026-08-01')),
  '23514',
  'una conferma_mese con settimana_inizio viene rifiutata'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
    pg_temp.insert_sql('a0000000-0000-0000-0000-000000000005', 'conferma', null, 2,
                       'Tipo non previsto', '2026-08-01')),
  '23514',
  'un tipo diverso da quelli previsti (es. "conferma") viene rifiutato dal check'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
    pg_temp.insert_sql('a0000000-0000-0000-0000-000000000005', 'precarico', null, 2,
                       '', '2026-08-01')),
  '23514',
  'il precarico continua a richiedere una nota non vuota'
);

-- =========================================================================
-- MOR-05: modifica ed eliminazione di una conferma (admin)
-- =========================================================================
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
    $q$update public.monte_ore_movimenti set mese_competenza = '2026-09-01'
        where utente_id = 'a0000000-0000-0000-0000-000000000002'
          and tipo = 'conferma_mese' and mese_competenza = '2026-10-01'$q$),
  '23505',
  'MOR-05: spostare la conferma su un mese che ne ha già una viene rifiutato'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
    $q$update public.monte_ore_movimenti set mese_competenza = '2026-08-01', variazione = 16.5
        where utente_id = 'a0000000-0000-0000-0000-000000000002'
          and tipo = 'conferma_mese' and mese_competenza = '2026-10-01'$q$),
  'ok',
  'MOR-05/MOR-07: l''admin modifica competenza e variazione di una conferma'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
    $q$delete from public.monte_ore_movimenti
        where utente_id = 'a0000000-0000-0000-0000-000000000002'
          and tipo = 'conferma_mese' and mese_competenza = '2026-08-01'$q$),
  'ok',
  'MOR-05: l''admin elimina una conferma'
);
select is(
  (select count(*)::int from public.monte_ore_movimenti
    where utente_id = 'a0000000-0000-0000-0000-000000000002'
      and tipo = 'conferma_mese' and mese_competenza = '2026-08-01'),
  0,
  'MOR-05: dopo l''eliminazione la conferma non c''è più (il pulsante Conferma riappare)'
);

-- =========================================================================
-- MOR-04: solo l'admin scrive (RLS e GRANT invariati)
-- =========================================================================
select is(
  (select array_agg(policyname::text order by policyname::text) from pg_policies
    where schemaname = 'public' and tablename = 'monte_ore_movimenti'),
  array[
    'monte_ore_movimenti_delete_admin',
    'monte_ore_movimenti_insert_admin',
    'monte_ore_movimenti_select_own_or_admin',
    'monte_ore_movimenti_update_admin'
  ],
  'MOR-04: nessuna policy nuova su monte_ore_movimenti'
);
select ok(
  has_table_privilege('authenticated', 'public.monte_ore_movimenti', 'select')
  and has_table_privilege('authenticated', 'public.monte_ore_movimenti', 'insert')
  and has_table_privilege('authenticated', 'public.monte_ore_movimenti', 'update')
  and has_table_privilege('authenticated', 'public.monte_ore_movimenti', 'delete')
  and not has_table_privilege('anon', 'public.monte_ore_movimenti', 'select')
  and not has_table_privilege('anon', 'public.monte_ore_movimenti', 'insert'),
  'MOR-04: GRANT invariati (authenticated select/insert/update/delete, anon nulla)'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000002',
    pg_temp.insert_sql('a0000000-0000-0000-0000-000000000002', 'conferma_mese', null, 5,
                       'Conferma abusiva', '2026-07-01')),
  '42501',
  'MOR-04: la maestra non può registrare una conferma nemmeno su se stessa'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000003',
    pg_temp.insert_sql('a0000000-0000-0000-0000-000000000003', 'conferma_mese', null, 5,
                       'Conferma abusiva', '2026-07-01')),
  '42501',
  'MOR-04: l''assistente non può registrare una conferma'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000004',
    pg_temp.insert_sql('a0000000-0000-0000-0000-000000000004', 'conferma_mese', null, 5,
                       'Conferma abusiva', '2026-07-01')),
  '42501',
  'MOR-04: il genitore non può registrare una conferma'
);
select ok(
  pg_temp.write_as(null,
    pg_temp.insert_sql('a0000000-0000-0000-0000-000000000002', 'conferma_mese', null, 5,
                       'Conferma abusiva', '2026-07-01')) in ('42501'),
  'MOR-04: l''anonimo non può registrare una conferma'
);

-- Update/delete di un non admin: nessun errore, ma zero righe toccate.
select pg_temp.write_as('a0000000-0000-0000-0000-000000000002',
  $q$update public.monte_ore_movimenti set mese_competenza = '2026-01-01', variazione = 99
      where id = 'b0000000-0000-0000-0000-000000000001'$q$);
select pg_temp.write_as('a0000000-0000-0000-0000-000000000002',
  $q$delete from public.monte_ore_movimenti where id = 'b0000000-0000-0000-0000-000000000001'$q$);
select results_eq(
  $q$select variazione::float8, mese_competenza from public.monte_ore_movimenti
      where id = 'b0000000-0000-0000-0000-000000000001'$q$,
  $q$values (3::float8, '2026-10-01'::date)$q$,
  'MOR-04: la maestra non modifica né elimina i movimenti (competenza e variazione invariate)'
);

-- La maestra vede i propri movimenti (anche il mese di competenza), non quelli altrui.
create function pg_temp.conta_as(p_uid uuid, p_utente uuid) returns int
language plpgsql as $$
declare
  v_prev text := current_user;
  v_n int;
begin
  perform pg_temp.impersona(p_uid);
  select count(*)::int into v_n from public.monte_ore_movimenti where utente_id = p_utente;
  perform set_config('role', v_prev, true);
  return v_n;
end;
$$;
select ok(
  pg_temp.conta_as('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002') > 0
  and pg_temp.conta_as('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000005') = 0,
  'la maestra legge i propri movimenti e nessuno dei colleghi'
);

-- =========================================================================
-- MOR-09: il saldo è la somma delle variazioni, qualunque sia la competenza
-- =========================================================================
select is(
  (select sum(variazione) from public.monte_ore_movimenti
    where utente_id = 'a0000000-0000-0000-0000-000000000002'),
  (select sum(variazione) from public.monte_ore_movimenti
    where utente_id = 'a0000000-0000-0000-0000-000000000002' and mese_competenza is not null),
  'MOR-09: la competenza non cambia il saldo (somma delle variazioni)'
);
select is(
  (select sum(variazione) from public.monte_ore_movimenti
    where utente_id = 'a0000000-0000-0000-0000-000000000002'),
  3 + (-1) + (-6) + 1::numeric,
  'MOR-09: saldo atteso = precarico ottobre + precarico novembre + conferma settembre + altro precarico'
);

-- MOR-10: la funzione di report somma tutti i movimenti, conferme comprese,
-- senza distinguere la competenza (verificato in e2e/52 sul saldo mostrato).
select is(
  (select count(*)::int from public.monte_ore_movimenti
    where utente_id = 'a0000000-0000-0000-0000-000000000002' and tipo = 'conferma_mese'),
  1,
  'MOR-10: la conferma di settembre è un movimento come gli altri e conta nel saldo'
);

select * from finish();
rollback;
