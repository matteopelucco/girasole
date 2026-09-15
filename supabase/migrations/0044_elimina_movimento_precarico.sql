-- Girasole — Eliminare un movimento manuale di monte ore (estende
-- specs/19 - monte-ore.md): finora nessuna policy di delete esisteva
-- su monte_ore_movimenti (i movimenti erano pensati come immutabili al
-- 100%). Un movimento manuale (`precarico`) inserito per errore può
-- ora essere eliminato dall'admin; i movimenti automatici
-- (`settimanale`, `straordinario_residuo`) restano immutabili — la
-- policy li esclude esplicitamente, non solo la UI.
--
-- Incolla questo file nel SQL Editor di Supabase (test e produzione),
-- dopo 0043_bonifico_comunicazione_retta.sql, ed eseguilo una volta
-- sola.

create policy "monte_ore_movimenti_delete_precarico_admin" on public.monte_ore_movimenti
  for delete using (public.ruolo_corrente() = 'admin' and tipo = 'precarico');

grant delete on public.monte_ore_movimenti to authenticated;
