-- Girasole — test pgTAP sulla funzione public.crea_bambino_con_costi
-- (issue #396; specs/50 AMM-03, AMM-04, AMM-05; specs/55 COS-03; specs/62 PRZ-07, PRZ-08).
--
-- La funzione crea il bambino e, se la sezione ha un tipo, la sua riga di
-- costi, in un'unica operazione. Questo file copre anche AMM-05, che in e2e
-- non si può provare: se la scrittura dei costi fallisce, non resta il
-- bambino (la funzione è una sola transazione).
--
-- Tutto dentro una transazione chiusa da `rollback`. Dati fittizi. Si esegue
-- con `supabase test db`. Mai sulla produzione. Stessi helper degli altri
-- test pgTAP del progetto.

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
-- ('ok' se non ne ha dati). Un errore annulla solo lo statement (sottotransazione).
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

insert into public.sezioni (id, nome, tipo) values
  ('b0000000-0000-0000-0000-000000000001', 'Sezione pgTAP materna', 'materna'),
  ('b0000000-0000-0000-0000-000000000002', 'Sezione pgTAP primavera', 'primavera'),
  ('b0000000-0000-0000-0000-000000000003', 'Sezione pgTAP senza tipo', null);

-- Prezzi noti, distinti tra loro (come postgres).
update public.prezzi_predefiniti set
  retta_materna = 161.11, retta_primavera = 201.22, buono_pasto = 6.33, marca_da_bollo = 2.44,
  abbonamento_pre_asilo = 71.55, abbonamento_post_asilo = 72.66,
  gettone_pre_asilo = 7.77, gettone_post_asilo = 7.88
where id = true;

-- =========================================================================
-- Privilegi sulla funzione
-- =========================================================================
select ok(
  has_function_privilege('authenticated', 'public.crea_bambino_con_costi(text,text,uuid,date,text,text,text)', 'EXECUTE'),
  'authenticated: può eseguire la funzione'
);
select ok(
  not has_function_privilege('anon', 'public.crea_bambino_con_costi(text,text,uuid,date,text,text,text)', 'EXECUTE'),
  'anon: non può eseguire la funzione'
);
select ok(
  not has_function_privilege('service_role', 'public.crea_bambino_con_costi(text,text,uuid,date,text,text,text)', 'EXECUTE'),
  'service_role: non può eseguire la funzione'
);
select ok(
  not (select prosecdef from pg_proc where oid = 'public.crea_bambino_con_costi(text,text,uuid,date,text,text,text)'::regprocedure),
  'la funzione è security invoker: valgono RLS e GRANT di chi la chiama'
);

-- =========================================================================
-- AMM-03 / PRZ-07: sezione con tipo -> bambino e costi nascono insieme
-- =========================================================================
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001', $q$
    select public.crea_bambino_con_costi('Prova', 'PgTapMaterna', 'b0000000-0000-0000-0000-000000000001', '2021-04-04', 'F', null, null)
  $q$),
  'ok', 'admin: crea un bambino in una sezione materna'
);
select is(
  (select to_jsonb(c) - 'updated_at' - 'bambino_id'
     from public.costi_bambini c join public.bambini b on b.id = c.bambino_id
    where b.cognome = 'PgTapMaterna'),
  '{"prezzo_mensile":161.11,"prezzo_buono_pasto":6.33,"prezzo_marca_da_bollo":2.44,"pre_asilo_richiesto":false,"prezzo_pre_asilo":71.55,"post_asilo_richiesto":false,"prezzo_post_asilo":72.66,"gettone_pre_asilo":7.77,"gettone_post_asilo":7.88,"email_promemoria":null}'::jsonb,
  'materna: retta Materna, buono pasto, marca da bollo, abbonamenti e gettoni dei prezzi; flag falsi; email vuota'
);
-- COS-12 / PRZ-07: i gettoni vengono da prezzi_predefiniti, non da valori fissi.
select is(
  (select (c.gettone_pre_asilo, c.gettone_post_asilo)::text
     from public.costi_bambini c join public.bambini b on b.id = c.bambino_id
    where b.cognome = 'PgTapMaterna'),
  '(7.77,7.88)',
  'COS-12: i gettoni del nuovo bambino sono quelli di "Prezzi" (7,77 e 7,88)'
);
select is(
  (select sezione_id from public.bambini where cognome = 'PgTapMaterna'),
  'b0000000-0000-0000-0000-000000000001'::uuid,
  'il bambino è nella sezione scelta'
);

select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001', $q$
    select public.crea_bambino_con_costi('Prova', 'PgTapPrimavera', 'b0000000-0000-0000-0000-000000000002', '2021-04-04', 'M', 'nessuna', 'nota')
  $q$),
  'ok', 'admin: crea un bambino in una sezione primavera'
);
select is(
  (select c.prezzo_mensile from public.costi_bambini c join public.bambini b on b.id = c.bambino_id where b.cognome = 'PgTapPrimavera'),
  201.22::numeric,
  'primavera: la retta è quella Primavera'
);
select is(
  (select (c.gettone_pre_asilo, c.gettone_post_asilo)::text from public.costi_bambini c join public.bambini b on b.id = c.bambino_id where b.cognome = 'PgTapPrimavera'),
  '(7.77,7.88)',
  'COS-12: anche in primavera i gettoni sono quelli di "Prezzi"'
);
select is(
  (select (note_allergie, altre_note)::text from public.bambini where cognome = 'PgTapPrimavera'),
  '(nessuna,nota)',
  'note allergie e altre note sono salvate'
);

-- =========================================================================
-- AMM-04 / PRZ-08: senza sezione o senza tipo -> solo il bambino
-- =========================================================================
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001', $q$
    select public.crea_bambino_con_costi('Prova', 'PgTapSenzaSezione', null, '2021-04-04', 'F', null, null)
  $q$),
  'ok', 'admin: crea un bambino senza sezione'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001', $q$
    select public.crea_bambino_con_costi('Prova', 'PgTapSenzaTipo', 'b0000000-0000-0000-0000-000000000003', '2021-04-04', 'F', null, null)
  $q$),
  'ok', 'admin: crea un bambino in una sezione senza tipo'
);
select is(
  (select count(*)::int from public.bambini where cognome in ('PgTapSenzaSezione', 'PgTapSenzaTipo')),
  2, 'i due bambini ci sono'
);
select is(
  (select count(*)::int from public.costi_bambini c join public.bambini b on b.id = c.bambino_id
    where b.cognome in ('PgTapSenzaSezione', 'PgTapSenzaTipo')),
  0, 'nessuna riga di costi per loro'
);

-- =========================================================================
-- Un duplicato è rifiutato (23505) e non lascia nulla
-- =========================================================================
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001', $q$
    select public.crea_bambino_con_costi('Prova', 'PgTapMaterna', 'b0000000-0000-0000-0000-000000000001', '2021-04-04', 'F', null, null)
  $q$),
  '23505', 'lo stesso nome, cognome e data di nascita è rifiutato'
);
select is((select count(*)::int from public.bambini where cognome = 'PgTapMaterna'), 1, 'resta un solo bambino con quel cognome');

-- =========================================================================
-- Chi non è admin non crea nulla
-- =========================================================================
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000002', $q$
    select public.crea_bambino_con_costi('Prova', 'PgTapMaestra', 'b0000000-0000-0000-0000-000000000001', '2021-04-04', 'F', null, null)
  $q$),
  '42501', 'maestra: negato'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000003', $q$
    select public.crea_bambino_con_costi('Prova', 'PgTapAssistente', 'b0000000-0000-0000-0000-000000000001', '2021-04-04', 'F', null, null)
  $q$),
  '42501', 'assistente: negato'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000004', $q$
    select public.crea_bambino_con_costi('Prova', 'PgTapGenitore', 'b0000000-0000-0000-0000-000000000001', '2021-04-04', 'F', null, null)
  $q$),
  '42501', 'genitore: negato'
);
select is(
  pg_temp.write_as(null, $q$
    select public.crea_bambino_con_costi('Prova', 'PgTapAnon', null, '2021-04-04', 'F', null, null)
  $q$),
  '42501', 'anonimo: negato'
);
select is(
  (select count(*)::int from public.bambini where cognome in ('PgTapMaestra', 'PgTapAssistente', 'PgTapGenitore', 'PgTapAnon')),
  0, 'nessun bambino creato da chi non è admin'
);

-- =========================================================================
-- AMM-05: se i costi non si possono scrivere, non resta nemmeno il bambino
-- =========================================================================
-- Simulo un errore del database sulla scrittura dei costi: un vincolo che
-- rifiuta ogni nuova riga (NOT VALID: non controlla le righe già presenti).
alter table public.costi_bambini
  add constraint costi_pgtap_fallisce check (prezzo_mensile < 0) not valid;

select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001', $q$
    select public.crea_bambino_con_costi('Prova', 'PgTapCostiFalliti', 'b0000000-0000-0000-0000-000000000001', '2021-04-04', 'F', null, null)
  $q$),
  '23514', 'la scrittura dei costi fallisce: la funzione dà errore'
);
select is(
  (select count(*)::int from public.bambini where cognome = 'PgTapCostiFalliti'),
  0, 'AMM-05: non resta il bambino senza costi'
);

-- Senza sezione con tipo i costi non si scrivono: il vincolo non c'entra e il bambino nasce.
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001', $q$
    select public.crea_bambino_con_costi('Prova', 'PgTapSenzaCosti', null, '2021-04-04', 'F', null, null)
  $q$),
  'ok', 'senza sezione con tipo non si scrivono costi: il bambino nasce comunque'
);

alter table public.costi_bambini drop constraint costi_pgtap_fallisce;

-- Prezzi non leggibili (riga mancante): niente bambino a metà.
delete from public.prezzi_predefiniti;
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001', $q$
    select public.crea_bambino_con_costi('Prova', 'PgTapSenzaPrezzi', 'b0000000-0000-0000-0000-000000000001', '2021-04-04', 'F', null, null)
  $q$),
  'P0001', 'senza prezzi la funzione dà errore (nessun valore inventato)'
);
select is(
  (select count(*)::int from public.bambini where cognome = 'PgTapSenzaPrezzi'),
  0, 'non resta il bambino senza costi'
);

select * from finish();

rollback;
