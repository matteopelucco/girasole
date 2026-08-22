-- Girasole — Requisito 13/14: il ruolo "maestra" può inserire/modificare
-- presenze e pasti solo per la data odierna (fuso Europe/Rome);
-- l'admin resta senza restrizioni di data. La RLS è la difesa primaria
-- (CLAUDE.md), non solo l'interfaccia: senza questa migration una
-- maestra potrebbe comunque scrivere su date passate/future chiamando
-- direttamente la server action.
--
-- Incolla questo file nel SQL Editor di Supabase (dopo 0008) ed
-- eseguilo una volta sola.

-- =========================================================
-- "Oggi" nel fuso Europe/Rome, lato database — equivalente di
-- lib/date.ts:oggi(), usato dalle policy sotto e dal report notturno.
-- =========================================================
create or replace function public.oggi_roma()
returns date
language sql stable
as $$
  select (now() at time zone 'Europe/Rome')::date;
$$;

-- =========================================================
-- presenze: le policy insert/update sostituiscono quelle di 0001,
-- aggiungendo il vincolo "solo oggi" per la maestra.
-- =========================================================
drop policy if exists "presenze_insert_staff" on public.presenze;
create policy "presenze_insert_staff" on public.presenze
  for insert with check (
    public.ruolo_corrente() = 'admin'
    or (
      data = public.oggi_roma()
      and exists (
        select 1 from public.bambini b
        join public.maestre_sezioni ms on ms.sezione_id = b.sezione_id
        where b.id = presenze.bambino_id and ms.maestra_id = auth.uid()
      )
    )
  );

drop policy if exists "presenze_update_staff" on public.presenze;
create policy "presenze_update_staff" on public.presenze
  for update using (
    public.ruolo_corrente() = 'admin'
    or (
      data = public.oggi_roma()
      and exists (
        select 1 from public.bambini b
        join public.maestre_sezioni ms on ms.sezione_id = b.sezione_id
        where b.id = presenze.bambino_id and ms.maestra_id = auth.uid()
      )
    )
  );

-- =========================================================
-- pasti: stessa regola.
-- =========================================================
drop policy if exists "pasti_insert_staff" on public.pasti;
create policy "pasti_insert_staff" on public.pasti
  for insert with check (
    public.ruolo_corrente() = 'admin'
    or (
      data = public.oggi_roma()
      and exists (
        select 1 from public.bambini b
        join public.maestre_sezioni ms on ms.sezione_id = b.sezione_id
        where b.id = pasti.bambino_id and ms.maestra_id = auth.uid()
      )
    )
  );

drop policy if exists "pasti_update_staff" on public.pasti;
create policy "pasti_update_staff" on public.pasti
  for update using (
    public.ruolo_corrente() = 'admin'
    or (
      data = public.oggi_roma()
      and exists (
        select 1 from public.bambini b
        join public.maestre_sezioni ms on ms.sezione_id = b.sezione_id
        where b.id = pasti.bambino_id and ms.maestra_id = auth.uid()
      )
    )
  );

-- =========================================================
-- Tracciamento invii del riepilogo giornaliero via email (specs/13),
-- per rendere il job idempotente se rieseguito per la stessa data.
-- Nessuna policy di select/insert per utenti autenticati: la route del
-- cron (app/api/cron/report-presenze/route.ts) usa la service_role key
-- (createAdminClient), che bypassa la RLS.
-- =========================================================
create table if not exists public.report_giornalieri_inviati (
  data date primary key,
  inviato_at timestamptz not null default now()
);

alter table public.report_giornalieri_inviati enable row level security;
