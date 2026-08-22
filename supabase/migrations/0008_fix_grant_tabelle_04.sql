-- Girasole — fix: privilegi di tabella mancanti su anni_scolastici e
-- bambini_sezioni_storico (introdotte in 0006_data_types.sql).
--
-- Stesso bug già visto e corretto in
-- 0004_fix_grant_tabelle.sql per le tabelle originarie: le policy RLS
-- filtrano le RIGHE visibili, ma Postgres richiede comunque il GRANT
-- di base sulla TABELLA prima ancora di valutare le policy. La
-- migration 0006 ha creato due tabelle nuove senza riapplicare questo
-- grant, causando "permission denied for table anni_scolastici"
-- creando un anno scolastico da /admin.
--
-- Incolla questo file nel SQL Editor di Supabase (dopo
-- 0007_fix_ruolo_corrente_ricorsione.sql) ed eseguilo una volta sola.

grant select, insert, update, delete on public.anni_scolastici to authenticated;
grant select, insert, update, delete on public.bambini_sezioni_storico to authenticated;
