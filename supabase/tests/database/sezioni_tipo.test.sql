-- Girasole — test pgTAP sul tipo della sezione e sui costi senza default
-- (issue #396; specs/50 AMM-01, AMM-02, AMM-06; specs/55 COS-03; specs/62 PRZ-06).
--
-- Comportamento da implementare (migration della issue #396):
--   * sezioni.tipo: colonna text NULL, senza default (le sezioni esistenti
--     restano senza tipo), con check: ammessi solo 'materna' e 'primavera'
--     (minuscoli) oppure NULL ("Nessuno"). Chi scrive la sezione resta
--     governato dalle policy di prima: solo l'admin (sezioni_admin_write).
--   * costi_bambini: le colonne prezzo_buono_pasto, prezzo_marca_da_bollo,
--     prezzo_pre_asilo e prezzo_post_asilo non hanno più i default 6/2/70/70
--     (0037, 0039): ogni inserimento scrive i prezzi in modo esplicito. Le
--     righe già esistenti non vengono toccate.
--
-- Tutto dentro una transazione chiusa da `rollback`. Dati fittizi. Si esegue
-- con `supabase test db`. Mai sulla produzione. Stessi helper di
-- calendario_eventi.test.sql.

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
  ('a0000000-0000-0000-0000-000000000004', 'pgtap.genitore@example.test', '{"ruolo":"genitore"}');

insert into public.sezioni (id, nome) values
  ('b0000000-0000-0000-0000-000000000001', 'Sezione pgTAP senza tipo');

-- =========================================================================
-- sezioni.tipo (AMM-01, AMM-02)
-- =========================================================================
select has_column('public', 'sezioni', 'tipo', 'sezioni ha la colonna tipo');
select col_is_null('public', 'sezioni', 'tipo', 'sezioni.tipo è facoltativo (nullable)');
select col_type_is('public', 'sezioni', 'tipo', 'text', 'sezioni.tipo è testo');
select col_hasnt_default('public', 'sezioni', 'tipo', 'sezioni.tipo non ha un default');
select is(
  (select tipo from public.sezioni where id = 'b0000000-0000-0000-0000-000000000001'),
  null::text,
  'una sezione creata senza tipo (come quelle già esistenti) resta senza tipo'
);

select lives_ok(
  $q$insert into public.sezioni (nome, tipo) values ('Sezione pgTAP materna', 'materna')$q$,
  'si crea una sezione di tipo materna'
);
select lives_ok(
  $q$insert into public.sezioni (nome, tipo) values ('Sezione pgTAP primavera', 'primavera')$q$,
  'si crea una sezione di tipo primavera'
);
select throws_ok(
  $q$insert into public.sezioni (nome, tipo) values ('Sezione pgTAP sbagliata', 'altro')$q$,
  '23514', null,
  'un tipo diverso da materna/primavera è rifiutato'
);
select throws_ok(
  $q$insert into public.sezioni (nome, tipo) values ('Sezione pgTAP maiuscola', 'Materna')$q$,
  '23514', null,
  'il tipo è in minuscolo: "Materna" è rifiutato'
);
select throws_ok(
  $q$insert into public.sezioni (nome, tipo) values ('Sezione pgTAP vuota', '')$q$,
  '23514', null,
  'una stringa vuota non è un tipo ("Nessuno" è NULL)'
);

-- Solo l'admin modifica il tipo.
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
    $q$update public.sezioni set tipo = 'primavera' where id = 'b0000000-0000-0000-0000-000000000001'$q$),
  'ok', 'admin: imposta il tipo di una sezione'
);
select is(
  (select tipo from public.sezioni where id = 'b0000000-0000-0000-0000-000000000001'),
  'primavera', 'il tipo è salvato'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
    $q$update public.sezioni set tipo = 'materna' where id = 'b0000000-0000-0000-0000-000000000001'$q$),
  'ok', 'admin: cambia il tipo da primavera a materna'
);
select is(
  (select tipo from public.sezioni where id = 'b0000000-0000-0000-0000-000000000001'),
  'materna', 'il tipo nuovo è salvato'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000002',
    $q$update public.sezioni set tipo = 'primavera' where id = 'b0000000-0000-0000-0000-000000000001'$q$),
  'ok', 'maestra: l''UPDATE non dà errore ma la RLS non fa toccare nessuna riga'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000004',
    $q$update public.sezioni set tipo = 'primavera' where id = 'b0000000-0000-0000-0000-000000000001'$q$),
  'ok', 'genitore: l''UPDATE non dà errore ma la RLS non fa toccare nessuna riga'
);
select is(
  pg_temp.write_as(null,
    $q$update public.sezioni set tipo = 'primavera' where id = 'b0000000-0000-0000-0000-000000000001'$q$),
  '42501', 'anonimo: UPDATE del tipo negato'
);
select is(
  (select tipo from public.sezioni where id = 'b0000000-0000-0000-0000-000000000001'),
  'materna', 'il tipo è rimasto quello dell''admin'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
    $q$update public.sezioni set tipo = null where id = 'b0000000-0000-0000-0000-000000000001'$q$),
  'ok', 'admin: può togliere il tipo (Nessuno)'
);
select is(
  (select tipo from public.sezioni where id = 'b0000000-0000-0000-0000-000000000001'),
  null::text, 'il tipo torna vuoto'
);

-- =========================================================================
-- Cambiare tipo a una sezione o spostare un bambino non tocca i suoi costi
-- (AMM-02, AMM-06, COS-03, PRZ-06): nessun trigger collega sezioni/bambini a
-- costi_bambini.
-- =========================================================================
insert into public.sezioni (id, nome, tipo) values
  ('b0000000-0000-0000-0000-000000000002', 'Sezione pgTAP A', 'materna'),
  ('b0000000-0000-0000-0000-000000000003', 'Sezione pgTAP B', 'primavera');
insert into public.bambini (id, nome, cognome, sezione_id) values
  ('c0000000-0000-0000-0000-000000000001', 'Prova', 'PgTap', 'b0000000-0000-0000-0000-000000000002');
insert into public.costi_bambini
  (bambino_id, prezzo_mensile, prezzo_buono_pasto, prezzo_marca_da_bollo, prezzo_pre_asilo, prezzo_post_asilo,
   gettone_pre_asilo, gettone_post_asilo)
values ('c0000000-0000-0000-0000-000000000001', 123.45, 5.55, 1.99, 33.33, 44.44, 7.11, 7.22);

update public.sezioni set tipo = 'primavera' where id = 'b0000000-0000-0000-0000-000000000002';
update public.bambini set sezione_id = 'b0000000-0000-0000-0000-000000000003'
  where id = 'c0000000-0000-0000-0000-000000000001';

select is(
  (select to_jsonb(c) - 'updated_at' from public.costi_bambini c where bambino_id = 'c0000000-0000-0000-0000-000000000001'),
  '{"bambino_id":"c0000000-0000-0000-0000-000000000001","prezzo_mensile":123.45,"prezzo_buono_pasto":5.55,"prezzo_marca_da_bollo":1.99,"pre_asilo_richiesto":false,"prezzo_pre_asilo":33.33,"post_asilo_richiesto":false,"prezzo_post_asilo":44.44,"gettone_pre_asilo":7.11,"gettone_post_asilo":7.22,"email_promemoria":null}'::jsonb,
  'dopo il cambio di tipo e lo spostamento di sezione i costi del bambino sono identici al centesimo'
);
select is(
  (select count(*)::int from pg_trigger
    where tgrelid in ('public.sezioni'::regclass, 'public.bambini'::regclass)
      and not tgisinternal
      and pg_get_triggerdef(oid) ilike '%costi_bambini%'),
  0,
  'nessun trigger su sezioni/bambini scrive in costi_bambini'
);

-- =========================================================================
-- costi_bambini: niente più default sui prezzi (COS-02, spec 55 "Regole")
-- =========================================================================
select col_hasnt_default('public', 'costi_bambini', 'prezzo_buono_pasto', 'costi_bambini.prezzo_buono_pasto: nessun default (era 6)');
select col_hasnt_default('public', 'costi_bambini', 'prezzo_marca_da_bollo', 'costi_bambini.prezzo_marca_da_bollo: nessun default (era 2)');
select col_hasnt_default('public', 'costi_bambini', 'prezzo_pre_asilo', 'costi_bambini.prezzo_pre_asilo: nessun default (era 70)');
select col_hasnt_default('public', 'costi_bambini', 'prezzo_post_asilo', 'costi_bambini.prezzo_post_asilo: nessun default (era 70)');

select * from finish();

rollback;
