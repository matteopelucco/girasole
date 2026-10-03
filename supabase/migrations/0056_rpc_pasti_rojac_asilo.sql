-- Girasole — RPC per conteggi e controlli dei pasti per Rojac su tutto l'asilo
-- (specs/16). Applicazione: in test con `supabase db push --project-ref
-- <ref-test>`; in produzione solo Matteo, a mano, con `--project-ref`
-- esplicito (mai SQL Editor, mai automazioni). Non incollare questo file nel
-- SQL Editor.
--
-- Perché: la comunicazione dei pasti a Rojac riguarda l'intero asilo, ma una
-- maestra vede via RLS solo le proprie sezioni. Finora il totale e i
-- controlli di blocco (presenze mancanti, dati incoerenti) giravano con la
-- service_role key. Qui diventano tre funzioni `security definer` richiamate
-- via RPC con la sessione dell'utente (issue #211, sotto-issue "a" di #38):
-- la RLS delle tabelle resta quella di sempre, le funzioni espongono solo
-- il minimo necessario e il ruolo è controllato dentro la funzione.
--
-- Perimetro di accesso (specs/16, specs/03, 0016): SOLO admin e maestra.
-- L'assistente non ha accesso ai pasti (non è un attore della
-- comunicazione a Rojac): la funzione la rifiuta, così non ottiene via RPC
-- ciò che la RLS le nega sulle tabelle. Genitore, utenti senza profilo e
-- anonimo sono respinti. Il rifiuto è un errore SQLSTATE 42501, mai un
-- insieme vuoto: un risultato vuoto di `bambini_senza_presenza_asilo`
-- significherebbe "si può comunicare", quindi il rifiuto deve essere
-- esplicito (fail-closed).
--
-- Finestra della data: come oggi lato app (lib/auth.ts:puoScrivereData),
-- l'admin può interrogare qualunque data, la maestra solo "oggi" nel fuso
-- Europe/Rome (public.oggi_roma()). Il chiamante passa la data, ma non può
-- usarla per leggere giorni che non poteva già leggere con la service_role
-- dietro il controllo applicativo.
--
-- Non toccati: la tabella pasti_comunicati, i trigger 0020 e 0052. L'INSERT
-- in pasti_comunicati con la service_role resta fino alla sotto-issue "b".

-- ---------------------------------------------------------------------
-- Controllo comune di accesso (interno alle tre RPC)
-- ---------------------------------------------------------------------
-- Non esposta: revoca a tutti i ruoli API. Le RPC sono `security definer`
-- (eseguono come il proprietario), quindi possono chiamarla anche senza
-- EXECUTE per authenticated.
create or replace function public.assicura_accesso_pasti_asilo(p_data date)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ruolo public.ruolo_utente := public.ruolo_corrente();
begin
  if v_ruolo is null or v_ruolo not in ('admin', 'maestra') then
    raise exception 'Accesso negato ai dati dei pasti dell''asilo.' using errcode = '42501';
  end if;
  if p_data is null then
    raise exception 'Data mancante.' using errcode = '22004';
  end if;
  if v_ruolo <> 'admin' and p_data <> public.oggi_roma() then
    raise exception 'Le maestre possono interrogare solo la giornata odierna.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.assicura_accesso_pasti_asilo(date) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 1) Totale dei pasti "sì" della data, bambini attivi di tutto l'asilo
-- ---------------------------------------------------------------------
create or replace function public.pasti_si_oggi_asilo(p_data date)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assicura_accesso_pasti_asilo(p_data);

  return (
    select count(*)::integer
    from public.pasti pa
    join public.bambini b on b.id = pa.bambino_id
    where pa.data = p_data
      and pa.mangiato = 'si'
      and b.attiva
  );
end;
$$;

revoke all on function public.pasti_si_oggi_asilo(date) from public, anon;
grant execute on function public.pasti_si_oggi_asilo(date) to authenticated;

-- ---------------------------------------------------------------------
-- 2) Bambini attivi di tutto l'asilo senza presenza segnata nella data
-- ---------------------------------------------------------------------
-- Solo id, nome e cognome (serve per elencare chi manca e linkare la card).
create or replace function public.bambini_senza_presenza_asilo(p_data date)
returns table (id uuid, nome text, cognome text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assicura_accesso_pasti_asilo(p_data);

  return query
    select b.id, b.nome::text, b.cognome::text
    from public.bambini b
    where b.attiva
      and not exists (
        select 1 from public.presenze p
        where p.bambino_id = b.id and p.data = p_data
      )
    order by b.cognome, b.nome;
end;
$$;

revoke all on function public.bambini_senza_presenza_asilo(date) from public, anon;
grant execute on function public.bambini_senza_presenza_asilo(date) to authenticated;

-- ---------------------------------------------------------------------
-- 3) Righe grezze per il controllo di incoerenza (specs/06, specs/16)
-- ---------------------------------------------------------------------
-- Nessuna regola qui: la logica resta in lib/consistenza.ts. Restituisce,
-- per ogni bambino attivo con almeno una presenza o un pasto nella data,
-- lo stato della presenza, i flag pre/post-asilo e il valore del pasto
-- (null se la riga non esiste). I bambini senza né presenza né pasto non
-- possono avere incoerenze e non sono restituiti.
create or replace function public.bambini_incoerenti_asilo(p_data date)
returns table (
  id uuid,
  nome text,
  cognome text,
  stato text,
  pre_asilo boolean,
  post_asilo boolean,
  mangiato text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assicura_accesso_pasti_asilo(p_data);

  return query
    select b.id, b.nome::text, b.cognome::text, p.stato, p.pre_asilo, p.post_asilo, pa.mangiato
    from public.bambini b
    left join public.presenze p on p.bambino_id = b.id and p.data = p_data
    left join public.pasti pa on pa.bambino_id = b.id and pa.data = p_data
    where b.attiva
      and (p.id is not null or pa.id is not null)
    order by b.cognome, b.nome;
end;
$$;

revoke all on function public.bambini_incoerenti_asilo(date) from public, anon;
grant execute on function public.bambini_incoerenti_asilo(date) to authenticated;
