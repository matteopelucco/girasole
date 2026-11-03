-- Girasole — test pgTAP sui confini di accesso di public.costi_bambini
-- (issue #396; specs/55 - costi-bambino.md, specs/03 - utenti-e-ruoli.md).
--
-- Comportamento fissato (migration 0035): la tabella è "solo admin" in ogni
-- operazione (policy costi_bambini_admin_all, for all). Maestra, assistente,
-- genitore (anche del bambino interessato) e anonimo non leggono nessuna riga
-- e non inseriscono, modificano né cancellano nulla. Sono importi dovuti dalle
-- famiglie: una fuga sarebbe una violazione di privacy.
--
-- Tutto dentro una transazione chiusa da `rollback`. Dati chiaramente
-- fittizi, nessun dato reale. Si esegue con `supabase test db`. Mai sulla
-- produzione. Stessi helper degli altri test pgTAP del progetto.

begin;

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

select plan(37);

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

-- Quante righe di costi_bambini (tra le tre di fixture) vede p_uid
-- (null = anonimo). Un "permission denied" conta come nessuna riga.
create function pg_temp.righe_as(p_uid uuid) returns int
language plpgsql as $$
declare
  v_prev text := current_user;
  v_n int;
begin
  perform pg_temp.impersona(p_uid);
  begin
    select count(*)::int into v_n from public.costi_bambini
     where bambino_id in ('c0000000-0000-0000-0000-000000000001',
                          'c0000000-0000-0000-0000-000000000002',
                          'c0000000-0000-0000-0000-000000000003');
  exception when insufficient_privilege then
    v_n := 0;
  end;
  perform set_config('role', v_prev, true);
  return v_n;
end;
$$;

-- Esegue uno statement come p_uid e restituisce lo SQLSTATE dell'errore
-- ('ok' se non ne ha dati; UPDATE/DELETE bloccati dalla RLS non danno errore
-- ma zero righe).
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

-- INSERT di una riga di costi con importi fittizi (tutti espliciti: le
-- colonne dei prezzi non hanno più default).
create function pg_temp.insert_sql(p_bambino uuid) returns text
language sql as $$
  select format(
    $q$insert into public.costi_bambini
         (bambino_id, prezzo_mensile, prezzo_buono_pasto, prezzo_marca_da_bollo,
          prezzo_pre_asilo, prezzo_post_asilo, gettone_pre_asilo, gettone_post_asilo)
       values (%L, 100, 6, 2, 70, 70, 7, 7)$q$,
    p_bambino
  );
$$;

-- Fixture (come postgres, con bypass RLS) ----------------------------------
--   admin a0..01, maestra a0..02 e assistente a0..03 (sezione S1),
--   genitore a0..04 (figlio B1)
-- Bambini: B1 e B2 hanno già i costi; B3 è per l'insert dell'admin; B4 per i
-- tentativi abusivi.
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

insert into public.costi_bambini
  (bambino_id, prezzo_mensile, prezzo_buono_pasto, prezzo_marca_da_bollo,
   prezzo_pre_asilo, prezzo_post_asilo, gettone_pre_asilo, gettone_post_asilo)
values
  ('c0000000-0000-0000-0000-000000000001', 100, 6, 2, 70, 70, 7, 7),
  ('c0000000-0000-0000-0000-000000000002', 100, 6, 2, 70, 70, 7, 7);

-- =========================================================================
-- RLS attiva, una sola policy, nessun privilegio ad anon
-- =========================================================================
select ok(
  (select relrowsecurity from pg_class where oid = 'public.costi_bambini'::regclass),
  'costi_bambini: RLS attiva'
);
select is(
  (select array_agg(policyname::text order by policyname::text) from pg_policies
    where schemaname = 'public' and tablename = 'costi_bambini'),
  array['costi_bambini_admin_all'],
  'costi_bambini: esattamente la policy admin_all, nessun''altra'
);
select ok(
  not has_any_column_privilege('anon', 'public.costi_bambini', 'SELECT,INSERT,UPDATE,REFERENCES'),
  'anon: nessun privilegio sulla tabella'
);

-- =========================================================================
-- SELECT: solo l'admin legge
-- =========================================================================
select is(pg_temp.righe_as('a0000000-0000-0000-0000-000000000001'), 2, 'admin: legge i costi dei bambini');
select is(pg_temp.righe_as('a0000000-0000-0000-0000-000000000002'), 0, 'maestra (della sezione): non legge nessuna riga');
select is(pg_temp.righe_as('a0000000-0000-0000-0000-000000000003'), 0, 'assistente (della sezione): non legge nessuna riga');
select is(pg_temp.righe_as('a0000000-0000-0000-0000-000000000004'), 0, 'genitore: non legge nessuna riga, nemmeno quella del proprio figlio');
select is(pg_temp.righe_as(null), 0, 'anonimo: non legge nessuna riga');

-- =========================================================================
-- INSERT: solo l'admin scrive
-- =========================================================================
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
    pg_temp.insert_sql('c0000000-0000-0000-0000-000000000003')),
  'ok', 'admin: può inserire i costi di un bambino'
);
select is(
  (select count(*)::int from public.costi_bambini where bambino_id = 'c0000000-0000-0000-0000-000000000003'),
  1, 'admin: la riga inserita esiste davvero'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000002',
    pg_temp.insert_sql('c0000000-0000-0000-0000-000000000004')),
  '42501', 'maestra: non può inserire costi'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000003',
    pg_temp.insert_sql('c0000000-0000-0000-0000-000000000004')),
  '42501', 'assistente: non può inserire costi'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000004',
    pg_temp.insert_sql('c0000000-0000-0000-0000-000000000004')),
  '42501', 'genitore: non può inserire costi'
);
select is(
  pg_temp.write_as(null, pg_temp.insert_sql('c0000000-0000-0000-0000-000000000004')),
  '42501', 'anonimo: non può inserire costi'
);

-- =========================================================================
-- UPDATE: solo l'admin
-- =========================================================================
-- Per i ruoli non admin la RLS riduce l'UPDATE a zero righe senza errore (o
-- permission denied per anon): si verifica che i dati non siano cambiati.
-- `do`/`perform` e non `select`: un `select` stamperebbe la stringa e
-- pg_prove la leggerebbe come un risultato TAP in più.
do $do$ begin
  perform pg_temp.write_as('a0000000-0000-0000-0000-000000000002',
    $q$update public.costi_bambini set prezzo_mensile = 999$q$);
end $do$;
select is(
  (select count(*)::int from public.costi_bambini
    where bambino_id in ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002')
      and prezzo_mensile = 100),
  2, 'maestra: l''update non ha modificato nessuna riga'
);

do $do$ begin
  perform pg_temp.write_as('a0000000-0000-0000-0000-000000000003',
    $q$update public.costi_bambini set prezzo_mensile = 999$q$);
end $do$;
select is(
  (select count(*)::int from public.costi_bambini
    where bambino_id in ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002')
      and prezzo_mensile = 100),
  2, 'assistente: l''update non ha modificato nessuna riga'
);

do $do$ begin
  perform pg_temp.write_as('a0000000-0000-0000-0000-000000000004',
    $q$update public.costi_bambini set prezzo_mensile = 999$q$);
end $do$;
select is(
  (select count(*)::int from public.costi_bambini
    where bambino_id in ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002')
      and prezzo_mensile = 100),
  2, 'genitore: l''update non ha modificato nessuna riga, neanche quella del proprio figlio'
);

do $do$ begin
  perform pg_temp.write_as(null,
    $q$update public.costi_bambini set prezzo_mensile = 999$q$);
end $do$;
select is(
  (select count(*)::int from public.costi_bambini
    where bambino_id in ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002')
      and prezzo_mensile = 100),
  2, 'anonimo: l''update non ha modificato nessuna riga'
);

select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
    $q$update public.costi_bambini set prezzo_mensile = 150
        where bambino_id = 'c0000000-0000-0000-0000-000000000001'$q$),
  'ok', 'admin: può modificare i costi (nessun errore)'
);
select is(
  (select prezzo_mensile from public.costi_bambini where bambino_id = 'c0000000-0000-0000-0000-000000000001'),
  150::numeric, 'admin: l''update ha effettivamente modificato la riga'
);

-- =========================================================================
-- DELETE: solo l'admin
-- =========================================================================
do $do$ begin
  perform pg_temp.write_as('a0000000-0000-0000-0000-000000000002',
    $q$delete from public.costi_bambini$q$);
end $do$;
select is(
  (select count(*)::int from public.costi_bambini
    where bambino_id in ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003')),
  3, 'maestra: il delete non ha eliminato nessuna riga'
);

do $do$ begin
  perform pg_temp.write_as('a0000000-0000-0000-0000-000000000003',
    $q$delete from public.costi_bambini$q$);
end $do$;
select is(
  (select count(*)::int from public.costi_bambini
    where bambino_id in ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003')),
  3, 'assistente: il delete non ha eliminato nessuna riga'
);

do $do$ begin
  perform pg_temp.write_as('a0000000-0000-0000-0000-000000000004',
    $q$delete from public.costi_bambini$q$);
end $do$;
select is(
  (select count(*)::int from public.costi_bambini
    where bambino_id in ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003')),
  3, 'genitore: il delete non ha eliminato nessuna riga, neanche quella del proprio figlio'
);

do $do$ begin
  perform pg_temp.write_as(null,
    $q$delete from public.costi_bambini$q$);
end $do$;
select is(
  (select count(*)::int from public.costi_bambini
    where bambino_id in ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003')),
  3, 'anonimo: il delete non ha eliminato nessuna riga'
);

select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
    $q$delete from public.costi_bambini where bambino_id = 'c0000000-0000-0000-0000-000000000001'$q$),
  'ok', 'admin: può cancellare i costi (nessun errore)'
);
select is(
  (select count(*)::int from public.costi_bambini where bambino_id = 'c0000000-0000-0000-0000-000000000001'),
  0, 'admin: la riga è stata davvero cancellata'
);

-- =========================================================================
-- COS-11 (issue #398): colonne dei gettoni. Il fatto che i bambini già
-- esistenti abbiano 7 euro dopo il rilascio è l'effetto di questa migration
-- (backfill, poi default tolto): qui si prova la forma finale delle colonne.
-- (come postgres, fuori dalla RLS)
-- =========================================================================
select has_column('public', 'costi_bambini', 'gettone_pre_asilo', 'COS-11: esiste costi_bambini.gettone_pre_asilo');
select has_column('public', 'costi_bambini', 'gettone_post_asilo', 'COS-11: esiste costi_bambini.gettone_post_asilo');
select is(
  (select format_type(a.atttypid, a.atttypmod) from pg_attribute a
    where a.attrelid = 'public.costi_bambini'::regclass and a.attname = 'gettone_pre_asilo'),
  'numeric(6,2)', 'COS-11: gettone_pre_asilo è numeric(6,2)'
);
select is(
  (select format_type(a.atttypid, a.atttypmod) from pg_attribute a
    where a.attrelid = 'public.costi_bambini'::regclass and a.attname = 'gettone_post_asilo'),
  'numeric(6,2)', 'COS-11: gettone_post_asilo è numeric(6,2)'
);
select col_not_null('public', 'costi_bambini', 'gettone_pre_asilo', 'COS-11: gettone_pre_asilo è not null');
select col_not_null('public', 'costi_bambini', 'gettone_post_asilo', 'COS-11: gettone_post_asilo è not null');
select col_hasnt_default('public', 'costi_bambini', 'gettone_pre_asilo', 'COS-11: gettone_pre_asilo senza default dopo la migration (era 7 solo per il backfill)');
select col_hasnt_default('public', 'costi_bambini', 'gettone_post_asilo', 'COS-11: gettone_post_asilo senza default dopo la migration (era 7 solo per il backfill)');

-- Vincolo 0..9999,99 (come gli altri importi): SQLSTATE dell'insert, 'ok' se riuscito.
insert into public.bambini (id, nome, cognome, sezione_id) values
  ('c0000000-0000-0000-0000-000000000005', 'PgtapCinque', 'Fittizio', 'd0000000-0000-0000-0000-000000000001');
create function pg_temp.stato_gettoni(p_pre numeric, p_post numeric) returns text
language plpgsql as $$
begin
  begin
    insert into public.costi_bambini
      (bambino_id, prezzo_mensile, prezzo_buono_pasto, prezzo_marca_da_bollo,
       prezzo_pre_asilo, prezzo_post_asilo, gettone_pre_asilo, gettone_post_asilo)
    values ('c0000000-0000-0000-0000-000000000005', 100, 6, 2, 70, 70, p_pre, p_post);
    delete from public.costi_bambini where bambino_id = 'c0000000-0000-0000-0000-000000000005';
    return 'ok';
  exception when others then
    return sqlstate;
  end;
end;
$$;
select is(pg_temp.stato_gettoni(-0.01, 7), '23514', 'COS-11: gettone pre-asilo negativo rifiutato');
select is(pg_temp.stato_gettoni(7, 10000), '23514', 'COS-11: gettone post-asilo sopra 9999,99 rifiutato');
select is(pg_temp.stato_gettoni(0, 9999.99), 'ok', 'COS-11: 0 e 9999,99 sono validi');

select * from finish();

rollback;
