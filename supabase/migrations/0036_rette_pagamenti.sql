-- Girasole — Rette: anno scolastico "corrente" e registrazione dei
-- pagamenti mensili (specs/56 - rette.md).
--
-- Incolla questo file nel SQL Editor di Supabase (dopo
-- 0035_rette_bambini.sql) ed eseguilo una volta sola.

-- =========================================================
-- Anno scolastico: anno solare di inizio (es. 2025 per l'anno
-- scolastico "2025/2026" — serve a calcolare le date reali dei mesi
-- Settembre-Giugno della tabella rette) e flag "corrente", uno solo
-- alla volta, impostato a mano dall'admin (specs/56).
-- =========================================================
alter table public.anni_scolastici add column if not exists anno_inizio integer;
alter table public.anni_scolastici add column if not exists corrente boolean not null default false;

create unique index if not exists anni_scolastici_un_solo_corrente
  on public.anni_scolastici (corrente)
  where corrente;

-- =========================================================
-- Pagamenti di retta registrati mese per mese (specs/56 - rette.md):
-- un solo importo per bambino e mese di competenza (`mese`, sempre il
-- primo giorno del mese). Dato economico, stesso pattern "solo admin"
-- di rette_bambini (0035_rette_bambini.sql).
-- =========================================================
create table public.pagamenti_retta (
  id uuid primary key default gen_random_uuid(),
  bambino_id uuid not null references public.bambini(id) on delete cascade,
  mese date not null check (extract(day from mese) = 1),
  importo numeric(10, 2) not null default 0,
  note text,
  registrato_da uuid references public.profili(id),
  created_at timestamptz not null default now(),
  unique (bambino_id, mese)
);

alter table public.pagamenti_retta enable row level security;

create policy "pagamenti_retta_admin_all" on public.pagamenti_retta
  for all using (public.ruolo_corrente() = 'admin')
  with check (public.ruolo_corrente() = 'admin');

grant select, insert, update, delete on public.pagamenti_retta to authenticated;
