-- Girasole — Navigazione tra le settimane del report ore di lavoro
-- (specs/18 - report-ore-lavoro.md): il personale può ora rivedere e
-- confermare settimane passate, non solo quella corrente. Resta però
-- un vincolo assoluto: non è mai possibile registrare o confermare ore
-- per una settimana futura, per QUALUNQUE ruolo (admin incluso) — non
-- è un permesso di scrittura ma un vincolo di coerenza dei dati (non si
-- possono lavorare ore che non sono ancora accadute). Già applicato in
-- app (lib/oreLavoro.ts, pagina e server action), qui imposto anche a
-- livello di database come difesa in profondità, stesso principio già
-- usato per altri vincoli di integrità del progetto.
--
-- Incolla questo file nel SQL Editor di Supabase (dopo
-- 0027_allarmi.sql) ed eseguilo una volta sola.

create or replace function public.impedisci_ore_lavoro_futura()
returns trigger
language plpgsql
as $$
begin
  if new.data > (now() at time zone 'Europe/Rome')::date then
    raise exception 'Impossibile registrare ore per una data futura: %.', new.data;
  end if;
  return new;
end;
$$;

drop trigger if exists ore_lavoro_giorni_blocca_futuro on public.ore_lavoro_giorni;
create trigger ore_lavoro_giorni_blocca_futuro
  before insert or update on public.ore_lavoro_giorni
  for each row execute procedure public.impedisci_ore_lavoro_futura();

create or replace function public.impedisci_conferma_settimana_futura()
returns trigger
language plpgsql
as $$
begin
  if new.settimana_inizio > (now() at time zone 'Europe/Rome')::date then
    raise exception 'Impossibile confermare una settimana futura: %.', new.settimana_inizio;
  end if;
  return new;
end;
$$;

drop trigger if exists ore_lavoro_settimane_blocca_futuro on public.ore_lavoro_settimane;
create trigger ore_lavoro_settimane_blocca_futuro
  before insert on public.ore_lavoro_settimane
  for each row execute procedure public.impedisci_conferma_settimana_futura();
