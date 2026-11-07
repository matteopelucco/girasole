-- Girasole — Modifica degli importi di una retta già inviata, con storico
-- (specs/60, PAG-02..PAG-15; issue #421). Applicazione: in test con
-- `supabase db push --remote=<ref-test>`; in produzione solo Matteo,
-- a mano, con `--remote=<ref>` esplicito (mai SQL Editor, mai automazioni).
-- Non incollare questo file nel SQL Editor.
--
-- Cosa fa:
--   1) `comunicazioni_retta`: tre colonne per leggere subito "Modificata il …
--      da …" e "Totale della mail" (tutte vuote finché il mese non è stato
--      modificato; devono essere tutte vuote o tutte piene).
--   2) Tabella `modifiche_comunicazioni_retta`: storico in sola aggiunta, una
--      riga per modifica (chi, quando, motivo, totale prima/dopo e le sole
--      voci cambiate con valore prima e dopo). `on delete cascade`: "Annulla
--      invio" cancella la retta e con lei lo storico. RLS: solo l'admin legge.
--      Nessuna policy né privilegio di insert/update/delete: si scrive solo
--      dalla funzione qui sotto.
--   3) Funzione `modifica_importi_comunicazione_retta`: in una sola
--      transazione controlla che l'utente sia admin e che il bonifico non sia
--      stato verificato, riscrive le voci, ricalcola il totale come somma,
--      aggiorna la comunicazione e scrive lo storico (tutto o niente).
--
-- Non cambia mai: inviata_il, inviata_da, email_destinatario, il numero dei
-- gettoni e le colonne del bonifico.
--
-- GRANT: la tabella nuova nasce col suo GRANT (solo select ad authenticated).
-- La funzione è `security definer` con `search_path` vuoto e controlla il
-- ruolo dentro; execute solo ad authenticated (anon e public revocati).

-- ---------------------------------------------------------------------
-- 1) Colonne sulla comunicazione
-- ---------------------------------------------------------------------
alter table public.comunicazioni_retta
  add column modificata_il timestamptz,
  add column modificata_da_nome text,
  add column totale_mail numeric(10, 2);

alter table public.comunicazioni_retta
  add constraint comunicazioni_retta_modifica_completa
    check (
      (modificata_il is null and modificata_da_nome is null and totale_mail is null)
      or (modificata_il is not null and modificata_da_nome is not null and totale_mail is not null)
    );

-- ---------------------------------------------------------------------
-- 2) Storico delle modifiche (solo aggiunta)
-- ---------------------------------------------------------------------
create table public.modifiche_comunicazioni_retta (
  id uuid primary key default gen_random_uuid(),
  comunicazione_id uuid not null references public.comunicazioni_retta(id) on delete cascade,
  modificata_il timestamptz not null default now(),
  modificata_da uuid references public.profili(id) on delete set null,
  -- Nome scritto per esteso al momento della modifica, come `inviata_da_nome`.
  modificata_da_nome text not null,
  motivo text not null
    check (btrim(motivo) <> '' and char_length(motivo) <= 500),
  totale_prima numeric(10, 2) not null,
  totale_dopo numeric(10, 2) not null,
  -- Le sole voci cambiate: {"costo_pasti": {"prima": 108.00, "dopo": 100.00}, ...}
  modifiche jsonb not null
    check (jsonb_typeof(modifiche) = 'object' and modifiche <> '{}'::jsonb)
);

create index modifiche_comunicazioni_retta_comunicazione_idx
  on public.modifiche_comunicazioni_retta (comunicazione_id, modificata_il desc);

alter table public.modifiche_comunicazioni_retta enable row level security;

create policy "modifiche_comunicazioni_retta_admin_select" on public.modifiche_comunicazioni_retta
  for select using (public.ruolo_corrente() = 'admin');

-- Privilegi minimi: solo lettura per la sessione dell'admin. Niente a anon,
-- niente a service_role (nessun codice la usa), niente insert/update/delete:
-- le righe le scrive solo la funzione, che gira come proprietario.
revoke all on public.modifiche_comunicazioni_retta from public, anon, authenticated, service_role;
grant select on public.modifiche_comunicazioni_retta to authenticated;

-- ---------------------------------------------------------------------
-- 3) Funzione di modifica
-- ---------------------------------------------------------------------
-- Errori (SQLSTATE): 42501 non admin; 22004 valore mancante; 22023 dati non
-- validi o nessuna modifica; P0002 comunicazione inesistente; 55000 bonifico
-- già verificato. Restituisce il nuovo totale.
create or replace function public.modifica_importi_comunicazione_retta(
  p_comunicazione_id uuid,
  p_motivo text,
  p_retta_mensile numeric,
  p_marca_da_bollo numeric,
  p_costo_pasti numeric,
  p_conguaglio_pasti numeric,
  p_costo_pre_asilo numeric,
  p_costo_post_asilo numeric,
  p_gettoni_pre_asilo numeric,
  p_gettoni_post_asilo numeric,
  p_costi_extra numeric,
  p_credito_debito numeric,
  p_note_costi_extra text,
  p_nota_credito_debito text
)
returns numeric
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_nome text;
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_note_extra text := nullif(btrim(coalesce(p_note_costi_extra, '')), '');
  v_nota_cd text := nullif(btrim(coalesce(p_nota_credito_debito, '')), '');
  v_max constant numeric := 999999.99;
  v_c public.comunicazioni_retta%rowtype;
  v_voce record;
  v_diff jsonb := '{}'::jsonb;
  v_totale numeric;
begin
  -- Solo l'admin (fail-closed: anonimo, senza profilo e altri ruoli respinti).
  if public.ruolo_corrente() is distinct from 'admin' then
    raise exception 'Accesso negato: solo l''admin può modificare gli importi.' using errcode = '42501';
  end if;

  if p_comunicazione_id is null then
    raise exception 'Comunicazione mancante.' using errcode = '22004';
  end if;
  if v_motivo = '' then
    raise exception 'Scrivi il motivo della modifica.' using errcode = '22023';
  end if;
  if char_length(v_motivo) > 500 then
    raise exception 'Il motivo può essere lungo al massimo 500 caratteri.' using errcode = '22023';
  end if;
  if char_length(coalesce(v_note_extra, '')) > 500 or char_length(coalesce(v_nota_cd, '')) > 500 then
    raise exception 'Le note possono essere lunghe al massimo 500 caratteri.' using errcode = '22023';
  end if;

  -- Controllo delle voci: presenti, a due decimali, entro il limite, non
  -- negative tranne conguaglio pasti e credito/debito.
  for v_voce in
    select * from (values
      ('Retta mensile', p_retta_mensile, false),
      ('Marca da bollo', p_marca_da_bollo, false),
      ('Pasti', p_costo_pasti, false),
      ('Conguaglio pasti', p_conguaglio_pasti, true),
      ('Pre-asilo', p_costo_pre_asilo, false),
      ('Post-asilo', p_costo_post_asilo, false),
      ('Gettoni pre-asilo', p_gettoni_pre_asilo, false),
      ('Gettoni post-asilo', p_gettoni_post_asilo, false),
      ('Costi extra', p_costi_extra, false),
      ('Credito/Debito', p_credito_debito, true)
    ) as t(etichetta, valore, negativa)
  loop
    if v_voce.valore is null then
      raise exception '%: importo mancante.', v_voce.etichetta using errcode = '22004';
    end if;
    if v_voce.valore <> round(v_voce.valore, 2) then
      raise exception '%: al massimo due decimali.', v_voce.etichetta using errcode = '22023';
    end if;
    if abs(v_voce.valore) > v_max then
      raise exception '%: importo troppo grande.', v_voce.etichetta using errcode = '22023';
    end if;
    if v_voce.valore < 0 and not v_voce.negativa then
      raise exception '%: l''importo non può essere negativo.', v_voce.etichetta using errcode = '22023';
    end if;
  end loop;

  -- La riga resta bloccata fino alla fine della transazione: il controllo sul
  -- bonifico vale nel momento della scrittura. Con due modifiche contemporanee
  -- vince l'ultima, e lo storico le mostra entrambe.
  select * into v_c from public.comunicazioni_retta where id = p_comunicazione_id for update;
  if not found then
    raise exception 'Comunicazione non trovata.' using errcode = 'P0002';
  end if;
  if v_c.bonifico_stato <> 'in_attesa' then
    raise exception 'Il bonifico di questa comunicazione è già stato verificato: annulla prima la verifica.'
      using errcode = '55000';
  end if;

  -- Le sole voci cambiate, con valore prima e dopo.
  select coalesce(jsonb_object_agg(d.chiave, jsonb_build_object('prima', d.prima, 'dopo', d.dopo)), '{}'::jsonb)
    into v_diff
    from (values
      ('retta_mensile', v_c.retta_mensile, p_retta_mensile),
      ('marca_da_bollo', v_c.marca_da_bollo, p_marca_da_bollo),
      ('costo_pasti', v_c.costo_pasti, p_costo_pasti),
      ('conguaglio_pasti', v_c.conguaglio_pasti, p_conguaglio_pasti),
      ('costo_pre_asilo', v_c.costo_pre_asilo, p_costo_pre_asilo),
      ('costo_post_asilo', v_c.costo_post_asilo, p_costo_post_asilo),
      ('gettoni_pre_asilo', v_c.gettoni_pre_asilo, p_gettoni_pre_asilo),
      ('gettoni_post_asilo', v_c.gettoni_post_asilo, p_gettoni_post_asilo),
      ('costi_extra', v_c.costi_extra, p_costi_extra),
      ('credito_debito', v_c.credito_debito, p_credito_debito)
    ) as d(chiave, prima, dopo)
   where d.prima is distinct from d.dopo;

  if nullif(btrim(coalesce(v_c.note_costi_extra, '')), '') is distinct from v_note_extra then
    v_diff := v_diff || jsonb_build_object(
      'note_costi_extra', jsonb_build_object('prima', v_c.note_costi_extra, 'dopo', v_note_extra));
  end if;
  if nullif(btrim(coalesce(v_c.nota_credito_debito, '')), '') is distinct from v_nota_cd then
    v_diff := v_diff || jsonb_build_object(
      'nota_credito_debito', jsonb_build_object('prima', v_c.nota_credito_debito, 'dopo', v_nota_cd));
  end if;

  if v_diff = '{}'::jsonb then
    raise exception 'Nessun valore è stato cambiato.' using errcode = '22023';
  end if;

  v_totale := p_retta_mensile + p_marca_da_bollo + p_costo_pasti + p_conguaglio_pasti
    + p_costo_pre_asilo + p_costo_post_asilo + p_gettoni_pre_asilo + p_gettoni_post_asilo
    + p_costi_extra + p_credito_debito;

  select coalesce(
           nullif(btrim(coalesce(pr.nome, '') || ' ' || coalesce(pr.cognome, '')), ''),
           (select u.email::text from auth.users u where u.id = v_uid),
           'Sconosciuto'
         )
    into v_nome
    from public.profili pr
   where pr.id = v_uid;

  update public.comunicazioni_retta
     set retta_mensile = p_retta_mensile,
         marca_da_bollo = p_marca_da_bollo,
         costo_pasti = p_costo_pasti,
         conguaglio_pasti = p_conguaglio_pasti,
         costo_pre_asilo = p_costo_pre_asilo,
         costo_post_asilo = p_costo_post_asilo,
         gettoni_pre_asilo = p_gettoni_pre_asilo,
         gettoni_post_asilo = p_gettoni_post_asilo,
         costi_extra = p_costi_extra,
         credito_debito = p_credito_debito,
         note_costi_extra = v_note_extra,
         nota_credito_debito = v_nota_cd,
         totale = v_totale,
         -- Il totale della mail è quello prima della modifica più vecchia.
         totale_mail = coalesce(totale_mail, v_c.totale),
         modificata_il = now(),
         modificata_da_nome = coalesce(v_nome, 'Sconosciuto')
   where id = p_comunicazione_id;

  insert into public.modifiche_comunicazioni_retta
    (comunicazione_id, modificata_da, modificata_da_nome, motivo, totale_prima, totale_dopo, modifiche)
  values
    (p_comunicazione_id, v_uid, coalesce(v_nome, 'Sconosciuto'), v_motivo, v_c.totale, v_totale, v_diff);

  return v_totale;
end;
$$;

revoke all on function public.modifica_importi_comunicazione_retta(
  uuid, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, text, text
) from public, anon;
grant execute on function public.modifica_importi_comunicazione_retta(
  uuid, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, text, text
) to authenticated;
