-- Girasole — feedback da una sessione di test con un'insegnante
-- (specs/14 - segna-pasto.md, specs/15 - memo.md).
--
-- Incolla questo file nel SQL Editor di Supabase (dopo 0011) ed
-- eseguilo una volta sola.

-- =========================================================
-- 1) Rimozione dello stato "parziale" dai pasti: nella pratica un
-- pasto è mangiato o no, un dettaglio va nella nota libera. I dati
-- storici già segnati "parziale" diventano "si" (il bambino ha
-- comunque mangiato, anche se non tutto), con la nota che lo ricorda.
-- =========================================================
update public.pasti
set note = trim(concat_ws(' ', 'Pasto parziale (dato storico, vedi nota).', note)),
    mangiato = 'si'
where mangiato = 'parziale';

alter table public.pasti drop constraint if exists pasti_mangiato_check;
alter table public.pasti add constraint pasti_mangiato_check check (mangiato in ('si', 'no'));

-- =========================================================
-- 2) Un bambino "assente" non può avere un pasto segnato per la
-- stessa data: vincolo imposto a livello di database (non solo UI),
-- perché è una regola di integrità dei dati, non solo di interfaccia.
-- Riguarda solo lo stato "assente", non "malattia".
-- =========================================================
create or replace function public.impedisci_pasto_bambino_assente()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1 from public.presenze
    where bambino_id = new.bambino_id
      and data = new.data
      and stato = 'assente'
  ) then
    raise exception 'Impossibile segnare il pasto: il bambino è assente in questa data.';
  end if;
  return new;
end;
$$;

drop trigger if exists pasti_blocca_se_assente on public.pasti;
create trigger pasti_blocca_se_assente
  before insert or update on public.pasti
  for each row execute procedure public.impedisci_pasto_bambino_assente();

-- =========================================================
-- 3) Promemoria: mancavano le policy di update/delete (solo insert e
-- select esistevano in 0001_init.sql) — impedivano di modificare o
-- cancellare un promemoria già pubblicato (specs/15 - memo.md).
-- Permesso a qualunque membro dello staff, non solo all'autore,
-- coerente con "lo staff vede tutti i promemoria".
-- =========================================================
create policy "promemoria_update_staff" on public.promemoria
  for update using (public.ruolo_corrente() in ('admin', 'maestra'))
  with check (public.ruolo_corrente() in ('admin', 'maestra'));

create policy "promemoria_delete_staff" on public.promemoria
  for delete using (public.ruolo_corrente() in ('admin', 'maestra'));
