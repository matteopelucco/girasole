-- Girasole — test pgTAP sulle policy RLS di public.profili_orari
-- (issue #180, sotto-issue "a" di #29; specs/54 - profili-orari.md,
-- specs/03 - utenti-e-ruoli.md).
--
-- Perché esiste: 0024_profili_orari.sql aveva la select "solo admin", e la
-- RLS non dà errore ma restituisce ZERO righe: ogni maestra/assistente
-- vedeva "0 ore ordinarie" invece del proprio profilo, e l'unico e2e
-- (che gira come admin) non se ne accorgeva. 0030 ha aggiunto
-- `profili_orari_select_own`. Questo file fissa il comportamento per ruolo
-- e dimostra che il caso 0030 passa SOLO con quella policy.
--
-- Tutto dentro una transazione chiusa da `rollback`: utenti, profili e
-- profili orari qui sotto esistono solo per la durata del test. Dati
-- chiaramente fittizi (email @example.test), nessun dato reale.
-- Si esegue con `supabase test db` (in CI: job `e2e`, dopo il reset del DB
-- di test). Mai sulla produzione.

begin;

-- No-op se pgTAP è già installato (è il caso del progetto di test);
-- altrimenti viene creato e poi annullato dal rollback finale.
create extension if not exists pgtap with schema extensions;

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

select plan(13);

-- ---------------------------------------------------------------------
-- Helper (temporanei: spariscono con la transazione)
-- ---------------------------------------------------------------------

-- Impersona un utente autenticato, come fa PostgREST con un JWT valido:
-- ruolo `authenticated` + claim `sub` letto da auth.uid().
create function pg_temp.act_as(p_uid uuid) returns void
language plpgsql as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text,
    true
  );
  perform set_config('role', 'authenticated', true);
end;
$$;

-- Impersona un visitatore non autenticato (chiave anon, nessun `sub`).
create function pg_temp.act_as_anon() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end;
$$;

-- Righe di profili_orari visibili al ruolo corrente. Un "permission
-- denied" conta come zero righe: per questi test conta solo che il dato
-- non sia leggibile.
create function pg_temp.n_visibili() returns int
language plpgsql as $$
begin
  return (select count(*) from public.profili_orari)::int;
exception when insufficient_privilege then
  return 0;
end;
$$;

-- ---------------------------------------------------------------------
-- Fixture (costruite come ruolo del test, con bypass RLS)
-- ---------------------------------------------------------------------
-- Il trigger on_auth_user_created (handle_new_user) crea il profilo
-- leggendo `ruolo` da raw_user_meta_data.
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-0000-0000-000000000001', 'pgtap.admin@example.test', '{"ruolo":"admin"}'),
  ('a0000000-0000-0000-0000-000000000002', 'pgtap.maestra@example.test', '{"ruolo":"maestra"}'),
  ('a0000000-0000-0000-0000-000000000003', 'pgtap.assistente@example.test', '{"ruolo":"assistente"}'),
  ('a0000000-0000-0000-0000-000000000004', 'pgtap.maestra-senza@example.test', '{"ruolo":"maestra"}'),
  ('a0000000-0000-0000-0000-000000000005', 'pgtap.genitore@example.test', '{"ruolo":"genitore"}');

insert into public.profili_orari (id, nome, ore_lunedi, ore_martedi, ore_mercoledi, ore_giovedi, ore_venerdi) values
  ('b0000000-0000-0000-0000-00000000000a', 'pgTAP profilo A', 7, 7, 7, 7, 7),
  ('b0000000-0000-0000-0000-00000000000b', 'pgTAP profilo B', 3, 3, 3, 3, 3);

update public.profili set profilo_orario_id = 'b0000000-0000-0000-0000-00000000000a'
  where id = 'a0000000-0000-0000-0000-000000000002';  -- maestra -> A
update public.profili set profilo_orario_id = 'b0000000-0000-0000-0000-00000000000b'
  where id = 'a0000000-0000-0000-0000-000000000003';  -- assistente -> B

-- ---------------------------------------------------------------------
-- Le policy attese esistono
-- ---------------------------------------------------------------------
select policy_exists('public', 'profili_orari', 'profili_orari_admin_all',
  'esiste la policy profili_orari_admin_all');
select policy_exists('public', 'profili_orari', 'profili_orari_select_own',
  'esiste la policy profili_orari_select_own (fix 0030)');

-- ---------------------------------------------------------------------
-- Admin: legge tutto
-- ---------------------------------------------------------------------
select pg_temp.act_as('a0000000-0000-0000-0000-000000000001');
select is(
  (select count(*)::int from public.profili_orari
    where id in ('b0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b')),
  2,
  'admin: legge entrambi i profili orari, anche non assegnati a lui'
);
reset role;

-- ---------------------------------------------------------------------
-- Staff: legge SOLO il profilo assegnato (caso 0030)
-- ---------------------------------------------------------------------
select pg_temp.act_as('a0000000-0000-0000-0000-000000000002');
select is(
  (select array_agg(id order by id) from public.profili_orari),
  array['b0000000-0000-0000-0000-00000000000a']::uuid[],
  'maestra: legge solo il proprio profilo (A), non quello di altri'
);
reset role;

select pg_temp.act_as('a0000000-0000-0000-0000-000000000003');
select is(
  (select array_agg(id order by id) from public.profili_orari),
  array['b0000000-0000-0000-0000-00000000000b']::uuid[],
  'assistente: legge solo il proprio profilo (B), non quello di altri'
);
reset role;

-- ---------------------------------------------------------------------
-- Senza profilo assegnato, genitore, anonimo: non leggono nulla
-- ---------------------------------------------------------------------
select pg_temp.act_as('a0000000-0000-0000-0000-000000000004');
select is(pg_temp.n_visibili(), 0, 'maestra senza profilo assegnato: non legge nulla');
reset role;

select pg_temp.act_as('a0000000-0000-0000-0000-000000000005');
select is(pg_temp.n_visibili(), 0, 'genitore: non legge nulla');
reset role;

select pg_temp.act_as_anon();
select is(pg_temp.n_visibili(), 0, 'anonimo: non legge nulla');
reset role;

-- ---------------------------------------------------------------------
-- Lo staff non scrive (la policy select_own è solo SELECT)
-- ---------------------------------------------------------------------
select pg_temp.act_as('a0000000-0000-0000-0000-000000000002');
select throws_ok(
  $$insert into public.profili_orari (nome) values ('pgTAP abusivo')$$,
  '42501',
  null,
  'maestra: non può inserire un profilo orario'
);
-- UPDATE e DELETE non danno errore: la RLS li riduce a zero righe.
update public.profili_orari set nome = 'pgTAP manomesso';
delete from public.profili_orari;
reset role;

select is(
  (select count(*)::int from public.profili_orari
    where (id, nome) in (
      ('b0000000-0000-0000-0000-00000000000a', 'pgTAP profilo A'),
      ('b0000000-0000-0000-0000-00000000000b', 'pgTAP profilo B')
    )),
  2,
  'maestra: update e delete non hanno modificato né eliminato i profili'
);

-- ---------------------------------------------------------------------
-- Regressione 0030: SENZA profili_orari_select_own lo staff vede zero righe
-- ---------------------------------------------------------------------
-- Il drop vive solo in questa transazione (rollback in fondo). Se la policy
-- mancasse davvero dallo schema, sia il test di esistenza sopra sia le
-- letture "proprio profilo" sopra fallirebbero.
drop policy "profili_orari_select_own" on public.profili_orari;

select pg_temp.act_as('a0000000-0000-0000-0000-000000000002');
select is(pg_temp.n_visibili(), 0,
  '0030: senza select_own la maestra legge zero righe (il bug originale)');
reset role;

select pg_temp.act_as('a0000000-0000-0000-0000-000000000003');
select is(pg_temp.n_visibili(), 0,
  '0030: senza select_own l''assistente legge zero righe (il bug originale)');
reset role;

select pg_temp.act_as('a0000000-0000-0000-0000-000000000001');
select is(pg_temp.n_visibili() >= 2, true,
  '0030: senza select_own l''admin legge comunque (profili_orari_admin_all)');
reset role;

select * from finish();

rollback;
