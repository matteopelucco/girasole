-- Girasole — rate limiting per il recupero password (specs/02 - password-recovery.md)
-- Incolla questo file nel SQL Editor di Supabase (dopo 0001 e 0002) ed eseguilo una volta sola.

-- =========================================================
-- Registro dei tentativi di richiesta reset password.
-- Scritto e letto SOLO dalla funzione security definer qui sotto: RLS
-- attiva senza alcuna policy, quindi né anon né authenticated possono
-- leggerlo/scriverlo direttamente via API — altrimenti chiunque potrebbe
-- interrogare la tabella per scoprire quali email hanno chiesto un
-- reset (enumeration).
-- =========================================================
create table public.tentativi_reset_password (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  ip text not null default 'sconosciuto',
  creato_il timestamptz not null default now()
);

alter table public.tentativi_reset_password enable row level security;

create index tentativi_reset_password_email_idx
  on public.tentativi_reset_password (email, creato_il);
create index tentativi_reset_password_ip_idx
  on public.tentativi_reset_password (ip, creato_il);

-- =========================================================
-- Ritorna true e registra il tentativo se la richiesta è concessa,
-- false se va bloccata per rate limit. Non rivela mai se l'email
-- esiste: quella verifica resta interamente a carico di
-- supabase.auth.resetPasswordForEmail, che già non fa enumeration.
--
-- Regole (vedi specs/02 - password-recovery.md):
-- - massimo 1 richiesta al minuto per la stessa email
-- - massimo 5 richieste ogni 5 minuti dallo stesso IP, a qualunque email
-- =========================================================
create or replace function public.puo_richiedere_reset_password(p_email text, p_ip text)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  richieste_stessa_email int;
  richieste_stesso_ip int;
begin
  select count(*) into richieste_stessa_email
  from public.tentativi_reset_password
  where email = lower(p_email) and creato_il > now() - interval '1 minute';

  if richieste_stessa_email > 0 then
    return false;
  end if;

  select count(*) into richieste_stesso_ip
  from public.tentativi_reset_password
  where ip = p_ip and creato_il > now() - interval '5 minutes';

  if richieste_stesso_ip >= 5 then
    return false;
  end if;

  insert into public.tentativi_reset_password (email, ip) values (lower(p_email), p_ip);
  return true;
end;
$$;

grant execute on function public.puo_richiedere_reset_password(text, text) to anon, authenticated;
