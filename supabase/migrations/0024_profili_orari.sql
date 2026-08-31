-- Girasole — Profili orari (specs/54 - profili-orari.md): "orari tipo"
-- settimanali (ore previste lunedì-venerdì) che l'admin definisce in un
-- pannello dedicato e assegna al personale, indipendentemente
-- dall'abilitazione al report ore (specs/17 -
-- ore-di-lavoro.md). Solo la definizione/assegnazione dei profili in
-- questa fase: come verranno effettivamente usati resta fuori scope.
--
-- Incolla questo file nel SQL Editor di Supabase (dopo
-- 0023_ore_lavoro_abilitazione.sql) ed eseguilo una volta sola.

create table public.profili_orari (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ore_lunedi numeric(4, 2) not null default 0,
  ore_martedi numeric(4, 2) not null default 0,
  ore_mercoledi numeric(4, 2) not null default 0,
  ore_giovedi numeric(4, 2) not null default 0,
  ore_venerdi numeric(4, 2) not null default 0,
  created_at timestamptz not null default now()
);

alter table public.profili_orari enable row level security;

-- Solo l'admin, in ogni operazione: è un pannello di configurazione,
-- non ancora un dato che lo staff deve leggere (specs/54 — "vedremo poi
-- a cosa serviranno" era la richiesta esplicita dell'utente).
create policy "profili_orari_admin_all" on public.profili_orari
  for all using (public.ruolo_corrente() = 'admin')
  with check (public.ruolo_corrente() = 'admin');

grant select, insert, update, delete on public.profili_orari to authenticated;

-- =========================================================
-- Assegnazione utente -> profilo orario: al più un profilo per utente,
-- facoltativo (indipendente da profili.abilitato_ore_lavoro, specs/54).
-- Se il profilo viene eliminato, l'utente resta senza assegnazione
-- invece di bloccare l'eliminazione — stesso pattern già usato per
-- sezioni.anno_scolastico_id (0006_data_types.sql).
-- =========================================================
alter table public.profili add column if not exists profilo_orario_id uuid references public.profili_orari(id) on delete set null;
