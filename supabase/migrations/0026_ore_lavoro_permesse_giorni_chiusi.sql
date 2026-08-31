-- Girasole — Le ore di lavoro del personale si possono registrare anche
-- nei giorni in cui l'asilo è chiuso (weekend o chiusura registrata
-- dall'admin): richiesta esplicita dell'utente. Corregge
-- 0025_report_ore_lavoro.sql, che — riprendendo la nota "in futuro"
-- lasciata in 0022_calendario_scolastico.sql/specs/53 — aveva esteso lo
-- stesso blocco già in vigore per presenze/pasti anche alle ore di
-- lavoro. Il personale può lavorare (pulizie, attività amministrative,
-- formazione...) anche quando l'asilo non è operativo: vedi
-- specs/18 - report-ore-lavoro.md e la nota aggiornata in specs/53.
--
-- L'informazione di chiusura resta visibile in UI (a scopo puramente
-- informativo, lib/calendarioScolastico.ts), solo il blocco a livello
-- di trigger viene rimosso qui.
--
-- Incolla questo file nel SQL Editor di Supabase (dopo
-- 0025_report_ore_lavoro.sql) ed eseguilo una volta sola.

drop trigger if exists ore_lavoro_giorni_blocca_se_chiuso on public.ore_lavoro_giorni;
drop function if exists public.impedisci_ore_lavoro_giorno_chiuso();
