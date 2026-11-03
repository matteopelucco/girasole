-- Girasole — test pgTAP sulla funzione di sola lettura che dice se il
-- pre/post-asilo di un bambino è coperto dall'abbonamento (issue #399, parte di
-- #401; specs/13 - segna-presenza.md GET-08 e GET-11, specs/03, specs/55).
--
-- Funzione sotto test (da creare, security definer, richiamata via RPC con la
-- sessione dell'utente):
--   copertura_pre_post_asilo(p_data date)
--     -> table (bambino_id uuid, pre_asilo_coperto boolean,
--               post_asilo_coperto boolean, retta_successiva_inviata boolean)
--
-- Comportamento fissato:
--   * una riga per ogni bambino ATTIVO che il chiamante già può vedere: admin
--     tutti, maestra e assistente solo quelli delle proprie sezioni
--     (maestre_sezioni); nessuna riga per gli altri;
--   * la riga contiene SOLO sì/no (le quattro colonne sopra): mai prezzi,
--     gettoni, flag o altre colonne di costi_bambini;
--   * coperto (GET-11), per la voce e il mese solare di p_data: se la retta di
--     quel mese è già in comunicazioni_retta vale cosa fu addebitato
--     (costo_pre_asilo > 0 / costo_post_asilo > 0); altrimenti il flag attuale
--     pre_asilo_richiesto / post_asilo_richiesto di costi_bambini (nessuna riga
--     di costi = non coperto). Pre e post sono voci separate;
--   * retta_successiva_inviata: esiste una comunicazione del mese successivo a
--     quello di p_data (serve all'avviso di GET-12);
--   * funziona per qualunque data (anche passata: sola lettura di GET-14);
--   * respinti con SQLSTATE 42501: genitore e utente senza profilo; anonimo
--     senza EXECUTE; data nulla = 22004;
--   * sicurezza: security definer, search_path fisso e vuoto, stable, EXECUTE
--     solo ad authenticated.
--
-- Fixture (data fissa 2030-03-12; mese 2030-03, successivo 2030-04):
--   B1 (S1) costi pre sì, post no, nessuna retta     -> t|f|f
--   B2 (S1) nessuna riga di costi                    -> f|f|f
--   B3 (S2) costi pre sì, post sì (sezione non sua)  -> t|t|f (solo admin)
--   B4 (S1) costi pre sì, post no; retta 2030-03 con pre 0 e post 70 -> f|t|f
--   B5 (S1) costi no/no; retta 2030-04 già inviata   -> f|f|t
--   B6 (S1, INATTIVO) costi pre sì                   -> escluso ovunque
--
-- Tutto dentro una transazione chiusa da `rollback`. Dati fittizi, mai reali.
-- Si esegue con `supabase test db` (in CI dopo il reset del DB di test).

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

select plan(14);

-- ---------------------------------------------------------------------
-- Helper (temporanei)
-- ---------------------------------------------------------------------
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

-- Righe della funzione per i bambini di fixture, nel formato
-- 'NN|pre|post|successiva' (t/f), ordinate per id.
create function pg_temp.righe_as(p_uid uuid, p_data date) returns text[]
language plpgsql as $$
declare
  v_prev text := current_user;
  v_r text[];
begin
  perform pg_temp.impersona(p_uid);
  select coalesce(array_agg(
           format('%s|%s|%s|%s', right(c.bambino_id::text, 2),
                  case when c.pre_asilo_coperto then 't' else 'f' end,
                  case when c.post_asilo_coperto then 't' else 'f' end,
                  case when c.retta_successiva_inviata then 't' else 'f' end)
           order by c.bambino_id), '{}') into v_r
    from public.copertura_pre_post_asilo(p_data) c
   where c.bambino_id::text like 'c0000000-0000-0000-0000-0000000000%';
  perform set_config('role', v_prev, true);
  return v_r;
end;
$$;

-- Righe di costi_bambini che p_uid riesce a leggere direttamente (RLS).
create function pg_temp.costi_visibili_as(p_uid uuid) returns integer
language plpgsql as $$
declare
  v_prev text := current_user;
  v_n integer;
begin
  perform pg_temp.impersona(p_uid);
  select count(*)::integer into v_n from public.costi_bambini
   where bambino_id::text like 'c0000000-0000-0000-0000-0000000000%';
  perform set_config('role', v_prev, true);
  return v_n;
end;
$$;

-- ---------------------------------------------------------------------
-- Fixture
-- ---------------------------------------------------------------------
--   admin a0..01, maestra a0..02 (S1), assistente a0..03 (S1),
--   genitore a0..04 (figlio B1), senza profilo a0..05
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
  ('c0000000-0000-0000-0000-000000000002', 'PgtapDue', 'Fittizio', 'd0000000-0000-0000-0000-000000000001', true),
  ('c0000000-0000-0000-0000-000000000003', 'PgtapTre', 'Fittizio', 'd0000000-0000-0000-0000-000000000002', true),
  ('c0000000-0000-0000-0000-000000000004', 'PgtapQuattro', 'Fittizio', 'd0000000-0000-0000-0000-000000000001', true),
  ('c0000000-0000-0000-0000-000000000005', 'PgtapCinque', 'Fittizio', 'd0000000-0000-0000-0000-000000000001', true),
  ('c0000000-0000-0000-0000-000000000006', 'PgtapSei', 'Fittizio', 'd0000000-0000-0000-0000-000000000001', false);

insert into public.maestre_sezioni (maestra_id, sezione_id) values
  ('a0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001');

insert into public.bambini_genitori (bambino_id, genitore_id) values
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004');

-- Costi (upsert: un eventuale trigger può aver già creato la riga). B2 resta
-- volutamente senza costi: si cancella l'eventuale riga di default.
-- Gli importi non hanno più default (0067, 0069): si scrivono tutti.
insert into public.costi_bambini
  (bambino_id, pre_asilo_richiesto, post_asilo_richiesto, prezzo_buono_pasto,
   prezzo_marca_da_bollo, prezzo_pre_asilo, prezzo_post_asilo, gettone_pre_asilo, gettone_post_asilo) values
  ('c0000000-0000-0000-0000-000000000001', true, false, 6, 2, 70, 70, 7, 7),
  ('c0000000-0000-0000-0000-000000000003', true, true, 6, 2, 70, 70, 7, 7),
  ('c0000000-0000-0000-0000-000000000004', true, false, 6, 2, 70, 70, 7, 7),
  ('c0000000-0000-0000-0000-000000000005', false, false, 6, 2, 70, 70, 7, 7),
  ('c0000000-0000-0000-0000-000000000006', true, false, 6, 2, 70, 70, 7, 7)
on conflict (bambino_id) do update
  set pre_asilo_richiesto = excluded.pre_asilo_richiesto,
      post_asilo_richiesto = excluded.post_asilo_richiesto;
delete from public.costi_bambini where bambino_id = 'c0000000-0000-0000-0000-000000000002';

insert into public.comunicazioni_retta
  (bambino_id, mese, retta_mensile, costo_pasti, conguaglio_pasti, costo_pre_asilo,
   costo_post_asilo, costi_extra, totale, email_destinatario, inviata_da_nome) values
  ('c0000000-0000-0000-0000-000000000004', '2030-03', 160, 0, 0, 0, 70, 0, 230,
   'pgtap@example.test', 'pgTAP'),
  ('c0000000-0000-0000-0000-000000000005', '2030-04', 160, 0, 0, 0, 0, 0, 160,
   'pgtap@example.test', 'pgTAP');

-- ---------------------------------------------------------------------
-- Proprietà di sicurezza e forma della risposta
-- ---------------------------------------------------------------------
select ok(
  (select p.prosecdef from pg_proc p where p.oid = 'public.copertura_pre_post_asilo(date)'::regprocedure),
  'copertura_pre_post_asilo: security definer');
select ok(
  (select coalesce(p.proconfig, '{}') @> array['search_path=""'] from pg_proc p
    where p.oid = 'public.copertura_pre_post_asilo(date)'::regprocedure),
  'copertura_pre_post_asilo: search_path fisso e vuoto');
select is(
  (select p.provolatile::text from pg_proc p where p.oid = 'public.copertura_pre_post_asilo(date)'::regprocedure),
  's', 'copertura_pre_post_asilo: stable (sola lettura)');
select ok(
  not has_function_privilege('anon', 'public.copertura_pre_post_asilo(date)', 'execute'),
  'copertura_pre_post_asilo: anon non ha EXECUTE');
select ok(
  has_function_privilege('authenticated', 'public.copertura_pre_post_asilo(date)', 'execute'),
  'copertura_pre_post_asilo: authenticated ha EXECUTE');
select is(
  (select p.proargnames from pg_proc p where p.oid = 'public.copertura_pre_post_asilo(date)'::regprocedure),
  array['p_data', 'bambino_id', 'pre_asilo_coperto', 'post_asilo_coperto', 'retta_successiva_inviata'],
  'la risposta contiene solo il sì/no (nessun prezzo, flag o colonna di costi_bambini)');

-- ---------------------------------------------------------------------
-- Contenuto per ruolo
-- ---------------------------------------------------------------------
select is(pg_temp.righe_as('a0000000-0000-0000-0000-000000000001', date '2030-03-12'),
  array['01|t|f|f', '02|f|f|f', '03|t|t|f', '04|f|t|f', '05|f|f|t'],
  'admin: tutti i bambini attivi; flag attuale senza retta (B1, B3), nessun costo = non coperto (B2), retta inviata vince sul flag (B4), retta successiva inviata (B5), inattivo escluso');
select is(pg_temp.righe_as('a0000000-0000-0000-0000-000000000002', date '2030-03-12'),
  array['01|t|f|f', '02|f|f|f', '04|f|t|f', '05|f|f|t'],
  'maestra: solo i bambini delle proprie sezioni (B3 di S2 non compare), anche su una data diversa da oggi');
select is(pg_temp.righe_as('a0000000-0000-0000-0000-000000000003', date '2030-03-12'),
  array['01|t|f|f', '02|f|f|f', '04|f|t|f', '05|f|f|t'],
  'assistente: come la maestra, solo le proprie sezioni');
select is(pg_temp.costi_visibili_as('a0000000-0000-0000-0000-000000000002'), 0,
  'maestra: costi_bambini resta illeggibile direttamente (solo la funzione dà il sì/no)');

-- ---------------------------------------------------------------------
-- Respinti
-- ---------------------------------------------------------------------
select is(pg_temp.esito_as('a0000000-0000-0000-0000-000000000004',
    'select * from public.copertura_pre_post_asilo(date ''2030-03-12'')'), '42501',
  'genitore (anche del bambino interessato): rifiutato');
select is(pg_temp.esito_as('a0000000-0000-0000-0000-000000000005',
    'select * from public.copertura_pre_post_asilo(date ''2030-03-12'')'), '42501',
  'utente senza profilo: rifiutato');
select is(pg_temp.esito_as(null, 'select * from public.copertura_pre_post_asilo(date ''2030-03-12'')'), '42501',
  'anonimo: rifiutato (nessun EXECUTE)');
select is(pg_temp.esito_as('a0000000-0000-0000-0000-000000000001',
    'select * from public.copertura_pre_post_asilo(null)'), '22004',
  'admin: data nulla rifiutata');

select * from finish();

rollback;
