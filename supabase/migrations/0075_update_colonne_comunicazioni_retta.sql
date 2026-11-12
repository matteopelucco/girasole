-- Girasole — UPDATE dell'admin su comunicazioni_retta limitato alle colonne
-- usate (specs/59, specs/60; issue #427). Applicazione: in test con
-- `supabase db push --remote=<ref-test>`; in produzione solo Matteo,
-- a mano, con `--remote=<ref>` esplicito (mai SQL Editor, mai automazioni).
-- Non incollare questo file nel SQL Editor.
--
-- Prima (0046): `grant update` su tutta la tabella. Con la propria sessione e
-- la chiave pubblica un admin poteva cambiare importi e totale senza passare
-- da `modifica_importi_comunicazione_retta` (quindi senza storico) e falsificare
-- `modificata_il`, `modificata_da_nome`, `totale_mail`.
--
-- Ora: `authenticated` aggiorna solo le colonne che l'app scrive davvero:
--   - verifica / annullo verifica del bonifico (specs/59):
--     bonifico_stato, bonifico_importo_ricevuto, bonifico_nota,
--     bonifico_verificato_da, bonifico_verificato_da_nome, bonifico_verificato_il;
--   - nota privata per riga (specs/60): nota_pagamento.
-- Gli importi, il totale e le colonne della modifica si cambiano solo dalla
-- funzione `modifica_importi_comunicazione_retta` (security definer, gira come
-- proprietario: non risente di questa restrizione).
--
-- Non cambia nessuna policy RLS (resta comunicazioni_retta_admin_update, solo
-- admin) né i privilegi di select/insert/delete. Idempotente.

revoke update on public.comunicazioni_retta from authenticated;

grant update (
  bonifico_stato,
  bonifico_importo_ricevuto,
  bonifico_nota,
  bonifico_verificato_da,
  bonifico_verificato_da_nome,
  bonifico_verificato_il,
  nota_pagamento
) on public.comunicazioni_retta to authenticated;
