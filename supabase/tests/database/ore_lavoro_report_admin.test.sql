-- Girasole — test pgTAP sulle letture RLS del PDF mensile delle ore di lavoro
-- (issue #213, sotto-issue "c" di #38; specs/18 - report-ore-lavoro.md,
-- specs/19 - monte-ore.md, specs/52 - report-email-automatico.md).
--
-- Perché esiste: la route `/admin/ore-lavoro/pdf` non usa più la service_role
-- ma la sessione dell'admin. Il PDF legge `profili` (colonna
-- `abilitato_ore_lavoro`), `ore_lavoro_giorni`, `ore_lavoro_settimane`,
-- `monte_ore_movimenti`, `giorni_chiusura` (le chiusure del calendario) e
-- `profili_orari`. La RLS non dà errore se manca una policy: restituisce ZERO
-- righe e il PDF uscirebbe vuoto in silenzio. Qui si fissa che:
--   * l'admin legge le righe di TUTTO il personale (non solo le proprie);
--   * la maestra, l'assistente e il genitore NON leggono dati altrui;
--   * l'anonimo non legge nulla.
-- `profili_orari` (admin legge tutto, lo staff solo il proprio) è già
-- coperta da profili_orari.test.sql: non si duplica qui.
--
-- Tutto dentro una transazione chiusa da `rollback`: utenti, profili e dati
-- qui sotto esistono solo per la durata del test. Dati chiaramente fittizi
-- (email @example.test), nessun dato reale. Il DB di test può contenere altri
-- dati: ogni lettura è filtrata sui soli id di fixture.
-- Si esegue con `supabase test db` (in CI: job `e2e`, dopo il reset del DB
-- di test). Mai sulla produzione.
--
-- Struttura: le funzioni pgTAP (plan, is, finish) girano SEMPRE con il
-- ruolo "privilegiato" di partenza; l'impersonazione di authenticated/anon
-- avviene solo dentro gli helper `pg_temp.*_as`.

begin;

-- No-op se pgTAP è già installato (è il caso del progetto di test);
-- altrimenti viene creato e poi annullato dal rollback finale.
create extension if not exists pgtap with schema extensions;

-- La CLI remota si collega con un login role temporaneo che può non
-- ereditare i privilegi di `postgres`: si prova a diventare `postgres` per
-- questa sola transazione; se non è permesso si prosegue col ruolo di
-- partenza.
do $$
begin
  set local role postgres;
exception when others then
  raise notice 'set local role postgres non riuscito: % (%)', sqlerrm, sqlstate;
end;
$$;

-- Lo schema dove pgTAP è davvero installato si legge dal catalogo (di solito
-- `extensions`) e lo si mette nel search_path solo per questa transazione.
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

select plan(21);

-- ---------------------------------------------------------------------
-- Helper (temporanei: spariscono con la transazione)
-- ---------------------------------------------------------------------

-- Imposta ruolo e claim come farebbe PostgREST con un JWT valido
-- (`authenticated` + `sub` letto da auth.uid()), oppure `anon` se p_uid è
-- null. Va chiamato solo da pg_temp.ids_as, che poi ripristina il ruolo.
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

-- Esegue come p_uid (null = anonimo) una query che restituisce una colonna
-- uuid e ne dà l'elenco ordinato. Un "permission denied" conta come nessuna
-- riga: per questi test conta solo che il dato non sia leggibile.
create function pg_temp.ids_as(p_uid uuid, p_sql text) returns uuid[]
language plpgsql as $$
declare
  v_prev text := current_user;
  v_ids uuid[];
begin
  perform pg_temp.impersona(p_uid);
  begin
    execute format('select coalesce(array_agg(x order by x), ''{}'') from (%s) t(x)', p_sql) into v_ids;
  exception when insufficient_privilege then
    v_ids := '{}';
  end;
  perform set_config('role', v_prev, true);
  return v_ids;
end;
$$;

-- ---------------------------------------------------------------------
-- Fixture (costruite col ruolo di partenza, con bypass RLS)
-- ---------------------------------------------------------------------
-- Il trigger on_auth_user_created (handle_new_user) crea il profilo
-- leggendo `ruolo` da raw_user_meta_data.
--   ...0001 admin | ...0002 maestra | ...0003 assistente | ...0004 genitore
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-0000-0000-000000000001', 'pgtap.admin@example.test', '{"ruolo":"admin"}'),
  ('a0000000-0000-0000-0000-000000000002', 'pgtap.maestra@example.test', '{"ruolo":"maestra"}'),
  ('a0000000-0000-0000-0000-000000000003', 'pgtap.assistente@example.test', '{"ruolo":"assistente"}'),
  ('a0000000-0000-0000-0000-000000000004', 'pgtap.genitore@example.test', '{"ruolo":"genitore"}');

-- Maestra e assistente abilitate al report ore di lavoro.
update public.profili set abilitato_ore_lavoro = true
  where id in ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003');

-- Un giorno (martedì 2026-09-08, passato), la conferma della sua settimana
-- (lunedì 2026-09-07) e un precarico di monte ore per maestra e assistente.
insert into public.ore_lavoro_giorni (utente_id, data, stato, ore_ordinarie) values
  ('a0000000-0000-0000-0000-000000000002', '2026-09-08', 'lavorativo', 7),
  ('a0000000-0000-0000-0000-000000000003', '2026-09-08', 'lavorativo', 5);

insert into public.ore_lavoro_settimane (utente_id, settimana_inizio) values
  ('a0000000-0000-0000-0000-000000000002', '2026-09-07'),
  ('a0000000-0000-0000-0000-000000000003', '2026-09-07');

insert into public.monte_ore_movimenti (utente_id, tipo, variazione, nota) values
  ('a0000000-0000-0000-0000-000000000002', 'precarico', 4, 'pgTAP precarico maestra'),
  ('a0000000-0000-0000-0000-000000000003', 'precarico', 2, 'pgTAP precarico assistente');

insert into public.giorni_chiusura (id, data_inizio, data_fine, nota) values
  ('c0000000-0000-0000-0000-000000000001', '2026-09-14', '2026-09-14', 'pgTAP chiusura');

-- ---------------------------------------------------------------------
-- Le policy di SELECT attese esistono
-- ---------------------------------------------------------------------
select ok(
  exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profili'
           and policyname = 'profili_select_own_or_admin'),
  'esiste la policy profili_select_own_or_admin'
);
select ok(
  exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ore_lavoro_giorni'
           and policyname = 'ore_lavoro_giorni_select_own_or_admin'),
  'esiste la policy ore_lavoro_giorni_select_own_or_admin'
);
select ok(
  exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ore_lavoro_settimane'
           and policyname = 'ore_lavoro_settimane_select_own_or_admin'),
  'esiste la policy ore_lavoro_settimane_select_own_or_admin'
);
select ok(
  exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'monte_ore_movimenti'
           and policyname = 'monte_ore_movimenti_select_own_or_admin'),
  'esiste la policy monte_ore_movimenti_select_own_or_admin'
);
select ok(
  exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'giorni_chiusura'
           and policyname = 'giorni_chiusura_select_staff'),
  'esiste la policy giorni_chiusura_select_staff'
);

-- ---------------------------------------------------------------------
-- Admin: legge i dati di tutto il personale abilitato
-- ---------------------------------------------------------------------
select is(
  pg_temp.ids_as('a0000000-0000-0000-0000-000000000001',
    $q$select id from public.profili where abilitato_ore_lavoro
         and id in ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003')$q$),
  array['a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003']::uuid[],
  'admin: legge i profili abilitati al report ore (maestra e assistente)'
);
select is(
  pg_temp.ids_as('a0000000-0000-0000-0000-000000000001',
    $q$select utente_id from public.ore_lavoro_giorni
        where utente_id in ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003')$q$),
  array['a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003']::uuid[],
  'admin: legge i giorni di ore di lavoro di tutto il personale'
);
select is(
  pg_temp.ids_as('a0000000-0000-0000-0000-000000000001',
    $q$select utente_id from public.ore_lavoro_settimane
        where utente_id in ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003')$q$),
  array['a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003']::uuid[],
  'admin: legge le settimane confermate di tutto il personale'
);
select is(
  pg_temp.ids_as('a0000000-0000-0000-0000-000000000001',
    $q$select utente_id from public.monte_ore_movimenti
        where utente_id in ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003')$q$),
  array['a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003']::uuid[],
  'admin: legge i movimenti di monte ore di tutto il personale'
);
select is(
  pg_temp.ids_as('a0000000-0000-0000-0000-000000000001',
    $q$select id from public.giorni_chiusura where id = 'c0000000-0000-0000-0000-000000000001'$q$),
  array['c0000000-0000-0000-0000-000000000001']::uuid[],
  'admin: legge le chiusure del calendario'
);

-- ---------------------------------------------------------------------
-- Maestra: legge solo i propri dati, non quelli dell'assistente
-- ---------------------------------------------------------------------
select is(
  pg_temp.ids_as('a0000000-0000-0000-0000-000000000002',
    $q$select id from public.profili where abilitato_ore_lavoro
         and id in ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003')$q$),
  array['a0000000-0000-0000-0000-000000000002']::uuid[],
  'maestra: tra i profili abilitati vede solo il proprio'
);
select is(
  pg_temp.ids_as('a0000000-0000-0000-0000-000000000002',
    $q$select utente_id from public.ore_lavoro_giorni
        where utente_id in ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003')$q$),
  array['a0000000-0000-0000-0000-000000000002']::uuid[],
  'maestra: legge solo i propri giorni di ore di lavoro'
);
select is(
  pg_temp.ids_as('a0000000-0000-0000-0000-000000000002',
    $q$select utente_id from public.ore_lavoro_settimane
        where utente_id in ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003')$q$),
  array['a0000000-0000-0000-0000-000000000002']::uuid[],
  'maestra: legge solo le proprie settimane confermate'
);
select is(
  pg_temp.ids_as('a0000000-0000-0000-0000-000000000002',
    $q$select utente_id from public.monte_ore_movimenti
        where utente_id in ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003')$q$),
  array['a0000000-0000-0000-0000-000000000002']::uuid[],
  'maestra: legge solo i propri movimenti di monte ore'
);

-- ---------------------------------------------------------------------
-- Assistente: stessa regola della maestra
-- ---------------------------------------------------------------------
select is(
  pg_temp.ids_as('a0000000-0000-0000-0000-000000000003',
    $q$select utente_id from public.ore_lavoro_giorni
        where utente_id in ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003')$q$),
  array['a0000000-0000-0000-0000-000000000003']::uuid[],
  'assistente: legge solo i propri giorni di ore di lavoro'
);
select is(
  pg_temp.ids_as('a0000000-0000-0000-0000-000000000003',
    $q$select utente_id from public.monte_ore_movimenti
        where utente_id in ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003')$q$),
  array['a0000000-0000-0000-0000-000000000003']::uuid[],
  'assistente: legge solo i propri movimenti di monte ore'
);

-- ---------------------------------------------------------------------
-- Genitore e anonimo: nessun dato di ore di lavoro
-- ---------------------------------------------------------------------
select is(
  pg_temp.ids_as('a0000000-0000-0000-0000-000000000004',
    $q$select utente_id from public.ore_lavoro_giorni
        where utente_id in ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003')$q$),
  '{}'::uuid[],
  'genitore: non legge i giorni di ore di lavoro'
);
select is(
  pg_temp.ids_as('a0000000-0000-0000-0000-000000000004',
    $q$select utente_id from public.monte_ore_movimenti
        where utente_id in ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003')$q$),
  '{}'::uuid[],
  'genitore: non legge i movimenti di monte ore'
);
select is(
  pg_temp.ids_as('a0000000-0000-0000-0000-000000000004',
    $q$select id from public.giorni_chiusura where id = 'c0000000-0000-0000-0000-000000000001'$q$),
  '{}'::uuid[],
  'genitore: non legge le chiusure del calendario (policy solo staff)'
);
select is(
  pg_temp.ids_as(null,
    $q$select utente_id from public.ore_lavoro_giorni
        where utente_id in ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003')$q$),
  '{}'::uuid[],
  'anonimo: non legge i giorni di ore di lavoro'
);
select is(
  pg_temp.ids_as(null,
    $q$select utente_id from public.ore_lavoro_settimane
        where utente_id in ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003')$q$),
  '{}'::uuid[],
  'anonimo: non legge le settimane confermate'
);

select * from finish();

rollback;
