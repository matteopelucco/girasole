-- Girasole — fix: privilegi di tabella mancanti per il ruolo `authenticated`
-- Incolla questo file nel SQL Editor di Supabase ed eseguilo una volta sola.
--
-- Causa del bug "Ruolo: non impostato" per l'admin in produzione:
-- l'errore reale era `42501: permission denied for table profili`, non un
-- filtro RLS (che darebbe 0 righe, non un errore). Le policy RLS filtrano
-- le RIGHE visibili, ma Postgres richiede comunque il GRANT di base sulla
-- TABELLA prima ancora di valutare le policy. Le migration precedenti non
-- avevano mai un GRANT esplicito: contavano sui privilegi di default che
-- Supabase normalmente assegna alle tabelle nuove nello schema `public`.
-- Su `profili` questo privilegio è mancante (causa imprecisata — non è
-- nelle migration). Per sicurezza, ripristiniamo il grant standard su
-- tutte le tabelle dell'app, non solo su `profili`, così lo stesso bug
-- non si ripresenta silenziosamente sulla prossima tabella usata da una
-- sessione autenticata reale (finora mai verificata in produzione prima
-- di questo bug).
--
-- `tentativi_reset_password` è ESCLUSA di proposito: deve restare
-- accessibile solo tramite la funzione security definer
-- `puo_richiedere_reset_password` (vedi 0003_password_recovery.sql) — un
-- grant diretto qui riaprirebbe il rischio di enumeration che quella
-- funzione è pensata per evitare.

grant select, insert, update, delete on public.profili to authenticated;
grant select, insert, update, delete on public.sezioni to authenticated;
grant select, insert, update, delete on public.maestre_sezioni to authenticated;
grant select, insert, update, delete on public.bambini to authenticated;
grant select, insert, update, delete on public.bambini_genitori to authenticated;
grant select, insert, update, delete on public.presenze to authenticated;
grant select, insert, update, delete on public.pasti to authenticated;
grant select, insert, update, delete on public.promemoria to authenticated;

-- Anche gli enum/sequence impliciti a volte perdono i privilegi di
-- default insieme alle tabelle: innocuo ri-applicarlo.
grant usage on schema public to authenticated;
