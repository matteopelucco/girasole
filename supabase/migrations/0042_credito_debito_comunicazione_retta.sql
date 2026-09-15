-- Girasole — Credito/debito nella comunicazione retta (specs/58 -
-- crediti-debiti-bambino.md): l'importo e la nota di un eventuale
-- credito/debito "da conteggiare" quel mese, così come effettivamente
-- comunicati (mai ricalcolati in seguito, stesso pattern delle altre
-- colonne di comunicazioni_retta).
--
-- Incolla questo file nel SQL Editor di Supabase (test e produzione),
-- dopo 0041_crediti_debiti_bambini.sql, ed eseguilo una volta sola.

alter table public.comunicazioni_retta
  add column credito_debito numeric(10, 2) not null default 0,
  add column nota_credito_debito text;
