-- Girasole — Monte ore gestito a mano (specs/19 - monte-ore.md): nessuna
-- azione registra più movimenti in automatico (la conferma di una
-- settimana non tocca il monte ore), e l'admin può inserire, modificare
-- ed eliminare qualunque movimento, di ogni tipo.
--
-- Prima scrittura di un nuovo tipo di operazione (update) su
-- monte_ore_movimenti: policy e GRANT vanno insieme, altrimenti la
-- richiesta fallisce con "permission denied" anche per l'admin.
--
-- Incolla questo file nel SQL Editor di Supabase (test e produzione),
-- dopo 0054_ore_lavoro_stati_chiusura_ferie.sql, ed eseguilo una volta
-- sola.

-- insert: solo l'admin (prima anche il personale poteva inserire il
-- movimento 'settimanale' su se stesso alla conferma: non esiste più).
drop policy if exists "monte_ore_movimenti_insert_settimanale_own_or_admin" on public.monte_ore_movimenti;

create policy "monte_ore_movimenti_insert_admin" on public.monte_ore_movimenti
  for insert with check (public.ruolo_corrente() = 'admin');

-- update: solo l'admin, qualunque tipo.
create policy "monte_ore_movimenti_update_admin" on public.monte_ore_movimenti
  for update using (public.ruolo_corrente() = 'admin') with check (public.ruolo_corrente() = 'admin');

-- delete: solo l'admin, qualunque tipo (prima solo 'precarico').
drop policy if exists "monte_ore_movimenti_delete_precarico_admin" on public.monte_ore_movimenti;

create policy "monte_ore_movimenti_delete_admin" on public.monte_ore_movimenti
  for delete using (public.ruolo_corrente() = 'admin');

grant update, delete on public.monte_ore_movimenti to authenticated;
