-- Girasole — lanci a mano nel registro dei job (specs/63). Applicazione: in test con
-- `supabase db push --project-ref <ref-test>`; in produzione solo Matteo,
-- a mano, con `--project-ref` esplicito (mai SQL Editor, mai automazioni).
-- Non incollare questo file nel SQL Editor.
--
-- Ordine di rilascio: applicare questa migration in produzione PRIMA del
-- deploy del codice. Senza la colonna la pagina "Cron Job" non riesce a
-- leggere il registro e il lancio a mano non viene registrato; i cron
-- pianificati invece continuano a funzionare (non scrivono la colonna).
--
-- Colonna `estemporaneo` su `cron_esecuzioni` (issue #302): vera per i lanci
-- avviati a mano dall'admin dalla pagina "Cron Job", falsa (default) per i
-- lanci di Vercel Cron. Le righe già presenti diventano `false`: sono tutte
-- lanci pianificati. Nessun dato personale.
--
-- Accessi: invariati rispetto a 0063. Nessuna policy nuova (resta la sola
-- SELECT dell'admin); nessun privilegio nuovo. I GRANT di 0063 sono a livello
-- di tabella, quindi coprono già la colonna nuova: authenticated solo SELECT
-- (filtrata dalla policy admin), service_role SELECT, INSERT, UPDATE (scrive
-- il lancio a mano dalla Server Action dell'admin, dopo `requireAdmin()`),
-- nessun DELETE. Nessuna utenza scrive la colonna con la propria sessione.

alter table public.cron_esecuzioni
  add column estemporaneo boolean not null default false;
