-- Girasole — Verifica del bonifico di una retta (specs/59 -
-- verifica-bonifico-retta.md): stato di verifica del bonifico ricevuto
-- per ogni comunicazione retta inviata. Nasce sempre "in_attesa"; solo
-- un admin può marcarla "corretto" o "importo_errato" (mai il
-- contrario, stessa immutabilità di comunicazioni_retta) — nessuna
-- nuova policy RLS necessaria, le colonne vivono sulla stessa riga già
-- protetta da 0036_comunicazione_retta.sql.
--
-- Incolla questo file nel SQL Editor di Supabase (test e produzione),
-- dopo 0042_credito_debito_comunicazione_retta.sql, ed eseguilo una
-- volta sola.

alter table public.comunicazioni_retta
  add column bonifico_stato text not null default 'in_attesa'
    check (bonifico_stato in ('in_attesa', 'corretto', 'importo_errato')),
  add column bonifico_importo_ricevuto numeric(10, 2),
  add column bonifico_nota text,
  add column bonifico_verificato_da uuid references public.profili(id),
  add column bonifico_verificato_da_nome text,
  add column bonifico_verificato_il timestamptz;
