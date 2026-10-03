-- Girasole — test pgTAP sulle RPC dei pasti per Rojac su tutto l'asilo
-- (issue #211, sotto-issue "a" di #38; specs/16 - comunicazione-pasti-rojac.md,
-- specs/03 - utenti-e-ruoli.md; migration 0056).
--
-- Funzioni sotto test (security definer, richiamate via RPC con la sessione
-- dell'utente):
--   pasti_si_oggi_asilo(date)            -> integer
--   bambini_senza_presenza_asilo(date)   -> (id, nome, cognome)
--   bambini_incoerenti_asilo(date)       -> righe grezze (id, nome, cognome,
--                                           stato, pre_asilo, post_asilo, mangiato)
-- più il controllo interno assicura_accesso_pasti_asilo(date).
--
-- Comportamento fissato:
--   * ammessi: admin (qualunque data) e maestra (solo oggi_roma());
--   * respinti con SQLSTATE 42501 (mai un insieme vuoto): assistente (non è
--     un attore della comunicazione, specs/16/03: niente pasti), genitore,
--     utente senza profilo, maestra su una data diversa da oggi, anonimo
--     (nessun EXECUTE concesso ad anon);
--   * i dati sono dell'intero asilo (anche sezioni non assegnate alla
--     maestra), solo bambini attivi;
--   * proprietà di sicurezza: security definer, search_path fisso, stable,
--     EXECUTE solo ad authenticated (e non a anon).
--
-- Fixture (stessa struttura su una data fissa feriale, 2030-03-12, per i
-- risultati esatti dell'admin, e su oggi_roma() per la maestra; il DB di test
-- può contenere altri dati "di oggi", quindi su oggi gli elenchi sono
-- filtrati sui soli bambini di fixture):
--   B1 (S1, maestra)  presente + pre-asilo, pasto si
--   B2 (S2)           presente, pasto si
--   B3 (S2)           assente, pasto si              -> incoerente
--   B4 (S2)           nessuna presenza, nessun pasto -> senza presenza
--   B5 (S2, INATTIVO) nessuna presenza, pasto si     -> escluso ovunque
--   B6 (S2)           malattia, pasto si             -> incoerente
--   B7 (S1)           assente, pasto no
--
-- Tutto dentro una transazione chiusa da `rollback`. Dati chiaramente
-- fittizi (email @example.test), nessun dato reale. Si esegue con
-- `supabase test db` (in CI: job `e2e`, dopo il reset del DB di test). Mai
-- sulla produzione.
--
-- Struttura (come comunicazioni_retta.test.sql): le funzioni pgTAP girano
-- SEMPRE col ruolo privilegiato di partenza; l'impersonazione di
-- authenticated/anon avviene solo dentro gli helper `pg_temp.*_as`, che poi
-- ripristinano il ruolo di partenza.

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

select pg_temp.diag('dopo set role');

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

select plan(45);

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

-- Esegue una query come p_uid e restituisce 'ok' oppure lo SQLSTATE
-- dell'errore.
create function pg_temp.esito_as(p_uid uuid, p_sql text) returns text
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

-- Risultato di pasti_si_oggi_asilo(p_data) come p_uid.
create function pg_temp.conta_as(p_uid uuid, p_data date) returns integer
language plpgsql as $$
declare
  v_prev text := current_user;
  v_n integer;
begin
  perform pg_temp.impersona(p_uid);
  select public.pasti_si_oggi_asilo(p_data) into v_n;
  perform set_config('role', v_prev, true);
  return v_n;
end;
$$;

-- Pasti "sì" della data che p_uid vede direttamente sulla tabella (RLS):
-- serve a provare che la RPC va oltre le sezioni visibili alla maestra.
create function pg_temp.pasti_visibili_as(p_uid uuid, p_data date) returns integer
language plpgsql as $$
declare
  v_prev text := current_user;
  v_n integer;
begin
  perform pg_temp.impersona(p_uid);
  select count(*)::integer into v_n
    from public.pasti where data = p_data and mangiato = 'si';
  perform set_config('role', v_prev, true);
  return v_n;
end;
$$;

-- Ultime due cifre degli id dei bambini di fixture senza presenza, come
-- restituiti da bambini_senza_presenza_asilo(p_data) a p_uid.
create function pg_temp.senza_as(p_uid uuid, p_data date) returns text[]
language plpgsql as $$
declare
  v_prev text := current_user;
  v_r text[];
begin
  perform pg_temp.impersona(p_uid);
  select coalesce(array_agg(right(s.id::text, 2) order by s.id), '{}') into v_r
    from public.bambini_senza_presenza_asilo(p_data) s
   where s.id::text like 'c0000000-0000-0000-0000-0000000000%';
  perform set_config('role', v_prev, true);
  return v_r;
end;
$$;

-- Nome e cognome della riga B4 restituita da bambini_senza_presenza_asilo
-- (verifica che i campi restituiti siano proprio nome e cognome).
create function pg_temp.nome_b4_as(p_uid uuid, p_data date) returns text
language plpgsql as $$
declare
  v_prev text := current_user;
  v_r text;
begin
  perform pg_temp.impersona(p_uid);
  select s.nome || ' ' || s.cognome into v_r
    from public.bambini_senza_presenza_asilo(p_data) s
   where s.id = 'c0000000-0000-0000-0000-000000000004';
  perform set_config('role', v_prev, true);
  return v_r;
end;
$$;

-- Righe grezze di bambini_incoerenti_asilo(p_data) per i bambini di
-- fixture, nel formato 'NN|stato|pre|post|pasto'.
create function pg_temp.incoerenti_as(p_uid uuid, p_data date) returns text[]
language plpgsql as $$
declare
  v_prev text := current_user;
  v_r text[];
begin
  perform pg_temp.impersona(p_uid);
  select coalesce(array_agg(
           format('%s|%s|%s|%s|%s', right(i.id::text, 2), coalesce(i.stato, '-'),
                  coalesce(i.pre_asilo::text, '-'), coalesce(i.post_asilo::text, '-'),
                  coalesce(i.mangiato, '-'))
           order by i.id), '{}') into v_r
    from public.bambini_incoerenti_asilo(p_data) i
   where i.id::text like 'c0000000-0000-0000-0000-0000000000%';
  perform set_config('role', v_prev, true);
  return v_r;
end;
$$;

-- ---------------------------------------------------------------------
-- Fixture (costruite col ruolo di partenza, con bypass RLS)
-- ---------------------------------------------------------------------
--   admin       a0..01
--   maestra     a0..02  -> sezione S1
--   assistente  a0..03  -> sezione S1
--   genitore    a0..04  -> figlio B1
--   senza profilo a0..05 (profilo eliminato subito dopo la creazione)
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-0000-0000-000000000001', 'pgtap.admin@example.test', '{"ruolo":"admin"}'),
  ('a0000000-0000-0000-0000-000000000002', 'pgtap.maestra@example.test', '{"ruolo":"maestra"}'),
  ('a0000000-0000-0000-0000-000000000003', 'pgtap.assistente@example.test', '{"ruolo":"assistente"}'),
  ('a0000000-0000-0000-0000-000000000004', 'pgtap.genitore@example.test', '{"ruolo":"genitore"}'),
  ('a0000000-0000-0000-0000-000000000005', 'pgtap.senzaprofilo@example.test', '{"ruolo":"genitore"}');

delete from public.profili where id = 'a0000000-0000-0000-0000-000000000005';

insert into public.sezioni (id, nome) values
  ('d0000000-0000-0000-0000-000000000001', 'pgTAP S1'),
  ('d0000000-0000-0000-0000-000000000002', 'pgTAP S2');

insert into public.bambini (id, nome, cognome, sezione_id, attiva) values
  ('c0000000-0000-0000-0000-000000000001', 'PgtapUno', 'Fittizio', 'd0000000-0000-0000-0000-000000000001', true),
  ('c0000000-0000-0000-0000-000000000002', 'PgtapDue', 'Fittizio', 'd0000000-0000-0000-0000-000000000002', true),
  ('c0000000-0000-0000-0000-000000000003', 'PgtapTre', 'Fittizio', 'd0000000-0000-0000-0000-000000000002', true),
  ('c0000000-0000-0000-0000-000000000004', 'PgtapQuattro', 'Fittizio', 'd0000000-0000-0000-0000-000000000002', true),
  ('c0000000-0000-0000-0000-000000000005', 'PgtapCinque', 'Fittizio', 'd0000000-0000-0000-0000-000000000002', false),
  ('c0000000-0000-0000-0000-000000000006', 'PgtapSei', 'Fittizio', 'd0000000-0000-0000-0000-000000000002', true),
  ('c0000000-0000-0000-0000-000000000007', 'PgtapSette', 'Fittizio', 'd0000000-0000-0000-0000-000000000001', true);

insert into public.maestre_sezioni (maestra_id, sezione_id) values
  ('a0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001');

insert into public.bambini_genitori (bambino_id, genitore_id) values
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004');

-- Un'eventuale comunicazione di oggi o della data fissa rimasta nel DB di
-- test bloccherebbe i trigger 0020/0052 (solo in questa transazione).
delete from public.pasti_comunicati where data in (public.oggi_roma(), date '2030-03-12');

-- I trigger di chiusura scolastica (0022) rifiutano la scrittura nei giorni
-- chiusi (sabato, domenica, ...): l'esito dipenderebbe dal giorno in cui gira
-- la CI. Si disattivano per questa transazione (il rollback li ripristina).
alter table public.presenze disable trigger presenze_blocca_se_chiuso;
alter table public.pasti disable trigger pasti_blocca_se_chiuso;

-- Stesse righe su due date: quella fissa (risultati esatti per l'admin) e
-- oggi (per la maestra). Prima i pasti, poi le presenze: il trigger 0012
-- rifiuta un pasto su un bambino già assente.
do $$
declare
  d date;
begin
  foreach d in array array[date '2030-03-12', public.oggi_roma()] loop
    insert into public.pasti (bambino_id, data, mangiato) values
      ('c0000000-0000-0000-0000-000000000001', d, 'si'),
      ('c0000000-0000-0000-0000-000000000002', d, 'si'),
      ('c0000000-0000-0000-0000-000000000003', d, 'si'),
      ('c0000000-0000-0000-0000-000000000005', d, 'si'),
      ('c0000000-0000-0000-0000-000000000006', d, 'si'),
      ('c0000000-0000-0000-0000-000000000007', d, 'no');
    insert into public.presenze (bambino_id, data, stato, pre_asilo) values
      ('c0000000-0000-0000-0000-000000000001', d, 'presente', true),
      ('c0000000-0000-0000-0000-000000000002', d, 'presente', false),
      ('c0000000-0000-0000-0000-000000000003', d, 'assente', false),
      ('c0000000-0000-0000-0000-000000000006', d, 'malattia', false),
      ('c0000000-0000-0000-0000-000000000007', d, 'assente', false);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Proprietà di sicurezza delle funzioni (15 asserzioni)
-- ---------------------------------------------------------------------
select ok(
  (select p.prosecdef from pg_proc p where p.oid = 'public.pasti_si_oggi_asilo(date)'::regprocedure),
  'pasti_si_oggi_asilo: security definer');
select ok(
  (select p.prosecdef from pg_proc p where p.oid = 'public.bambini_senza_presenza_asilo(date)'::regprocedure),
  'bambini_senza_presenza_asilo: security definer');
select ok(
  (select p.prosecdef from pg_proc p where p.oid = 'public.bambini_incoerenti_asilo(date)'::regprocedure),
  'bambini_incoerenti_asilo: security definer');

select ok(
  (select coalesce(p.proconfig, '{}') @> array['search_path=""'] from pg_proc p
    where p.oid = 'public.pasti_si_oggi_asilo(date)'::regprocedure),
  'pasti_si_oggi_asilo: search_path fisso e vuoto');
select ok(
  (select coalesce(p.proconfig, '{}') @> array['search_path=""'] from pg_proc p
    where p.oid = 'public.bambini_senza_presenza_asilo(date)'::regprocedure),
  'bambini_senza_presenza_asilo: search_path fisso e vuoto');
select ok(
  (select coalesce(p.proconfig, '{}') @> array['search_path=""'] from pg_proc p
    where p.oid = 'public.bambini_incoerenti_asilo(date)'::regprocedure),
  'bambini_incoerenti_asilo: search_path fisso e vuoto');

select is(
  (select p.provolatile::text from pg_proc p where p.oid = 'public.pasti_si_oggi_asilo(date)'::regprocedure),
  's', 'pasti_si_oggi_asilo: stable');
select is(
  (select p.provolatile::text from pg_proc p where p.oid = 'public.bambini_senza_presenza_asilo(date)'::regprocedure),
  's', 'bambini_senza_presenza_asilo: stable');
select is(
  (select p.provolatile::text from pg_proc p where p.oid = 'public.bambini_incoerenti_asilo(date)'::regprocedure),
  's', 'bambini_incoerenti_asilo: stable');

select ok(
  not has_function_privilege('anon', 'public.pasti_si_oggi_asilo(date)', 'execute'),
  'pasti_si_oggi_asilo: anon non ha EXECUTE');
select ok(
  not has_function_privilege('anon', 'public.bambini_senza_presenza_asilo(date)', 'execute'),
  'bambini_senza_presenza_asilo: anon non ha EXECUTE');
select ok(
  not has_function_privilege('anon', 'public.bambini_incoerenti_asilo(date)', 'execute'),
  'bambini_incoerenti_asilo: anon non ha EXECUTE');

select ok(
  has_function_privilege('authenticated', 'public.pasti_si_oggi_asilo(date)', 'execute')
  and has_function_privilege('authenticated', 'public.bambini_senza_presenza_asilo(date)', 'execute')
  and has_function_privilege('authenticated', 'public.bambini_incoerenti_asilo(date)', 'execute'),
  'le tre RPC: authenticated ha EXECUTE');

-- Il controllo interno non è esposto: security definer, ma né anon né
-- authenticated possono chiamarlo direttamente.
select ok(
  (select p.prosecdef from pg_proc p where p.oid = 'public.assicura_accesso_pasti_asilo(date)'::regprocedure),
  'assicura_accesso_pasti_asilo: security definer');
select ok(
  not has_function_privilege('anon', 'public.assicura_accesso_pasti_asilo(date)', 'execute')
  and not has_function_privilege('authenticated', 'public.assicura_accesso_pasti_asilo(date)', 'execute'),
  'assicura_accesso_pasti_asilo: né anon né authenticated hanno EXECUTE');

-- ---------------------------------------------------------------------
-- Admin: qualunque data, risultati esatti sulla data fissa
-- ---------------------------------------------------------------------
-- Pasti "sì" su tutto l'asilo: B1, B2, B3, B6 (B5 è inattivo, B7 ha "no").
-- La data fissa non ha altri dati nel DB di test.
select is(pg_temp.conta_as('a0000000-0000-0000-0000-000000000001', date '2030-03-12'), 4,
  'admin: totale pasti sì dell''asilo, esclusi i bambini inattivi');
select is(pg_temp.senza_as('a0000000-0000-0000-0000-000000000001', date '2030-03-12'), array['04'],
  'admin: senza presenza = solo B4 (B5 inattivo escluso)');
select is(pg_temp.nome_b4_as('a0000000-0000-0000-0000-000000000001', date '2030-03-12'),
  'PgtapQuattro Fittizio', 'admin: la riga senza presenza riporta nome e cognome');
select is(pg_temp.incoerenti_as('a0000000-0000-0000-0000-000000000001', date '2030-03-12'),
  array['01|presente|true|false|si', '02|presente|false|false|si', '03|assente|false|false|si',
        '06|malattia|false|false|si', '07|assente|false|false|no'],
  'admin: righe grezze stato/pasto dei bambini attivi con presenza o pasto (B4 e B5 esclusi)');
select is(pg_temp.esito_as('a0000000-0000-0000-0000-000000000001',
    'select public.pasti_si_oggi_asilo(null)'), '22004',
  'admin: data nulla rifiutata');

-- ---------------------------------------------------------------------
-- Admin e maestra su oggi
-- ---------------------------------------------------------------------
select is(
  pg_temp.conta_as('a0000000-0000-0000-0000-000000000002', public.oggi_roma()),
  pg_temp.conta_as('a0000000-0000-0000-0000-000000000001', public.oggi_roma()),
  'maestra: il totale di oggi è quello dell''intero asilo (uguale a quello dell''admin)');
select cmp_ok(
  pg_temp.conta_as('a0000000-0000-0000-0000-000000000002', public.oggi_roma())
    - pg_temp.pasti_visibili_as('a0000000-0000-0000-0000-000000000002', public.oggi_roma()),
  '>=', 3,
  'maestra: il totale supera i pasti visibili via RLS di almeno i 3 pasti sì di S2 (sezione non sua)');
select cmp_ok(
  pg_temp.conta_as('a0000000-0000-0000-0000-000000000002', public.oggi_roma()), '>=', 4,
  'maestra: il totale comprende almeno i 4 pasti sì di fixture');
select is(pg_temp.senza_as('a0000000-0000-0000-0000-000000000002', public.oggi_roma()), array['04'],
  'maestra: vede il bambino senza presenza anche di una sezione non sua (B4 in S2)');
select is(pg_temp.nome_b4_as('a0000000-0000-0000-0000-000000000002', public.oggi_roma()),
  'PgtapQuattro Fittizio', 'maestra: nome e cognome del bambino di una sezione non sua');
select is(pg_temp.incoerenti_as('a0000000-0000-0000-0000-000000000002', public.oggi_roma()),
  array['01|presente|true|false|si', '02|presente|false|false|si', '03|assente|false|false|si',
        '06|malattia|false|false|si', '07|assente|false|false|no'],
  'maestra: righe grezze dell''intero asilo, anche di sezioni non sue');
select is(pg_temp.senza_as('a0000000-0000-0000-0000-000000000001', public.oggi_roma()), array['04'],
  'admin: senza presenza di oggi = solo B4');
select is(pg_temp.incoerenti_as('a0000000-0000-0000-0000-000000000001', public.oggi_roma()),
  array['01|presente|true|false|si', '02|presente|false|false|si', '03|assente|false|false|si',
        '06|malattia|false|false|si', '07|assente|false|false|no'],
  'admin: righe grezze di oggi');

-- ---------------------------------------------------------------------
-- Respinti: errore 42501, mai un insieme vuoto
-- ---------------------------------------------------------------------
-- Maestra: solo oggi. Una data passata o futura è rifiutata.
select is(pg_temp.esito_as('a0000000-0000-0000-0000-000000000002',
    'select public.pasti_si_oggi_asilo(date ''2030-03-12'')'), '42501',
  'maestra: pasti_si_oggi_asilo su una data diversa da oggi rifiutata');
select is(pg_temp.esito_as('a0000000-0000-0000-0000-000000000002',
    'select * from public.bambini_senza_presenza_asilo(date ''2030-03-12'')'), '42501',
  'maestra: bambini_senza_presenza_asilo su una data diversa da oggi rifiutata');
select is(pg_temp.esito_as('a0000000-0000-0000-0000-000000000002',
    'select * from public.bambini_incoerenti_asilo(date ''2030-03-12'')'), '42501',
  'maestra: bambini_incoerenti_asilo su una data diversa da oggi rifiutata');

-- Assistente: nessun accesso ai pasti, nemmeno oggi.
select is(pg_temp.esito_as('a0000000-0000-0000-0000-000000000003',
    'select public.pasti_si_oggi_asilo(public.oggi_roma())'), '42501',
  'assistente: pasti_si_oggi_asilo rifiutata');
select is(pg_temp.esito_as('a0000000-0000-0000-0000-000000000003',
    'select * from public.bambini_senza_presenza_asilo(public.oggi_roma())'), '42501',
  'assistente: bambini_senza_presenza_asilo rifiutata');
select is(pg_temp.esito_as('a0000000-0000-0000-0000-000000000003',
    'select * from public.bambini_incoerenti_asilo(public.oggi_roma())'), '42501',
  'assistente: bambini_incoerenti_asilo rifiutata');

-- Genitore (anche del bambino interessato).
select is(pg_temp.esito_as('a0000000-0000-0000-0000-000000000004',
    'select public.pasti_si_oggi_asilo(public.oggi_roma())'), '42501',
  'genitore: pasti_si_oggi_asilo rifiutata');
select is(pg_temp.esito_as('a0000000-0000-0000-0000-000000000004',
    'select * from public.bambini_senza_presenza_asilo(public.oggi_roma())'), '42501',
  'genitore: bambini_senza_presenza_asilo rifiutata');
select is(pg_temp.esito_as('a0000000-0000-0000-0000-000000000004',
    'select * from public.bambini_incoerenti_asilo(public.oggi_roma())'), '42501',
  'genitore: bambini_incoerenti_asilo rifiutata');

-- Utente autenticato senza profilo: ruolo_corrente() è null.
select is(pg_temp.esito_as('a0000000-0000-0000-0000-000000000005',
    'select public.pasti_si_oggi_asilo(public.oggi_roma())'), '42501',
  'senza profilo: pasti_si_oggi_asilo rifiutata');
select is(pg_temp.esito_as('a0000000-0000-0000-0000-000000000005',
    'select * from public.bambini_senza_presenza_asilo(public.oggi_roma())'), '42501',
  'senza profilo: bambini_senza_presenza_asilo rifiutata');
select is(pg_temp.esito_as('a0000000-0000-0000-0000-000000000005',
    'select * from public.bambini_incoerenti_asilo(public.oggi_roma())'), '42501',
  'senza profilo: bambini_incoerenti_asilo rifiutata');

-- Anonimo: nessun EXECUTE (permission denied for function).
select is(pg_temp.esito_as(null, 'select public.pasti_si_oggi_asilo(public.oggi_roma())'), '42501',
  'anonimo: pasti_si_oggi_asilo rifiutata');
select is(pg_temp.esito_as(null, 'select * from public.bambini_senza_presenza_asilo(public.oggi_roma())'), '42501',
  'anonimo: bambini_senza_presenza_asilo rifiutata');
select is(pg_temp.esito_as(null, 'select * from public.bambini_incoerenti_asilo(public.oggi_roma())'), '42501',
  'anonimo: bambini_incoerenti_asilo rifiutata');

-- Il controllo interno non è chiamabile direttamente da un utente.
select is(pg_temp.esito_as('a0000000-0000-0000-0000-000000000001',
    'select public.assicura_accesso_pasti_asilo(public.oggi_roma())'), '42501',
  'admin: il controllo interno non è chiamabile direttamente');
select is(pg_temp.esito_as(null, 'select public.assicura_accesso_pasti_asilo(public.oggi_roma())'), '42501',
  'anonimo: il controllo interno non è chiamabile direttamente');

select * from finish();

rollback;
