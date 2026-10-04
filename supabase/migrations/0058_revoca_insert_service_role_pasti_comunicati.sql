-- Girasole — revoca dei privilegi di scrittura residui su pasti_comunicati
-- (specs/16). Applicazione: in test con `supabase db push --project-ref
-- <ref-test>`; in produzione solo Matteo, a mano, con `--project-ref`
-- esplicito (mai SQL Editor, mai automazioni). Non incollare questo file nel
-- SQL Editor.
--
-- Perché (issue #217, follow-up di #212): pasti_comunicati è un log contabile
-- (fattura Rojac). Dalla 0057 l'INSERT passa solo dalla RPC
-- comunica_pasti_rojac, `security definer`: gira con i privilegi del
-- proprietario della funzione, quindi non dipende dai privilegi dei ruoli API.
-- Nessun codice applicativo, cron, script o fixture e2e scrive in
-- pasti_comunicati con service_role o con la sessione dell'utente
-- (verificato con grep, vedi PR): i privilegi di scrittura residui sono
-- inutilizzati. La tabella è creata dalla 0020 come `postgres` senza
-- `revoke all`, quindi con i default privileges di Supabase su `public` i
-- ruoli API possono avere ancora UPDATE, DELETE e TRUNCATE; service_role
-- ignora la RLS, quindi via REST potrebbe ancora riscrivere o cancellare il
-- log.
--
-- Cosa si revoca:
--   * INSERT a service_role (il GRANT della 0021; a public, anon e
--     authenticated l'INSERT è già revocato dalla 0057);
--   * UPDATE, DELETE e TRUNCATE a service_role, anon e authenticated.
-- Cosa resta: SELECT a service_role (cron allarmi/report presenze, reset
-- giornata) e ad authenticated (la schermata legge il log, protetta dalla RLS).
-- Al proprietario `postgres` non si toglie nulla: la RPC security definer e le
-- pulizie dei test pgTAP girano come owner.
--
-- Le revoche sono idempotenti: rieseguirle non ha effetto se i privilegi sono
-- già assenti. Nessun vincolo di ordine rispetto al deploy del codice, purché
-- la 0057 sia già applicata.

revoke insert on public.pasti_comunicati from service_role;
revoke update, delete, truncate on public.pasti_comunicati
  from service_role, anon, authenticated;
