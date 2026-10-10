-- Girasole — allarme "rette non comunicate" (specs/07, specs/56). Applicazione:
-- in test con `supabase db push --project-ref <ref-test>`; in produzione solo
-- Matteo, a mano, con `--project-ref` esplicito (mai SQL Editor, mai
-- automazioni). Non incollare questo file nel SQL Editor.
--
-- Ordine di rilascio: applicare questa migration in produzione PRIMA del
-- deploy del codice. Il cron registra la riga in `allarmi_inviati` prima di
-- inviare l'email: se il vincolo qui sotto non accetta ancora il nuovo valore,
-- l'email non parte (nessun invio ripetuto), ma l'allarme non viene mai
-- mandato finché la migration manca.
--
-- 1) Vincolo su allarmi_inviati.tipo (creato in linea dalla 0027, quindi con
--    il nome automatico `allarmi_inviati_tipo_check`): si aggiunge il terzo
--    valore `rette_non_comunicate`. Il DROP è senza `if exists` di proposito:
--    se il nome fosse diverso la migration deve fallire (è transazionale),
--    non lasciare il vecchio vincolo che rifiuterebbe il nuovo valore.
--    `chiave` per questo tipo è il mese "YYYY-MM": con unique (tipo, chiave)
--    c'è al più una riga, quindi una sola email, per mese.
-- 2) Privilegi di tabella per service_role, usata solo dal cron
--    `/api/cron/allarmi` (nessun utente autenticato tocca queste tabelle con
--    questi privilegi; la RLS non si applica a service_role, nessuna policy
--    nuova e nessun privilegio nuovo per anon o authenticated):
--      * SELECT su costi_bambini e comunicazioni_retta: il cron deve sapere
--        a quali bambini manca la comunicazione della retta. Dalla 0059 la
--        lettura di service_role su comunicazioni_retta dipende dai default
--        privileges dell'ambiente (nel DB di test manca): qui diventa
--        esplicita. Sola lettura: insert, update e delete restano revocati;
--      * DELETE su allarmi_inviati: se l'invio dell'email fallisce il cron
--        cancella la riga appena registrata, così il tentativo successivo
--        può ritentare (specs/07).

alter table public.allarmi_inviati
  drop constraint allarmi_inviati_tipo_check;

alter table public.allarmi_inviati
  add constraint allarmi_inviati_tipo_check
  check (tipo in ('presenze_pasti_mezzogiorno', 'settimana_ore_non_confermata', 'rette_non_comunicate'));

grant select on public.costi_bambini to service_role;
grant select on public.comunicazioni_retta to service_role;
grant delete on public.allarmi_inviati to service_role;
