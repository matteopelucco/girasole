-- Girasole — test pgTAP sui gettoni nella retta mensile (issue #400, parte di #401;
-- specs/56 - comunicazione-retta-mensile.md: RET-06, RET-09, RET-10, RET-11).
--
-- Comportamento atteso dalla migration di questa funzione:
--   * `comunicazioni_retta` ha quattro colonne nuove:
--       gettoni_pre_asilo, gettoni_post_asilo      numeric(8,2) not null default 0, >= 0
--       numero_gettoni_pre_asilo, numero_gettoni_post_asilo   integer not null default 0, >= 0
--     le righe esistenti restano a 0 (RET-06);
--   * `impostazioni_email_retta` (modello salvato) e il valore predefinito della colonna
--     `corpo` (modello predefinito) contengono, UNA volta sola, le righe
--     «Gettoni pre-asilo (mese precedente): € {{gettoni_pre_asilo}}» e quella post-asilo,
--     subito dopo la riga del conguaglio pasti e prima del totale (RET-09); il resto
--     del testo non cambia (RET-09);
--   * la migration è idempotente (RET-10): qui si verifica che dopo il reset (tutte
--     le migration applicate una volta) ogni segnaposto compaia una sola volta, nessun
--     duplicato. Riapplicare la migration a mano non è automatizzabile in pgTAP.
--
-- Si esegue con `supabase test db` subito DOPO il reset del DB di test e PRIMA degli e2e
-- (che sovrascrivono il modello salvato): il modello salvato è quindi ancora quello delle
-- migration. Tutto in una transazione chiusa da `rollback`; dati fittizi. Mai in produzione.

begin;

create extension if not exists pgtap with schema extensions;

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

select plan(23);

-- Colonne nuove di comunicazioni_retta ---------------------------------------
select col_type_is('public', 'comunicazioni_retta', 'gettoni_pre_asilo', 'numeric(8,2)', 'gettoni_pre_asilo e numeric(8,2)');
select col_type_is('public', 'comunicazioni_retta', 'gettoni_post_asilo', 'numeric(8,2)', 'gettoni_post_asilo e numeric(8,2)');
select col_type_is('public', 'comunicazioni_retta', 'numero_gettoni_pre_asilo', 'integer', 'numero_gettoni_pre_asilo e integer');
select col_type_is('public', 'comunicazioni_retta', 'numero_gettoni_post_asilo', 'integer', 'numero_gettoni_post_asilo e integer');

select col_not_null('public', 'comunicazioni_retta', 'gettoni_pre_asilo', 'gettoni_pre_asilo not null');
select col_not_null('public', 'comunicazioni_retta', 'gettoni_post_asilo', 'gettoni_post_asilo not null');
select col_not_null('public', 'comunicazioni_retta', 'numero_gettoni_pre_asilo', 'numero_gettoni_pre_asilo not null');
select col_not_null('public', 'comunicazioni_retta', 'numero_gettoni_post_asilo', 'numero_gettoni_post_asilo not null');

select col_default_is('public', 'comunicazioni_retta', 'gettoni_pre_asilo', '0', 'gettoni_pre_asilo default 0');
select col_default_is('public', 'comunicazioni_retta', 'gettoni_post_asilo', '0', 'gettoni_post_asilo default 0');
select col_default_is('public', 'comunicazioni_retta', 'numero_gettoni_pre_asilo', '0', 'numero_gettoni_pre_asilo default 0');
select col_default_is('public', 'comunicazioni_retta', 'numero_gettoni_post_asilo', '0', 'numero_gettoni_post_asilo default 0');

-- Una retta inserita senza le colonne nuove (come quelle di prima) ha 0 e 0 (RET-06).
insert into public.bambini (id, nome, cognome) values
  ('c0000000-0000-0000-0000-0000000000a1', 'PgtapGettoni', 'Fittizio');

insert into public.comunicazioni_retta
  (bambino_id, mese, retta_mensile, costo_pasti, conguaglio_pasti, costo_pre_asilo, costo_post_asilo,
   costi_extra, totale, email_destinatario, inviata_da_nome)
values
  ('c0000000-0000-0000-0000-0000000000a1', '2099-01', 100, 0, 0, 0, 0, 0, 100,
   'pgtap.gettoni@example.test', 'pgTAP');

select is(
  (select format('%s|%s|%s|%s', gettoni_pre_asilo, gettoni_post_asilo, numero_gettoni_pre_asilo, numero_gettoni_post_asilo)
     from public.comunicazioni_retta where bambino_id = 'c0000000-0000-0000-0000-0000000000a1'),
  '0.00|0.00|0|0',
  'una retta senza gettoni ha importi 0,00 e numeri 0'
);

-- Non negativi.
select throws_ok(
  $$update public.comunicazioni_retta set gettoni_pre_asilo = -1 where bambino_id = 'c0000000-0000-0000-0000-0000000000a1'$$,
  '23514', null, 'l''importo dei gettoni non puo essere negativo'
);
select throws_ok(
  $$update public.comunicazioni_retta set numero_gettoni_post_asilo = -1 where bambino_id = 'c0000000-0000-0000-0000-0000000000a1'$$,
  '23514', null, 'il numero di gettoni non puo essere negativo'
);

-- Modello email salvato (RET-09, RET-10) -------------------------------------
select is(
  (select (length(corpo) - length(replace(corpo, '{{gettoni_pre_asilo}}', ''))) / length('{{gettoni_pre_asilo}}')
     from public.impostazioni_email_retta where id),
  1,
  'modello salvato: {{gettoni_pre_asilo}} compare una sola volta'
);
select is(
  (select (length(corpo) - length(replace(corpo, '{{gettoni_post_asilo}}', ''))) / length('{{gettoni_post_asilo}}')
     from public.impostazioni_email_retta where id),
  1,
  'modello salvato: {{gettoni_post_asilo}} compare una sola volta'
);
select ok(
  (select corpo like '%Gettoni pre-asilo (mese precedente): € {{gettoni_pre_asilo}}%'
     from public.impostazioni_email_retta where id),
  'modello salvato: riga dei gettoni pre-asilo con il testo previsto'
);
select ok(
  (select strpos(corpo, '{{conguaglio_pasti}}') < strpos(corpo, '{{gettoni_pre_asilo}}')
      and strpos(corpo, '{{gettoni_pre_asilo}}') < strpos(corpo, '{{gettoni_post_asilo}}')
      and strpos(corpo, '{{gettoni_post_asilo}}') < strpos(corpo, '{{totale}}')
     from public.impostazioni_email_retta where id),
  'modello salvato: gettoni dopo il conguaglio pasti e prima del totale'
);

-- Modello predefinito (default della colonna `corpo`) ------------------------
select ok(
  (select column_default like '%Gettoni pre-asilo (mese precedente): € {{gettoni_pre_asilo}}%'
      and column_default like '%{{gettoni_post_asilo}}%'
     from information_schema.columns
    where table_schema = 'public' and table_name = 'impostazioni_email_retta' and column_name = 'corpo'),
  'modello predefinito: contiene le righe dei gettoni'
);
select is(
  (select (length(column_default) - length(replace(column_default, '{{gettoni_pre_asilo}}', ''))) / length('{{gettoni_pre_asilo}}')
     from information_schema.columns
    where table_schema = 'public' and table_name = 'impostazioni_email_retta' and column_name = 'corpo'),
  1,
  'modello predefinito: {{gettoni_pre_asilo}} compare una sola volta'
);
select is(
  (select (length(column_default) - length(replace(column_default, '{{gettoni_post_asilo}}', ''))) / length('{{gettoni_post_asilo}}')
     from information_schema.columns
    where table_schema = 'public' and table_name = 'impostazioni_email_retta' and column_name = 'corpo'),
  1,
  'modello predefinito: {{gettoni_post_asilo}} compare una sola volta'
);
select ok(
  (select strpos(column_default, '{{conguaglio_pasti}}') < strpos(column_default, '{{gettoni_pre_asilo}}')
      and strpos(column_default, '{{gettoni_post_asilo}}') < strpos(column_default, '{{totale}}')
     from information_schema.columns
    where table_schema = 'public' and table_name = 'impostazioni_email_retta' and column_name = 'corpo'),
  'modello predefinito: gettoni dopo il conguaglio pasti e prima del totale'
);

select * from finish();

rollback;
