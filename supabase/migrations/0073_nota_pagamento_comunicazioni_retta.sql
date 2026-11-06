-- Girasole — Nota privata per riga in "Pagamenti bambino" (specs/60,
-- PAG-05..PAG-08; issue #417). Applicazione: in test con
-- `supabase db push --remote=<ref-test>`; in produzione solo Matteo,
-- a mano, con `--remote=<ref>` esplicito (mai SQL Editor, mai automazioni).
-- Non incollare questo file nel SQL Editor.
--
-- Una colonna di testo sulla comunicazione retta già inviata: nota scritta
-- dall'admin su un mese comunicato, separata da `bonifico_nota` (specs/59).
-- Vuota di default, al massimo 500 caratteri. Nessuna policy RLS nuova e
-- nessun GRANT nuovo: select/update restano solo admin (0036, 0046) e i
-- privilegi di tabella a `authenticated` (0059) coprono già la colonna
-- aggiunta; anon e service_role non hanno privilegi sulla tabella.

alter table public.comunicazioni_retta
  add column if not exists nota_pagamento text;

alter table public.comunicazioni_retta
  drop constraint if exists comunicazioni_retta_nota_pagamento_max_500;
alter table public.comunicazioni_retta
  add constraint comunicazioni_retta_nota_pagamento_max_500
    check (nota_pagamento is null or char_length(nota_pagamento) <= 500);
