-- Girasole — Conferma del mese e mese di competenza del monte ore
-- (specs/19 - monte-ore.md, scenari MOR-01..MOR-10; issue #403).
--
-- Ogni movimento ha due date: il giorno reale di registrazione (created_at,
-- non cambia mai) e il mese di competenza, cioè il mese a cui le ore
-- appartengono nel "Calcolo mese per mese". Nasce anche il tipo
-- `conferma_mese`: la differenza ore di un mese chiuso confermata dall'admin
-- con un pulsante, una sola per persona e mese.
--
-- Il saldo non cambia: resta la somma di `variazione`, indipendente dalla
-- competenza. Nessuna policy RLS nuova e nessun GRANT nuovo: insert, update e
-- delete restano solo admin (0055) e i privilegi di tabella (select/insert/
-- update/delete a `authenticated`) coprono già la colonna aggiunta.
--
-- Produzione: applicare a mano subito dopo il merge, prima con
-- `supabase db push --remote=<ref-produzione> --dry-run`, poi senza --dry-run.

-- 1. Colonna: primo giorno del mese (forma AAAA-MM-01). Vuota solo per i
--    movimenti che il backfill non ha ancora raggiunto; il codice usa il mese
--    di created_at come ripiego.
alter table public.monte_ore_movimenti
  add column if not exists mese_competenza date;

alter table public.monte_ore_movimenti
  drop constraint if exists monte_ore_movimenti_mese_competenza_primo_giorno;
alter table public.monte_ore_movimenti
  add constraint monte_ore_movimenti_mese_competenza_primo_giorno
    check (mese_competenza is null or mese_competenza = date_trunc('month', mese_competenza)::date);

-- 2. Backfill: il mese della data di registrazione, nel fuso dell'app.
update public.monte_ore_movimenti
   set mese_competenza = date_trunc('month', created_at at time zone 'Europe/Rome')::date
 where mese_competenza is null;

-- 3. Nuovo tipo `conferma_mese`.
alter table public.monte_ore_movimenti drop constraint if exists monte_ore_movimenti_tipo_check;
alter table public.monte_ore_movimenti
  add constraint monte_ore_movimenti_tipo_check
    check (tipo in ('settimanale', 'precarico', 'straordinario_residuo', 'conferma_mese'));

-- La conferma ha sempre il mese di competenza e mai una settimana.
alter table public.monte_ore_movimenti
  drop constraint if exists monte_ore_movimenti_conferma_mese_con_competenza;
alter table public.monte_ore_movimenti
  add constraint monte_ore_movimenti_conferma_mese_con_competenza
    check (tipo <> 'conferma_mese' or mese_competenza is not null);

alter table public.monte_ore_movimenti
  drop constraint if exists monte_ore_movimenti_conferma_mese_senza_settimana;
alter table public.monte_ore_movimenti
  add constraint monte_ore_movimenti_conferma_mese_senza_settimana
    check (tipo <> 'conferma_mese' or settimana_inizio is null);

-- 4. Una sola conferma per persona e mese, anche con richieste simultanee
--    (doppio click, due admin): la seconda dà 23505, anche in UPDATE.
create unique index if not exists monte_ore_movimenti_conferma_mese_unico
  on public.monte_ore_movimenti (utente_id, mese_competenza)
  where tipo = 'conferma_mese';
