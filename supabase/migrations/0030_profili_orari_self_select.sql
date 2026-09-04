-- Girasole — Bug: un utente non admin non poteva leggere il proprio
-- profilo orario assegnato. `0024_profili_orari.sql` aveva scritto la
-- policy select come "solo admin" perché all'epoca i profili orari non
-- erano ancora usati da nessuna pagina (specs/54: "non ancora mostrati
-- allo staff"). Ma `0025_report_ore_lavoro.sql`, arrivata dopo, ha reso
-- il report ore di lavoro dipendente proprio da questa lettura per
-- precaricare le ore ordinarie (specs/18, scenario "aprire la sezione
-- mostra la settimana corrente con le ore precaricate" —
-- lib/profiliOrari.ts:recuperaProfiloOrario, chiamata anche per l'utente
-- che sta guardando le PROPRIE ore, non solo dall'admin). La RLS blocca
-- silenziosamente la lettura per chi non è admin (nessun errore: la
-- select ritorna semplicemente zero righe), quindi ogni maestra/
-- assistente vede sempre "0 ore ordinarie" invece del precaricato dal
-- proprio profilo — bug non intercettato dall'unico test e2e esistente
-- (e2e/18-report-ore-lavoro.spec.ts) perché gira con l'account admin,
-- a cui la policy "solo admin" già permette la lettura.
--
-- Incolla questo file nel SQL Editor di Supabase (dopo
-- 0029_fix_ore_lavoro_vincolo_futuro.sql) ed eseguilo una volta sola.

create policy "profili_orari_select_own" on public.profili_orari
  for select using (
    id in (select profilo_orario_id from public.profili where id = auth.uid())
  );
