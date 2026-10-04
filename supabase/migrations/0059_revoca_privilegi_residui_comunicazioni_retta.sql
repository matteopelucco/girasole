-- Girasole — revoca dei privilegi residui su comunicazioni_retta (specs/56,
-- specs/59). Applicazione: in test con `supabase db push --project-ref
-- <ref-test>`; in produzione solo Matteo, a mano, con `--project-ref`
-- esplicito (mai SQL Editor, mai automazioni). Non incollare questo file nel
-- SQL Editor.
--
-- Perché (issue #226, gemella di #217): comunicazioni_retta è un log contabile
-- (importi e email dei genitori) con policy RLS solo admin su select, insert,
-- update e delete (0036, 0038, 0046; pgTAP comunicazioni_retta.test.sql). La
-- tabella è creata dalla 0036 come `postgres` senza `revoke all`, quindi con i
-- default privileges di Supabase su `public` i ruoli API hanno privilegi di
-- tabella più ampi del necessario: service_role ignora la RLS e via REST
-- potrebbe riscrivere o cancellare il log; anon non ha alcun motivo di avere
-- privilegi sulla tabella.
--
-- Nessun codice usa la tabella con service_role (verificato con grep, vedi
-- PR): le letture e le scritture (invio, annullo, verifica bonifico) sono
-- tutte di app/admin/rette con la sessione dell'admin (ruolo authenticated,
-- RLS admin-only). I cron e gli script non la toccano.
--
-- Cosa si revoca:
--   * ad anon: tutti i privilegi (select, insert, update, delete, truncate,
--     references, trigger);
--   * a service_role: insert, update, delete, truncate;
--   * ad authenticated: solo truncate.
-- Cosa resta:
--   * ad authenticated: select, insert, update, delete (le policy admin-only
--     li richiedono: senza il GRANT di tabella l'admin avrebbe "permission
--     denied", vedi 0046), più references e trigger (non usati, non toccati);
--   * a service_role: select, references, trigger (non usati, non toccati);
--   * al proprietario `postgres` non si toglie nulla.
--
-- Le revoche sono idempotenti: rieseguirle non ha effetto se i privilegi sono
-- già assenti. Nessun vincolo di ordine rispetto al deploy del codice.

revoke all on public.comunicazioni_retta from anon;
revoke insert, update, delete, truncate on public.comunicazioni_retta
  from service_role;
revoke truncate on public.comunicazioni_retta from authenticated;
