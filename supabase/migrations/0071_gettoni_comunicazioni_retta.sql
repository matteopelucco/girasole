-- Girasole — Gettoni del mese precedente nella retta mensile
-- (issue #400, parte di #401; specs/56 RET-06, RET-09, RET-10; specs/60 PAG-01).
-- Applicazione: in test con `supabase db push --project-ref <ref-test>`; in
-- produzione solo Matteo, a mano, con `--project-ref` esplicito e PRIMA con
-- `--dry-run` (mai SQL Editor, mai automazioni).
--
-- Ordine di rilascio: dopo la 0069 (#398) e la 0070 (#399).
--
-- Cosa fa:
--   1) `comunicazioni_retta`: quattro colonne nuove (importo e numero dei
--      gettoni pre-asilo e post-asilo del mese precedente, registrati
--      all'invio). Le rette già inviate restano a 0 (default), invariate.
--   2) Modello email salvato (`impostazioni_email_retta.corpo`): aggiunge le
--      righe dei gettoni dopo la riga del conguaglio pasti (se manca, prima
--      della riga del totale). Idempotente: ogni riga si aggiunge solo se il
--      suo segnaposto non c'è già.
--   3) Modello predefinito (default della colonna `corpo`): stesso testo con
--      le due righe in più (impostare un default è per natura idempotente).
--
-- GRANT: nessuno nuovo. `comunicazioni_retta` ha già i privilegi a livello di
-- tabella (select/insert/update/delete per authenticated, select per
-- service_role): valgono anche per le colonne nuove. Nessuna policy nuova.

alter table public.comunicazioni_retta
  add column gettoni_pre_asilo numeric(8, 2) not null default 0
    check (gettoni_pre_asilo >= 0),
  add column gettoni_post_asilo numeric(8, 2) not null default 0
    check (gettoni_post_asilo >= 0),
  add column numero_gettoni_pre_asilo integer not null default 0
    check (numero_gettoni_pre_asilo >= 0),
  add column numero_gettoni_post_asilo integer not null default 0
    check (numero_gettoni_post_asilo >= 0);

-- Modello salvato: riga del pre-asilo (dopo il conguaglio pasti, altrimenti
-- prima del totale), poi riga del post-asilo (subito dopo quella del pre).
-- Flag 'n': ^ e $ valgono per riga. Il gruppo 1 conserva l'eventuale "- ".
update public.impostazioni_email_retta
   set corpo = regexp_replace(
         corpo,
         '^((?:- )?)(.*\{\{conguaglio_pasti\}\}.*)$',
         '\1\2' || chr(10) || '\1Gettoni pre-asilo (mese precedente): € {{gettoni_pre_asilo}}',
         'n')
 where corpo not like '%{{gettoni_pre_asilo}}%'
   and corpo like '%{{conguaglio_pasti}}%';

update public.impostazioni_email_retta
   set corpo = regexp_replace(
         corpo,
         '^(.*\{\{totale\}\}.*)$',
         'Gettoni pre-asilo (mese precedente): € {{gettoni_pre_asilo}}' || chr(10) || '\1',
         'n')
 where corpo not like '%{{gettoni_pre_asilo}}%'
   and corpo like '%{{totale}}%';

update public.impostazioni_email_retta
   set corpo = regexp_replace(
         corpo,
         '^((?:- )?)(.*\{\{gettoni_pre_asilo\}\}.*)$',
         '\1\2' || chr(10) || '\1Gettoni post-asilo (mese precedente): € {{gettoni_post_asilo}}',
         'n')
 where corpo not like '%{{gettoni_post_asilo}}%'
   and corpo like '%{{gettoni_pre_asilo}}%';

-- Modello predefinito.
alter table public.impostazioni_email_retta
  alter column corpo set default 'Gentile famiglia,

di seguito il riepilogo della retta di {{mese}} per {{nome}} {{cognome}}:

- Retta mensile: € {{retta_mensile}}
- Costo pasti (stima mese corrente): € {{costo_pasti}}
- Conguaglio pasti (mese precedente): € {{conguaglio_pasti}}
- Gettoni pre-asilo (mese precedente): € {{gettoni_pre_asilo}}
- Gettoni post-asilo (mese precedente): € {{gettoni_post_asilo}}
- Servizio pre-asilo: € {{costo_pre_asilo}}
- Servizio post-asilo: € {{costo_post_asilo}}
- Costi extra: € {{costi_extra}}

Totale da versare: € {{totale}}

Vi ringraziamo per la collaborazione.

Asilo Sartorio';
