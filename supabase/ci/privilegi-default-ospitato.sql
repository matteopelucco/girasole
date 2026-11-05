-- Girasole — SOLO per il job `e2e-locale` (issue #419): NON è una migration.
-- Il job lo copia come prima migration nel runner, prima di `supabase start`.
--
-- L'immagine locale di Supabase dà ancora ai nuovi oggetti di `public` i
-- privilegi di default che il servizio ospitato ha tolto (dal 30/10/2026): il
-- locale sarebbe più permissivo del vero e un GRANT mancante passerebbe
-- inosservato. Questi comandi riportano lo schema `public` allo stato letto da
-- pg_default_acl del progetto di test il 5/11/2026:
--   postgres, tabelle:  anon, authenticated, service_role = Dxtm
--   postgres, sequenze e funzioni: solo postgres
-- Se Supabase cambia di nuovo i default, va riallineato leggendo pg_default_acl.

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant truncate, references, trigger, maintain on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated, service_role;
