-- Girasole — specs/16 - comunicazione-pasti-rojac.md: nuovo requisito,
-- la comunicazione pasti a Rojac è bloccata finché anche un solo
-- bambino attivo dell'asilo non ha ancora una presenza segnata per
-- quella data (qualunque stato: presente/assente/malattia, non
-- necessariamente "presente" — un dato mancante non è un'assenza
-- implicita). Stesso principio delle altre regole pasti già applicate
-- anche a livello di database (vedi 0012_pasto_senza_parziale.sql,
-- 0017_pasto_blocca_anche_malattia.sql, 0020_pasti_comunicati_globale.sql):
-- l'app (PaginaClassi + comunicaPastiRojac) nasconde già il pulsante e
-- controlla prima dell'insert, ma questo trigger è la difesa reale.
-- Incolla questo file nel SQL Editor di Supabase (test e produzione) ed
-- eseguilo una volta sola.

create or replace function public.impedisci_comunicazione_se_presenze_mancanti()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from public.bambini b
    where b.attiva = true
      and not exists (
        select 1 from public.presenze p
        where p.bambino_id = b.id and p.data = new.data
      )
  ) then
    raise exception 'Impossibile comunicare i pasti: ci sono bambini con la presenza non ancora segnata per questa data.';
  end if;

  return new;
end;
$$;

create trigger pasti_comunicati_blocca_se_presenze_mancanti
  before insert on public.pasti_comunicati
  for each row execute procedure public.impedisci_comunicazione_se_presenze_mancanti();
