-- Girasole — updated_at su giorni_chiusura (specs/05 - feedback.md):
-- stesso motivo di 0047_updated_at_bambini.sql, per il form "Salva
-- modifiche" di un giorno di chiusura scolastica.
--
-- Incolla questo file nel SQL Editor di Supabase (test e produzione) ed
-- eseguilo una volta sola.

alter table public.giorni_chiusura
  add column updated_at timestamptz not null default now();
