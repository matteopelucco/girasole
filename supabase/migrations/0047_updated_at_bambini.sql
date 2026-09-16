-- Girasole — updated_at su bambini (specs/05 - feedback.md): senza
-- questa colonna il form "Salva modifiche" della scheda bambino non ha
-- modo di mostrare un effetto visibile dopo un salvataggio riuscito (i
-- campi restano con gli stessi valori appena scritti) — stesso motivo e
-- stesso pattern già usato per impostazioni_email_retta
-- (0036_comunicazione_retta.sql, "Ultimo salvataggio" sotto "Salva
-- modello").
--
-- Incolla questo file nel SQL Editor di Supabase (test e produzione) ed
-- eseguilo una volta sola.

alter table public.bambini
  add column updated_at timestamptz not null default now();
