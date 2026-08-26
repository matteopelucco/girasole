-- Girasole — fix: privilegi di tabella mancanti per il ruolo `service_role`
-- Incolla questo file nel SQL Editor di Supabase (progetto di test E di
-- produzione) ed eseguilo una volta sola.
--
-- Causa del report notturno vuoto ("Nessuna classe attiva" anche con dati
-- presenti, specs/52): l'errore reale, reso visibile solo dopo aver
-- aggiunto il controllo esplicito dell'errore in lib/reportPresenze.ts
-- (righeOSollevaErrore), è `42501: permission denied for table sezioni`
-- — non un filtro RLS (che darebbe 0 righe, non un errore).
--
-- È lo stesso bug già corretto una volta per il ruolo `authenticated` in
-- 0004_fix_grant_tabelle.sql: bypassare la RLS (`service_role`, usato dal
-- cron via lib/supabase/admin.ts:createAdminClient) e avere il GRANT di
-- base sulla TABELLA sono due controlli Postgres distinti — bypassare il
-- primo non dispensa dal secondo. Nessuna migration precedente aveva mai
-- dato un GRANT esplicito a `service_role`.
--
-- Solo le tabelle davvero lette/scritte dal client service_role (vedi
-- lib/reportPresenze.ts, app/api/cron/report-presenze/route.ts) — le
-- altre azioni che usano createAdminClient (creare/eliminare utenti,
-- app/admin/maestre/actions.ts) passano dall'Admin Auth API
-- (auth.users), non da tabelle public.*, quindi non necessitano di
-- questo grant.

grant select on public.sezioni to service_role;
grant select on public.bambini to service_role;
grant select on public.presenze to service_role;
grant select on public.pasti to service_role;
grant select, insert on public.report_giornalieri_inviati to service_role;
grant select, insert on public.report_periodici_inviati to service_role;

grant usage on schema public to service_role;
