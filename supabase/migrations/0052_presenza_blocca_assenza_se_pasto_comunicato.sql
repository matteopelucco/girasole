-- Girasole — specs/16 - comunicazione-pasti-rojac.md (issue #100, R4.2/
-- R4.3): dopo la comunicazione dei pasti di una data a Rojac, maestra e
-- assistente non possono più far passare a "assente" o "malattia" la
-- presenza di un bambino che ha il pasto di quella data segnato "sì".
-- Evita il caso "pasto comunicato e fatturato, poi bambino segnato
-- assente" (incoerenza di specs/06 e scostamento con la fattura Rojac).
-- Stesso principio delle altre regole pasti già imposte anche a livello
-- di database (0012, 0017, 0020, 0033): la UI disabilita già i pulsanti
-- Assente/Malattia per la maestra, ma questo trigger è la difesa reale.
--
-- Regole (vedi "Regole" in specs/16):
-- - Esentato solo il ruolo admin (ruolo_corrente() = 'admin'), come il
--   blocco dei pasti di 0020: l'admin deve poter correggere errori reali
--   (e potrebbe comunque correggere prima il pasto in "no").
-- - Bloccato solo il PASSAGGIO a assente/malattia: da nessuna presenza o
--   da "presente". Una riga già assente/malattia resta modificabile
--   (nota, passaggio assente <-> malattia): non cambia il conteggio.
-- - Pasto considerato: quello attuale del bambino per quella data
--   (dopo la comunicazione solo l'admin può cambiarlo, vedi 0020).
-- - Nessuna eccezione per service_role / SQL Editor (ruolo_corrente() è
--   null senza una sessione utente), come per il trigger di 0020. Oggi
--   nessuno script/cron scrive in presenze; il reset giornata (specs/57,
--   0040) è un DELETE e non attiva questo trigger (solo INSERT/UPDATE).
--
-- SECURITY DEFINER: la funzione legge pasti e pasti_comunicati, che la
-- RLS nasconde all'assistente (pasti: nessun accesso; pasti_comunicati:
-- select solo admin/maestra). Eseguita con i diritti del chiamante,
-- per l'assistente le due exists sarebbero sempre false e il blocco non
-- scatterebbe mai. search_path fissato per evitare hijacking; la
-- funzione non restituisce dati, solo accetta o rifiuta la riga.
--
-- Upsert (INSERT ... ON CONFLICT DO UPDATE, usato dall'app): in Postgres
-- scatta prima il trigger BEFORE INSERT sulla riga proposta e poi, in
-- caso di conflitto, il BEFORE UPDATE. Per questo nel ramo INSERT lo
-- stato precedente si legge dalla tabella (può esistere già una riga per
-- bambino+data), non si assume "nessuna presenza".
--
-- In test la applica il reset del DB di CI (supabase db reset); in
-- produzione la applica Matteo a mano dopo il merge (supabase db push
-- --project-ref <ref-produzione>), vedi CLAUDE.md.

create or replace function public.impedisci_assenza_se_pasto_comunicato()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  stato_precedente text;
begin
  if new.stato not in ('assente', 'malattia') then
    return new;
  end if;

  if public.ruolo_corrente() = 'admin' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.bambino_id = new.bambino_id and old.data = new.data then
    stato_precedente := old.stato;
  else
    select p.stato into stato_precedente
    from public.presenze p
    where p.bambino_id = new.bambino_id
      and p.data = new.data;
  end if;

  if stato_precedente in ('assente', 'malattia') then
    return new;
  end if;

  if exists (select 1 from public.pasti_comunicati pc where pc.data = new.data)
     and exists (
       select 1 from public.pasti pa
       where pa.bambino_id = new.bambino_id
         and pa.data = new.data
         and pa.mangiato = 'si'
     ) then
    raise exception 'Impossibile segnare assente o malattia: il pasto di questo bambino è già stato comunicato a Rojac.';
  end if;

  return new;
end;
$$;

-- Nessun grant/revoke dedicato: una funzione "returns trigger" non è
-- invocabile direttamente (né via SQL né via RPC di PostgREST, che
-- espone solo funzioni non-trigger), quindi la security definer non
-- apre una nuova superficie chiamabile.

drop trigger if exists presenze_blocca_assenza_se_pasto_comunicato on public.presenze;
create trigger presenze_blocca_assenza_se_pasto_comunicato
  before insert or update on public.presenze
  for each row execute procedure public.impedisci_assenza_se_pasto_comunicato();
