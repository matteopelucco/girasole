-- Girasole — Fase 1: pagine admin (sezioni/bambini/maestre) e dashboard maestra
-- Incolla questo file nel SQL Editor di Supabase (dopo 0001_init.sql) ed eseguilo una volta sola.

-- =========================================================
-- profili: aggiunge l'email (comoda per l'admin per riconoscere
-- gli utenti quando promuove a maestra/admin — auth.users non è
-- interrogabile dal client con la anon key)
-- =========================================================
alter table public.profili add column if not exists email text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profili (id, nome, cognome, ruolo, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', ''),
    coalesce(new.raw_user_meta_data->>'cognome', ''),
    'genitore',
    new.email
  );
  return new;
end;
$$;

-- backfill per gli utenti già registrati prima di questa migration
update public.profili p
set email = u.email
from auth.users u
where p.id = u.id and p.email is null;

-- =========================================================
-- Fix: mancava una policy di select su maestre_sezioni. Con RLS
-- abilitata e zero policy la tabella risultava illeggibile per
-- chiunque (anche per la maestra stessa), il che rompeva a
-- cascata le policy di bambini/presenze/pasti che fanno una
-- exists() su maestre_sezioni per una maestra.
-- =========================================================
create policy "maestre_sezioni_select_own" on public.maestre_sezioni
  for select using (maestra_id = auth.uid());

-- =========================================================
-- Scrittura da parte dell'admin (creazione sezioni/bambini,
-- assegnazione maestre alle sezioni, promozione di un utente)
-- =========================================================
create policy "sezioni_admin_write" on public.sezioni
  for all using (public.ruolo_corrente() = 'admin')
  with check (public.ruolo_corrente() = 'admin');

create policy "bambini_admin_write" on public.bambini
  for all using (public.ruolo_corrente() = 'admin')
  with check (public.ruolo_corrente() = 'admin');

create policy "maestre_sezioni_admin_write" on public.maestre_sezioni
  for all using (public.ruolo_corrente() = 'admin')
  with check (public.ruolo_corrente() = 'admin');

create policy "profili_update_admin" on public.profili
  for update using (public.ruolo_corrente() = 'admin')
  with check (public.ruolo_corrente() = 'admin');
