-- Girasole — correzione a specs/16 - comunicazione-pasti-rojac.md: la
-- comunicazione a Rojac non è per singola classe ma per l'intero asilo,
-- una volta al giorno. Sostituisce lo schema per-sezione introdotto in
-- 0019_pasti_comunicati_rojac.sql (mai usato in pratica: corretto prima
-- ancora di essere applicato/usato con dati reali) con uno per-data.
-- Incolla questo file nel SQL Editor di Supabase (test e produzione)
-- dopo 0019 (o al posto suo, se 0019 non è mai stata applicata) ed
-- eseguilo una volta sola.

drop trigger if exists pasti_blocca_se_comunicato on public.pasti;
drop table if exists public.pasti_comunicati cascade;

-- =========================================================
-- 1) Tabella di log: una sola comunicazione per data (non più per
-- sezione+data). Nome di chi ha comunicato salvato come testo al
-- momento dell'azione (log contabile, non deve cambiare
-- retroattivamente). Nessuna policy di update/delete: immutabile per
-- costruzione.
-- =========================================================
create table public.pasti_comunicati (
  id uuid primary key default gen_random_uuid(),
  data date not null unique,
  numero_pasti integer not null,
  comunicato_da uuid references public.profili(id),
  comunicato_da_nome text not null,
  comunicato_at timestamptz not null default now()
);

alter table public.pasti_comunicati enable row level security;

-- Chiunque abbia accesso a Pasti vede se oggi è già stato comunicato,
-- indipendentemente dalle classi a cui è assegnato: è un dato
-- sull'intero asilo, non su una singola classe.
create policy "pasti_comunicati_select_staff" on public.pasti_comunicati
  for select using (public.ruolo_corrente() in ('admin', 'maestra'));

-- Si può comunicare solo una data che si potrebbe altrimenti
-- modificare (stessa regola "solo oggi" per la maestra, qualunque data
-- per l'admin — vedi 0009_scrittura_solo_oggi_maestra.sql). Chiunque
-- abbia il ruolo, non solo chi è assegnato a una sezione specifica:
-- l'azione riguarda l'intero asilo.
create policy "pasti_comunicati_insert_staff" on public.pasti_comunicati
  for insert with check (
    public.ruolo_corrente() = 'admin'
    or (data = public.oggi_roma() and public.ruolo_corrente() = 'maestra')
  );

grant select, insert on public.pasti_comunicati to authenticated;

-- Il report email notturno legge questa tabella con la service_role
-- key (lib/reportPresenze.ts): senza questo grant esplicito fallisce
-- con "permission denied", stesso bug già capitato una volta per le
-- altre tabelle del report — vedi 0018_grant_service_role_report.sql.
grant select on public.pasti_comunicati to service_role;

-- =========================================================
-- 2) Blocco della modifica pasti dopo una comunicazione, per QUALUNQUE
-- classe, solo per la maestra (l'admin può sempre scrivere, specs/14 e
-- specs/16). A differenza della versione precedente non serve più
-- risalire alla sezione del bambino: basta guardare la data.
-- =========================================================
create or replace function public.impedisci_pasto_se_comunicato()
returns trigger
language plpgsql
as $$
begin
  if public.ruolo_corrente() = 'admin' then
    return new;
  end if;

  if exists (select 1 from public.pasti_comunicati where data = new.data) then
    raise exception 'Impossibile modificare il pasto: i pasti di questa data sono già stati comunicati a Rojac.';
  end if;

  return new;
end;
$$;

create trigger pasti_blocca_se_comunicato
  before insert or update on public.pasti
  for each row execute procedure public.impedisci_pasto_se_comunicato();
