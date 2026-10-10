-- Girasole — test pgTAP sul registro degli invii a Rojac, public.invii_rojac
-- (specs/61 - email-pasti-rojac.md, specs/03 - utenti-e-ruoli.md), e sul
-- vincolo di allarmi_inviati.tipo.
--
-- Comportamento fissato (migration 0062): registro in sola aggiunta; solo
-- l'admin legge (SELECT) e inserisce (INSERT, e solo a proprio nome);
-- nessuno aggiorna o cancella; maestra, assistente, genitore e anonimo non
-- leggono né scrivono; nessun privilegio per anon e service_role.
-- Il vincolo allarmi_inviati_tipo_check accetta anche `rojac_non_inviata`.
--
-- Tutto dentro una transazione chiusa da `rollback`. Dati fittizi
-- (email @example.test, mese 2031-01). Si esegue con `supabase test db` (in
-- CI: job `e2e`, dopo il reset del DB di test). Mai sulla produzione.
-- Stessa struttura e stessi helper di impostazioni_email_rojac.test.sql.

begin;

-- No-op se pgTAP è già installato (è il caso del progetto di test);
-- altrimenti viene creato e poi annullato dal rollback finale.
create extension if not exists pgtap with schema extensions;

-- La CLI remota si collega con un login role temporaneo (cli_login_postgres)
-- che può non ereditare i privilegi di `postgres` (es. USAGE sullo schema
-- delle estensioni): si prova a diventare `postgres` (stesso ruolo che fa
-- girare le migration) per questa sola transazione; se non è permesso si
-- prosegue col ruolo di partenza.
do $$
begin
  set local role postgres;
exception when others then
  raise notice 'set local role postgres non riuscito: % (%)', sqlerrm, sqlstate;
end;
$$;

-- La connessione di pg_prove NON ha lo schema delle estensioni nel
-- search_path: lo schema dove pgTAP è davvero installato si legge dal
-- catalogo e lo si mette nel search_path solo per questa transazione.
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

select plan(30);

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

-- Righe del mese di prova visibili a p_uid (un "permission denied" conta
-- come nessuna riga).
create function pg_temp.righe_as(p_uid uuid) returns int
language plpgsql as $$
declare
  v_prev text := current_user;
  v_n int;
begin
  perform pg_temp.impersona(p_uid);
  begin
    select count(*)::int into v_n from public.invii_rojac where mese = '2031-01';
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

-- RLS e policy ---------------------------------------------------------------
select ok(
  (select relrowsecurity from pg_class where oid = 'public.invii_rojac'::regclass),
  'invii_rojac: RLS attiva'
);
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'invii_rojac'),
  2,
  'invii_rojac: esattamente 2 policy (select e insert admin), nessun''altra'
);

-- Privilegi ------------------------------------------------------------------
select ok(not has_table_privilege('anon', 'public.invii_rojac', 'SELECT'), 'anon: nessun SELECT');
select ok(not has_table_privilege('anon', 'public.invii_rojac', 'INSERT'), 'anon: nessun INSERT');
select ok(has_table_privilege('authenticated', 'public.invii_rojac', 'SELECT'),
  'authenticated: ha SELECT (richiesto dalla policy admin_select)');
select ok(has_table_privilege('authenticated', 'public.invii_rojac', 'INSERT'),
  'authenticated: ha INSERT (richiesto dalla policy admin_insert)');
select ok(not has_table_privilege('authenticated', 'public.invii_rojac', 'UPDATE'),
  'authenticated: nessun UPDATE (registro in sola aggiunta)');
select ok(not has_table_privilege('authenticated', 'public.invii_rojac', 'DELETE'),
  'authenticated: nessun DELETE (registro in sola aggiunta)');
select ok(not has_table_privilege('service_role', 'public.invii_rojac', 'SELECT'),
  'service_role: nessun SELECT (il cron della parte b lo chiederà con la sua migration)');
select ok(not has_table_privilege('service_role', 'public.invii_rojac', 'INSERT'),
  'service_role: nessun INSERT');
select ok(not has_table_privilege('service_role', 'public.invii_rojac', 'UPDATE'),
  'service_role: nessun UPDATE');
select ok(not has_table_privilege('service_role', 'public.invii_rojac', 'DELETE'),
  'service_role: nessun DELETE');

-- INSERT: solo l'admin, solo a proprio nome ----------------------------------
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
    $q$insert into public.invii_rojac (mese, inviato_da) values ('2031-01', 'a0000000-0000-0000-0000-000000000001')$q$),
  'ok',
  'admin: INSERT a proprio nome consentito'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
    $q$insert into public.invii_rojac (mese, inviato_da) values ('2031-01', 'a0000000-0000-0000-0000-000000000002')$q$),
  '42501',
  'admin: INSERT a nome di un altro utente bloccato dalla RLS'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
    $q$insert into public.invii_rojac (mese) values ('2031-01')$q$),
  '42501',
  'admin: INSERT senza autore bloccato dalla RLS'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000002',
    $q$insert into public.invii_rojac (mese, inviato_da) values ('2031-01', 'a0000000-0000-0000-0000-000000000002')$q$),
  '42501',
  'maestra: INSERT bloccato dalla RLS'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000003',
    $q$insert into public.invii_rojac (mese, inviato_da) values ('2031-01', 'a0000000-0000-0000-0000-000000000003')$q$),
  '42501',
  'assistente: INSERT bloccato dalla RLS'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000004',
    $q$insert into public.invii_rojac (mese, inviato_da) values ('2031-01', 'a0000000-0000-0000-0000-000000000004')$q$),
  '42501',
  'genitore: INSERT bloccato dalla RLS'
);
select is(
  pg_temp.write_as(null, $q$insert into public.invii_rojac (mese) values ('2031-01')$q$),
  '42501',
  'anonimo: INSERT negato'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
    $q$insert into public.invii_rojac (mese, inviato_da) values ('2031-13', 'a0000000-0000-0000-0000-000000000001')$q$),
  '23514',
  'admin: un mese non valido è rifiutato dal vincolo sul formato'
);

-- SELECT: solo l'admin legge (resta la sola riga dell'admin) -----------------
select is(pg_temp.righe_as('a0000000-0000-0000-0000-000000000001'), 1, 'admin: legge il registro');
select is(pg_temp.righe_as('a0000000-0000-0000-0000-000000000002'), 0, 'maestra: non legge nulla');
select is(pg_temp.righe_as('a0000000-0000-0000-0000-000000000003'), 0, 'assistente: non legge nulla');
select is(pg_temp.righe_as('a0000000-0000-0000-0000-000000000004'), 0, 'genitore: non legge nulla');
select is(pg_temp.righe_as(null), 0, 'anonimo: non legge nulla');

-- UPDATE e DELETE: nessuno, nemmeno l'admin ----------------------------------
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
    $q$update public.invii_rojac set mese = '2031-02' where mese = '2031-01'$q$),
  '42501',
  'admin: UPDATE negato (registro in sola aggiunta)'
);
select is(
  pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
    $q$delete from public.invii_rojac where mese = '2031-01'$q$),
  '42501',
  'admin: DELETE negato (registro in sola aggiunta)'
);

-- allarmi_inviati.tipo: il vincolo accetta il nuovo valore e i vecchi --------
select lives_ok(
  $q$insert into public.allarmi_inviati (tipo, chiave) values ('rojac_non_inviata', 'pgtap-2031-01')$q$,
  'allarmi_inviati: accetta il tipo rojac_non_inviata'
);
select lives_ok(
  $q$insert into public.allarmi_inviati (tipo, chiave) values ('rette_non_comunicate', 'pgtap-2031-01')$q$,
  'allarmi_inviati: accetta ancora rette_non_comunicate'
);
select throws_ok(
  $q$insert into public.allarmi_inviati (tipo, chiave) values ('tipo_inesistente', 'pgtap-2031-01')$q$,
  '23514',
  null,
  'allarmi_inviati: un tipo sconosciuto è rifiutato dal vincolo'
);

select * from finish();

rollback;
