-- Girasole — updated_at su promemoria (specs/05 - feedback.md): stesso
-- motivo di 0047_updated_at_bambini.sql, per il form "Salva modifiche"
-- di un avviso/promemoria.
--
-- Incolla questo file nel SQL Editor di Supabase (test e produzione) ed
-- eseguilo una volta sola.

alter table public.promemoria
  add column updated_at timestamptz not null default now();
