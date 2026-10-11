-- Girasole — test pgTAP sul registro dei lanci dei job pianificati,
-- public.cron_esecuzioni (specs/63 - cron-job.md).
--
-- Comportamento fissato (migration 0063): RLS attiva; solo l'admin legge
-- (SELECT); nessun utente inserisce, modifica o cancella; maestra,
-- assistente, genitore e anonimo non leggono nulla; anon nessun privilegio;
-- service_role (i cron) ha SELECT, INSERT e UPDATE ma non DELETE; vincoli su
-- nome, esito e lunghezza del messaggio di errore. Migration 0064 (issue
-- #302): colonna `estemporaneo` (lanci a mano), non nulla, falsa di default,
-- senza privilegi nuovi: authenticated non la scrive, service_role sì.
--
-- Tutto dentro una transazione chiusa da `rollback`. Dati fittizi
-- (email @example.test, nome job `pgtap-prova`). Si esegue con
-- `supabase test db` (in CI: job `e2e`, dopo il reset del DB di test). Mai
-- sulla produzione. Stessa struttura e stessi helper di invii_rojac.test.sql.

begin;

-- No-op se pgTAP è già installato (è il caso del progetto di test);
-- altrimenti viene creato e poi annullato dal rollback finale.
create extension if not exists pgtap with schema extensions;

-- La CLI remota si collega con un login role temporaneo (cli_login_postgres)
-- che può non ereditare i privilegi di `postgres` (es. USAGE sullo schema
-- delle estensioni): si prova a diventare `postgres` (stesso ruolo che fa
-- girare le migration) per questa sola transazione; se non è permesso si
-- prosegue col ruolo di partenza.
do $$
begin
  set local role postgres;
exception when others then
  raise notice 'set local role postgres non riuscito: % (%)', sqlerrm, sqlstate;
end;
$$;

-- La connessione di pg_prove NON ha lo schema delle estensioni nel
-- search_path: lo schema dove pgTAP è davvero installato si legge dal
-- catalogo e lo si mette nel search_path solo per questa transazione.
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

select plan(38);

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

-- Righe del job di prova visibili a p_uid (un "permission denied" conta
-- come nessuna riga).
create function pg_temp.righe_as(p_uid uuid) returns int
language plpgsql as $$
declare
  v_prev text := current_user;
  v_n int;
begin
  perform pg_temp.impersona(p_uid);
  begin
    select count(*)::int into v_n from public.cron_esecuzioni where nome = 'pgtap-prova';
  exception when insufficient_privilege then
    v_n := 0;
  end;
  perform set_config('role', v_prev, true);
  return coalesce(v_n, 0);
end;
$$;

-- Esegue uno statement come p_uid e restituisce lo SQLSTATE dell'errore
-- ('ok' se non ne ha dati).
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

-- Fixture ------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-0000-0000-000000000001', 'pgtap.admin@example.test', '{"ruolo":"admin"}'),
  ('a0000000-0000-0000-0000-000000000002', 'pgtap.maestra@example.test', '{"ruolo":"maestra"}'),
  ('a0000000-0000-0000-0000-000000000003', 'pgtap.assistente@example.test', '{"ruolo":"assistente"}'),
  ('a0000000-0000-0000-0000-000000000004', 'pgtap.genitore@example.test', '{"ruolo":"genitore"}');

-- Un lancio di prova, scritto come lo scrive il cron (proprietario della
-- tabella qui, service_role in produzione: entrambi ignorano la RLS).
insert into public.cron_esecuzioni (id, nome, iniziato_il, finito_il, esito)
values ('c0000000-0000-0000-0000-000000000001', 'pgtap-prova', '2031-01-01T10:00:00Z', '2031-01-01T10:00:05Z', 'ok');

-- RLS e policy ---------------------------------------------------------------
select ok(
  (select relrowsecurity from pg_class where oid = 'public.cron_esecuzioni'::regclass),
  'cron_esecuzioni: RLS attiva'
);
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'cron_esecuzioni'),
  1,
  'cron_esecuzioni: una sola policy (select admin), nessun''altra'
);

-- Privilegi ------------------------------------------------------------------
select ok(not has_table_privilege('anon', 'public.cron_esecuzioni', 'SELECT'), 'anon: nessun SELECT');
select ok(not has_table_privilege('anon', 'public.cron_esecuzioni', 'INSERT'), 'anon: nessun INSERT');
select ok(has_table_privilege('authenticated', 'public.cron_esecuzioni', 'SELECT'),
  'authenticated: ha SELECT (richiesto dalla policy admin_select)');
select ok(not has_table_privilege('authenticated', 'public.cron_esecuzioni', 'INSERT'),
  'authenticated: nessun INSERT (scrivono solo i cron)');
select ok(not has_table_privilege('authenticated', 'public.cron_esecuzioni', 'UPDATE'),
  'authenticated: nessun UPDATE');
select ok(not has_table_privilege('authenticated', 'public.cron_esecuzioni', 'DELETE'),
  'authenticated: nessun DELETE');
select ok(has_table_privilege('service_role', 'public.cron_esecuzioni', 'SELECT'),
  'service_role: ha SELECT (WHERE dell''aggiornamento a fine lancio)');
select ok(has_table_privilege('service_role', 'public.cron_esecuzioni', 'INSERT'),
  'service_role: ha INSERT (inizio del lancio)');
select ok(has_table_privilege('service_role', 'public.cron_esecuzioni', 'UPDATE'),
  'service_role: ha UPDATE (fine del lancio)');
select ok(not has_table_privilege('service_role', 'public.cron_esecuzioni', 'DELETE'),
  'service_role: nessun DELETE (nessuna pulizia automatica)');

-- SELECT: solo l'admin legge -------------------------------------------------
select is(pg_temp.righe_as('a0000000-0000-0000-0000-000000000001'), 1, 'admin: legge il registro');
select is(pg_temp.righe_as('a0000000-0000-0000-0000-000000000002'), 0, 'maestra: non legge nulla');
select is(pg_temp.righe_as('a0000000-0000-0000-0000-000000000003'), 0, 'assistente: non legge nulla');
select is(pg_temp.righe_as('a0000000-0000-0000-0000-000000000004'), 0, 'genitore: non legge nulla');
select is(pg_temp.righe_as(null), 0, 'anonimo: non legge nulla');

-- INSERT, UPDATE, DELETE: nessun utente, nemmeno l'admin ----------------------
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
    $q$insert into public.cron_esecuzioni (nome) values ('pgtap-prova')$q$),
  '42501',
  'admin: INSERT negato'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000002',
    $q$insert into public.cron_esecuzioni (nome) values ('pgtap-prova')$q$),
  '42501',
  'maestra: INSERT negato'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000004',
    $q$insert into public.cron_esecuzioni (nome) values ('pgtap-prova')$q$),
  '42501',
  'genitore: INSERT negato'
);
select is(
  pg_temp.write_as(null, $q$insert into public.cron_esecuzioni (nome) values ('pgtap-prova')$q$),
  '42501',
  'anonimo: INSERT negato'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
    $q$update public.cron_esecuzioni set esito = 'ko' where nome = 'pgtap-prova'$q$),
  '42501',
  'admin: UPDATE negato'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000002',
    $q$update public.cron_esecuzioni set esito = 'ko' where nome = 'pgtap-prova'$q$),
  '42501',
  'maestra: UPDATE negato'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
    $q$delete from public.cron_esecuzioni where nome = 'pgtap-prova'$q$),
  '42501',
  'admin: DELETE negato'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000003',
    $q$delete from public.cron_esecuzioni where nome = 'pgtap-prova'$q$),
  '42501',
  'assistente: DELETE negato'
);
select is(pg_temp.righe_as('a0000000-0000-0000-0000-000000000001'), 1, 'admin: il lancio di prova è ancora lì, invariato');
select is(
  (select esito from public.cron_esecuzioni where id = 'c0000000-0000-0000-0000-000000000001'),
  'ok',
  'il lancio di prova ha ancora esito ok'
);

-- Vincoli --------------------------------------------------------------------
select throws_ok(
  $q$insert into public.cron_esecuzioni (nome, esito) values ('pgtap-prova', 'forse')$q$,
  '23514',
  null,
  'un esito diverso da ok/ko è rifiutato'
);
select throws_ok(
  $q$insert into public.cron_esecuzioni (nome) values ('Nome Non Valido!')$q$,
  '23514',
  null,
  'un nome di job non valido è rifiutato'
);
select throws_ok(
  $q$insert into public.cron_esecuzioni (nome, esito, messaggio_errore) values ('pgtap-prova', 'ko', repeat('x', 501))$q$,
  '23514',
  null,
  'un messaggio di errore oltre 500 caratteri è rifiutato'
);
select lives_ok(
  $q$insert into public.cron_esecuzioni (nome) values ('pgtap-prova')$q$,
  'un lancio appena iniziato (senza fine né esito) è accettato'
);

-- Colonna estemporaneo (migration 0064) --------------------------------------
select col_not_null('public', 'cron_esecuzioni', 'estemporaneo', 'estemporaneo: non nulla');
select col_default_is('public', 'cron_esecuzioni', 'estemporaneo', 'false', 'estemporaneo: falsa di default');
select is(
  (select estemporaneo from public.cron_esecuzioni where id = 'c0000000-0000-0000-0000-000000000001'),
  false,
  'un lancio scritto senza la colonna (come i cron pianificati) non è estemporaneo'
);
select ok(not has_column_privilege('authenticated', 'public.cron_esecuzioni', 'estemporaneo', 'UPDATE'),
  'authenticated: nessun UPDATE sulla colonna estemporaneo');
select ok(not has_column_privilege('authenticated', 'public.cron_esecuzioni', 'estemporaneo', 'INSERT'),
  'authenticated: nessun INSERT sulla colonna estemporaneo');
select ok(has_column_privilege('service_role', 'public.cron_esecuzioni', 'estemporaneo', 'INSERT'),
  'service_role: scrive la colonna estemporaneo (lancio a mano)');
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
    $q$update public.cron_esecuzioni set estemporaneo = true where nome = 'pgtap-prova'$q$),
  '42501',
  'admin: non può segnare un lancio come estemporaneo con la propria sessione'
);

select * from finish();

rollback;
