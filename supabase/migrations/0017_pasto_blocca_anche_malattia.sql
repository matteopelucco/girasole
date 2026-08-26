-- Girasole — estende il blocco pasto già in vigore per "assente"
-- (0012_pasto_senza_parziale.sql) anche allo stato "malattia"
-- (specs/14 - segna-pasto.md): un bambino malato non viene servito a
-- pranzo, quindi il pasto non è selezionabile per lui quanto per un
-- assente. Sostituisce la funzione trigger esistente (il trigger
-- pasti_blocca_se_assente resta invariato, richiama la funzione per
-- nome).

create or replace function public.impedisci_pasto_bambino_assente()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1 from public.presenze
    where bambino_id = new.bambino_id
      and data = new.data
      and stato in ('assente', 'malattia')
  ) then
    raise exception 'Impossibile segnare il pasto: il bambino è assente o malato in questa data.';
  end if;
  return new;
end;
$$;
