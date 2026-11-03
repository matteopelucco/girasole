-- Girasole — test pgTAP sulla tabella a riga unica public.prezzi_predefiniti
-- (issue #396; specs/62 - parametri-di-funzionamento.md, PRZ-01, PRZ-10).
--
-- Comportamento da implementare (migration della issue #396):
--   * prezzi_predefiniti: tabella a riga unica (id boolean primary key default
--     true check (id), come impostazioni_calendario, 0065) con otto colonne
--     numeric(6,2) NOT NULL, ciascuna tra 0 e 9999.99 (check):
--     retta_materna, retta_primavera, buono_pasto, marca_da_bollo,
--     abbonamento_pre_asilo, abbonamento_post_asilo, gettone_pre_asilo,
--     gettone_post_asilo; piu' updated_at timestamptz NOT NULL (serve al
--     controllo di concorrenza, PRZ-09). La migration inserisce la riga gia'
--     compilata: 160, 200, 6, 2, 70, 70, 7, 7.
--   * RLS attiva; due sole policy (select e update, solo admin).
--   * GRANT: authenticated ha SELECT e UPDATE sulle otto colonne e su
--     updated_at (non su id); nessun INSERT ne' DELETE; anon nessun privilegio;
--     service_role solo SELECT (migration 0068, il cron dell'allarme prezzi).
--   * Maestra, assistente, genitore e anonimo non leggono ne' modificano nulla.
--
-- Tutto dentro una transazione chiusa da `rollback`. Dati fittizi. Si esegue
-- con `supabase test db` (in CI dopo il reset del DB di test: i valori
-- iniziali attesi sono quelli della migration). Mai sulla produzione. Stessa
-- struttura e stessi helper di calendario_eventi.test.sql.

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

-- =========================================================================
-- Struttura, riga unica e valori iniziali (PRZ-01)
-- =========================================================================
select ok(
  (select relrowsecurity from pg_class where oid = 'public.prezzi_predefiniti'::regclass),
  'prezzi_predefiniti: RLS attiva'
);
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'prezzi_predefiniti'),
  2,
  'prezzi_predefiniti: due sole policy (select e update, admin)'
);
select is((select count(*)::int from public.prezzi_predefiniti), 1, 'prezzi_predefiniti: una sola riga, creata dalla migration');

select is(
  (select to_jsonb(p) - 'id' - 'updated_at' from public.prezzi_predefiniti p),
  '{"retta_materna":160.00,"retta_primavera":200.00,"buono_pasto":6.00,"marca_da_bollo":2.00,"abbonamento_pre_asilo":70.00,"abbonamento_post_asilo":70.00,"gettone_pre_asilo":7.00,"gettone_post_asilo":7.00}'::jsonb,
  'valori iniziali: 160, 200, 6, 2, 70, 70, 7, 7 (tutti valorizzati, nessun prezzo non impostato)'
);
select is(
  (select count(*)::int from information_schema.columns
    where table_schema = 'public' and table_name = 'prezzi_predefiniti'
      and column_name in ('retta_materna','retta_primavera','buono_pasto','marca_da_bollo',
                          'abbonamento_pre_asilo','abbonamento_post_asilo',
                          'gettone_pre_asilo','gettone_post_asilo')
      and is_nullable = 'NO' and data_type = 'numeric'),
  8,
  'gli otto prezzi sono numeric NOT NULL'
);
select ok(
  (select is_nullable = 'NO' from information_schema.columns
    where table_schema = 'public' and table_name = 'prezzi_predefiniti' and column_name = 'updated_at'),
  'updated_at è NOT NULL (controllo di concorrenza)'
);
select throws_ok(
  $q$insert into public.prezzi_predefiniti (id) values (true)$q$,
  '23505',
  null,
  'una seconda riga con id = true è rifiutata (chiave primaria)'
);
select throws_ok(
  $q$insert into public.prezzi_predefiniti (id) values (false)$q$,
  '23514',
  null,
  'id = false è rifiutato (check): la riga è una sola'
);

-- Limiti di ciascun prezzo: 0 e 9999,99 ammessi, negativo e 10000 rifiutati.
select lives_ok(
  $q$update public.prezzi_predefiniti set retta_materna = 0, retta_primavera = 9999.99 where id = true$q$,
  '0 e 9999,99 sono valori ammessi'
);
select is(
  (select retta_primavera from public.prezzi_predefiniti), 9999.99::numeric,
  '9999,99 è salvato al centesimo'
);
select throws_ok($q$update public.prezzi_predefiniti set retta_materna = -0.01 where id = true$q$, '23514', null, 'retta_materna negativa rifiutata');
select throws_ok($q$update public.prezzi_predefiniti set retta_primavera = 10000 where id = true$q$, '22003', null, 'retta_primavera 10000 rifiutata (fuori scala)');
select throws_ok($q$update public.prezzi_predefiniti set buono_pasto = -1 where id = true$q$, '23514', null, 'buono_pasto negativo rifiutato');
select throws_ok($q$update public.prezzi_predefiniti set marca_da_bollo = -1 where id = true$q$, '23514', null, 'marca_da_bollo negativa rifiutata');
select throws_ok($q$update public.prezzi_predefiniti set abbonamento_pre_asilo = -1 where id = true$q$, '23514', null, 'abbonamento_pre_asilo negativo rifiutato');
select throws_ok($q$update public.prezzi_predefiniti set abbonamento_post_asilo = -1 where id = true$q$, '23514', null, 'abbonamento_post_asilo negativo rifiutato');
select throws_ok($q$update public.prezzi_predefiniti set gettone_pre_asilo = -1 where id = true$q$, '23514', null, 'gettone_pre_asilo negativo rifiutato');
select throws_ok($q$update public.prezzi_predefiniti set gettone_post_asilo = -1 where id = true$q$, '23514', null, 'gettone_post_asilo negativo rifiutato');
select throws_ok($q$update public.prezzi_predefiniti set buono_pasto = null where id = true$q$, '23502', null, 'un prezzo nullo è rifiutato (NOT NULL)');

-- Riparto da valori noti per i controlli sui ruoli (come postgres).
update public.prezzi_predefiniti set
  retta_materna = 160, retta_primavera = 200, buono_pasto = 6, marca_da_bollo = 2,
  abbonamento_pre_asilo = 70, abbonamento_post_asilo = 70,
  gettone_pre_asilo = 7, gettone_post_asilo = 7
where id = true;

-- =========================================================================
-- Privilegi (PRZ-10)
-- =========================================================================
select ok(not has_table_privilege('anon', 'public.prezzi_predefiniti', 'SELECT'), 'anon: nessun SELECT');
select ok(not has_table_privilege('anon', 'public.prezzi_predefiniti', 'UPDATE'), 'anon: nessun UPDATE');
select ok(not has_table_privilege('anon', 'public.prezzi_predefiniti', 'INSERT'), 'anon: nessun INSERT');
select ok(not has_table_privilege('anon', 'public.prezzi_predefiniti', 'DELETE'), 'anon: nessun DELETE');
select ok(has_table_privilege('authenticated', 'public.prezzi_predefiniti', 'SELECT'), 'authenticated: ha SELECT (policy admin)');
select ok(has_column_privilege('authenticated', 'public.prezzi_predefiniti', 'retta_materna', 'UPDATE'), 'authenticated: UPDATE su retta_materna');
select ok(has_column_privilege('authenticated', 'public.prezzi_predefiniti', 'gettone_post_asilo', 'UPDATE'), 'authenticated: UPDATE su gettone_post_asilo');
select ok(has_column_privilege('authenticated', 'public.prezzi_predefiniti', 'updated_at', 'UPDATE'), 'authenticated: UPDATE su updated_at');
select ok(not has_column_privilege('authenticated', 'public.prezzi_predefiniti', 'id', 'UPDATE'), 'authenticated: nessun UPDATE su id');
select ok(not has_table_privilege('authenticated', 'public.prezzi_predefiniti', 'INSERT'), 'authenticated: nessun INSERT');
select ok(not has_table_privilege('authenticated', 'public.prezzi_predefiniti', 'DELETE'), 'authenticated: nessun DELETE');
select ok(has_table_privilege('service_role', 'public.prezzi_predefiniti', 'SELECT'), 'service_role: ha SELECT (migration 0068, lo legge il cron dell''allarme prezzi)');
select ok(not has_table_privilege('service_role', 'public.prezzi_predefiniti', 'UPDATE'), 'service_role: nessun UPDATE');
select ok(not has_table_privilege('service_role', 'public.prezzi_predefiniti', 'INSERT'), 'service_role: nessun INSERT');
select ok(not has_table_privilege('service_role', 'public.prezzi_predefiniti', 'DELETE'), 'service_role: nessun DELETE');

-- Solo l'admin legge i prezzi.
select is(pg_temp.righe_as('a0000000-0000-0000-0000-000000000001', 'prezzi_predefiniti'), 1, 'admin: legge i prezzi');
select is(pg_temp.righe_as('a0000000-0000-0000-0000-000000000002', 'prezzi_predefiniti'), 0, 'maestra: non legge i prezzi');
select is(pg_temp.righe_as('a0000000-0000-0000-0000-000000000003', 'prezzi_predefiniti'), 0, 'assistente: non legge i prezzi');
select is(pg_temp.righe_as('a0000000-0000-0000-0000-000000000004', 'prezzi_predefiniti'), 0, 'genitore: non legge i prezzi');
select is(pg_temp.righe_as(null, 'prezzi_predefiniti'), 0, 'anonimo: non legge i prezzi');

-- Solo l'admin li modifica, anche più colonne insieme.
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
    $q$update public.prezzi_predefiniti set retta_materna = 165.50, gettone_pre_asilo = 7.25, updated_at = now() where id = true$q$),
  'ok',
  'admin: salva i prezzi'
);
select is(
  (select retta_materna from public.prezzi_predefiniti), 165.50::numeric,
  'la retta Materna dell''admin è salvata al centesimo'
);
select is(
  (select gettone_pre_asilo from public.prezzi_predefiniti), 7.25::numeric,
  'il gettone pre-asilo dell''admin è salvato al centesimo'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000002',
    $q$update public.prezzi_predefiniti set retta_materna = 1 where id = true$q$),
  'ok', 'maestra: l''UPDATE non dà errore ma la RLS non fa toccare nessuna riga'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000003',
    $q$update public.prezzi_predefiniti set retta_materna = 1 where id = true$q$),
  'ok', 'assistente: l''UPDATE non dà errore ma la RLS non fa toccare nessuna riga'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000004',
    $q$update public.prezzi_predefiniti set retta_materna = 1 where id = true$q$),
  'ok', 'genitore: l''UPDATE non dà errore ma la RLS non fa toccare nessuna riga'
);
select is(
  pg_temp.write_as(null, $q$update public.prezzi_predefiniti set retta_materna = 1 where id = true$q$),
  '42501', 'anonimo: UPDATE negato'
);
select is(
  (select retta_materna from public.prezzi_predefiniti), 165.50::numeric,
  'la retta Materna è rimasta quella dell''admin'
);

-- Una sola riga: niente insert extra né delete, nemmeno per l'admin.
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001', $q$insert into public.prezzi_predefiniti (id) values (false)$q$),
  '42501', 'admin: INSERT negato'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001', $q$delete from public.prezzi_predefiniti$q$),
  '42501', 'admin: DELETE negato'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000002', $q$delete from public.prezzi_predefiniti$q$),
  '42501', 'maestra: DELETE negato'
);
select is(
  pg_temp.write_as(null, $q$delete from public.prezzi_predefiniti$q$),
  '42501', 'anonimo: DELETE negato'
);
select is((select count(*)::int from public.prezzi_predefiniti), 1, 'la riga unica c''è ancora');

-- Cambiare i prezzi non tocca i costi dei bambini esistenti (PRZ-06, COS-03):
-- nessun trigger sui prezzi che propaghi qualcosa a costi_bambini.
select is(
  (select count(*)::int from pg_trigger
    where tgrelid = 'public.prezzi_predefiniti'::regclass and not tgisinternal),
  0,
  'nessun trigger sui prezzi: non propagano nulla ai costi dei bambini'
);

select * from finish();

rollback;
