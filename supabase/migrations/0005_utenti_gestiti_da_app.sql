-- Girasole — Fase 1: gli utenti si creano/modificano/eliminano dall'app
-- (server action con la service_role key), non più da Supabase Auth
-- (dashboard) — vedi specs/03 - utenti-e-ruoli.md.
-- Incolla questo file nel SQL Editor di Supabase (dopo
-- 0004_fix_grant_tabelle.sql) ed eseguilo una volta sola.

-- =========================================================
-- profili: aggiunge il numero di telefono (specs/03 - utenti-e-ruoli.md)
-- =========================================================
alter table public.profili add column if not exists telefono text not null default '';

-- =========================================================
-- L'admin ora crea gli utenti dall'app passando nome/cognome/telefono/
-- ruolo come user_metadata su auth.users (vedi
-- app/admin/maestre/actions.ts, creaUtente). Il trigger li recepisce
-- invece di assegnare sempre ruolo 'genitore' e telefono vuoto.
-- =========================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profili (id, nome, cognome, telefono, ruolo, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', ''),
    coalesce(new.raw_user_meta_data->>'cognome', ''),
    coalesce(new.raw_user_meta_data->>'telefono', ''),
    coalesce(nullif(new.raw_user_meta_data->>'ruolo', ''), 'genitore')::ruolo_utente,
    new.email
  );
  return new;
end;
$$;
