-- Girasole — fix: cron notturno in errore su "Ore di lavoro"
-- ("permission denied for table profili").
--
-- Stesso bug già capitato più volte per altre tabelle nuove lette dal
-- cron con la service_role key (vedi 0018_grant_service_role_report.sql
-- e successivi): bypassare la RLS non dispensa dal GRANT di base sulla
-- TABELLA, che sono due controlli Postgres distinti.
--
-- lib/reportOreLavoro.ts (specs/52 - report-email-automatico.md) è il
-- primo codice a far leggere public.profili al service_role (per il
-- personale abilitato al report ore, specs/17), e nessuna migration
-- precedente gliel'ha mai concesso.
--
-- Incolla questo file nel SQL Editor di Supabase (progetto di test E di
-- produzione) ed eseguilo una volta sola.

grant select on public.profili to service_role;
