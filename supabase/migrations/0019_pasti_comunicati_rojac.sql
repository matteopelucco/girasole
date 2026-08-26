-- Girasole — comunicazione pasti a Rojac (specs/16 -
-- comunicazione-pasti-rojac.md): una volta comunicati i pasti di una
-- classe per una data, la maestra non può più modificarli (l'admin sì,
-- sempre — vedi specs/14). Ogni comunicazione resta in un log
-- permanente per il confronto con la fattura Rojac di fine mese.
-- Incolla questo file nel SQL Editor di Supabase (test e produzione)
-- dopo 0018 ed eseguilo una volta sola.

-- =========================================================
-- 1) Tabella di log delle comunicazioni: una per (sezione, data). Il
-- nome di chi ha comunicato è salvato come testo al momento dell'azione
-- (non solo come riferimento al profilo): è un log contabile, non deve
-- cambiare retroattivamente se il profilo viene rinominato o eliminato.
-- Nessuna policy di update/delete: il log è immutabile per costruzione,
-- non solo per convenzione applicativa.
-- =========================================================
create table if not exists public.pasti_comunicati (
  id uuid primary key default gen_random_uuid(),
  sezione_id uuid not null references public.sezioni(id) on delete cascade,
  data date not null,
  numero_pasti integer not null,
  comunicato_da uuid references public.profili(id),
  comunicato_da_nome text not null,
  comunicato_at timestamptz not null default now(),
  unique (sezione_id, data)
);

alter table public.pasti_comunicati enable row level security;

create policy "pasti_comunicati_select_staff" on public.pasti_comunicati
  for select using (
    public.ruolo_corrente() = 'admin'
    or (
      public.ruolo_corrente() = 'maestra'
      and exists (
        select 1 from public.maestre_sezioni ms
        where ms.maestra_id = auth.uid() and ms.sezione_id = pasti_comunicati.sezione_id
      )
    )
  );

-- Si può comunicare solo una data che si potrebbe altrimenti modificare
-- (stessa regola "solo oggi" per la maestra, qualunque data per
-- l'admin — vedi 0009_scrittura_solo_oggi_maestra.sql).
create policy "pasti_comunicati_insert_staff" on public.pasti_comunicati
  for insert with check (
    public.ruolo_corrente() = 'admin'
    or (
      data = public.oggi_roma()
      and public.ruolo_corrente() = 'maestra'
      and exists (
        select 1 from public.maestre_sezioni ms
        where ms.maestra_id = auth.uid() and ms.sezione_id = pasti_comunicati.sezione_id
      )
    )
  );

grant select, insert on public.pasti_comunicati to authenticated;

-- Il report email notturno legge questa tabella con la service_role key
-- (lib/reportPresenze.ts): senza questo grant esplicito fallisce con
-- "permission denied", stesso bug già capitato una volta per le altre
-- tabelle del report — vedi 0018_grant_service_role_report.sql.
grant select on public.pasti_comunicati to service_role;

-- =========================================================
-- 2) Blocco della modifica pasti dopo una comunicazione, solo per la
-- maestra (l'admin può sempre scrivere, specs/14 e specs/16). Vincolo
-- imposto anche qui a livello di database, non solo in UI, stesso
-- principio già in uso per le altre regole pasti (0012, 0017).
-- =========================================================
create or replace function public.impedisci_pasto_se_comunicato()
returns trigger
language plpgsql
as $$
declare
  v_sezione_id uuid;
begin
  if public.ruolo_corrente() = 'admin' then
    return new;
  end if;

  select sezione_id into v_sezione_id from public.bambini where id = new.bambino_id;

  if v_sezione_id is not null and exists (
    select 1 from public.pasti_comunicati
    where sezione_id = v_sezione_id and data = new.data
  ) then
    raise exception 'Impossibile modificare il pasto: i pasti di questa classe per questa data sono già stati comunicati a Rojac.';
  end if;

  return new;
end;
$$;

drop trigger if exists pasti_blocca_se_comunicato on public.pasti;
create trigger pasti_blocca_se_comunicato
  before insert or update on public.pasti
  for each row execute procedure public.impedisci_pasto_se_comunicato();
