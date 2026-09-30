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

drop policy if exists "monte_ore_movimenti_insert_admin" on public.monte_ore_movimenti;

create policy "monte_ore_movimenti_insert_admin" on public.monte_ore_movimenti
  for insert with check (public.ruolo_corrente() = 'admin');

-- update: solo l'admin, qualunque tipo.
drop policy if exists "monte_ore_movimenti_update_admin" on public.monte_ore_movimenti;

create policy "monte_ore_movimenti_update_admin" on public.monte_ore_movimenti
  for update using (public.ruolo_corrente() = 'admin') with check (public.ruolo_corrente() = 'admin');

-- delete: solo l'admin, qualunque tipo (prima solo 'precarico').
drop policy if exists "monte_ore_movimenti_delete_precarico_admin" on public.monte_ore_movimenti;

drop policy if exists "monte_ore_movimenti_delete_admin" on public.monte_ore_movimenti;

create policy "monte_ore_movimenti_delete_admin" on public.monte_ore_movimenti
  for delete using (public.ruolo_corrente() = 'admin');

grant update, delete on public.monte_ore_movimenti to authenticated;

-- Il vincolo "straordinario residuo sempre <= 0" (0032) non ha più senso con
-- la gestione manuale: l'admin può cambiare il verso di qualunque movimento,
-- anche storico (come già fatto per 'settimanale' in 0045).
alter table public.monte_ore_movimenti
  drop constraint if exists monte_ore_movimenti_straordinario_residuo_non_positivo;

-- Difesa contro policy create a mano con altri nomi: le policy permissive si
-- combinano in OR, quindi una policy inattesa riaprirebbe la scrittura al
-- personale. Se ce ne sono, la migration si ferma invece di passare in silenzio.
do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'monte_ore_movimenti'
      and policyname not in (
        'monte_ore_movimenti_select_own_or_admin',
        'monte_ore_movimenti_insert_admin',
        'monte_ore_movimenti_update_admin',
        'monte_ore_movimenti_delete_admin'
      )
  ) then
    raise exception 'policy inattesa su monte_ore_movimenti: verificare e rimuovere a mano';
  end if;
end $$;
