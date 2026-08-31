-- Girasole — Allarmi (specs/07 - allarmi.md): tabella di idempotenza
-- per le email dei due allarmi (presenze/pasti non completati entro
-- mezzogiorno; settimana di ore di lavoro non confermata). Stesso
-- principio "esistenza della riga = già inviato" già in uso per i
-- report notturni (0009/specs/52) e la conferma di una settimana ore
-- (0025/specs/18), qui condiviso in un'unica tabella con un
-- discriminatore `tipo` invece di una tabella per allarme, non
-- essendoci altri campi da conservare oltre alla chiave.
--
-- Solo il cron (service_role) la usa: nessun utente autenticato legge o
-- scrive qui, quindi RLS abilitata senza alcuna policy per
-- `authenticated` (nega tutto di default).
--
-- Incolla questo file nel SQL Editor di Supabase (dopo
-- 0026_ore_lavoro_permesse_giorni_chiusi.sql) ed eseguilo una volta sola.

create table public.allarmi_inviati (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('presenze_pasti_mezzogiorno', 'settimana_ore_non_confermata')),
  chiave text not null,
  inviato_at timestamptz not null default now(),
  unique (tipo, chiave)
);

alter table public.allarmi_inviati enable row level security;

grant select, insert on public.allarmi_inviati to service_role;
