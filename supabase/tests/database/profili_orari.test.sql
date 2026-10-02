-- Girasole — test pgTAP sulle policy RLS di public.profili_orari
-- (issue #180, sotto-issue "a" di #29; specs/54 - profili-orari.md,
-- specs/03 - utenti-e-ruoli.md).
--
-- Perché esiste: 0024_profili_orari.sql aveva la select "solo admin", e la
-- RLS non dà errore ma restituisce ZERO righe: ogni maestra/assistente
-- vedeva "0 ore ordinarie" invece del proprio profilo, e l'unico e2e
-- (che gira come admin) non se ne accorgeva. 0030 ha aggiunto
-- `profili_orari_select_own`. Questo file fissa il comportamento per ruolo
-- e dimostra che il caso 0030 passa SOLO con quella policy.
--
-- Tutto dentro una transazione chiusa da `rollback`: utenti, profili e
-- profili orari qui sotto esistono solo per la durata del test. Dati
-- chiaramente fittizi (email @example.test), nessun dato reale.
-- Si esegue con `supabase test db` (in CI: job `e2e`, dopo il reset del DB
-- di test). Mai sulla produzione.
--
-- Struttura: le funzioni pgTAP (plan, is, finish) girano SEMPRE con il
-- ruolo "privilegiato" di partenza; l'impersonazione di authenticated/anon
-- avviene solo dentro gli helper `pg_temp.*_as`, che eseguono la query
-- impersonata, tornano al ruolo di partenza e restituiscono il risultato
-- da confrontare. Così le asserzioni non dipendono dai privilegi di
-- authenticated/anon sullo schema delle estensioni.

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

select plan(13);

-- ---------------------------------------------------------------------
-- Helper (temporanei: spariscono con la transazione)
-- ---------------------------------------------------------------------

-- Imposta ruolo e claim come farebbe PostgREST con un JWT valido
-- (`authenticated` + `sub` letto da auth.uid()), oppure `anon` se p_uid è
-- null. Va chiamato solo dagli helper qui sotto, che poi ripristinano il
-- ruolo di partenza.
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

-- Id dei profili_orari visibili a p_uid (null = anonimo), in ordine. Un
-- "permission denied" conta come nessuna riga: per questi test conta solo
-- che il dato non sia leggibile.
create function pg_temp.ids_as(p_uid uuid) returns uuid[]
language plpgsql as $$
declare
  v_prev text := current_user;
  v_ids uuid[];
begin
  perform pg_temp.impersona(p_uid);
  begin
    select coalesce(array_agg(id order by id), '{}') into v_ids from public.profili_orari;
  exception when insufficient_privilege then
    v_ids := '{}';
  end;
  perform set_config('role', v_prev, true);
  return v_ids;
end;
$$;

-- Esegue uno statement di scrittura come p_uid e restituisce lo SQLSTATE
-- dell'errore ('ok' se non ne ha dati; UPDATE/DELETE bloccati dalla RLS non
-- danno errore ma zero righe).
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

-- ---------------------------------------------------------------------
-- Fixture (costruite col ruolo di partenza, con bypass RLS)
-- ---------------------------------------------------------------------
-- Il trigger on_auth_user_created (handle_new_user) crea il profilo
-- leggendo `ruolo` da raw_user_meta_data.
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-0000-0000-000000000001', 'pgtap.admin@example.test', '{"ruolo":"admin"}'),
  ('a0000000-0000-0000-0000-000000000002', 'pgtap.maestra@example.test', '{"ruolo":"maestra"}'),
  ('a0000000-0000-0000-0000-000000000003', 'pgtap.assistente@example.test', '{"ruolo":"assistente"}'),
  ('a0000000-0000-0000-0000-000000000004', 'pgtap.maestra-senza@example.test', '{"ruolo":"maestra"}'),
  ('a0000000-0000-0000-0000-000000000005', 'pgtap.genitore@example.test', '{"ruolo":"genitore"}');

insert into public.profili_orari (id, nome, ore_lunedi, ore_martedi, ore_mercoledi, ore_giovedi, ore_venerdi) values
  ('b0000000-0000-0000-0000-00000000000a', 'pgTAP profilo A', 7, 7, 7, 7, 7),
  ('b0000000-0000-0000-0000-00000000000b', 'pgTAP profilo B', 3, 3, 3, 3, 3);

update public.profili set profilo_orario_id = 'b0000000-0000-0000-0000-00000000000a'
  where id = 'a0000000-0000-0000-0000-000000000002';  -- maestra -> A
update public.profili set profilo_orario_id = 'b0000000-0000-0000-0000-00000000000b'
  where id = 'a0000000-0000-0000-0000-000000000003';  -- assistente -> B

-- ---------------------------------------------------------------------
-- Le policy attese esistono
-- ---------------------------------------------------------------------
select ok(
  exists (select 1 from pg_policies
           where schemaname = 'public' and tablename = 'profili_orari'
             and policyname = 'profili_orari_admin_all'),
  'esiste la policy profili_orari_admin_all'
);
select ok(
  exists (select 1 from pg_policies
           where schemaname = 'public' and tablename = 'profili_orari'
             and policyname = 'profili_orari_select_own'),
  'esiste la policy profili_orari_select_own (fix 0030)'
);

-- ---------------------------------------------------------------------
-- Admin: legge tutto
-- ---------------------------------------------------------------------
select is(
  (select count(*)::int
     from unnest(pg_temp.ids_as('a0000000-0000-0000-0000-000000000001')) as i
    where i in ('b0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b')),
  2,
  'admin: legge entrambi i profili orari, anche non assegnati a lui'
);

-- ---------------------------------------------------------------------
-- Staff: legge SOLO il profilo assegnato (caso 0030)
-- ---------------------------------------------------------------------
select is(
  pg_temp.ids_as('a0000000-0000-0000-0000-000000000002'),
  array['b0000000-0000-0000-0000-00000000000a']::uuid[],
  'maestra: legge solo il proprio profilo (A), non quello di altri'
);

select is(
  pg_temp.ids_as('a0000000-0000-0000-0000-000000000003'),
  array['b0000000-0000-0000-0000-00000000000b']::uuid[],
  'assistente: legge solo il proprio profilo (B), non quello di altri'
);

-- ---------------------------------------------------------------------
-- Senza profilo assegnato, genitore, anonimo: non leggono nulla
-- ---------------------------------------------------------------------
select is(pg_temp.ids_as('a0000000-0000-0000-0000-000000000004'), '{}'::uuid[],
  'maestra senza profilo assegnato: non legge nulla');
select is(pg_temp.ids_as('a0000000-0000-0000-0000-000000000005'), '{}'::uuid[],
  'genitore: non legge nulla');
select is(pg_temp.ids_as(null), '{}'::uuid[], 'anonimo: non legge nulla');

-- ---------------------------------------------------------------------
-- Lo staff non scrive (la policy select_own è solo SELECT)
-- ---------------------------------------------------------------------
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000002',
    $q$insert into public.profili_orari (nome) values ('pgTAP abusivo')$q$),
  '42501',
  'maestra: non può inserire un profilo orario'
);
-- UPDATE e DELETE non danno errore: la RLS li riduce a zero righe.
select pg_temp.write_as('a0000000-0000-0000-0000-000000000002',
  $q$update public.profili_orari set nome = 'pgTAP manomesso'$q$);
select pg_temp.write_as('a0000000-0000-0000-0000-000000000002',
  $q$delete from public.profili_orari$q$);

select is(
  (select count(*)::int from public.profili_orari
    where (id, nome) in (
      ('b0000000-0000-0000-0000-00000000000a', 'pgTAP profilo A'),
      ('b0000000-0000-0000-0000-00000000000b', 'pgTAP profilo B')
    )),
  2,
  'maestra: update e delete non hanno modificato né eliminato i profili'
);

-- ---------------------------------------------------------------------
-- Regressione 0030: SENZA profili_orari_select_own lo staff vede zero righe
-- ---------------------------------------------------------------------
-- Il drop vive solo in questa transazione (rollback in fondo). Se la policy
-- mancasse davvero dallo schema, sia il test di esistenza sopra sia le
-- letture "proprio profilo" sopra fallirebbero.
drop policy "profili_orari_select_own" on public.profili_orari;

select is(pg_temp.ids_as('a0000000-0000-0000-0000-000000000002'), '{}'::uuid[],
  '0030: senza select_own la maestra legge zero righe (il bug originale)');
select is(pg_temp.ids_as('a0000000-0000-0000-0000-000000000003'), '{}'::uuid[],
  '0030: senza select_own l''assistente legge zero righe (il bug originale)');
select ok(
  pg_temp.ids_as('a0000000-0000-0000-0000-000000000001')
    @> array['b0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b']::uuid[],
  '0030: senza select_own l''admin legge comunque (profili_orari_admin_all)');

select * from finish();

rollback;
