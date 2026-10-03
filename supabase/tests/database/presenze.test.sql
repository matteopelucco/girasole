-- Girasole — test pgTAP sulle policy RLS di public.presenze
-- (issue #181, sotto-issue "b" di #29; specs/03 - utenti-e-ruoli.md,
-- specs/10 - presenze-e-pasti.md, specs/13 - segna-presenza.md).
--
-- Policy sotto test (stato REALE dopo le migration, non quello di 0001):
--   presenze_select        (0016) admin; maestra/assistente della sezione del
--                                 bambino; genitore del bambino (ramo inattivo, vedi "DISCREPANZA")
--   presenze_insert_staff  (0016) admin su ogni data; maestra/assistente della
--                                 sezione SOLO con data = oggi_roma()
--   presenze_update_staff  (0016) idem (nessuna WITH CHECK esplicita: vale la
--                                 USING anche sulla riga nuova)
--   presenze_delete_admin  (0040) solo admin (specs/57; maestra/assistente non
--                                 cancellano mai, nemmeno la propria sezione)
--
-- Dipendenza dal calendario (IMPORTANTE): per lo staff la scrittura richiede
-- data = oggi_roma(), ma il trigger BEFORE `presenze_blocca_se_chiuso` (0022)
-- rifiuta QUALUNQUE scrittura in un giorno chiuso (sabato, domenica,
-- intervalli in giorni_chiusura), admin compreso. Se i test di scrittura
-- "oggi" si appoggiassero a quel trigger, l'esito dipenderebbe dal giorno in
-- cui gira la CI (il sabato i casi positivi fallirebbero). Per questo:
--   * il trigger di chiusura viene verificato UNA volta, su un sabato fisso
--     (2030-03-16), prima di disattivarlo;
--   * poi viene disattivato (`alter table ... disable trigger`, solo in questa
--     transazione: il rollback finale lo ripristina) così tutti gli altri
--     casi misurano la sola RLS e danno lo stesso esito ogni giorno;
--   * le righe "storiche" di fixture usano date feriali fisse (2030-03-12 e
--     2030-03-13); le righe "di oggi" usano oggi_roma(), qualunque giorno sia.
--
-- Tutto dentro una transazione chiusa da `rollback`: utenti, sezioni, bambini
-- e presenze qui sotto esistono solo per la durata del test. Dati chiaramente
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

select plan(43);

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

-- Id delle presenze di FIXTURE (e0...01..05) visibili a p_uid (null =
-- anonimo), in ordine. Un "permission denied" conta come nessuna riga: per
-- questi test conta solo che il dato non sia leggibile. Le altre righe
-- eventualmente presenti nel DB di test non interessano e restano escluse.
create function pg_temp.ids_as(p_uid uuid) returns uuid[]
language plpgsql as $$
declare
  v_prev text := current_user;
  v_ids uuid[];
begin
  perform pg_temp.impersona(p_uid);
  begin
    select coalesce(array_agg(id order by id), '{}') into v_ids
      from public.presenze
     where id in (
       'e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002',
       'e0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000004',
       'e0000000-0000-0000-0000-000000000005'
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

-- ---------------------------------------------------------------------
-- Le policy attese esistono, RLS attiva
-- ---------------------------------------------------------------------
select ok(
  exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'presenze'
            and policyname = 'presenze_select'),
  'esiste la policy presenze_select');
select ok(
  exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'presenze'
            and policyname = 'presenze_insert_staff'),
  'esiste la policy presenze_insert_staff');
select ok(
  exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'presenze'
            and policyname = 'presenze_update_staff'),
  'esiste la policy presenze_update_staff');
select ok(
  exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'presenze'
            and policyname = 'presenze_delete_admin'),
  'esiste la policy presenze_delete_admin (0040)');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.presenze'::regclass),
  'RLS attiva su public.presenze');

-- ---------------------------------------------------------------------
-- Trigger di chiusura (0022): verificato su un sabato fisso, poi disattivato
-- ---------------------------------------------------------------------
-- Vale anche per l'admin (specs/53). SQLSTATE P0001 = raise exception.
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
    $q$insert into public.presenze (bambino_id, data, stato)
       values ('c0000000-0000-0000-0000-000000000001', '2030-03-16', 'presente')$q$),
  'P0001',
  'admin: il trigger 0022 rifiuta una presenza di sabato (giorno chiuso, nessuna eccezione di ruolo)');

-- Da qui in poi si misura la sola RLS, indipendentemente dal giorno in cui
-- gira la CI. Il rollback finale ripristina il trigger.
alter table public.presenze disable trigger presenze_blocca_se_chiuso;

-- Righe di presenza di fixture, inserite a trigger di chiusura disattivato
-- (così né un giorno di chiusura registrato nel DB di test né il fatto che
-- oggi sia un sabato possono impedirne la creazione):
--   e0..01 B1 il 2030-03-12 (martedì)  presente
--   e0..02 B2 il 2030-03-12            assente
--   e0..03 B3 il 2030-03-12            presente
--   e0..04 B1 oggi_roma()              presente
--   e0..05 B3 oggi_roma()              presente
-- I bambini sono fittizi e nuovi: nessun conflitto con unique (bambino_id, data).
insert into public.presenze (id, bambino_id, data, stato) values
  ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '2030-03-12', 'presente'),
  ('e0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', '2030-03-12', 'assente'),
  ('e0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003', '2030-03-12', 'presente'),
  ('e0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', public.oggi_roma(), 'presente'),
  ('e0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000003', public.oggi_roma(), 'presente');

-- ---------------------------------------------------------------------
-- SELECT per ruolo
-- ---------------------------------------------------------------------
select is(
  pg_temp.ids_as('a0000000-0000-0000-0000-000000000001'),
  array['e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002',
        'e0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000004',
        'e0000000-0000-0000-0000-000000000005']::uuid[],
  'admin: legge le presenze di tutte le sezioni, di ogni data');
select is(
  pg_temp.ids_as('a0000000-0000-0000-0000-000000000002'),
  array['e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002',
        'e0000000-0000-0000-0000-000000000004']::uuid[],
  'maestra S1: legge le presenze della propria sezione (anche date passate), non quelle di S2');
select is(
  pg_temp.ids_as('a0000000-0000-0000-0000-000000000003'),
  array['e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002',
        'e0000000-0000-0000-0000-000000000004']::uuid[],
  'assistente S1: legge le presenze della propria sezione (come la maestra), non quelle di S2');
select is(
  pg_temp.ids_as('a0000000-0000-0000-0000-000000000004'),
  array['e0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000005']::uuid[],
  'maestra S2: legge solo le presenze della propria sezione, non quelle di S1');
-- DISCREPANZA SPEC <-> DB (da decidere): specs/03 dice "lettura, solo il
-- proprio figlio" per il genitore, e presenze_select (0016) ha il ramo
-- `exists (select 1 from bambini_genitori bg where bg.genitore_id =
-- auth.uid() ...)`. Ma `bambini_genitori` ha la RLS attiva (0001) e NESSUNA
-- policy (verificato qui sotto su pg_policies): per authenticated la
-- subquery non restituisce righe (e lo stesso vale per `bambini_select_genitore`
-- su `bambini`), quindi il ramo genitore non scatta mai e OGGI il genitore
-- legge ZERO presenze. Il portale genitori è fuori scope UI, quindi nessun
-- effetto visibile; ma se un giorno servisse, la policy va corretta (non qui).
-- Il test fissa il comportamento REALE; se si aggiunge una policy a
-- bambini_genitori, l'asserzione strutturale sotto fallisce e questi due
-- casi vanno riscritti (atteso: le righe del solo figlio).
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'bambini_genitori'),
  0,
  'bambini_genitori: RLS attiva e nessuna policy (causa per cui il ramo genitore di presenze_select non scatta)');
select is(
  pg_temp.ids_as('a0000000-0000-0000-0000-000000000005'),
  '{}'::uuid[],
  'genitore G1: OGGI legge zero presenze, anche del proprio figlio B1 (differisce da specs/03; vedi nota sopra)');
select is(
  pg_temp.ids_as('a0000000-0000-0000-0000-000000000006'),
  '{}'::uuid[],
  'genitore G2: OGGI legge zero presenze, anche del proprio figlio B3 (differisce da specs/03; vedi nota sopra)');
select is(pg_temp.ids_as(null), '{}'::uuid[], 'anonimo: non legge nessuna presenza');

-- ---------------------------------------------------------------------
-- INSERT per ruolo (prima i casi negativi, poi i positivi: unique
-- (bambino_id, data) non deve mai mascherare l'esito della RLS)
-- ---------------------------------------------------------------------
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000002',
    $q$insert into public.presenze (bambino_id, data, stato)
       values ('c0000000-0000-0000-0000-000000000005', public.oggi_roma(), 'presente')$q$),
  '42501', 'maestra S1: non può inserire la presenza di un bambino di S2 (oggi)');
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000004',
    $q$insert into public.presenze (bambino_id, data, stato)
       values ('c0000000-0000-0000-0000-000000000002', public.oggi_roma(), 'presente')$q$),
  '42501', 'maestra S2: non può inserire la presenza di un bambino di S1 (oggi)');
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000002',
    $q$insert into public.presenze (bambino_id, data, stato)
       values ('c0000000-0000-0000-0000-000000000002', '2030-03-13', 'presente')$q$),
  '42501', 'maestra: non può inserire su una data diversa da oggi, nemmeno nella propria sezione');
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000005',
    $q$insert into public.presenze (bambino_id, data, stato)
       values ('c0000000-0000-0000-0000-000000000001', public.oggi_roma(), 'presente')$q$),
  '42501', 'genitore: non può inserire presenze, neanche del proprio figlio');
select is(
  pg_temp.write_as(null,
    $q$insert into public.presenze (bambino_id, data, stato)
       values ('c0000000-0000-0000-0000-000000000001', public.oggi_roma(), 'presente')$q$),
  '42501', 'anonimo: non può inserire presenze');

select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000002',
    $q$insert into public.presenze (bambino_id, data, stato)
       values ('c0000000-0000-0000-0000-000000000004', public.oggi_roma(), 'presente')$q$),
  '1', 'maestra S1: può inserire la presenza di oggi di un bambino della propria sezione');
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000004',
    $q$insert into public.presenze (bambino_id, data, stato)
       values ('c0000000-0000-0000-0000-000000000005', public.oggi_roma(), 'presente')$q$),
  '1', 'maestra S2: può inserire la presenza di oggi di un bambino della propria sezione');
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000003',
    $q$insert into public.presenze (bambino_id, data, stato)
       values ('c0000000-0000-0000-0000-000000000002', public.oggi_roma(), 'presente')$q$),
  '1', 'assistente S1: può inserire la presenza di oggi di un bambino della propria sezione');
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
    $q$insert into public.presenze (bambino_id, data, stato)
       values ('c0000000-0000-0000-0000-000000000001', '2030-03-13', 'presente')$q$),
  '1', 'admin: può inserire la presenza di qualunque bambino su una data diversa da oggi');

-- ---------------------------------------------------------------------
-- UPDATE per ruolo (UPDATE bloccato dalla RLS = '0' righe, senza errore)
-- ---------------------------------------------------------------------
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000002',
    $q$update public.presenze set note = 'pgTAP' where id = 'e0000000-0000-0000-0000-000000000004'$q$),
  '1', 'maestra S1: può modificare la presenza di oggi della propria sezione');
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000003',
    $q$update public.presenze set note = 'pgTAP' where id = 'e0000000-0000-0000-0000-000000000004'$q$),
  '1', 'assistente S1: può modificare la presenza di oggi della propria sezione');
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000004',
    $q$update public.presenze set note = 'pgTAP' where id = 'e0000000-0000-0000-0000-000000000005'$q$),
  '1', 'maestra S2: può modificare la presenza di oggi della propria sezione');
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000002',
    $q$update public.presenze set note = 'manomesso' where id = 'e0000000-0000-0000-0000-000000000005'$q$),
  '0', 'maestra S1: non modifica (0 righe) la presenza di un bambino di S2');
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000004',
    $q$update public.presenze set note = 'manomesso' where id = 'e0000000-0000-0000-0000-000000000004'$q$),
  '0', 'maestra S2: non modifica (0 righe) la presenza di un bambino di S1');
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000002',
    $q$update public.presenze set note = 'manomesso' where id = 'e0000000-0000-0000-0000-000000000001'$q$),
  '0', 'maestra S1: non modifica (0 righe) la presenza di una data passata della propria sezione');
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000002',
    $q$update public.presenze set data = '2030-03-13' where id = 'e0000000-0000-0000-0000-000000000004'$q$),
  '42501', 'maestra: non può spostare la presenza di oggi su un''altra data (la USING vale anche come WITH CHECK)');
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000002',
    $q$update public.presenze set bambino_id = 'c0000000-0000-0000-0000-000000000003'
       where id = 'e0000000-0000-0000-0000-000000000004'$q$),
  '42501', 'maestra S1: non può riassegnare la propria presenza a un bambino di S2');
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
    $q$update public.presenze set note = 'pgTAP admin' where id = 'e0000000-0000-0000-0000-000000000001'$q$),
  '1', 'admin: può modificare la presenza di una data passata');
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000005',
    $q$update public.presenze set note = 'manomesso' where id = 'e0000000-0000-0000-0000-000000000004'$q$),
  '0', 'genitore: non modifica (0 righe) la presenza del proprio figlio');
-- Anonimo: 0 righe se authenticated/anon hanno il GRANT (la RLS nega), 42501
-- se il GRANT mancasse: entrambi significano "nessuna scrittura possibile".
select ok(
  pg_temp.write_as(null,
    $q$update public.presenze set note = 'manomesso' where id = 'e0000000-0000-0000-0000-000000000004'$q$)
    in ('0', '42501'),
  'anonimo: non può modificare presenze');

-- ---------------------------------------------------------------------
-- DELETE per ruolo (solo admin, specs/57)
-- ---------------------------------------------------------------------
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000002',
    $q$delete from public.presenze where id = 'e0000000-0000-0000-0000-000000000004'$q$),
  '0', 'maestra S1: non può eliminare la presenza di oggi della propria sezione');
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000003',
    $q$delete from public.presenze where id = 'e0000000-0000-0000-0000-000000000004'$q$),
  '0', 'assistente S1: non può eliminare la presenza di oggi della propria sezione');
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000002',
    $q$delete from public.presenze where id = 'e0000000-0000-0000-0000-000000000005'$q$),
  '0', 'maestra S1: non può eliminare la presenza di un bambino di S2');
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000004',
    $q$delete from public.presenze where id = 'e0000000-0000-0000-0000-000000000005'$q$),
  '0', 'maestra S2: non può eliminare nemmeno la presenza di oggi della propria sezione');
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000005',
    $q$delete from public.presenze where id = 'e0000000-0000-0000-0000-000000000004'$q$),
  '0', 'genitore: non può eliminare la presenza del proprio figlio');
select ok(
  pg_temp.write_as(null,
    $q$delete from public.presenze where id = 'e0000000-0000-0000-0000-000000000004'$q$)
    in ('0', '42501'),
  'anonimo: non può eliminare presenze');
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
    $q$delete from public.presenze where id = 'e0000000-0000-0000-0000-000000000001'$q$),
  '1', 'admin: può eliminare una presenza di una data passata (reset giornata)');
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
    $q$delete from public.presenze where id = 'e0000000-0000-0000-0000-000000000003'$q$),
  '1', 'admin: può eliminare la presenza di qualunque sezione');

-- Controprova con ruolo privilegiato: i tentativi negativi sopra non hanno
-- eliminato le due presenze di oggi.
select is(
  (select count(*)::int from public.presenze
    where id in ('e0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000005')),
  2,
  'le DELETE negate (maestra, assistente, genitore, anonimo) non hanno eliminato le presenze di oggi');

select * from finish();

rollback;
