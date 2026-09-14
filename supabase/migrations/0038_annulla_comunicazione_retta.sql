-- Girasole — Annullare l'invio di una comunicazione retta (specs/56):
-- l'admin può "sbiancare" una comunicazione già inviata per poterla
-- reinviare (es. dopo un errore negli importi comunicati). Finora
-- comunicazioni_retta non aveva nessuna policy di update/delete da
-- interfaccia (log pensato come del tutto immutabile) — il caso reale
-- di dover correggere un invio sbagliato richiede di poter cancellare
-- la riga per liberare il vincolo unique (bambino_id, mese) e permettere
-- un nuovo invio. Resta immutabile nel senso che non si aggiorna mai una
-- riga esistente: la si cancella e se ne crea una nuova al prossimo
-- invio, mai un update sul posto (nessuna policy di update aggiunta qui).
--
-- Incolla questo file nel SQL Editor di Supabase (test e produzione),
-- dopo la 0037, ed eseguilo una volta sola.

create policy "comunicazioni_retta_admin_delete" on public.comunicazioni_retta
  for delete using (public.ruolo_corrente() = 'admin');

grant delete on public.comunicazioni_retta to authenticated;
