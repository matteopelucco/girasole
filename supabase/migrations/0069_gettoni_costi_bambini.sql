-- Girasole — Prezzo del gettone pre-asilo e post-asilo per bambino
-- (issue #398; specs/55 COS-09..COS-12).
-- Applicazione: in test con `supabase db push --project-ref <ref-test>`; in
-- produzione solo Matteo, a mano, con `--project-ref` esplicito e PRIMA con
-- `--dry-run` (mai SQL Editor, mai automazioni).
--
-- Ordine di rilascio: applicare questa migration in produzione subito dopo il
-- merge, prima di usare la nuova versione dell'app (la scheda del bambino e la
-- creazione di un bambino scrivono le colonne nuove).
--
-- DATI ESISTENTI: le righe di `costi_bambini` già presenti ricevono i due
-- gettoni a 7 euro (backfill, COS-11); tutti gli altri valori restano identici.
-- Nessun'altra tabella viene toccata.
--
-- Cosa fa:
--   1) `costi_bambini`: colonne `gettone_pre_asilo` e `gettone_post_asilo`,
--      numeric(6,2) not null, da 0 a 9999,99. Il default 7 serve solo a
--      riempire le righe esistenti e viene tolto subito dopo: nessun valore
--      predefinito fisso, ogni inserimento scrive i gettoni in modo esplicito.
--   2) `crea_bambino_con_costi(...)`: copia anche i gettoni dai prezzi
--      predefiniti (COS-12). Resta `security invoker`, con il controllo admin
--      e `execute` solo ad `authenticated`, come nella 0067.
--
-- GRANT: nessuno nuovo. `costi_bambini` ha i privilegi di TABELLA per
-- `authenticated` (0035: select, insert, update, delete) e per `service_role`
-- (0061: select), che coprono anche le colonne nuove; non ci sono GRANT per
-- singola colonna da estendere. La RLS (solo admin) non cambia.

-- ---------------------------------------------------------------------
-- 1) Colonne dei gettoni
-- ---------------------------------------------------------------------
alter table public.costi_bambini
  add column gettone_pre_asilo numeric(6, 2) not null default 7
    check (gettone_pre_asilo between 0 and 9999.99),
  add column gettone_post_asilo numeric(6, 2) not null default 7
    check (gettone_post_asilo between 0 and 9999.99);

alter table public.costi_bambini alter column gettone_pre_asilo drop default;
alter table public.costi_bambini alter column gettone_post_asilo drop default;

-- ---------------------------------------------------------------------
-- 2) crea_bambino_con_costi: copia anche i gettoni
-- ---------------------------------------------------------------------
-- Regola di copia (specs/55): come nella 0067, più gettone pre-asilo e
-- gettone post-asilo = dei prezzi predefiniti (COS-12).
create or replace function public.crea_bambino_con_costi(
  p_nome text,
  p_cognome text,
  p_sezione_id uuid,
  p_data_nascita date,
  p_sesso text,
  p_note_allergie text,
  p_altre_note text
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = public, pg_temp
as $$
declare
  v_bambino_id uuid;
  v_tipo text;
  v_prezzi public.prezzi_predefiniti%rowtype;
begin
  if public.ruolo_corrente() is distinct from 'admin' then
    raise exception 'Operazione riservata all''admin.' using errcode = '42501';
  end if;

  insert into public.bambini
    (nome, cognome, sezione_id, data_nascita, sesso, note_allergie, altre_note)
  values
    (p_nome, p_cognome, p_sezione_id, p_data_nascita, p_sesso, p_note_allergie, p_altre_note)
  returning id into v_bambino_id;

  if p_sezione_id is not null then
    select s.tipo into v_tipo from public.sezioni s where s.id = p_sezione_id;
  end if;

  if v_tipo is not null then
    select * into v_prezzi from public.prezzi_predefiniti where id = true;
    if not found then
      raise exception 'Prezzi predefiniti non disponibili.';
    end if;

    insert into public.costi_bambini
      (bambino_id, prezzo_mensile, prezzo_buono_pasto, prezzo_marca_da_bollo,
       pre_asilo_richiesto, prezzo_pre_asilo, post_asilo_richiesto, prezzo_post_asilo,
       gettone_pre_asilo, gettone_post_asilo, email_promemoria)
    values
      (v_bambino_id,
       case v_tipo when 'materna' then v_prezzi.retta_materna else v_prezzi.retta_primavera end,
       v_prezzi.buono_pasto,
       v_prezzi.marca_da_bollo,
       false,
       v_prezzi.abbonamento_pre_asilo,
       false,
       v_prezzi.abbonamento_post_asilo,
       v_prezzi.gettone_pre_asilo,
       v_prezzi.gettone_post_asilo,
       null);
  end if;

  return v_bambino_id;
end;
$$;

revoke all on function public.crea_bambino_con_costi(text, text, uuid, date, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.crea_bambino_con_costi(text, text, uuid, date, text, text, text)
  to authenticated;
