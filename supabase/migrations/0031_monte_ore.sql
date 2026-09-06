-- Girasole — Monte ore (specs/19 - monte-ore.md): un contatore di ore
-- per persona, aggiornato automaticamente alla conferma di ogni
-- settimana di ore di lavoro (esubero di straordinario lo scala,
-- carenza rispetto al profilo orario lo aumenta), precaricabile o
-- correggibile manualmente dall'admin con un movimento motivato da una
-- nota.
--
-- Incolla questo file nel SQL Editor di Supabase (dopo
-- 0030_profili_orari_self_select.sql) ed eseguilo una volta sola.

-- =========================================================
-- Ogni riga è un movimento di monte ore, mai modificato dopo
-- l'inserimento (ledger, stesso principio già in uso per
-- ore_lavoro_settimane/report_giornalieri_inviati: lo storico dei
-- movimenti è la fonte di verità, il saldo è la somma di `variazione`,
-- calcolata da chi legge — nessun campo "saldo" salvato a parte da
-- tenere sincronizzato). Convenzione di segno: `variazione` positiva =
-- il monte ore aumenta (cresce il debito verso la struttura);
-- negativa = il monte ore scala (si riduce il debito).
-- =========================================================
create table public.monte_ore_movimenti (
  id uuid primary key default gen_random_uuid(),
  utente_id uuid not null references public.profili(id) on delete cascade,
  tipo text not null check (tipo in ('settimanale', 'precarico')),
  settimana_inizio date,
  variazione numeric(6, 2) not null,
  nota text,
  created_at timestamptz not null default now(),
  constraint monte_ore_movimenti_settimanale_con_settimana
    check (tipo <> 'settimanale' or settimana_inizio is not null),
  constraint monte_ore_movimenti_precarico_senza_settimana
    check (tipo <> 'precarico' or settimana_inizio is null),
  constraint monte_ore_movimenti_precarico_con_nota
    check (tipo <> 'precarico' or (nota is not null and length(trim(nota)) > 0))
);

create index monte_ore_movimenti_utente_idx on public.monte_ore_movimenti (utente_id);

-- Un solo movimento automatico per settimana per persona: la conferma
-- della settimana (ore_lavoro_settimane, unique su utente_id+settimana_inizio)
-- è già la difesa primaria, questo indice è una seconda difesa allo
-- stesso livello dei dati derivati.
create unique index monte_ore_movimenti_settimanale_unico
  on public.monte_ore_movimenti (utente_id, settimana_inizio)
  where tipo = 'settimanale';

alter table public.monte_ore_movimenti enable row level security;

-- select: i propri movimenti, o l'admin (specs/19: il saldo è visibile
-- al diretto interessato e all'admin, nessun altro ruolo).
create policy "monte_ore_movimenti_select_own_or_admin" on public.monte_ore_movimenti
  for select using (utente_id = auth.uid() or public.ruolo_corrente() = 'admin');

-- insert: l'admin sempre (precarico manuale, o per conto di chiunque);
-- chiunque altro SOLO un movimento 'settimanale' su se stesso, e solo
-- se esiste davvero una conferma di quella esatta settimana per lui —
-- non può inserire un 'precarico' né un movimento per un'altra persona.
-- Nessuna policy di update/delete: i movimenti sono immutabili, una
-- correzione si registra come nuovo movimento (specs/19).
create policy "monte_ore_movimenti_insert_settimanale_own_or_admin" on public.monte_ore_movimenti
  for insert with check (
    public.ruolo_corrente() = 'admin'
    or (
      tipo = 'settimanale'
      and utente_id = auth.uid()
      and exists (
        select 1 from public.ore_lavoro_settimane s
        where s.utente_id = auth.uid() and s.settimana_inizio = monte_ore_movimenti.settimana_inizio
      )
    )
  );

grant select, insert on public.monte_ore_movimenti to authenticated;

-- Grant preventivo per service_role (il cron notturno legge i saldi per
-- il riepilogo email e il PDF mensile — specs/52): stesso bug già
-- capitato più volte per altre tabelle nuove, evitato da subito (vedi
-- 0018_grant_service_role_report.sql e successivi).
grant select on public.monte_ore_movimenti to service_role;
