-- Girasole — Straordinario residuo e controllo settimanale (estende
-- specs/19 - monte-ore.md): la carenza di una settimana viene coperta
-- prima dallo straordinario della stessa settimana; solo la carenza non
-- coperta fa aumentare automaticamente il monte ore. Lo straordinario
-- che resta dopo aver coperto la carenza ("straordinario residuo") NON
-- scala più automaticamente il monte ore: resta in attesa di una
-- decisione esplicita dell'admin (pagamento mensile, oppure scalo dal
-- monte ore), registrata su `ore_lavoro_settimane`.
--
-- Incolla questo file nel SQL Editor di Supabase (dopo
-- 0031_monte_ore.sql) ed eseguilo una volta sola.

-- =========================================================
-- Snapshot del controllo calcolato alla conferma (specs/19): valori
-- immutabili una volta scritti (un cambio di profilo orario successivo
-- o una correzione delle ore non li ricalcola da sola), colonne di
-- ore_lavoro_settimane perché sono un attributo 1:1 della conferma
-- stessa, non una tabella a parte.
-- =========================================================
alter table public.ore_lavoro_settimane
  add column ore_dovute numeric(6, 2) not null default 0,
  add column ore_ordinarie_erogate numeric(6, 2) not null default 0,
  add column ore_straordinarie_erogate numeric(6, 2) not null default 0,
  add column straordinario_residuo numeric(6, 2) not null default 0 check (straordinario_residuo >= 0),
  add column decisione_straordinari text check (decisione_straordinari in ('pagamento_mensile', 'monte_ore')),
  add column decisione_straordinari_at timestamptz,
  add column decisione_straordinari_admin_id uuid references public.profili(id),
  add constraint ore_lavoro_settimane_decisione_richiede_residuo
    check (decisione_straordinari is null or straordinario_residuo > 0),
  add constraint ore_lavoro_settimane_decisione_con_data_e_admin
    check (
      (decisione_straordinari is null and decisione_straordinari_at is null and decisione_straordinari_admin_id is null)
      or (decisione_straordinari is not null and decisione_straordinari_at is not null and decisione_straordinari_admin_id is not null)
    );

-- Nuova policy di update: finora ore_lavoro_settimane non ne aveva
-- alcuna (una conferma si registrava e basta, mai più modificata) — ora
-- serve per permettere solo all'admin di registrare la decisione
-- sull'eventuale straordinario residuo. Nessuna policy per il diretto
-- interessato: la decisione spetta solo all'admin (specs/19).
create policy "ore_lavoro_settimane_update_admin" on public.ore_lavoro_settimane
  for update using (public.ruolo_corrente() = 'admin')
  with check (public.ruolo_corrente() = 'admin');

grant update on public.ore_lavoro_settimane to authenticated;

-- =========================================================
-- Nuovo tipo di movimento: `straordinario_residuo`, registrato solo
-- quando l'admin sceglie di scalare dal monte ore lo straordinario
-- residuo di una settimana (mai una compensazione automatica). Sempre
-- <= 0 (il monte ore può solo scalare per questo tipo), sempre legato a
-- una settimana, al massimo uno per settimana per persona.
-- =========================================================
alter table public.monte_ore_movimenti drop constraint monte_ore_movimenti_tipo_check;
alter table public.monte_ore_movimenti
  add constraint monte_ore_movimenti_tipo_check
    check (tipo in ('settimanale', 'precarico', 'straordinario_residuo'));

alter table public.monte_ore_movimenti
  add constraint monte_ore_movimenti_straordinario_residuo_con_settimana
    check (tipo <> 'straordinario_residuo' or settimana_inizio is not null),
  add constraint monte_ore_movimenti_settimanale_non_negativo
    check (tipo <> 'settimanale' or variazione >= 0),
  add constraint monte_ore_movimenti_straordinario_residuo_non_positivo
    check (tipo <> 'straordinario_residuo' or variazione <= 0);

create unique index monte_ore_movimenti_straordinario_residuo_unico
  on public.monte_ore_movimenti (utente_id, settimana_inizio)
  where tipo = 'straordinario_residuo';

-- insert: solo l'admin può registrare un movimento `straordinario_residuo`
-- (è sempre conseguenza di una sua decisione) — la policy esistente
-- "monte_ore_movimenti_insert_settimanale_own_or_admin" già permette
-- all'admin di inserire qualunque tipo, questa non cambia: nessuna
-- nuova policy necessaria, il vincolo è già coperto dal ramo
-- `public.ruolo_corrente() = 'admin'`.
