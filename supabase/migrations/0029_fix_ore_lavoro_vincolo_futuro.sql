-- Girasole — Correzione bug in 0028_ore_lavoro_navigazione_settimane.sql
-- (specs/18 - report-ore-lavoro.md): il trigger su ore_lavoro_giorni
-- confrontava `data` con la data odierna, bloccando qualunque giorno
-- futuro all'interno di una settimana comunque ammessa (corrente o
-- passata) — es. salvare le ore di lunedì/martedì a metà settimana
-- falliva, perché il form invia sempre tutti e 7 i giorni della
-- settimana in un solo upsert, e Postgres rifiuta l'intera istruzione
-- se anche una sola riga (i giorni successivi a oggi) viola il
-- trigger. Il vincolo di specs/18 è sulla SETTIMANA, non sul singolo
-- giorno: dentro una settimana ammessa, un giorno non ancora accaduto
-- (es. venerdì quando oggi è lunedì) resta scrivibile, come già
-- previsto dallo scenario "confermare la settimana" (che registra con
-- valori precaricati anche i giorni non ancora salvati esplicitamente).
--
-- Incolla questo file nel SQL Editor di Supabase (dopo 0028) ed
-- eseguilo una volta sola.

create or replace function public.impedisci_ore_lavoro_futura()
returns trigger
language plpgsql
as $$
begin
  if date_trunc('week', new.data)::date > date_trunc('week', (now() at time zone 'Europe/Rome')::date)::date then
    raise exception 'Impossibile registrare ore per una settimana futura: %.', new.data;
  end if;
  return new;
end;
$$;
