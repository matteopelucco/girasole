-- Girasole — Grant/policy di update mancante per la verifica del
-- bonifico (specs/59 - verifica-bonifico-retta.md): comunicazioni_retta
-- non ha mai avuto una policy di update (0038_annulla_comunicazione_retta.sql
-- l'aveva esplicitamente esclusa, la tabella era pensata come
-- insert/delete soltanto — vedi il commento in quel file). La verifica
-- del bonifico introduce il primo caso reale di update sul posto
-- (bonifico_stato e le colonne collegate), mai coperto da una
-- migration: `marcaBonificoCorretto`/`marcaBonificoImportoErrato`
-- fallivano con "permission denied for table comunicazioni_retta".
--
-- Incolla questo file nel SQL Editor di Supabase (test e produzione),
-- dopo 0045_movimento_settimanale_netto_pieno.sql, ed eseguilo una
-- volta sola.

create policy "comunicazioni_retta_admin_update" on public.comunicazioni_retta
  for update using (public.ruolo_corrente() = 'admin')
  with check (public.ruolo_corrente() = 'admin');

grant update on public.comunicazioni_retta to authenticated;
