-- Girasole — test pgTAP sulle policy RLS di public.comunicazioni_retta
-- (issue #182, sotto-issue "c" di #29; specs/56 - comunicazione-retta-mensile.md,
-- specs/59 - verifica-bonifico-retta.md, specs/03 - utenti-e-ruoli.md).
--
-- Comportamento fissato (migration 0036, 0038, 0046): la tabella è "solo
-- admin" su tutte e quattro le operazioni.
--   SELECT  0036  comunicazioni_retta_admin_select
--   INSERT  0036  comunicazioni_retta_admin_insert
--   DELETE  0038  comunicazioni_retta_admin_delete (annullo invio, specs/56)
--   UPDATE  0046  comunicazioni_retta_admin_update (verifica bonifico, specs/59)
-- Maestra, assistente, genitore (anche del bambino interessato) e anonimo
-- non leggono né scrivono nulla. Il log contiene importi e l'email dei
-- genitori: la fuga di una SELECT sarebbe una violazione di privacy.
--
-- Tutto dentro una transazione chiusa da `rollback`: utenti, bambini e
-- comunicazioni qui sotto esistono solo per la durata del test. Dati
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

select plan(30);

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

-- Id delle comunicazioni_retta visibili a p_uid (null = anonimo), in ordine.
-- Un "permission denied" conta come nessuna riga: per questi test conta solo
-- che il dato non sia leggibile.
create function pg_temp.ids_as(p_uid uuid) returns uuid[]
language plpgsql as $$
declare
  v_prev text := current_user;
  v_ids uuid[];
begin
  perform pg_temp.impersona(p_uid);
  begin
    select coalesce(array_agg(id order by id), '{}') into v_ids from public.comunicazioni_retta;
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

-- INSERT di una comunicazione con importi fittizi per (bambino, mese).
create function pg_temp.insert_sql(p_bambino uuid, p_mese text) returns text
language sql as $$
  select format(
    $q$insert into public.comunicazioni_retta
         (bambino_id, mese, retta_mensile, costo_pasti, conguaglio_pasti,
          costo_pre_asilo, costo_post_asilo, costi_extra, totale,
          email_destinatario, inviata_da_nome)
       values (%L, %L, 100, 20, 0, 0, 0, 0, 120,
               'pgtap.destinatario@example.test', 'pgTAP')$q$,
    p_bambino, p_mese
  );
$$;

-- ---------------------------------------------------------------------
-- Fixture (costruite col ruolo di partenza, con bypass RLS)
-- ---------------------------------------------------------------------
-- Il trigger on_auth_user_created (handle_new_user) crea il profilo
-- leggendo `ruolo` da raw_user_meta_data.
--   admin       a0..01
--   maestra     a0..02  -> sezione S1 (come B1 e B2)
--   assistente  a0..03  -> sezione S1
--   genitore    a0..04  -> figlio B1
-- Bambini: B1 (c0..01) e B2 (c0..02) hanno già una comunicazione (C1, C2);
-- B3 (c0..03) è per l'insert dell'admin; B4 (c0..04) per i tentativi abusivi.
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-0000-0000-000000000001', 'pgtap.admin@example.test', '{"ruolo":"admin"}'),
  ('a0000000-0000-0000-0000-000000000002', 'pgtap.maestra@example.test', '{"ruolo":"maestra"}'),
  ('a0000000-0000-0000-0000-000000000003', 'pgtap.assistente@example.test', '{"ruolo":"assistente"}'),
  ('a0000000-0000-0000-0000-000000000004', 'pgtap.genitore@example.test', '{"ruolo":"genitore"}');

insert into public.sezioni (id, nome) values
  ('d0000000-0000-0000-0000-000000000001', 'pgTAP S1');

insert into public.bambini (id, nome, cognome, sezione_id) values
  ('c0000000-0000-0000-0000-000000000001', 'PgtapUno', 'Fittizio', 'd0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000002', 'PgtapDue', 'Fittizio', 'd0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000003', 'PgtapTre', 'Fittizio', 'd0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000004', 'PgtapQuattro', 'Fittizio', 'd0000000-0000-0000-0000-000000000001');

insert into public.maestre_sezioni (maestra_id, sezione_id) values
  ('a0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001');

insert into public.bambini_genitori (bambino_id, genitore_id) values
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004');

-- Mese lontano nel futuro: nessun conflitto con dati reali del DB di test
-- (unique (bambino_id, mese) e comunque bambini nuovi).
insert into public.comunicazioni_retta
  (id, bambino_id, mese, retta_mensile, costo_pasti, conguaglio_pasti,
   costo_pre_asilo, costo_post_asilo, costi_extra, totale,
   email_destinatario, inviata_da_nome)
values
  ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '2099-01',
   100, 20, 0, 0, 0, 0, 120, 'pgtap.destinatario1@example.test', 'pgTAP'),
  ('e0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', '2099-01',
   100, 20, 0, 0, 0, 0, 120, 'pgtap.destinatario2@example.test', 'pgTAP');

-- ---------------------------------------------------------------------
-- RLS attiva e policy attese presenti (e nessun'altra)
-- ---------------------------------------------------------------------
select ok(
  (select relrowsecurity from pg_class
    where oid = 'public.comunicazioni_retta'::regclass),
  'comunicazioni_retta: RLS attiva'
);
select ok(
  exists (select 1 from pg_policies
           where schemaname = 'public' and tablename = 'comunicazioni_retta'
             and policyname = 'comunicazioni_retta_admin_select' and cmd = 'SELECT'),
  'esiste la policy comunicazioni_retta_admin_select'
);
select ok(
  exists (select 1 from pg_policies
           where schemaname = 'public' and tablename = 'comunicazioni_retta'
             and policyname = 'comunicazioni_retta_admin_insert' and cmd = 'INSERT'),
  'esiste la policy comunicazioni_retta_admin_insert'
);
select ok(
  exists (select 1 from pg_policies
           where schemaname = 'public' and tablename = 'comunicazioni_retta'
             and policyname = 'comunicazioni_retta_admin_update' and cmd = 'UPDATE'),
  'esiste la policy comunicazioni_retta_admin_update (0046)'
);
select ok(
  exists (select 1 from pg_policies
           where schemaname = 'public' and tablename = 'comunicazioni_retta'
             and policyname = 'comunicazioni_retta_admin_delete' and cmd = 'DELETE'),
  'esiste la policy comunicazioni_retta_admin_delete (0038)'
);
-- Se qualcuno aggiunge una policy (es. una select per il genitore) questo
-- test fallisce e obbliga ad aggiornare consapevolmente il file.
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'comunicazioni_retta'),
  4,
  'comunicazioni_retta: esattamente le 4 policy admin, nessun''altra'
);

-- ---------------------------------------------------------------------
-- SELECT: solo l'admin legge
-- ---------------------------------------------------------------------
-- Filtrato sulle sole righe di fixture: il DB di test può contenere altre
-- comunicazioni che l'admin legge legittimamente.
select is(
  (select array_agg(i order by i)
     from unnest(pg_temp.ids_as('a0000000-0000-0000-0000-000000000001')) as i
    where i in ('e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002')),
  array['e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002']::uuid[],
  'admin: legge le comunicazioni di tutti i bambini'
);
select is(pg_temp.ids_as('a0000000-0000-0000-0000-000000000002'), '{}'::uuid[],
  'maestra (della sezione dei bambini): non legge nulla');
select is(pg_temp.ids_as('a0000000-0000-0000-0000-000000000003'), '{}'::uuid[],
  'assistente (della sezione dei bambini): non legge nulla');
select is(pg_temp.ids_as('a0000000-0000-0000-0000-000000000004'), '{}'::uuid[],
  'genitore: non legge nulla, nemmeno la comunicazione del proprio figlio B1');
select is(pg_temp.ids_as(null), '{}'::uuid[], 'anonimo: non legge nulla');

-- ---------------------------------------------------------------------
-- INSERT: solo l'admin scrive
-- ---------------------------------------------------------------------
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
    pg_temp.insert_sql('c0000000-0000-0000-0000-000000000003', '2099-01')),
  'ok',
  'admin: può registrare una comunicazione'
);
select is(
  (select count(*)::int from public.comunicazioni_retta
    where bambino_id = 'c0000000-0000-0000-0000-000000000003'),
  1,
  'admin: la comunicazione inserita esiste davvero'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000002',
    pg_temp.insert_sql('c0000000-0000-0000-0000-000000000004', '2099-01')),
  '42501',
  'maestra: non può registrare una comunicazione'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000003',
    pg_temp.insert_sql('c0000000-0000-0000-0000-000000000004', '2099-01')),
  '42501',
  'assistente: non può registrare una comunicazione'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000004',
    pg_temp.insert_sql('c0000000-0000-0000-0000-000000000001', '2099-02')),
  '42501',
  'genitore: non può registrare una comunicazione, neanche per il proprio figlio'
);
select is(
  pg_temp.write_as(null,
    pg_temp.insert_sql('c0000000-0000-0000-0000-000000000004', '2099-01')),
  '42501',
  'anonimo: non può registrare una comunicazione'
);

-- ---------------------------------------------------------------------
-- UPDATE: solo l'admin (verifica bonifico, specs/59)
-- ---------------------------------------------------------------------
-- Per i ruoli non admin la RLS riduce l'UPDATE a zero righe senza errore (o
-- permission denied per anon): si verifica che i dati non siano cambiati.
-- `do`/`perform` e non `select`: un `select` stamperebbe la stringa e
-- pg_prove la leggerebbe come un risultato TAP in più ("Bad plan").
do $do$ begin
  perform pg_temp.write_as('a0000000-0000-0000-0000-000000000002',
    $q$update public.comunicazioni_retta set bonifico_stato = 'importo_errato'$q$);
end $do$;
select is(
  (select count(*)::int from public.comunicazioni_retta
    where id in ('e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002')
      and bonifico_stato = 'in_attesa'),
  2,
  'maestra: l''update non ha modificato nessuna comunicazione'
);

do $do$ begin
  perform pg_temp.write_as('a0000000-0000-0000-0000-000000000003',
    $q$update public.comunicazioni_retta set bonifico_stato = 'importo_errato'$q$);
end $do$;
select is(
  (select count(*)::int from public.comunicazioni_retta
    where id in ('e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002')
      and bonifico_stato = 'in_attesa'),
  2,
  'assistente: l''update non ha modificato nessuna comunicazione'
);

do $do$ begin
  perform pg_temp.write_as('a0000000-0000-0000-0000-000000000004',
    $q$update public.comunicazioni_retta set bonifico_stato = 'importo_errato'$q$);
end $do$;
select is(
  (select count(*)::int from public.comunicazioni_retta
    where id in ('e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002')
      and bonifico_stato = 'in_attesa'),
  2,
  'genitore: l''update non ha modificato nessuna comunicazione, neanche quella del proprio figlio'
);

do $do$ begin
  perform pg_temp.write_as(null,
    $q$update public.comunicazioni_retta set bonifico_stato = 'importo_errato'$q$);
end $do$;
select is(
  (select count(*)::int from public.comunicazioni_retta
    where id in ('e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002')
      and bonifico_stato = 'in_attesa'),
  2,
  'anonimo: l''update non ha modificato nessuna comunicazione'
);

select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
    $q$update public.comunicazioni_retta
          set bonifico_stato = 'corretto'
        where id = 'e0000000-0000-0000-0000-000000000001'$q$),
  'ok',
  'admin: può aggiornare la verifica del bonifico (nessun errore)'
);
select is(
  (select bonifico_stato from public.comunicazioni_retta
    where id = 'e0000000-0000-0000-0000-000000000001'),
  'corretto',
  'admin: l''update ha effettivamente modificato la riga'
);

-- ---------------------------------------------------------------------
-- DELETE: solo l'admin (annullo invio, specs/56)
-- ---------------------------------------------------------------------
do $do$ begin
  perform pg_temp.write_as('a0000000-0000-0000-0000-000000000002',
    $q$delete from public.comunicazioni_retta$q$);
end $do$;
select is(
  (select count(*)::int from public.comunicazioni_retta
    where id in ('e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002')),
  2,
  'maestra: il delete non ha eliminato nessuna comunicazione'
);

do $do$ begin
  perform pg_temp.write_as('a0000000-0000-0000-0000-000000000003',
    $q$delete from public.comunicazioni_retta$q$);
end $do$;
select is(
  (select count(*)::int from public.comunicazioni_retta
    where id in ('e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002')),
  2,
  'assistente: il delete non ha eliminato nessuna comunicazione'
);

do $do$ begin
  perform pg_temp.write_as('a0000000-0000-0000-0000-000000000004',
    $q$delete from public.comunicazioni_retta$q$);
end $do$;
select is(
  (select count(*)::int from public.comunicazioni_retta
    where id in ('e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002')),
  2,
  'genitore: il delete non ha eliminato nessuna comunicazione, neanche quella del proprio figlio'
);

do $do$ begin
  perform pg_temp.write_as(null,
    $q$delete from public.comunicazioni_retta$q$);
end $do$;
select is(
  (select count(*)::int from public.comunicazioni_retta
    where id in ('e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002')),
  2,
  'anonimo: il delete non ha eliminato nessuna comunicazione'
);

select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
    $q$delete from public.comunicazioni_retta
        where id = 'e0000000-0000-0000-0000-000000000002'$q$),
  'ok',
  'admin: può annullare una comunicazione (nessun errore)'
);
select is(
  (select coalesce(array_agg(id order by id), '{}') from public.comunicazioni_retta
    where id in ('e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002')),
  array['e0000000-0000-0000-0000-000000000001']::uuid[],
  'admin: il delete ha eliminato solo la riga indicata'
);
-- Lo scopo dell'annullo (0038): liberare unique (bambino_id, mese) per
-- poter reinviare la comunicazione.
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
    pg_temp.insert_sql('c0000000-0000-0000-0000-000000000002', '2099-01')),
  'ok',
  'admin: dopo l''annullo può reinviare la comunicazione dello stesso mese'
);

select * from finish();

rollback;
