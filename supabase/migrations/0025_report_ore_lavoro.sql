-- Girasole — Report ore di lavoro (specs/18 - report-ore-lavoro.md): il
-- personale abilitato (specs/17) registra ore ordinarie/straordinarie o
-- malattia/assenza per ciascun giorno feriale della settimana corrente,
-- e conferma la settimana quando l'ha verificata. Una settimana
-- confermata non è più modificabile in autonomia dal personale, solo
-- dall'admin.
--
-- Incolla questo file nel SQL Editor di Supabase (dopo
-- 0024_profili_orari.sql) ed eseguilo una volta sola.

-- =========================================================
-- Un giorno registrato per un utente: lavorativo (ore ordinarie/
-- straordinarie), malattia (codice obbligatorio) o assenza (nota
-- obbligatoria) — mutuamente esclusivi, imposti anche a livello di
-- database (non solo in UI) perché sono dati che, una volta confermati,
-- diventano stabili.
-- =========================================================
create table public.ore_lavoro_giorni (
  id uuid primary key default gen_random_uuid(),
  utente_id uuid not null references public.profili(id) on delete cascade,
  data date not null,
  stato text not null default 'lavorativo' check (stato in ('lavorativo', 'malattia', 'assenza')),
  ore_ordinarie numeric(4, 2) not null default 0 check (ore_ordinarie >= 0),
  ore_straordinarie numeric(4, 2) not null default 0 check (ore_straordinarie >= 0),
  motivo_straordinario text,
  codice_malattia text,
  nota_assenza text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (utente_id, data),
  constraint ore_lavoro_giorni_straordinario_con_motivo
    check (ore_straordinarie = 0 or (motivo_straordinario is not null and length(trim(motivo_straordinario)) > 0)),
  constraint ore_lavoro_giorni_malattia_con_codice
    check (stato <> 'malattia' or (codice_malattia is not null and length(trim(codice_malattia)) > 0)),
  constraint ore_lavoro_giorni_assenza_con_nota
    check (stato <> 'assenza' or (nota_assenza is not null and length(trim(nota_assenza)) > 0))
);

create index ore_lavoro_giorni_utente_data_idx on public.ore_lavoro_giorni (utente_id, data);

-- =========================================================
-- Conferma di una settimana: l'esistenza della riga È la conferma,
-- stesso pattern già usato per report_giornalieri_inviati/
-- report_periodici_inviati (0009/specs/52) invece di un flag booleano
-- da tenere sincronizzato. settimana_inizio è sempre un lunedì.
-- =========================================================
create table public.ore_lavoro_settimane (
  id uuid primary key default gen_random_uuid(),
  utente_id uuid not null references public.profili(id) on delete cascade,
  settimana_inizio date not null,
  confermata_at timestamptz not null default now(),
  unique (utente_id, settimana_inizio)
);

alter table public.ore_lavoro_giorni enable row level security;
alter table public.ore_lavoro_settimane enable row level security;

-- Vero se la settimana che contiene p_giorno è già stata confermata da
-- p_utente. p_giorno - (isodow - 1) = lunedì di quella settimana (in
-- Postgres date - integer = date, isodow: 1 = lunedì ... 7 = domenica).
create or replace function public.settimana_ore_lavoro_confermata(p_utente uuid, p_giorno date)
returns boolean
language sql stable
as $$
  select exists (
    select 1 from public.ore_lavoro_settimane
    where utente_id = p_utente
      and settimana_inizio = p_giorno - (extract(isodow from p_giorno)::int - 1)
  );
$$;

-- select: i propri dati, o l'admin (che in una fase successiva potrà
-- rivedere/correggere i dati di chiunque — specs/18, "Fuori scope": i
-- permessi sono già pronti, l'interfaccia non ancora).
create policy "ore_lavoro_giorni_select_own_or_admin" on public.ore_lavoro_giorni
  for select using (utente_id = auth.uid() or public.ruolo_corrente() = 'admin');

-- insert/update: il proprietario, solo se la settimana di quel giorno
-- non è già confermata; l'admin sempre (specs/18: "non è più
-- modificabile in autonomia dal personale, ma solo da admin").
create policy "ore_lavoro_giorni_insert_own_o_admin" on public.ore_lavoro_giorni
  for insert with check (
    public.ruolo_corrente() = 'admin'
    or (utente_id = auth.uid() and not public.settimana_ore_lavoro_confermata(utente_id, data))
  );

create policy "ore_lavoro_giorni_update_own_o_admin" on public.ore_lavoro_giorni
  for update using (
    public.ruolo_corrente() = 'admin'
    or (utente_id = auth.uid() and not public.settimana_ore_lavoro_confermata(utente_id, data))
  );

grant select, insert, update on public.ore_lavoro_giorni to authenticated;

-- Stesso vincolo di "giorno chiuso" già in vigore per presenze/pasti
-- (specs/53 - calendario-scolastico.md, la cui nota "Regole" rimandava
-- esplicitamente a questa futura funzionalità): vale per QUALUNQUE
-- ruolo, admin incluso, riusando la funzione public.giorno_chiuso già
-- definita in 0022_calendario_scolastico.sql.
create or replace function public.impedisci_ore_lavoro_giorno_chiuso()
returns trigger
language plpgsql
as $$
begin
  if public.giorno_chiuso(new.data) then
    raise exception 'Impossibile registrare le ore: % è un giorno di chiusura scolastica.', new.data;
  end if;
  return new;
end;
$$;

drop trigger if exists ore_lavoro_giorni_blocca_se_chiuso on public.ore_lavoro_giorni;
create trigger ore_lavoro_giorni_blocca_se_chiuso
  before insert or update on public.ore_lavoro_giorni
  for each row execute procedure public.impedisci_ore_lavoro_giorno_chiuso();

-- select/insert su ore_lavoro_settimane: i propri dati, o l'admin.
-- Nessun update (una conferma non si modifica, si registra soltanto);
-- delete solo admin, predisposto per un'eventuale "riapertura" futura
-- della settimana (fuori scope in questa fase: nessuna UI la usa).
create policy "ore_lavoro_settimane_select_own_or_admin" on public.ore_lavoro_settimane
  for select using (utente_id = auth.uid() or public.ruolo_corrente() = 'admin');

create policy "ore_lavoro_settimane_insert_own_or_admin" on public.ore_lavoro_settimane
  for insert with check (utente_id = auth.uid() or public.ruolo_corrente() = 'admin');

create policy "ore_lavoro_settimane_delete_admin" on public.ore_lavoro_settimane
  for delete using (public.ruolo_corrente() = 'admin');

grant select, insert, delete on public.ore_lavoro_settimane to authenticated;

-- Grant preventivo per service_role: nessuna route lo usa ancora per
-- queste due tabelle, ma è lo stesso bug già capitato più volte per
-- altre tabelle nuove (vedi 0018_grant_service_role_report.sql e
-- successivi) — lo evitiamo da subito.
grant select on public.ore_lavoro_giorni, public.ore_lavoro_settimane to service_role;
