-- Girasole — Calendario scolastico: giorni di chiusura (specs/53 -
-- calendario-scolastico.md). L'admin gestisce intervalli di chiusura
-- (es. vacanze, ponti) con una nota opzionale; sabato e domenica sono
-- chiusura implicita, senza bisogno di un record. In un giorno chiuso
-- (weekend o intervallo registrato) non è possibile inserire né
-- modificare presenze o pasti, per NESSUN ruolo (admin incluso — è un
-- vincolo di coerenza dei dati, non un permesso di scrittura, stesso
-- principio già in vigore per "pasto di un bambino assente/malato", vedi
-- 0012_pasto_senza_parziale.sql / 0017_pasto_blocca_anche_malattia.sql).
--
-- Incolla questo file nel SQL Editor di Supabase (dopo 0021) ed
-- eseguilo una volta sola.

create table public.giorni_chiusura (
  id uuid primary key default gen_random_uuid(),
  data_inizio date not null,
  data_fine date not null,
  nota text,
  creato_da uuid references public.profili(id),
  created_at timestamptz not null default now(),
  constraint giorni_chiusura_intervallo_valido check (data_fine >= data_inizio)
);

create index giorni_chiusura_intervallo_idx on public.giorni_chiusura (data_inizio, data_fine);

alter table public.giorni_chiusura enable row level security;

-- select: tutto lo staff (admin, maestra, assistente) deve poter vedere
-- i giorni di chiusura in Presenze/Pasti, non solo l'admin che li gestisce.
create policy "giorni_chiusura_select_staff" on public.giorni_chiusura
  for select using (public.ruolo_corrente() in ('admin', 'maestra', 'assistente'));

-- insert/update/delete: solo admin (specs/53).
create policy "giorni_chiusura_insert_admin" on public.giorni_chiusura
  for insert with check (public.ruolo_corrente() = 'admin');

create policy "giorni_chiusura_update_admin" on public.giorni_chiusura
  for update using (public.ruolo_corrente() = 'admin');

create policy "giorni_chiusura_delete_admin" on public.giorni_chiusura
  for delete using (public.ruolo_corrente() = 'admin');

grant select, insert, update, delete on public.giorni_chiusura to authenticated;

-- Grant preventivo per service_role: nessuna route lo usa ancora per
-- leggere questa tabella, ma è lo stesso bug già capitato due volte per
-- altre tabelle nuove (vedi 0018_grant_service_role_report.sql,
-- 0019_pasti_comunicati_rojac.sql) — lo evitiamo da subito.
grant select on public.giorni_chiusura to service_role;

-- =========================================================
-- "Giorno chiuso" = weekend O dentro un intervallo registrato. Funzione
-- condivisa dai due trigger sotto e riusabile da eventuali query future.
-- extract(isodow from data): 6 = sabato, 7 = domenica.
-- =========================================================
create or replace function public.giorno_chiuso(controllo date)
returns boolean
language sql stable
as $$
  select
    extract(isodow from controllo) in (6, 7)
    or exists (
      select 1 from public.giorni_chiusura
      where data_inizio <= controllo and data_fine >= controllo
    );
$$;

-- =========================================================
-- Blocco su presenze e pasti: vale per QUALUNQUE ruolo, admin incluso
-- (a differenza del blocco "solo data odierna" di
-- 0009_scrittura_solo_oggi_maestra.sql, che esenta l'admin) — vedi
-- "Regole" in specs/53.
-- =========================================================
create or replace function public.impedisci_presenza_giorno_chiuso()
returns trigger
language plpgsql
as $$
begin
  if public.giorno_chiuso(new.data) then
    raise exception 'Impossibile segnare la presenza: % è un giorno di chiusura scolastica.', new.data;
  end if;
  return new;
end;
$$;

drop trigger if exists presenze_blocca_se_chiuso on public.presenze;
create trigger presenze_blocca_se_chiuso
  before insert or update on public.presenze
  for each row execute procedure public.impedisci_presenza_giorno_chiuso();

create or replace function public.impedisci_pasto_giorno_chiuso()
returns trigger
language plpgsql
as $$
begin
  if public.giorno_chiuso(new.data) then
    raise exception 'Impossibile segnare il pasto: % è un giorno di chiusura scolastica.', new.data;
  end if;
  return new;
end;
$$;

drop trigger if exists pasti_blocca_se_chiuso on public.pasti;
create trigger pasti_blocca_se_chiuso
  before insert or update on public.pasti
  for each row execute procedure public.impedisci_pasto_giorno_chiuso();
