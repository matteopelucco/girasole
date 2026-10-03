-- Girasole — test pgTAP sulle policy RLS di public.pasti
-- (issue #181, sotto-issue "b" di #29; specs/03 - utenti-e-ruoli.md,
-- specs/10 - presenze-e-pasti.md, specs/14 - segna-pasto.md).
--
-- Policy sotto test (stato REALE dopo le migration):
--   pasti_select        (0001) admin; MAESTRA della sezione del bambino;
--                              genitore del bambino (ramo inattivo, vedi "DISCREPANZA"). L'assistente NON è
--                              nell'elenco: non legge nessun pasto (specs/14)
--   pasti_insert_staff  (0016) admin su ogni data; maestra (NON assistente)
--                              della sezione SOLO con data = oggi_roma()
--   pasti_update_staff  (0016) idem (nessuna WITH CHECK esplicita: vale la
--                              USING anche sulla riga nuova)
--   pasti_delete_admin  (0040) solo admin (specs/57)
--
-- Dipendenza dal calendario (IMPORTANTE): per la maestra la scrittura richiede
-- data = oggi_roma(), ma il trigger BEFORE `pasti_blocca_se_chiuso` (0022)
-- rifiuta QUALUNQUE scrittura in un giorno chiuso (sabato, domenica,
-- intervalli in giorni_chiusura), admin compreso. Se i test di scrittura
-- "oggi" si appoggiassero a quel trigger, l'esito dipenderebbe dal giorno in
-- cui gira la CI. Per questo (stessa scelta di presenze.test.sql):
--   * il trigger di chiusura viene verificato UNA volta, su un sabato fisso
--     (2030-03-16), prima di disattivarlo;
--   * poi viene disattivato (`alter table ... disable trigger`, solo in questa
--     transazione: il rollback finale lo ripristina) così tutti gli altri
--     casi misurano la sola RLS e danno lo stesso esito ogni giorno;
--   * le righe "storiche" di fixture usano un giorno feriale fisso
--     (2030-03-12), quelle "di oggi" usano oggi_roma(), qualunque giorno sia;
--   * gli altri trigger di `pasti` (0012/0017 bambino assente, 0020 pasti già
--     comunicati) non interferiscono: nessun bambino di fixture è assente e le
--     comunicazioni di oggi eventualmente presenti nel DB di test vengono
--     tolte dentro la transazione (rollback finale).
--
-- Tutto dentro una transazione chiusa da `rollback`: utenti, sezioni, bambini
-- e pasti qui sotto esistono solo per la durata del test. Dati chiaramente
-- fittizi (email @example.test), nessun dato reale. Si esegue con
-- `supabase test db` (in CI: job `e2e`, step 6a, dopo il reset del DB di
-- test). Mai sulla produzione.
--
-- Struttura (come profili_orari.test.sql): le funzioni pgTAP girano SEMPRE col
-- ruolo privilegiato di partenza; l'impersonazione di authenticated/anon
-- avviene solo dentro gli helper `pg_temp.*_as`, che poi ripristinano il
-- ruolo di partenza e restituiscono il risultato da confrontare.

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

select plan(47);

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

-- Id dei pasti di FIXTURE (f0...01..05) visibili a p_uid (null = anonimo),
-- in ordine. Un "permission denied" conta come nessuna riga: per questi test
-- conta solo che il dato non sia leggibile. Le altre righe eventualmente
-- presenti nel DB di test non interessano e restano escluse.
create function pg_temp.ids_as(p_uid uuid) returns uuid[]
language plpgsql as $$
declare
  v_prev text := current_user;
  v_ids uuid[];
begin
  perform pg_temp.impersona(p_uid);
  begin
    select coalesce(array_agg(id order by id), '{}') into v_ids
      from public.pasti
     where id in (
       'f0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000002',
       'f0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000004',
       'f0000000-0000-0000-0000-000000000005'
     );
  exception when insufficient_privilege then
    v_ids := '{}';
  end;
  perform set_config('role', v_prev, true);
  return v_ids;
end;
$$;

-- Esegue uno statement di scrittura come p_uid. Restituisce lo SQLSTATE
-- dell'errore se c'è (es. '42501' = RLS WITH CHECK / permission denied), o il
-- NUMERO DI RIGHE toccate come testo ('1' = scritto, '0' = la RLS ha ridotto
-- UPDATE/DELETE a zero righe senza errore).
create function pg_temp.write_as(p_uid uuid, p_sql text) returns text
language plpgsql as $$
declare
  v_prev text := current_user;
  v_res text;
  v_n bigint;
begin
  perform pg_temp.impersona(p_uid);
  begin
    execute p_sql;
    get diagnostics v_n = row_count;
    v_res := v_n::text;
  exception when others then
    v_res := sqlstate;
  end;
  perform set_config('role', v_prev, true);
  return v_res;
end;
$$;

-- ---------------------------------------------------------------------
-- Fixture (costruite col ruolo di partenza, con bypass RLS)
-- ---------------------------------------------------------------------
-- Il trigger on_auth_user_created (handle_new_user) crea il profilo
-- leggendo `ruolo` da raw_user_meta_data.
--   admin        a0..01
--   maestra M1   a0..02  -> sezione S1
--   assistente   a0..03  -> sezione S1
--   maestra M2   a0..04  -> sezione S2
--   genitore G1  a0..05  -> figlio B1 (S1)
--   genitore G2  a0..06  -> figlio B3 (S2)
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-0000-0000-000000000001', 'pgtap.admin@example.test', '{"ruolo":"admin"}'),
  ('a0000000-0000-0000-0000-000000000002', 'pgtap.maestra1@example.test', '{"ruolo":"maestra"}'),
  ('a0000000-0000-0000-0000-000000000003', 'pgtap.assistente@example.test', '{"ruolo":"assistente"}'),
  ('a0000000-0000-0000-0000-000000000004', 'pgtap.maestra2@example.test', '{"ruolo":"maestra"}'),
  ('a0000000-0000-0000-0000-000000000005', 'pgtap.genitore1@example.test', '{"ruolo":"genitore"}'),
  ('a0000000-0000-0000-0000-000000000006', 'pgtap.genitore2@example.test', '{"ruolo":"genitore"}');

insert into public.sezioni (id, nome) values
  ('d0000000-0000-0000-0000-000000000001', 'pgTAP S1'),
  ('d0000000-0000-0000-0000-000000000002', 'pgTAP S2');

insert into public.bambini (id, nome, cognome, sezione_id) values
  ('c0000000-0000-0000-0000-000000000001', 'PgtapUno', 'Fittizio', 'd0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000002', 'PgtapDue', 'Fittizio', 'd0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000003', 'PgtapTre', 'Fittizio', 'd0000000-0000-0000-0000-000000000002'),
  ('c0000000-0000-0000-0000-000000000004', 'PgtapQuattro', 'Fittizio', 'd0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000005', 'PgtapCinque', 'Fittizio', 'd0000000-0000-0000-0000-000000000002');

insert into public.maestre_sezioni (maestra_id, sezione_id) values
  ('a0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000002');

insert into public.bambini_genitori (bambino_id, genitore_id) values
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005'),
  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000006');

-- Il trigger 0020 blocca la maestra se i pasti della data sono già stati
-- comunicati: si toglie un'eventuale comunicazione di oggi rimasta nel DB di
-- test (solo in questa transazione).
delete from public.pasti_comunicati where data = public.oggi_roma();

-- ---------------------------------------------------------------------
-- Le policy attese esistono, RLS attiva
-- ---------------------------------------------------------------------
select ok(
  exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'pasti'
            and policyname = 'pasti_select'),
  'esiste la policy pasti_select');
select ok(
  exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'pasti'
            and policyname = 'pasti_insert_staff'),
  'esiste la policy pasti_insert_staff');
select ok(
  exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'pasti'
            and policyname = 'pasti_update_staff'),
  'esiste la policy pasti_update_staff');
select ok(
  exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'pasti'
            and policyname = 'pasti_delete_admin'),
  'esiste la policy pasti_delete_admin (0040)');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.pasti'::regclass),
  'RLS attiva su public.pasti');

-- ---------------------------------------------------------------------
-- Trigger di chiusura (0022): verificato su un sabato fisso, poi disattivato
-- ---------------------------------------------------------------------
-- Vale anche per l'admin (specs/53). SQLSTATE P0001 = raise exception.
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
    $q$insert into public.pasti (bambino_id, data, mangiato)
       values ('c0000000-0000-0000-0000-000000000001', '2030-03-16', 'si')$q$),
  'P0001',
  'admin: il trigger 0022 rifiuta un pasto di sabato (giorno chiuso, nessuna eccezione di ruolo)');

-- Da qui in poi si misura la sola RLS, indipendentemente dal giorno in cui
-- gira la CI. Il rollback finale ripristina il trigger.
alter table public.pasti disable trigger pasti_blocca_se_chiuso;

-- Righe di pasto di fixture, inserite a trigger di chiusura disattivato
-- (così né un giorno di chiusura registrato nel DB di test né il fatto che
-- oggi sia un sabato possono impedirne la creazione):
--   f0..01 B1 il 2030-03-12 (martedì)  si
--   f0..02 B2 il 2030-03-12            no
--   f0..03 B3 il 2030-03-12            si
--   f0..04 B1 oggi_roma()              si
--   f0..05 B3 oggi_roma()              si
--   f0..06 B1 il 2020-03-10 (martedì, davvero passato)  si
--     (bersaglio della prova negativa dell'assistente su data passata; NON
--     rientra nell'elenco di ids_as, quindi non altera le SELECT sopra)
-- I bambini sono fittizi e nuovi: nessun conflitto con unique (bambino_id, data).
insert into public.pasti (id, bambino_id, data, mangiato) values
  ('f0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '2030-03-12', 'si'),
  ('f0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', '2030-03-12', 'no'),
  ('f0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003', '2030-03-12', 'si'),
  ('f0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', public.oggi_roma(), 'si'),
  ('f0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000003', public.oggi_roma(), 'si'),
  ('f0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000001', '2020-03-10', 'si');

-- ---------------------------------------------------------------------
-- SELECT per ruolo
-- ---------------------------------------------------------------------
select is(
  pg_temp.ids_as('a0000000-0000-0000-0000-000000000001'),
  array['f0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000002',
        'f0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000004',
        'f0000000-0000-0000-0000-000000000005']::uuid[],
  'admin: legge i pasti di tutte le sezioni, di ogni data');
select is(
  pg_temp.ids_as('a0000000-0000-0000-0000-000000000002'),
  array['f0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000002',
        'f0000000-0000-0000-0000-000000000004']::uuid[],
  'maestra S1: legge i pasti della propria sezione (anche date passate), non quelli di S2');
select is(
  pg_temp.ids_as('a0000000-0000-0000-0000-000000000003'),
  '{}'::uuid[],
  'assistente: non legge nessun pasto, nemmeno della propria sezione (specs/14)');
select is(
  pg_temp.ids_as('a0000000-0000-0000-0000-000000000004'),
  array['f0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000005']::uuid[],
  'maestra S2: legge solo i pasti della propria sezione, non quelli di S1');
-- DISCREPANZA SPEC <-> DB (da decidere): specs/03 dice "lettura, solo il
-- proprio figlio" per il genitore, e pasti_select (0001) ha il ramo
-- `exists (select 1 from bambini_genitori bg where bg.genitore_id =
-- auth.uid() ...)`. Ma `bambini_genitori` ha la RLS attiva (0001) e NESSUNA
-- policy (verificato qui sotto su pg_policies): per authenticated la
-- subquery non restituisce righe (e lo stesso vale per `bambini_select_genitore`
-- su `bambini`), quindi il ramo genitore non scatta mai e OGGI il genitore
-- legge ZERO pasti. Il portale genitori è fuori scope UI, quindi nessun
-- effetto visibile; ma se un giorno servisse, la policy va corretta (non qui).
-- Il test fissa il comportamento REALE; se si aggiunge una policy a
-- bambini_genitori, l'asserzione strutturale sotto fallisce e questi due
-- casi vanno riscritti (atteso: le righe del solo figlio).
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'bambini_genitori'),
  0,
  'bambini_genitori: RLS attiva e nessuna policy (causa per cui il ramo genitore di pasti_select non scatta)');
select is(
  pg_temp.ids_as('a0000000-0000-0000-0000-000000000005'),
  '{}'::uuid[],
  'genitore G1: OGGI legge zero pasti, anche del proprio figlio B1 (differisce da specs/03; vedi nota sopra)');
select is(
  pg_temp.ids_as('a0000000-0000-0000-0000-000000000006'),
  '{}'::uuid[],
  'genitore G2: OGGI legge zero pasti, anche del proprio figlio B3 (differisce da specs/03; vedi nota sopra)');
select is(pg_temp.ids_as(null), '{}'::uuid[], 'anonimo: non legge nessun pasto');

-- ---------------------------------------------------------------------
-- INSERT per ruolo (prima i casi negativi, poi i positivi: unique
-- (bambino_id, data) non deve mai mascherare l'esito della RLS)
-- ---------------------------------------------------------------------
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000002',
    $q$insert into public.pasti (bambino_id, data, mangiato)
       values ('c0000000-0000-0000-0000-000000000005', public.oggi_roma(), 'si')$q$),
  '42501', 'maestra S1: non può inserire il pasto di un bambino di S2 (oggi)');
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000004',
    $q$insert into public.pasti (bambino_id, data, mangiato)
       values ('c0000000-0000-0000-0000-000000000002', public.oggi_roma(), 'si')$q$),
  '42501', 'maestra S2: non può inserire il pasto di un bambino di S1 (oggi)');
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000002',
    $q$insert into public.pasti (bambino_id, data, mangiato)
       values ('c0000000-0000-0000-0000-000000000002', '2030-03-13', 'si')$q$),
  '42501', 'maestra: non può inserire su una data diversa da oggi, nemmeno nella propria sezione');
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000003',
    $q$insert into public.pasti (bambino_id, data, mangiato)
       values ('c0000000-0000-0000-0000-000000000002', public.oggi_roma(), 'si')$q$),
  '42501', 'assistente: non può inserire pasti, nemmeno oggi nella propria sezione (specs/14)');
-- Assistente: il rifiuto è di ruolo (0016: pasti_insert_staff ammette solo
-- admin e maestra), non di sezione né di data; le due prove sotto fissano
-- che nessuna combinazione fuori sezione / data passata la faccia passare.
-- Il rifiuto atteso è della sola RLS: trigger di chiusura disattivato,
-- nessuna comunicazione per il 2020-03-10 (trigger 0020), nessun bambino
-- assente (0012) e nessun conflitto con unique (B5 oggi e B2 al 2020-03-10
-- non hanno righe).
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000003',
    $q$insert into public.pasti (bambino_id, data, mangiato)
       values ('c0000000-0000-0000-0000-000000000005', public.oggi_roma(), 'si')$q$),
  '42501', 'assistente S1: non può inserire il pasto di un bambino di S2 (oggi)');
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000003',
    $q$insert into public.pasti (bambino_id, data, mangiato)
       values ('c0000000-0000-0000-0000-000000000002', '2020-03-10', 'si')$q$),
  '42501', 'assistente: non può inserire pasti su una data passata, nemmeno nella propria sezione');
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000005',
    $q$insert into public.pasti (bambino_id, data, mangiato)
       values ('c0000000-0000-0000-0000-000000000001', public.oggi_roma(), 'si')$q$),
  '42501', 'genitore: non può inserire pasti, neanche del proprio figlio');
select is(
  pg_temp.write_as(null,
    $q$insert into public.pasti (bambino_id, data, mangiato)
       values ('c0000000-0000-0000-0000-000000000001', public.oggi_roma(), 'si')$q$),
  '42501', 'anonimo: non può inserire pasti');

select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000002',
    $q$insert into public.pasti (bambino_id, data, mangiato)
       values ('c0000000-0000-0000-0000-000000000004', public.oggi_roma(), 'si')$q$),
  '1', 'maestra S1: può inserire il pasto di oggi di un bambino della propria sezione');
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000004',
    $q$insert into public.pasti (bambino_id, data, mangiato)
       values ('c0000000-0000-0000-0000-000000000005', public.oggi_roma(), 'si')$q$),
  '1', 'maestra S2: può inserire il pasto di oggi di un bambino della propria sezione');
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
    $q$insert into public.pasti (bambino_id, data, mangiato)
       values ('c0000000-0000-0000-0000-000000000001', '2030-03-13', 'si')$q$),
  '1', 'admin: può inserire il pasto di qualunque bambino su una data diversa da oggi');

-- ---------------------------------------------------------------------
-- UPDATE per ruolo (UPDATE bloccato dalla RLS = '0' righe, senza errore)
-- ---------------------------------------------------------------------
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000002',
    $q$update public.pasti set note = 'pgTAP' where id = 'f0000000-0000-0000-0000-000000000004'$q$),
  '1', 'maestra S1: può modificare il pasto di oggi della propria sezione');
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000004',
    $q$update public.pasti set note = 'pgTAP' where id = 'f0000000-0000-0000-0000-000000000005'$q$),
  '1', 'maestra S2: può modificare il pasto di oggi della propria sezione');
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000003',
    $q$update public.pasti set note = 'manomesso' where id = 'f0000000-0000-0000-0000-000000000004'$q$),
  '0', 'assistente: non modifica (0 righe) il pasto di oggi della propria sezione');
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000002',
    $q$update public.pasti set note = 'manomesso' where id = 'f0000000-0000-0000-0000-000000000005'$q$),
  '0', 'maestra S1: non modifica (0 righe) il pasto di un bambino di S2');
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000004',
    $q$update public.pasti set note = 'manomesso' where id = 'f0000000-0000-0000-0000-000000000004'$q$),
  '0', 'maestra S2: non modifica (0 righe) il pasto di un bambino di S1');
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000002',
    $q$update public.pasti set note = 'manomesso' where id = 'f0000000-0000-0000-0000-000000000001'$q$),
  '0', 'maestra S1: non modifica (0 righe) il pasto di una data passata della propria sezione');
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000003',
    $q$update public.pasti set note = 'manomesso' where id = 'f0000000-0000-0000-0000-000000000006'$q$),
  '0', 'assistente: non modifica (0 righe) il pasto di una data passata della propria sezione');
-- Controprova con ruolo privilegiato: lo '0' righe vale come prova della RLS
-- solo se la riga esiste ed è rimasta intatta (non un id sbagliato né un
-- errore altrove).
select is(
  (select count(*)::int from public.pasti
    where id = 'f0000000-0000-0000-0000-000000000006' and note is null),
  1,
  'la riga di data passata esiste ed è intatta: lo 0 righe dell''assistente è della RLS (USING), non di un filtro sbagliato');
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000002',
    $q$update public.pasti set data = '2030-03-13' where id = 'f0000000-0000-0000-0000-000000000004'$q$),
  '42501', 'maestra: non può spostare il pasto di oggi su un''altra data (la USING vale anche come WITH CHECK)');
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000002',
    $q$update public.pasti set bambino_id = 'c0000000-0000-0000-0000-000000000003'
       where id = 'f0000000-0000-0000-0000-000000000004'$q$),
  '42501', 'maestra S1: non può riassegnare il proprio pasto a un bambino di S2');
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
    $q$update public.pasti set note = 'pgTAP admin' where id = 'f0000000-0000-0000-0000-000000000001'$q$),
  '1', 'admin: può modificare il pasto di una data passata');
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000005',
    $q$update public.pasti set note = 'manomesso' where id = 'f0000000-0000-0000-0000-000000000004'$q$),
  '0', 'genitore: non modifica (0 righe) il pasto del proprio figlio');
-- Anonimo: 0 righe se anon ha il GRANT (la RLS nega), 42501 se il GRANT
-- mancasse: entrambi significano "nessuna scrittura possibile".
select ok(
  pg_temp.write_as(null,
    $q$update public.pasti set note = 'manomesso' where id = 'f0000000-0000-0000-0000-000000000004'$q$)
    in ('0', '42501'),
  'anonimo: non può modificare pasti');

-- ---------------------------------------------------------------------
-- DELETE per ruolo (solo admin, specs/57)
-- ---------------------------------------------------------------------
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000002',
    $q$delete from public.pasti where id = 'f0000000-0000-0000-0000-000000000004'$q$),
  '0', 'maestra S1: non può eliminare il pasto di oggi della propria sezione');
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000003',
    $q$delete from public.pasti where id = 'f0000000-0000-0000-0000-000000000004'$q$),
  '0', 'assistente: non può eliminare pasti');
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000002',
    $q$delete from public.pasti where id = 'f0000000-0000-0000-0000-000000000005'$q$),
  '0', 'maestra S1: non può eliminare il pasto di un bambino di S2');
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000004',
    $q$delete from public.pasti where id = 'f0000000-0000-0000-0000-000000000005'$q$),
  '0', 'maestra S2: non può eliminare nemmeno il pasto di oggi della propria sezione');
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000005',
    $q$delete from public.pasti where id = 'f0000000-0000-0000-0000-000000000004'$q$),
  '0', 'genitore: non può eliminare il pasto del proprio figlio');
select ok(
  pg_temp.write_as(null,
    $q$delete from public.pasti where id = 'f0000000-0000-0000-0000-000000000004'$q$)
    in ('0', '42501'),
  'anonimo: non può eliminare pasti');
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
    $q$delete from public.pasti where id = 'f0000000-0000-0000-0000-000000000001'$q$),
  '1', 'admin: può eliminare un pasto di una data passata (reset giornata)');
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
    $q$delete from public.pasti where id = 'f0000000-0000-0000-0000-000000000003'$q$),
  '1', 'admin: può eliminare il pasto di qualunque sezione');

-- Controprova con ruolo privilegiato: i tentativi negativi sopra non hanno
-- eliminato i due pasti di oggi.
select is(
  (select count(*)::int from public.pasti
    where id in ('f0000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000005')),
  2,
  'le DELETE negate (maestra, assistente, genitore, anonimo) non hanno eliminato i pasti di oggi');

select * from finish();

rollback;
