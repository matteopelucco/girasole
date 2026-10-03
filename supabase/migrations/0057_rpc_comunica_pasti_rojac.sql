-- Girasole — RPC per registrare la comunicazione dei pasti a Rojac (specs/16).
-- Applicazione: in test con `supabase db push --project-ref <ref-test>`; in
-- produzione solo Matteo, a mano, con `--project-ref` esplicito (mai SQL
-- Editor, mai automazioni). Non incollare questo file nel SQL Editor.
--
-- Perché (issue #212, sotto-issue "b" di #38): l'INSERT in pasti_comunicati
-- girava con la service_role key. L'alternativa "INSERT col client
-- dell'utente" NON regge, per tre motivi verificati sul codice:
--   1) il trigger 0033 (pasti_comunicati_blocca_se_presenze_mancanti) non è
--      `security definer`: con la sessione di una maestra vedrebbe via RLS
--      solo i bambini delle sue sezioni e non bloccherebbe più per le
--      presenze mancanti nelle altre classi;
--   2) la policy pasti_comunicati_insert_staff (0020) non vincola le colonne:
--      con un INSERT diretto l'utente sceglierebbe da sé numero_pasti,
--      comunicato_da e comunicato_da_nome di un log contabile che deve essere
--      attendibile (fattura Rojac);
--   3) il totale dei pasti è sull'intero asilo, non sulle sezioni visibili.
-- Qui la comunicazione diventa una funzione `security definer`: il ruolo è
-- verificato dentro, totale e nome sono calcolati dal database (mai passati
-- dal chiamante) e il conteggio avviene nello stesso statement dell'INSERT.
--
-- Perimetro (specs/16, specs/03): SOLO admin e maestra; l'admin qualunque
-- data, la maestra solo oggi_roma(). Assistente, genitore, utenti senza
-- profilo e anonimo sono respinti con SQLSTATE 42501, via
-- public.assicura_accesso_pasti_asilo (0056).
--
-- Blocchi: presenze mancanti -> trigger 0033 (qui eseguito col proprietario
-- della funzione, quindi vede tutto l'asilo); dati incoerenti -> controllo
-- esplicito qui sotto, con lo stesso predicato di 0056
-- (bambini_incoerenti_asilo). Comunicazione già presente per la data ->
-- violazione di unicità 23505 (unique su data, 0020).
--
-- Non toccati: i trigger 0020 (pasti_blocca_se_comunicato), 0033 e 0052.

-- ---------------------------------------------------------------------
-- 1) comunica_pasti_rojac(p_data)
-- ---------------------------------------------------------------------
-- Restituisce una riga con il totale registrato e il nome di chi comunica
-- (serve all'email di notifica). Le colonne di uscita hanno nomi diversi da
-- quelli della tabella per evitare ambiguità con le variabili plpgsql.
create or replace function public.comunica_pasti_rojac(p_data date)
returns table (numero_comunicato integer, comunicato_nome text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_nome text;
  v_numero integer;
begin
  perform public.assicura_accesso_pasti_asilo(p_data);

  if exists (select 1 from public.bambini_incoerenti_asilo(p_data)) then
    raise exception 'Impossibile comunicare i pasti: ci sono bambini con dati incoerenti per questa data.';
  end if;

  select coalesce(
           nullif(btrim(coalesce(pr.nome, '') || ' ' || coalesce(pr.cognome, '')), ''),
           (select u.email::text from auth.users u where u.id = v_uid),
           'Sconosciuto'
         )
    into v_nome
    from public.profili pr
   where pr.id = v_uid;

  -- Conteggio e INSERT in un solo statement: il totale registrato è quello
  -- visto dallo snapshot dell'INSERT. Il trigger 0033 rifiuta se c'è un
  -- bambino attivo senza presenza.
  insert into public.pasti_comunicati as pc (data, numero_pasti, comunicato_da, comunicato_da_nome)
  values (
    p_data,
    (
      select count(*)::integer
      from public.pasti pa
      join public.bambini b on b.id = pa.bambino_id
      where pa.data = p_data
        and pa.mangiato = 'si'
        and b.attiva
    ),
    v_uid,
    coalesce(v_nome, 'Sconosciuto')
  )
  returning pc.numero_pasti into v_numero;

  return query select v_numero, coalesce(v_nome, 'Sconosciuto');
end;
$$;

revoke all on function public.comunica_pasti_rojac(date) from public, anon;
grant execute on function public.comunica_pasti_rojac(date) to authenticated;

-- ---------------------------------------------------------------------
-- 2) L'INSERT diretto non serve più a nessun ruolo API
-- ---------------------------------------------------------------------
-- Dopo il passaggio all'RPC, nessun codice inserisce in pasti_comunicati col
-- client dell'utente. Si toglie il privilegio INSERT ad authenticated (e ad
-- anon, se presente come default di Supabase) così il log non è più
-- falsificabile con una chiamata diretta alla REST API; la policy
-- pasti_comunicati_insert_staff resta come difesa in profondità. SELECT
-- resta invariato. Il GRANT INSERT a service_role (0021) non viene toccato
-- qui: serve al codice attuale fino al deploy; sarà rimosso a parte.
revoke insert on public.pasti_comunicati from public, anon, authenticated;
