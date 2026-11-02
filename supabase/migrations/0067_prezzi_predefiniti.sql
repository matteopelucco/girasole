-- Girasole — Prezzi predefiniti, tipo della sezione, costi iniziali del bambino
-- (issue #396; specs/62 PRZ-*, specs/50 AMM-*, specs/55 COS-*).
-- Applicazione: in test con `supabase db push --project-ref <ref-test>`; in
-- produzione solo Matteo, a mano, con `--project-ref` esplicito e PRIMA con
-- `--dry-run` (mai SQL Editor, mai automazioni).
--
-- Ordine di rilascio: applicare questa migration in produzione subito dopo il
-- merge, prima di usare la nuova versione dell'app: la pagina "Parametri di
-- funzionamento", il campo "Tipo" delle sezioni e la creazione di un bambino
-- (che ora passa dalla funzione `crea_bambino_con_costi`) la richiedono.
--
-- DATI ESISTENTI: questa migration NON modifica nessuna riga di `bambini`,
-- `sezioni`, `costi_bambini` o `comunicazioni_retta`. Le sezioni esistenti
-- restano senza tipo; i costi già salvati restano identici al centesimo.
--
-- Cosa fa:
--   1) `prezzi_predefiniti`: tabella a riga unica con gli otto prezzi in euro
--      (numeric(6,2): da 0 a 9999,99, due decimali esatti, mai virgola mobile),
--      già compilata con 160, 200, 6, 2, 70, 70, 7, 7. Solo l'admin la legge e
--      la modifica (RLS + GRANT): niente INSERT né DELETE, quindi la riga resta
--      una sola. Non ha trigger: cambiare un prezzo non tocca nessun bambino.
--   2) `sezioni.tipo`: 'materna' | 'primavera' | NULL, senza default.
--   3) `costi_bambini`: via i default di buono pasto, marca da bollo, pre-asilo
--      e post-asilo (0037, 0039): solo i FUTURI inserimenti, le righe esistenti
--      non cambiano. Ogni inserimento scrive tutti i prezzi in modo esplicito.
--   4) `crea_bambino_con_costi(...)`: crea il bambino e, se la sezione ha un
--      tipo, la sua riga di costi, in un'unica operazione (una funzione è una
--      sola transazione: se i costi falliscono non resta nemmeno il bambino).

-- ---------------------------------------------------------------------
-- 1) Prezzi predefiniti (riga unica, solo admin)
-- ---------------------------------------------------------------------
-- I default delle colonne servono solo a rendere raggiungibili i vincoli di
-- chiave (nessuno può inserire righe: manca il privilegio INSERT); i valori
-- della riga li scrive esplicitamente l'insert qui sotto.
create table public.prezzi_predefiniti (
  id boolean primary key default true check (id),
  retta_materna numeric(6, 2) not null default 160 check (retta_materna between 0 and 9999.99),
  retta_primavera numeric(6, 2) not null default 200 check (retta_primavera between 0 and 9999.99),
  buono_pasto numeric(6, 2) not null default 6 check (buono_pasto between 0 and 9999.99),
  marca_da_bollo numeric(6, 2) not null default 2 check (marca_da_bollo between 0 and 9999.99),
  abbonamento_pre_asilo numeric(6, 2) not null default 70 check (abbonamento_pre_asilo between 0 and 9999.99),
  abbonamento_post_asilo numeric(6, 2) not null default 70 check (abbonamento_post_asilo between 0 and 9999.99),
  gettone_pre_asilo numeric(6, 2) not null default 7 check (gettone_pre_asilo between 0 and 9999.99),
  gettone_post_asilo numeric(6, 2) not null default 7 check (gettone_post_asilo between 0 and 9999.99),
  updated_at timestamptz not null default now()
);

insert into public.prezzi_predefiniti
  (id, retta_materna, retta_primavera, buono_pasto, marca_da_bollo,
   abbonamento_pre_asilo, abbonamento_post_asilo, gettone_pre_asilo, gettone_post_asilo)
values (true, 160, 200, 6, 2, 70, 70, 7, 7);

alter table public.prezzi_predefiniti enable row level security;

create policy "prezzi_predefiniti_admin_select" on public.prezzi_predefiniti
  for select to authenticated using (public.ruolo_corrente() = 'admin');

create policy "prezzi_predefiniti_admin_update" on public.prezzi_predefiniti
  for update to authenticated
  using (public.ruolo_corrente() = 'admin')
  with check (public.ruolo_corrente() = 'admin');

-- Privilegi espliciti (vedi 0065): si toglie tutto e si concede solo ciò che serve.
revoke all on public.prezzi_predefiniti from public, anon, authenticated, service_role;
grant select on public.prezzi_predefiniti to authenticated;
-- Solo UPDATE e solo sulle colonne che l'app modifica (non su `id`).
grant update (
  retta_materna, retta_primavera, buono_pasto, marca_da_bollo,
  abbonamento_pre_asilo, abbonamento_post_asilo, gettone_pre_asilo, gettone_post_asilo,
  updated_at
) on public.prezzi_predefiniti to authenticated;

-- ---------------------------------------------------------------------
-- 2) Tipo della sezione
-- ---------------------------------------------------------------------
-- Nullable e senza default: le sezioni esistenti restano senza tipo. Chi lo
-- scrive resta governato dalle policy già in vigore su `sezioni` (solo admin).
alter table public.sezioni
  add column tipo text check (tipo in ('materna', 'primavera'));

-- ---------------------------------------------------------------------
-- 3) costi_bambini: niente più prezzi predefiniti fissi
-- ---------------------------------------------------------------------
-- DROP DEFAULT non riscrive nessuna riga. Il default 0 delle altre colonne
-- (prezzo_mensile, ecc.) non cambia.
alter table public.costi_bambini alter column prezzo_buono_pasto drop default;
alter table public.costi_bambini alter column prezzo_marca_da_bollo drop default;
alter table public.costi_bambini alter column prezzo_pre_asilo drop default;
alter table public.costi_bambini alter column prezzo_post_asilo drop default;

-- ---------------------------------------------------------------------
-- 4) crea_bambino_con_costi
-- ---------------------------------------------------------------------
-- `security invoker`: gira con i permessi di chi la chiama, quindi valgono la
-- RLS e i GRANT di sempre (nessuna scorciatoia); in più controlla di
-- proposito che sia l'admin. Ritorna l'id del bambino.
--
-- Regola di copia (specs/55): retta = quella del tipo della sezione; buono
-- pasto, marca da bollo e abbonamenti pre/post-asilo = dei prezzi; i due flag
-- "richiesto" falsi; email vuota; i gettoni NON si copiano. Senza sezione, o
-- con una sezione senza tipo, nasce solo il bambino (nessuna riga di costi).
-- Se i prezzi non si leggono (riga mancante o non visibile) la funzione
-- fallisce: non si inventano valori e non resta il bambino senza costi.
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
       email_promemoria)
    values
      (v_bambino_id,
       case v_tipo when 'materna' then v_prezzi.retta_materna else v_prezzi.retta_primavera end,
       v_prezzi.buono_pasto,
       v_prezzi.marca_da_bollo,
       false,
       v_prezzi.abbonamento_pre_asilo,
       false,
       v_prezzi.abbonamento_post_asilo,
       null);
  end if;

  return v_bambino_id;
end;
$$;

revoke all on function public.crea_bambino_con_costi(text, text, uuid, date, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.crea_bambino_con_costi(text, text, uuid, date, text, text, text)
  to authenticated;
