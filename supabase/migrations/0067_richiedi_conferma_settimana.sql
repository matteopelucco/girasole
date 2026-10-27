-- Girasole — opzione "Richiedi conferma settimana" per utente (specs/03, specs/07).
-- Applicazione: in test con `supabase db push --project-ref <ref-test>`; in
-- produzione solo Matteo, a mano, con `--project-ref` esplicito (mai SQL
-- Editor, mai automazioni). Non incollare questo file nel SQL Editor.
--
-- Colonna booleana su public.profili: se falsa, i controlli degli allarmi
-- (cron "Ore di lavoro", banner personale, pagina Allarmi) saltano la
-- conferma settimanale di quell'utente. Non cambia altro: l'utente può
-- inserire e confermare le ore e il report mensile continua a mostrare
-- "da confermare". Il default è true e la colonna è NOT NULL, così ogni
-- riga già presente la riceve a true: nessun cambio di comportamento.
--
-- Permessi: nessuna policy e nessun GRANT nuovi. La colonna è coperta da
-- quelli già esistenti su public.profili, che sono a livello di riga e di
-- tabella: select per l'utente stesso, le colleghe e l'admin
-- (profili_select_own_or_admin, profili_select_colleghe — 0001, 0013,
-- 0016), update riservato all'admin (profili_update_admin — 0002) con il
-- GRANT di tabella a authenticated (0004), select per service_role usata
-- dal cron (0034). Quindi solo l'admin può modificare il valore.

alter table public.profili
  add column if not exists richiedi_conferma_settimana boolean not null default true;
