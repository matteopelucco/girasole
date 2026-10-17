-- Girasole — test pgTAP su eventi e indirizzo del Google Calendar,
-- public.impostazioni_calendario, public.calendario_eventi e la funzione
-- public.sostituisci_eventi_calendario (specs/64 - calendario-eventi.md).
--
-- Comportamento fissato (migration 0065):
--   * impostazioni_calendario (riga singola con l'indirizzo SEGRETO del feed):
--     RLS attiva; solo l'admin legge (SELECT) e modifica (UPDATE di ical_url e
--     updated_at); nessun INSERT né DELETE per i ruoli API; maestra, assistente,
--     genitore e anonimo non leggono né modificano nulla; service_role (il cron)
--     ha solo SELECT.
--   * calendario_eventi: RLS attiva; leggono admin, maestra e assistente (non il
--     genitore, non anon); nessun utente scrive; service_role non ha privilegi
--     diretti sulla tabella.
--   * sostituisci_eventi_calendario(jsonb): eseguibile solo da service_role;
--     inserisce/aggiorna/rimuove in una transazione, idempotente, atomica.
--
-- Tutto dentro una transazione chiusa da `rollback`. Dati fittizi (email
-- @example.test, indirizzi example.test). Si esegue con `supabase test db` (in
-- CI: job `e2e`, dopo il reset del DB di test). Mai sulla produzione. Stessa
-- struttura e stessi helper di cron_esecuzioni.test.sql.

begin;

-- No-op se pgTAP è già installato (è il caso del progetto di test);
-- altrimenti viene creato e poi annullato dal rollback finale.
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

select no_plan();

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

-- Righe visibili a p_uid in una tabella (un "permission denied" conta come
-- nessuna riga).
create function pg_temp.righe_as(p_uid uuid, p_tabella text) returns int
language plpgsql as $$
declare
  v_prev text := current_user;
  v_n int;
begin
  perform pg_temp.impersona(p_uid);
  begin
    execute format('select count(*)::int from public.%I', p_tabella) into v_n;
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

-- Partenza pulita: eventuali eventi del DB di test spariscono con il rollback.
delete from public.calendario_eventi;

-- =========================================================================
-- impostazioni_calendario: l'indirizzo segreto
-- =========================================================================
select ok(
  (select relrowsecurity from pg_class where oid = 'public.impostazioni_calendario'::regclass),
  'impostazioni_calendario: RLS attiva'
);
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'impostazioni_calendario'),
  2,
  'impostazioni_calendario: due sole policy (select e update, admin)'
);
select is((select count(*)::int from public.impostazioni_calendario), 1, 'impostazioni_calendario: la riga singola esiste');

select ok(not has_table_privilege('anon', 'public.impostazioni_calendario', 'SELECT'), 'anon: nessun SELECT sull''indirizzo');
select ok(not has_table_privilege('anon', 'public.impostazioni_calendario', 'UPDATE'), 'anon: nessun UPDATE sull''indirizzo');
select ok(has_table_privilege('authenticated', 'public.impostazioni_calendario', 'SELECT'), 'authenticated: ha SELECT (policy admin)');
select ok(has_column_privilege('authenticated', 'public.impostazioni_calendario', 'ical_url', 'UPDATE'), 'authenticated: UPDATE su ical_url');
select ok(has_column_privilege('authenticated', 'public.impostazioni_calendario', 'updated_at', 'UPDATE'), 'authenticated: UPDATE su updated_at');
select ok(not has_column_privilege('authenticated', 'public.impostazioni_calendario', 'id', 'UPDATE'), 'authenticated: nessun UPDATE su id');
select ok(not has_table_privilege('authenticated', 'public.impostazioni_calendario', 'INSERT'), 'authenticated: nessun INSERT');
select ok(not has_table_privilege('authenticated', 'public.impostazioni_calendario', 'DELETE'), 'authenticated: nessun DELETE');
select ok(has_table_privilege('service_role', 'public.impostazioni_calendario', 'SELECT'), 'service_role: ha SELECT (il cron legge l''indirizzo)');
select ok(not has_table_privilege('service_role', 'public.impostazioni_calendario', 'UPDATE'), 'service_role: nessun UPDATE');
select ok(not has_table_privilege('service_role', 'public.impostazioni_calendario', 'INSERT'), 'service_role: nessun INSERT');
select ok(not has_table_privilege('service_role', 'public.impostazioni_calendario', 'DELETE'), 'service_role: nessun DELETE');

-- Solo l'admin legge l'indirizzo.
select is(pg_temp.righe_as('a0000000-0000-0000-0000-000000000001', 'impostazioni_calendario'), 1, 'admin: legge l''impostazione');
select is(pg_temp.righe_as('a0000000-0000-0000-0000-000000000002', 'impostazioni_calendario'), 0, 'maestra: non legge l''indirizzo');
select is(pg_temp.righe_as('a0000000-0000-0000-0000-000000000003', 'impostazioni_calendario'), 0, 'assistente: non legge l''indirizzo');
select is(pg_temp.righe_as('a0000000-0000-0000-0000-000000000004', 'impostazioni_calendario'), 0, 'genitore: non legge l''indirizzo');
select is(pg_temp.righe_as(null, 'impostazioni_calendario'), 0, 'anonimo: non legge l''indirizzo');

-- Solo l'admin lo modifica.
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
    $q$update public.impostazioni_calendario set ical_url = 'https://prova.example.test/uno.ics', updated_at = now() where id = true$q$),
  'ok',
  'admin: salva l''indirizzo'
);
select is(
  (select ical_url from public.impostazioni_calendario),
  'https://prova.example.test/uno.ics',
  'l''indirizzo dell''admin è salvato'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000002',
    $q$update public.impostazioni_calendario set ical_url = 'https://prova.example.test/maestra.ics' where id = true$q$),
  'ok',
  'maestra: l''UPDATE non dà errore ma la RLS non fa toccare nessuna riga'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000003',
    $q$update public.impostazioni_calendario set ical_url = 'https://prova.example.test/assistente.ics' where id = true$q$),
  'ok',
  'assistente: l''UPDATE non dà errore ma la RLS non fa toccare nessuna riga'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000004',
    $q$update public.impostazioni_calendario set ical_url = 'https://prova.example.test/genitore.ics' where id = true$q$),
  'ok',
  'genitore: l''UPDATE non dà errore ma la RLS non fa toccare nessuna riga'
);
select is(
  pg_temp.write_as(null, $q$update public.impostazioni_calendario set ical_url = 'https://prova.example.test/anon.ics' where id = true$q$),
  '42501',
  'anonimo: UPDATE negato'
);
select is(
  (select ical_url from public.impostazioni_calendario),
  'https://prova.example.test/uno.ics',
  'l''indirizzo è rimasto quello dell''admin'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001', $q$insert into public.impostazioni_calendario (id) values (false)$q$),
  '42501',
  'admin: INSERT negato'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001', $q$delete from public.impostazioni_calendario$q$),
  '42501',
  'admin: DELETE negato'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001', $q$update public.impostazioni_calendario set ical_url = null where id = true$q$),
  'ok',
  'admin: può svuotare l''indirizzo (sincronizzazione disattivata)'
);
select throws_ok(
  $q$update public.impostazioni_calendario set ical_url = repeat('x', 2001) where id = true$q$,
  '23514',
  null,
  'un indirizzo oltre 2000 caratteri è rifiutato'
);

-- =========================================================================
-- calendario_eventi: lettura dello staff, nessuna scrittura
-- =========================================================================
select ok(
  (select relrowsecurity from pg_class where oid = 'public.calendario_eventi'::regclass),
  'calendario_eventi: RLS attiva'
);
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'calendario_eventi'),
  1,
  'calendario_eventi: una sola policy (select staff)'
);
select ok(not has_table_privilege('anon', 'public.calendario_eventi', 'SELECT'), 'anon: nessun SELECT sugli eventi');
select ok(has_table_privilege('authenticated', 'public.calendario_eventi', 'SELECT'), 'authenticated: ha SELECT (policy staff)');
select ok(not has_table_privilege('authenticated', 'public.calendario_eventi', 'INSERT'), 'authenticated: nessun INSERT sugli eventi');
select ok(not has_table_privilege('authenticated', 'public.calendario_eventi', 'UPDATE'), 'authenticated: nessun UPDATE sugli eventi');
select ok(not has_table_privilege('authenticated', 'public.calendario_eventi', 'DELETE'), 'authenticated: nessun DELETE sugli eventi');
select ok(not has_table_privilege('service_role', 'public.calendario_eventi', 'INSERT'), 'service_role: nessun INSERT diretto (scrive con la funzione)');
select ok(not has_table_privilege('service_role', 'public.calendario_eventi', 'DELETE'), 'service_role: nessun DELETE diretto');

-- =========================================================================
-- sostituisci_eventi_calendario: privilegi
-- =========================================================================
select ok(has_function_privilege('service_role', 'public.sostituisci_eventi_calendario(jsonb)', 'EXECUTE'), 'service_role: può eseguire la sostituzione');
select ok(not has_function_privilege('authenticated', 'public.sostituisci_eventi_calendario(jsonb)', 'EXECUTE'), 'authenticated: non può eseguire la sostituzione');
select ok(not has_function_privilege('anon', 'public.sostituisci_eventi_calendario(jsonb)', 'EXECUTE'), 'anon: non può eseguire la sostituzione');
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001', $q$select public.sostituisci_eventi_calendario('[]'::jsonb)$q$),
  '42501',
  'admin con la propria sessione: sostituzione negata'
);

-- =========================================================================
-- sostituisci_eventi_calendario: comportamento
-- =========================================================================
select is(
  public.sostituisci_eventi_calendario($j$[
    {"id_esterno":"prova-a","titolo":"Evento A","descrizione":"Descrizione A","luogo":"Salone","inizio":"2031-03-01T09:00:00Z","fine":"2031-03-01T10:00:00Z","tutto_il_giorno":false},
    {"id_esterno":"prova-b","titolo":"Evento B","descrizione":null,"luogo":null,"inizio":"2031-03-02T23:00:00Z","fine":"2031-03-03T23:00:00Z","tutto_il_giorno":true}
  ]$j$::jsonb),
  '{"inseriti":2,"aggiornati":0,"rimossi":0,"totale":2}'::jsonb,
  'la prima sostituzione inserisce i due eventi'
);
select is(
  public.sostituisci_eventi_calendario($j$[
    {"id_esterno":"prova-a","titolo":"Evento A","descrizione":"Descrizione A","luogo":"Salone","inizio":"2031-03-01T09:00:00Z","fine":"2031-03-01T10:00:00Z","tutto_il_giorno":false},
    {"id_esterno":"prova-b","titolo":"Evento B","descrizione":null,"luogo":null,"inizio":"2031-03-02T23:00:00Z","fine":"2031-03-03T23:00:00Z","tutto_il_giorno":true}
  ]$j$::jsonb),
  '{"inseriti":0,"aggiornati":0,"rimossi":0,"totale":2}'::jsonb,
  'rilanciarla con lo stesso feed non cambia nulla (idempotente)'
);
create temp table id_evento_a as select id from public.calendario_eventi where id_esterno = 'prova-a';

select is(
  public.sostituisci_eventi_calendario($j$[
    {"id_esterno":"prova-a","titolo":"Evento A spostato","descrizione":"Descrizione A","luogo":"Salone","inizio":"2031-03-01T14:00:00Z","fine":"2031-03-01T15:00:00Z","tutto_il_giorno":false}
  ]$j$::jsonb),
  '{"inseriti":0,"aggiornati":1,"rimossi":1,"totale":1}'::jsonb,
  'un evento spostato si aggiorna e uno sparito dal feed si rimuove'
);
select is(
  (select id from public.calendario_eventi where id_esterno = 'prova-a'),
  (select id from id_evento_a),
  'l''evento spostato mantiene la stessa riga (id invariato)'
);
select is(
  (select titolo from public.calendario_eventi where id_esterno = 'prova-a'),
  'Evento A spostato',
  'il titolo aggiornato è salvato'
);
select is(
  (select count(*)::int from public.calendario_eventi where id_esterno = 'prova-b'),
  0,
  'l''evento tolto dal feed non c''è più'
);

-- Righe doppie nello stesso feed: una sola riga, nessun errore.
select is(
  public.sostituisci_eventi_calendario($j$[
    {"id_esterno":"prova-a","titolo":"Evento A spostato","descrizione":"Descrizione A","luogo":"Salone","inizio":"2031-03-01T14:00:00Z","fine":"2031-03-01T15:00:00Z","tutto_il_giorno":false},
    {"id_esterno":"prova-a","titolo":"Evento A spostato","descrizione":"Descrizione A","luogo":"Salone","inizio":"2031-03-01T14:00:00Z","fine":"2031-03-01T15:00:00Z","tutto_il_giorno":false}
  ]$j$::jsonb),
  '{"inseriti":0,"aggiornati":0,"rimossi":0,"totale":1}'::jsonb,
  'lo stesso evento ripetuto due volte nel feed vale una riga sola'
);

-- Atomicità: un evento non valido annulla tutto, restano gli eventi di prima.
select throws_ok(
  $q$select public.sostituisci_eventi_calendario('[
    {"id_esterno":"prova-nuovo","titolo":"Nuovo","inizio":"2031-04-01T09:00:00Z","fine":"2031-04-01T10:00:00Z","tutto_il_giorno":false},
    {"id_esterno":"prova-rotto","titolo":"Rotto","inizio":"2031-04-02T10:00:00Z","fine":"2031-04-02T09:00:00Z","tutto_il_giorno":false}
  ]'::jsonb)$q$,
  '23514',
  null,
  'un evento con la fine prima dell''inizio fa fallire l''intera sostituzione'
);
select is(
  (select array_agg(id_esterno order by id_esterno) from public.calendario_eventi),
  array['prova-a'],
  'dopo l''errore restano gli eventi di prima e non c''è l''evento nuovo'
);
select throws_ok(
  $q$select public.sostituisci_eventi_calendario('{"non":"un elenco"}'::jsonb)$q$,
  'P0001',
  'Elenco eventi non valido.',
  'un argomento che non è un elenco è rifiutato'
);

-- Chi legge gli eventi.
select is(pg_temp.righe_as('a0000000-0000-0000-0000-000000000001', 'calendario_eventi'), 1, 'admin: legge gli eventi');
select is(pg_temp.righe_as('a0000000-0000-0000-0000-000000000002', 'calendario_eventi'), 1, 'maestra: legge gli eventi');
select is(pg_temp.righe_as('a0000000-0000-0000-0000-000000000003', 'calendario_eventi'), 1, 'assistente: legge gli eventi');
select is(pg_temp.righe_as('a0000000-0000-0000-0000-000000000004', 'calendario_eventi'), 0, 'genitore: non legge gli eventi');
select is(pg_temp.righe_as(null, 'calendario_eventi'), 0, 'anonimo: non legge gli eventi');

-- Nessun utente scrive gli eventi, nemmeno l'admin.
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
    $q$insert into public.calendario_eventi (id_esterno, titolo, inizio, fine) values ('x', 'X', now(), now())$q$),
  '42501',
  'admin: INSERT diretto negato'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001', $q$update public.calendario_eventi set titolo = 'Y'$q$),
  '42501',
  'admin: UPDATE diretto negato'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001', $q$delete from public.calendario_eventi$q$),
  '42501',
  'admin: DELETE diretto negato'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000002', $q$delete from public.calendario_eventi$q$),
  '42501',
  'maestra: DELETE diretto negato'
);
select is(pg_temp.righe_as('a0000000-0000-0000-0000-000000000001', 'calendario_eventi'), 1, 'gli eventi sono ancora lì, invariati');

select * from finish();

rollback;
