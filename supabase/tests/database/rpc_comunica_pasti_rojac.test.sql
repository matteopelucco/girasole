-- Girasole — test pgTAP sulla RPC comunica_pasti_rojac (issue #212,
-- sotto-issue "b" di #38; specs/16 - comunicazione-pasti-rojac.md,
-- specs/03 - utenti-e-ruoli.md; migration 0057).
--
-- Funzione sotto test (security definer, richiamata via RPC con la sessione
-- dell'utente):
--   comunica_pasti_rojac(date) -> (numero_comunicato, comunicato_nome)
-- Registra la riga di log in pasti_comunicati con totale e nome calcolati dal
-- database, e dopo la migration l'INSERT diretto è revocato ad authenticated.
--
-- Comportamento fissato:
--   * ammessi: admin (qualunque data) e maestra (solo oggi_roma());
--   * respinti con SQLSTATE 42501: assistente (non è un attore, specs/16),
--     genitore, utente senza profilo, anonimo, maestra su una data diversa da
--     oggi; nessuna riga di log viene scritta;
--   * il totale è dell'intero asilo (anche sezioni non assegnate alla
--     maestra), solo bambini attivi, calcolato dal database;
--   * comunicato_da è l'utente della sessione, il nome viene dal profilo (o
--     dall'email se il profilo non ha nome): il chiamante non può falsificarli;
--   * blocchi: presenza mancante (trigger 0033) e dati incoerenti (controllo
--     nella funzione) -> eccezione, nessuna riga; seconda comunicazione della
--     stessa data -> 23505;
--   * INSERT diretto in pasti_comunicati non più possibile per authenticated e
--     anon (privilegio revocato in 0057) né per service_role (revocato in 0058,
--     issue #217); service_role mantiene SELECT (lo leggono i cron).
--
-- Fixture (stesse righe su più date; il DB di test può contenere altri dati
-- "di oggi" e altri bambini attivi, quindi per oggi si ripulisce la giornata
-- dentro la transazione e si completano le presenze mancanti):
--   B1 (S1, maestra)  presente, pasto si
--   B2 (S2)           presente, pasto si
--   B3 (S2)           presente, pasto no
--   B4 (S2)           presente, nessun pasto
--   B5 (S2, INATTIVO) nessuna presenza, pasto si   -> non conta
--   B6 (S2)           presente, nessun pasto
--   B7 (S1)           assente, pasto no
--   -> totale atteso = 2 (B1, B2).
-- Date: DA 2030-03-12 (coerente, admin), DB 2030-03-13 (B4 senza presenza),
-- DC 2030-03-14 (B3 assente con pasto si: incoerente), oggi (coerente,
-- maestra).
--
-- Tutto dentro una transazione chiusa da `rollback`. Dati chiaramente
-- fittizi (email @example.test), nessun dato reale. Si esegue con
-- `supabase test db` (in CI: job `e2e`, dopo il reset del DB di test). Mai
-- sulla produzione.
--
-- Struttura (come rpc_pasti_rojac.test.sql): le funzioni pgTAP girano SEMPRE
-- col ruolo privilegiato di partenza; l'impersonazione di authenticated/anon
-- avviene solo dentro gli helper `pg_temp.*_as`, che poi ripristinano il
-- ruolo di partenza.

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

select plan(26);

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

-- Esegue una query come p_uid e restituisce 'ok' oppure il messaggio
-- dell'errore (per distinguere due eccezioni con lo stesso SQLSTATE).
create function pg_temp.messaggio_as(p_uid uuid, p_sql text) returns text
language plpgsql as $$
declare
  v_prev text := current_user;
  v_msg text := 'ok';
begin
  perform pg_temp.impersona(p_uid);
  begin
    execute p_sql;
  exception when others then
    v_msg := sqlerrm;
  end;
  perform set_config('role', v_prev, true);
  return v_msg;
end;
$$;

-- Chiama comunica_pasti_rojac(p_data) come p_uid e restituisce
-- 'totale|nome'. Solo per i casi che devono riuscire.
create function pg_temp.comunica_as(p_uid uuid, p_data date) returns text
language plpgsql as $$
declare
  v_prev text := current_user;
  v_r text;
begin
  perform pg_temp.impersona(p_uid);
  select format('%s|%s', c.numero_comunicato, c.comunicato_nome) into v_r
    from public.comunica_pasti_rojac(p_data) c;
  perform set_config('role', v_prev, true);
  return v_r;
end;
$$;

-- ---------------------------------------------------------------------
-- Fixture (costruite col ruolo di partenza, con bypass RLS)
-- ---------------------------------------------------------------------
--   admin       a0..01 (profilo "Pgtap Admin")
--   maestra     a0..02 -> sezione S1 (profilo senza nome: ricade sull'email)
--   assistente  a0..03 -> sezione S1
--   genitore    a0..04 -> figlio B1
--   senza profilo a0..05 (profilo eliminato subito dopo la creazione)
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-0000-0000-000000000001', 'pgtap.admin@example.test', '{"ruolo":"admin"}'),
  ('a0000000-0000-0000-0000-000000000002', 'pgtap.maestra@example.test', '{"ruolo":"maestra"}'),
  ('a0000000-0000-0000-0000-000000000003', 'pgtap.assistente@example.test', '{"ruolo":"assistente"}'),
  ('a0000000-0000-0000-0000-000000000004', 'pgtap.genitore@example.test', '{"ruolo":"genitore"}'),
  ('a0000000-0000-0000-0000-000000000005', 'pgtap.senzaprofilo@example.test', '{"ruolo":"genitore"}');

delete from public.profili where id = 'a0000000-0000-0000-0000-000000000005';

update public.profili set nome = 'Pgtap', cognome = 'Admin'
 where id = 'a0000000-0000-0000-0000-000000000001';
update public.profili set nome = '', cognome = ''
 where id = 'a0000000-0000-0000-0000-000000000002';

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

-- I trigger di chiusura scolastica (0022) rifiutano la scrittura nei giorni
-- chiusi (sabato, domenica, ...): l'esito dipenderebbe dal giorno in cui gira
-- la CI. Si disattivano per questa transazione (il rollback li ripristina).
alter table public.presenze disable trigger presenze_blocca_se_chiuso;
alter table public.pasti disable trigger pasti_blocca_se_chiuso;

-- Giornata di oggi pulita (solo in questa transazione): eventuali comunicazioni,
-- pasti e presenze rimasti nel DB di test altererebbero totale e blocchi.
delete from public.pasti_comunicati where data in (public.oggi_roma(), date '2030-03-12', date '2030-03-13', date '2030-03-14');
delete from public.pasti where data = public.oggi_roma();
delete from public.presenze where data = public.oggi_roma();

-- Prima i pasti, poi le presenze: il trigger 0012 rifiuta un pasto su un
-- bambino già assente. DC differisce: B3 assente con pasto si (incoerente).
-- DB differisce: B4 senza presenza.
do $$
declare
  d date;
begin
  foreach d in array array[date '2030-03-12', date '2030-03-13', public.oggi_roma()] loop
    insert into public.pasti (bambino_id, data, mangiato) values
      ('c0000000-0000-0000-0000-000000000001', d, 'si'),
      ('c0000000-0000-0000-0000-000000000002', d, 'si'),
      ('c0000000-0000-0000-0000-000000000003', d, 'no'),
      ('c0000000-0000-0000-0000-000000000005', d, 'si'),
      ('c0000000-0000-0000-0000-000000000007', d, 'no');
    insert into public.presenze (bambino_id, data, stato) values
      ('c0000000-0000-0000-0000-000000000001', d, 'presente'),
      ('c0000000-0000-0000-0000-000000000002', d, 'presente'),
      ('c0000000-0000-0000-0000-000000000003', d, 'presente'),
      ('c0000000-0000-0000-0000-000000000006', d, 'presente'),
      ('c0000000-0000-0000-0000-000000000007', d, 'assente');
    if d <> date '2030-03-13' then
      insert into public.presenze (bambino_id, data, stato)
        values ('c0000000-0000-0000-0000-000000000004', d, 'presente');
    end if;
  end loop;

  insert into public.pasti (bambino_id, data, mangiato) values
    ('c0000000-0000-0000-0000-000000000001', date '2030-03-14', 'si'),
    ('c0000000-0000-0000-0000-000000000003', date '2030-03-14', 'si');
  insert into public.presenze (bambino_id, data, stato) values
    ('c0000000-0000-0000-0000-000000000001', date '2030-03-14', 'presente'),
    ('c0000000-0000-0000-0000-000000000003', date '2030-03-14', 'assente'),
    ('c0000000-0000-0000-0000-000000000004', date '2030-03-14', 'presente');

  -- Altri bambini attivi eventualmente presenti nel DB di test: presenza
  -- 'presente' sulle date che devono poter essere comunicate, così il trigger
  -- 0033 non li conta come mancanti. DB resta volutamente incompleta.
  foreach d in array array[date '2030-03-12', date '2030-03-14', public.oggi_roma()] loop
    insert into public.presenze (bambino_id, data, stato)
      select b.id, d, 'presente'
        from public.bambini b
       where b.attiva
         and not exists (select 1 from public.presenze p where p.bambino_id = b.id and p.data = d);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Proprietà di sicurezza (10 asserzioni)
-- ---------------------------------------------------------------------
select ok(
  (select p.prosecdef from pg_proc p where p.oid = 'public.comunica_pasti_rojac(date)'::regprocedure),
  'comunica_pasti_rojac: security definer');
select ok(
  (select coalesce(p.proconfig, '{}') @> array['search_path=""'] from pg_proc p
    where p.oid = 'public.comunica_pasti_rojac(date)'::regprocedure),
  'comunica_pasti_rojac: search_path fisso e vuoto');
select is(
  (select p.provolatile::text from pg_proc p where p.oid = 'public.comunica_pasti_rojac(date)'::regprocedure),
  'v', 'comunica_pasti_rojac: volatile (scrive)');
select ok(
  not has_function_privilege('anon', 'public.comunica_pasti_rojac(date)', 'execute'),
  'comunica_pasti_rojac: anon non ha EXECUTE');
select ok(
  has_function_privilege('authenticated', 'public.comunica_pasti_rojac(date)', 'execute'),
  'comunica_pasti_rojac: authenticated ha EXECUTE');
select ok(
  not has_table_privilege('authenticated', 'public.pasti_comunicati', 'insert'),
  'pasti_comunicati: authenticated non ha più INSERT diretto');
select ok(
  not has_table_privilege('anon', 'public.pasti_comunicati', 'insert'),
  'pasti_comunicati: anon non ha INSERT');
select ok(
  has_table_privilege('authenticated', 'public.pasti_comunicati', 'select'),
  'pasti_comunicati: authenticated mantiene SELECT (la schermata legge il log)');
-- Migration 0058 (issue #217): la RPC è `security definer`, non dipende dal
-- privilegio di service_role; il log non è più scrivibile con la sua key.
select ok(
  not has_table_privilege('service_role', 'public.pasti_comunicati', 'insert'),
  'pasti_comunicati: service_role non ha più INSERT diretto (0058)');
select ok(
  has_table_privilege('service_role', 'public.pasti_comunicati', 'select'),
  'pasti_comunicati: service_role mantiene SELECT (i cron leggono il log)');

-- ---------------------------------------------------------------------
-- Respinti: errore, nessuna riga di log
-- ---------------------------------------------------------------------
select is(pg_temp.esito_as('a0000000-0000-0000-0000-000000000003',
    'select * from public.comunica_pasti_rojac(public.oggi_roma())'), '42501',
  'assistente: comunica_pasti_rojac rifiutata');
select is(pg_temp.esito_as('a0000000-0000-0000-0000-000000000004',
    'select * from public.comunica_pasti_rojac(public.oggi_roma())'), '42501',
  'genitore: comunica_pasti_rojac rifiutata');
select is(pg_temp.esito_as('a0000000-0000-0000-0000-000000000005',
    'select * from public.comunica_pasti_rojac(public.oggi_roma())'), '42501',
  'senza profilo: comunica_pasti_rojac rifiutata');
select is(pg_temp.esito_as(null, 'select * from public.comunica_pasti_rojac(public.oggi_roma())'), '42501',
  'anonimo: comunica_pasti_rojac rifiutata');
select is(pg_temp.esito_as('a0000000-0000-0000-0000-000000000002',
    'select * from public.comunica_pasti_rojac(date ''2030-03-12'')'), '42501',
  'maestra: comunicare una data diversa da oggi rifiutata');
select is(pg_temp.esito_as('a0000000-0000-0000-0000-000000000001',
    'select * from public.comunica_pasti_rojac(null)'), '22004',
  'admin: data nulla rifiutata');

-- INSERT diretto: il privilegio è revocato, quindi non si può falsificare
-- il log nemmeno con una chiamata diretta alla REST API.
select is(pg_temp.esito_as('a0000000-0000-0000-0000-000000000001',
    $q$insert into public.pasti_comunicati (data, numero_pasti, comunicato_da, comunicato_da_nome)
       values (date '2030-03-12', 999, 'a0000000-0000-0000-0000-000000000001', 'Falso')$q$), '42501',
  'admin: INSERT diretto in pasti_comunicati rifiutato');
select is(pg_temp.esito_as('a0000000-0000-0000-0000-000000000002',
    $q$insert into public.pasti_comunicati (data, numero_pasti, comunicato_da, comunicato_da_nome)
       values (public.oggi_roma(), 999, 'a0000000-0000-0000-0000-000000000001', 'Falso')$q$), '42501',
  'maestra: INSERT diretto in pasti_comunicati rifiutato');

-- ---------------------------------------------------------------------
-- Blocchi: presenza mancante e dati incoerenti
-- ---------------------------------------------------------------------
select is(pg_temp.messaggio_as('a0000000-0000-0000-0000-000000000001',
    'select * from public.comunica_pasti_rojac(date ''2030-03-13'')'),
  'Impossibile comunicare i pasti: ci sono bambini con la presenza non ancora segnata per questa data.',
  'admin: presenza mancante (B4) blocca la comunicazione (trigger 0033)');
select is(pg_temp.messaggio_as('a0000000-0000-0000-0000-000000000001',
    'select * from public.comunica_pasti_rojac(date ''2030-03-14'')'),
  'Impossibile comunicare i pasti: ci sono bambini con dati incoerenti per questa data.',
  'admin: dati incoerenti (B3 assente con pasto si) bloccano la comunicazione');

select is(
  (select count(*)::integer from public.pasti_comunicati
    where data in (public.oggi_roma(), date '2030-03-12', date '2030-03-13', date '2030-03-14')),
  0, 'nessun tentativo respinto ha scritto una riga di log');

-- ---------------------------------------------------------------------
-- Ammessi: admin e maestra
-- ---------------------------------------------------------------------
-- Totale = B1 + B2 (B5 inattivo escluso, B3 e B7 hanno "no"): dal database.
select is(pg_temp.comunica_as('a0000000-0000-0000-0000-000000000001', date '2030-03-12'),
  '2|Pgtap Admin',
  'admin: comunica una data qualunque; totale dell''asilo e nome dal profilo');
select is(
  (select format('%s|%s|%s', numero_pasti, comunicato_da, comunicato_da_nome)
     from public.pasti_comunicati where data = date '2030-03-12'),
  '2|a0000000-0000-0000-0000-000000000001|Pgtap Admin',
  'admin: la riga di log ha totale, utente e nome decisi dal database');
select is(pg_temp.esito_as('a0000000-0000-0000-0000-000000000001',
    'select * from public.comunica_pasti_rojac(date ''2030-03-12'')'), '23505',
  'admin: seconda comunicazione della stessa data rifiutata (unicità)');

-- La maestra (sezione S1) comunica il totale dell'intero asilo, comprese le
-- sezioni che non vede (B2 è in S2); il profilo senza nome ricade sull'email.
select is(pg_temp.comunica_as('a0000000-0000-0000-0000-000000000002', public.oggi_roma()),
  '2|pgtap.maestra@example.test',
  'maestra: comunica oggi; totale dell''intero asilo, nome dall''email se il profilo è vuoto');
select is(
  (select comunicato_da::text from public.pasti_comunicati where data = public.oggi_roma()),
  'a0000000-0000-0000-0000-000000000002',
  'maestra: comunicato_da è l''utente della sessione');

select * from finish();

rollback;
