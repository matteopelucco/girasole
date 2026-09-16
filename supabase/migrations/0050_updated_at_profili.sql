-- Girasole — updated_at su profili (specs/05 - feedback.md): stesso
-- motivo di 0047_updated_at_bambini.sql, per il pulsante "Aggiorna" di
-- un utente/maestra su /admin/maestre.
--
-- Incolla questo file nel SQL Editor di Supabase (test e produzione) ed
-- eseguilo una volta sola.

alter table public.profili
  add column updated_at timestamptz not null default now();
