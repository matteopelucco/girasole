-- Girasole — test pgTAP sulle policy RLS di public.impostazioni_email_rojac
-- (specs/61 - email-pasti-rojac.md, specs/03 - utenti-e-ruoli.md).
--
-- Comportamento fissato (migration 0060): tabella a riga singola, "solo
-- admin" in lettura (SELECT) e modifica (UPDATE); nessun INSERT né DELETE
-- per authenticated (la riga esiste già dal seed). Maestra, assistente,
-- genitore e anonimo non leggono né modificano il modello.
--
-- Tutto dentro una transazione chiusa da `rollback`. Dati fittizi
-- (email @example.test). Si esegue con `supabase test db` (in CI: job
-- `e2e`, dopo il reset del DB di test). Mai sulla produzione. Stessa
-- struttura e stessi helper di comunicazioni_retta.test.sql.

begin;

-- ---------------------------------------------------------------------
-- Diagnostica (visibile nel log di `supabase test db`; non può fallire)
-- ---------------------------------------------------------------------
create function pg_temp.diag(p_label text) returns void
language plpgsql as $$
declare
  v_schema text;
  v_funcs text;
begin
  select n.nspname into v_schema
    from pg_extension e join pg_namespace n on n.oid = e.extnamespace
   where e.extname = 'pgtap';
  select string_agg(n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', ', ')
    into v_funcs
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where p.proname = 'plan';
  raise notice 'DIAG[%] current_user=% session_user=% search_path=% pgtap_schema=% usage_on_schema=% member_of_postgres=% plan_funcs=%',
    p_label, current_user, session_user, current_setting('search_path'), v_schema,
    case when v_schema is null then null else has_schema_privilege(current_user, v_schema, 'usage')::text end,
    pg_has_role(current_user, 'postgres', 'member'), v_funcs;
exception when others then
  raise notice 'DIAG[%] fallita: % (%)', p_label, sqlerrm, sqlstate;
end;
$$;

select pg_temp.diag('iniziale');

-- No-op se pgTAP è già installato (è il caso del progetto di test);
-- altrimenti viene creato e poi annullato dal rollback finale.
create extension if not exists pgtap with schema extensions;

-- La CLI remota si collega con un login role temporaneo (cli_login_postgres)
-- che può non ereditare i privilegi di `postgres` (es. USAGE sullo schema
-- delle estensioni): in tal caso plan() "non esiste". Si prova a diventare
-- `postgres` (stesso ruolo che fa girare le migration) per questa sola
-- transazione; se non è permesso si prosegue col ruolo di partenza.
do $$
begin
  set local role postgres;
exception when others then
  raise notice 'set local role postgres non riuscito: % (%)', sqlerrm, sqlstate;
end;
$$;

select pg_temp.diag('dopo set role');

-- La connessione di pg_prove NON ha lo schema delle estensioni nel
-- search_path, quindi plan()/is()/finish() non si risolvono ("function
-- plan(integer) does not exist"). Lo schema dove pgTAP è davvero installato
-- si legge dal catalogo (di solito `extensions`) e lo si mette nel
-- search_path solo per questa transazione.
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

select plan(17);

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

-- Oggetto del modello visibile a p_uid ('' se non legge nulla; un
-- "permission denied" conta come nessuna riga).
create function pg_temp.oggetto_as(p_uid uuid) returns text
language plpgsql as $$
declare
  v_prev text := current_user;
  v_oggetto text;
begin
  perform pg_temp.impersona(p_uid);
  begin
    select oggetto into v_oggetto from public.impostazioni_email_rojac;
  exception when insufficient_privilege then
    v_oggetto := null;
  end;
  perform set_config('role', v_prev, true);
  return coalesce(v_oggetto, '');
end;
$$;

-- Esegue uno statement di scrittura come p_uid e restituisce lo SQLSTATE
-- dell'errore ('ok' se non ne ha dati; un UPDATE bloccato dalla RLS non dà
-- errore ma tocca zero righe).
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

-- Il DB di test può avere già un oggetto personalizzato: lo si fissa a un
-- valore noto per tutta la transazione (il rollback lo ripristina).
update public.impostazioni_email_rojac set oggetto = 'pgTAP oggetto base';

-- RLS e policy ---------------------------------------------------------------
select ok(
  (select relrowsecurity from pg_class where oid = 'public.impostazioni_email_rojac'::regclass),
  'impostazioni_email_rojac: RLS attiva'
);
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'impostazioni_email_rojac'),
  2,
  'impostazioni_email_rojac: esattamente 2 policy (select e update admin), nessun''altra'
);

-- Privilegi ------------------------------------------------------------------
select ok(not has_table_privilege('anon', 'public.impostazioni_email_rojac', 'SELECT'),
  'anon: nessun SELECT');
select ok(has_table_privilege('authenticated', 'public.impostazioni_email_rojac', 'SELECT'),
  'authenticated: ha SELECT (richiesto dalla policy admin_select)');
select ok(has_table_privilege('authenticated', 'public.impostazioni_email_rojac', 'UPDATE'),
  'authenticated: ha UPDATE (richiesto dalla policy admin_update)');
select ok(not has_table_privilege('authenticated', 'public.impostazioni_email_rojac', 'INSERT'),
  'authenticated: nessun INSERT (la riga è unica e già presente)');
select ok(not has_table_privilege('authenticated', 'public.impostazioni_email_rojac', 'DELETE'),
  'authenticated: nessun DELETE');

-- SELECT: solo l'admin legge -------------------------------------------------
select is(pg_temp.oggetto_as('a0000000-0000-0000-0000-000000000001'), 'pgTAP oggetto base',
  'admin: legge il modello');
select is(pg_temp.oggetto_as('a0000000-0000-0000-0000-000000000002'), '', 'maestra: non legge nulla');
select is(pg_temp.oggetto_as('a0000000-0000-0000-0000-000000000003'), '', 'assistente: non legge nulla');
select is(pg_temp.oggetto_as('a0000000-0000-0000-0000-000000000004'), '', 'genitore: non legge nulla');
select is(pg_temp.oggetto_as(null), '', 'anonimo: non legge nulla');

-- UPDATE: solo l'admin modifica ----------------------------------------------
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000002',
    $q$update public.impostazioni_email_rojac set oggetto = 'pgTAP manomesso maestra'$q$),
  'ok',
  'maestra: UPDATE bloccato dalla RLS (zero righe, nessun errore)'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000004',
    $q$update public.impostazioni_email_rojac set oggetto = 'pgTAP manomesso genitore'$q$),
  'ok',
  'genitore: UPDATE bloccato dalla RLS (zero righe, nessun errore)'
);
select is((select oggetto from public.impostazioni_email_rojac), 'pgTAP oggetto base',
  'dopo i tentativi di maestra e genitore il modello è invariato');
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
    $q$update public.impostazioni_email_rojac set oggetto = 'pgTAP oggetto admin'$q$),
  'ok',
  'admin: UPDATE consentito'
);
select is((select oggetto from public.impostazioni_email_rojac), 'pgTAP oggetto admin',
  'dopo l''UPDATE dell''admin il modello è cambiato');

select * from finish();

rollback;
