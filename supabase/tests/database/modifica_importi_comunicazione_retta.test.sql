-- Girasole — test pgTAP sulla modifica degli importi di una retta già inviata
-- (issue #421; specs/60 - pagamenti-bambino.md, scenari PAG-05, PAG-06, PAG-07,
-- PAG-08, PAG-09, PAG-14; migration 0074).
--
-- Comportamento fissato dalla migration 0074:
--   * tabella `modifiche_comunicazioni_retta`: storico in sola aggiunta, RLS con
--     una sola policy (select solo admin), nessun privilegio di scrittura a
--     nessun ruolo API, `on delete cascade` dalla comunicazione;
--   * funzione `modifica_importi_comunicazione_retta`: solo admin (maestra,
--     assistente, genitore e anonimo respinti con 42501), rifiuta bonifico già
--     verificato (55000), dati non validi e nessuna modifica (22023),
--     ricalcola il totale come somma delle dieci voci, tiene il totale della
--     mail originale, scrive lo storico nella stessa transazione (tutto o nulla).
--
-- Tutto dentro una transazione chiusa da `rollback`. Dati fittizi. Si esegue
-- con `supabase test db`. Mai sulla produzione.

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

select plan(49);

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
-- ('ok' se non ne ha dati; UPDATE/DELETE bloccati dalla RLS non danno errore
-- ma zero righe). Il blocco con exception è un subtransaction: se lo
-- statement fallisce, tutto ciò che ha scritto torna indietro.
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

-- Numero di righe dello storico visibili a p_uid (un "permission denied"
-- conta come nessuna riga).
create function pg_temp.storico_visibile_as(p_uid uuid) returns integer
language plpgsql as $$
declare
  v_prev text := current_user;
  v_n integer;
begin
  perform pg_temp.impersona(p_uid);
  begin
    select count(*)::integer into v_n from public.modifiche_comunicazioni_retta;
  exception when insufficient_privilege then
    v_n := 0;
  end;
  perform set_config('role', v_prev, true);
  return v_n;
end;
$$;

-- Chiamata alla funzione. Voci fisse: bollo 2, conguaglio 0, post-asilo 0,
-- gettoni 21 e 0, costi extra 0; note: nessuna e "Rimborso".
create function pg_temp.mod_sql(
  p_id uuid, p_motivo text, p_retta text, p_pasti text, p_pre text, p_credito text
) returns text
language sql as $$
  select format(
    $q$select public.modifica_importi_comunicazione_retta(
         %L, %L, %s, 2, %s, 0, %s, 0, 21, 0, 0, %s, null, 'Rimborso')$q$,
    p_id, p_motivo, p_retta, p_pasti, p_pre, p_credito
  );
$$;

-- Fixture ------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-0000-0000-000000000001', 'pgtap.admin@example.test', '{"ruolo":"admin"}'),
  ('a0000000-0000-0000-0000-000000000002', 'pgtap.maestra@example.test', '{"ruolo":"maestra"}'),
  ('a0000000-0000-0000-0000-000000000003', 'pgtap.assistente@example.test', '{"ruolo":"assistente"}'),
  ('a0000000-0000-0000-0000-000000000004', 'pgtap.genitore@example.test', '{"ruolo":"genitore"}');

insert into public.sezioni (id, nome) values
  ('d0000000-0000-0000-0000-000000000001', 'pgTAP S1');

insert into public.bambini (id, nome, cognome, sezione_id) values
  ('c0000000-0000-0000-0000-000000000001', 'PgtapUno', 'Fittizio', 'd0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000002', 'PgtapDue', 'Fittizio', 'd0000000-0000-0000-0000-000000000001');

insert into public.bambini_genitori (bambino_id, genitore_id) values
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004');

-- E1 (modificabile): 250 + 2 + 108 + 0 + 70 + 0 + 21 + 0 + 0 - 20 = 431.
-- E2 (bonifico già verificato), stessi importi. Mese lontano nel futuro.
insert into public.comunicazioni_retta
  (id, bambino_id, mese, retta_mensile, marca_da_bollo, costo_pasti, conguaglio_pasti,
   costo_pre_asilo, costo_post_asilo, gettoni_pre_asilo, numero_gettoni_pre_asilo,
   costi_extra, credito_debito, nota_credito_debito, totale,
   email_destinatario, inviata_da_nome, inviata_il, bonifico_stato)
values
  ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '2099-01',
   250, 2, 108, 0, 70, 0, 21, 3, 0, -20, 'Rimborso', 431,
   'pgtap.destinatario1@example.test', 'pgTAP', '2099-01-05 10:00:00+00', 'in_attesa'),
  ('e0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', '2099-01',
   250, 2, 108, 0, 70, 0, 21, 3, 0, -20, 'Rimborso', 431,
   'pgtap.destinatario2@example.test', 'pgTAP', '2099-01-05 10:00:00+00', 'corretto');

-- =========================================================================
-- Schema, RLS e privilegi della tabella di storico
-- =========================================================================
select has_table('public', 'modifiche_comunicazioni_retta', 'esiste la tabella dello storico');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.modifiche_comunicazioni_retta'::regclass),
  'storico: RLS attiva'
);
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'modifiche_comunicazioni_retta'),
  1,
  'storico: una sola policy'
);
select ok(
  exists (select 1 from pg_policies
           where schemaname = 'public' and tablename = 'modifiche_comunicazioni_retta'
             and policyname = 'modifiche_comunicazioni_retta_admin_select' and cmd = 'SELECT'),
  'storico: la policy è la select solo admin'
);
select ok(has_table_privilege('authenticated', 'public.modifiche_comunicazioni_retta', 'select'),
  'storico: authenticated ha select');
select ok(
  not has_table_privilege('authenticated', 'public.modifiche_comunicazioni_retta', 'insert')
  and not has_table_privilege('authenticated', 'public.modifiche_comunicazioni_retta', 'update')
  and not has_table_privilege('authenticated', 'public.modifiche_comunicazioni_retta', 'delete'),
  'storico: authenticated non ha insert, update, delete'
);
select ok(
  not has_table_privilege('anon', 'public.modifiche_comunicazioni_retta', 'select')
  and not has_table_privilege('anon', 'public.modifiche_comunicazioni_retta', 'insert'),
  'storico: anon non ha privilegi'
);
select ok(
  not has_table_privilege('service_role', 'public.modifiche_comunicazioni_retta', 'select')
  and not has_table_privilege('service_role', 'public.modifiche_comunicazioni_retta', 'insert')
  and not has_table_privilege('service_role', 'public.modifiche_comunicazioni_retta', 'update')
  and not has_table_privilege('service_role', 'public.modifiche_comunicazioni_retta', 'delete'),
  'storico: service_role non ha privilegi'
);

-- =========================================================================
-- Funzione: privilegi di esecuzione
-- =========================================================================
select ok(
  has_function_privilege('authenticated',
    'public.modifica_importi_comunicazione_retta(uuid, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, text, text)',
    'execute'),
  'funzione: authenticated può eseguirla'
);
select ok(
  not has_function_privilege('anon',
    'public.modifica_importi_comunicazione_retta(uuid, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, text, text)',
    'execute'),
  'funzione: anon non può eseguirla'
);

-- =========================================================================
-- Non admin: né eseguono la funzione né leggono/scrivono lo storico
-- =========================================================================
select is(pg_temp.write_as('a0000000-0000-0000-0000-000000000002',
  pg_temp.mod_sql('e0000000-0000-0000-0000-000000000001', 'x', '260', '108', '70', '-20')),
  '42501', 'maestra: la funzione la respinge');
select is(pg_temp.write_as('a0000000-0000-0000-0000-000000000003',
  pg_temp.mod_sql('e0000000-0000-0000-0000-000000000001', 'x', '260', '108', '70', '-20')),
  '42501', 'assistente: la funzione la respinge');
select is(pg_temp.write_as('a0000000-0000-0000-0000-000000000004',
  pg_temp.mod_sql('e0000000-0000-0000-0000-000000000001', 'x', '260', '108', '70', '-20')),
  '42501', 'genitore: la funzione lo respinge');
select is(pg_temp.write_as(null,
  pg_temp.mod_sql('e0000000-0000-0000-0000-000000000001', 'x', '260', '108', '70', '-20')),
  '42501', 'anonimo: la funzione lo respinge');
select is(
  (select totale from public.comunicazioni_retta where id = 'e0000000-0000-0000-0000-000000000001'),
  431.00::numeric, 'dopo i tentativi dei non admin il totale è invariato');
select is((select count(*)::int from public.modifiche_comunicazioni_retta), 0,
  'dopo i tentativi dei non admin lo storico è vuoto');

-- =========================================================================
-- Admin: dati non validi e bonifico verificato non cambiano nulla
-- =========================================================================
select is(pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
  pg_temp.mod_sql('e0000000-0000-0000-0000-000000000001', '   ', '260', '108', '70', '-20')),
  '22023', 'admin: motivo vuoto rifiutato');
select is(pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
  pg_temp.mod_sql('e0000000-0000-0000-0000-000000000001', 'x', '-1', '108', '70', '-20')),
  '22023', 'admin: retta negativa rifiutata');
select is(pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
  pg_temp.mod_sql('e0000000-0000-0000-0000-000000000001', 'x', '260', '108.123', '70', '-20')),
  '22023', 'admin: tre decimali rifiutati');
select is(pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
  pg_temp.mod_sql('e0000000-0000-0000-0000-000000000001', 'x', '1000000', '108', '70', '-20')),
  '22023', 'admin: importo troppo grande rifiutato');
select is(pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
  pg_temp.mod_sql('e0000000-0000-0000-0000-000000000001', 'x', '250', '108', '70', '-20')),
  '22023', 'admin: nessuna modifica rifiutata');
select is(pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
  pg_temp.mod_sql('e0000000-0000-0000-0000-000000000009', 'x', '260', '108', '70', '-20')),
  'P0002', 'admin: comunicazione inesistente');
select is(pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
  pg_temp.mod_sql('e0000000-0000-0000-0000-000000000002', 'x', '260', '108', '70', '-20')),
  '55000', 'admin: con il bonifico verificato rifiuta');
select is(
  (select totale from public.comunicazioni_retta where id = 'e0000000-0000-0000-0000-000000000002'),
  431.00::numeric, 'bonifico verificato: il totale non cambia');
select is((select count(*)::int from public.modifiche_comunicazioni_retta), 0,
  'dopo i rifiuti lo storico è ancora vuoto');
select is(
  (select modificata_il is null and totale_mail is null
     from public.comunicazioni_retta where id = 'e0000000-0000-0000-0000-000000000001'),
  true, 'dopo i rifiuti la comunicazione non risulta modificata');

-- =========================================================================
-- Admin: modifica valida (pasti 108 -> 100, credito -20 -> -50)
-- =========================================================================
select is(pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
  pg_temp.mod_sql('e0000000-0000-0000-0000-000000000001', '  Errore nei pasti  ', '250', '100', '70', '-50')),
  'ok', 'admin: la modifica valida riesce');
select is(
  (select totale from public.comunicazioni_retta where id = 'e0000000-0000-0000-0000-000000000001'),
  393.00::numeric, 'il totale è la somma delle voci (431 - 8 - 30)');
select is(
  (select totale_mail from public.comunicazioni_retta where id = 'e0000000-0000-0000-0000-000000000001'),
  431.00::numeric, 'il totale della mail è quello di prima');
select ok(
  (select modificata_il is not null and modificata_da_nome <> ''
     from public.comunicazioni_retta where id = 'e0000000-0000-0000-0000-000000000001'),
  'la comunicazione ricorda quando e da chi è stata modificata');
select ok(
  (select inviata_il = '2099-01-05 10:00:00+00'::timestamptz
          and numero_gettoni_pre_asilo = 3
          and email_destinatario = 'pgtap.destinatario1@example.test'
          and bonifico_stato = 'in_attesa'
     from public.comunicazioni_retta where id = 'e0000000-0000-0000-0000-000000000001'),
  'inviata_il, gettoni, destinatario e bonifico non cambiano');
select is((select count(*)::int from public.modifiche_comunicazioni_retta), 1,
  'lo storico ha una riga');
select is(
  (select motivo from public.modifiche_comunicazioni_retta),
  'Errore nei pasti', 'il motivo è salvato senza spazi ai bordi');
select is(
  (select array_agg(k order by k) from public.modifiche_comunicazioni_retta, jsonb_object_keys(modifiche) as k),
  array['costo_pasti', 'credito_debito'],
  'lo storico contiene le sole voci cambiate');
select ok(
  (select (modifiche->'costo_pasti'->>'prima')::numeric = 108
      and (modifiche->'costo_pasti'->>'dopo')::numeric = 100
      and totale_prima = 431 and totale_dopo = 393
     from public.modifiche_comunicazioni_retta),
  'lo storico ha valori prima e dopo e i totali');

-- Seconda modifica: il totale della mail resta quello originale.
select is(pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
  pg_temp.mod_sql('e0000000-0000-0000-0000-000000000001', 'Secondo errore', '260', '100', '70', '-50')),
  'ok', 'admin: una seconda modifica riesce');
select is(
  (select totale_mail from public.comunicazioni_retta where id = 'e0000000-0000-0000-0000-000000000001'),
  431.00::numeric, 'con più modifiche il totale della mail resta quello originale');
select is((select count(*)::int from public.modifiche_comunicazioni_retta), 2,
  'lo storico ha due righe');

-- =========================================================================
-- Lettura e scrittura dello storico per ruolo
-- =========================================================================
select is(pg_temp.storico_visibile_as('a0000000-0000-0000-0000-000000000001'), 2, 'admin: legge lo storico');
select is(pg_temp.storico_visibile_as('a0000000-0000-0000-0000-000000000002'), 0, 'maestra: non legge lo storico');
select is(pg_temp.storico_visibile_as('a0000000-0000-0000-0000-000000000003'), 0, 'assistente: non legge lo storico');
select is(pg_temp.storico_visibile_as('a0000000-0000-0000-0000-000000000004'), 0, 'genitore: non legge lo storico');
select is(pg_temp.storico_visibile_as(null), 0, 'anonimo: non legge lo storico');
select isnt(pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
  $$insert into public.modifiche_comunicazioni_retta
      (comunicazione_id, modificata_da_nome, motivo, totale_prima, totale_dopo, modifiche)
    values ('e0000000-0000-0000-0000-000000000001', 'x', 'x', 1, 2, '{"a":1}')$$),
  'ok', 'admin: non può scrivere nello storico dall''app');
select isnt(pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
  $$update public.modifiche_comunicazioni_retta set motivo = 'cambiato'$$),
  'ok', 'admin: non può aggiornare lo storico dall''app');
select isnt(pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
  $$delete from public.modifiche_comunicazioni_retta$$),
  'ok', 'admin: non può cancellare lo storico dall''app');

-- =========================================================================
-- Tutto o niente: se lo storico non si scrive, la retta non cambia
-- =========================================================================
create function public.pgtap_blocca_storico() returns trigger
language plpgsql as $$
begin
  raise exception 'storico bloccato dal test' using errcode = 'P0001';
end;
$$;
create trigger pgtap_blocca_storico before insert on public.modifiche_comunicazioni_retta
  for each row execute function public.pgtap_blocca_storico();

select is(pg_temp.write_as('a0000000-0000-0000-0000-000000000001',
  pg_temp.mod_sql('e0000000-0000-0000-0000-000000000001', 'Terzo', '270', '100', '70', '-50')),
  'P0001', 'atomicità: se lo storico fallisce la funzione fallisce');
select is(
  (select totale from public.comunicazioni_retta where id = 'e0000000-0000-0000-0000-000000000001'),
  403.00::numeric, 'atomicità: la retta non ha preso la terza modifica (resta 403)');

drop trigger pgtap_blocca_storico on public.modifiche_comunicazioni_retta;

-- =========================================================================
-- "Annulla invio": la retta e il suo storico spariscono
-- =========================================================================
delete from public.comunicazioni_retta where id = 'e0000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.modifiche_comunicazioni_retta), 0,
  'cancellando la retta sparisce anche lo storico (on delete cascade)');

select * from finish();

rollback;
