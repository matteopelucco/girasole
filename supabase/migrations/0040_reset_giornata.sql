-- Girasole — Reset presenze e pasti di una giornata (specs/57): dopo
-- prove fatte per errore in produzione, l'admin deve poter eliminare
-- tutte le presenze e i pasti di una data (qualunque, anche passata),
-- di tutte le classi, per ripulire i dati. Finora presenze/pasti non
-- avevano nessuna policy di delete (il grant su queste due tabelle,
-- 0004_fix_grant_tabelle.sql, non è mai bastato da solo: senza una
-- policy la RLS blocca comunque tutto). Solo admin, nessuna eccezione
-- per maestra/assistente (specs/57 — a differenza di insert/update, mai
-- concesse a loro nemmeno sulla propria sezione).
--
-- Incolla questo file nel SQL Editor di Supabase (test e produzione),
-- dopo la 0039, ed eseguilo una volta sola.

create policy "presenze_delete_admin" on public.presenze
  for delete using (public.ruolo_corrente() = 'admin');

create policy "pasti_delete_admin" on public.pasti
  for delete using (public.ruolo_corrente() = 'admin');
