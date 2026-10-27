-- Girasole — test pgTAP sulla colonna profili.richiedi_conferma_settimana
-- (issue #383; specs/03 - utenti-e-ruoli.md, specs/07 - allarmi.md).
--
-- Perché esiste: la colonna decide se i controlli degli allarmi saltano la
-- conferma settimanale di un utente. Non ha policy proprie (le eredita da
-- `profili`), quindi qui si fissa che:
--   * il valore di partenza è true e la colonna è NOT NULL (le righe già
--     presenti e i nuovi utenti non cambiano comportamento);
--   * solo l'admin la modifica: la maestra non riesce a cambiarla, nemmeno
--     per il proprio profilo (la RLS non dà errore, aggiorna zero righe).
--
-- Tutto dentro una transazione chiusa da `rollback`. Dati fittizi
-- (email @example.test). Si esegue con `supabase test db` (in CI: job `e2e`,
-- dopo il reset del DB di test). Mai sulla produzione.

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

select plan(5);

-- Esegue come p_uid (authenticated) un comando di UPDATE e ne dà il numero di
-- righe modificate (-1 se il database rifiuta per privilegi). Poi ripristina
-- il ruolo di partenza.
create function pg_temp.aggiorna_as(p_uid uuid, p_sql text) returns integer
language plpgsql as $$
declare
  v_prev text := current_user;
  v_righe integer;
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text,
    true
  );
  perform set_config('role', 'authenticated', true);
  begin
    execute p_sql;
    get diagnostics v_righe = row_count;
  exception when insufficient_privilege then
    v_righe := -1;
  end;
  perform set_config('role', v_prev, true);
  return v_righe;
end;
$$;

--   ...0001 admin | ...0002 maestra
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-0000-0000-000000000001', 'pgtap.admin@example.test', '{"ruolo":"admin"}'),
  ('a0000000-0000-0000-0000-000000000002', 'pgtap.maestra@example.test', '{"ruolo":"maestra"}');

-- Colonna NOT NULL con default true.
select is(
  (select is_nullable || '/' || column_default
     from information_schema.columns
    where table_schema = 'public' and table_name = 'profili' and column_name = 'richiedi_conferma_settimana'),
  'NO/true',
  'la colonna è NOT NULL con default true'
);

-- Un profilo nuovo parte con l'opzione attiva.
select is(
  (select richiedi_conferma_settimana from public.profili where id = 'a0000000-0000-0000-0000-000000000002'),
  true,
  'un profilo nuovo ha richiedi_conferma_settimana = true'
);

-- La maestra non riesce a modificarla (zero righe: la policy di update è solo admin).
select is(
  pg_temp.aggiorna_as(
    'a0000000-0000-0000-0000-000000000002',
    $q$update public.profili set richiedi_conferma_settimana = false
        where id = 'a0000000-0000-0000-0000-000000000002'$q$
  ),
  0,
  'maestra: non modifica richiedi_conferma_settimana nemmeno sul proprio profilo'
);
select is(
  (select richiedi_conferma_settimana from public.profili where id = 'a0000000-0000-0000-0000-000000000002'),
  true,
  'il valore è rimasto true dopo il tentativo della maestra'
);

-- L'admin la modifica.
select is(
  pg_temp.aggiorna_as(
    'a0000000-0000-0000-0000-000000000001',
    $q$update public.profili set richiedi_conferma_settimana = false
        where id = 'a0000000-0000-0000-0000-000000000002'$q$
  ),
  1,
  'admin: modifica richiedi_conferma_settimana di un altro utente'
);

select * from finish();

rollback;
