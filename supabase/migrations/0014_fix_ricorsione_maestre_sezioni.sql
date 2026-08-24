-- Girasole — fix: ricorsione RLS su maestre_sezioni_select_colleghe
--
-- Bug: la policy "maestre_sezioni_select_colleghe" (0013_report_anagrafica.sql)
-- interroga public.maestre_sezioni dentro la propria USING per trovare le
-- sezioni della maestra corrente ("mie"). Quella lettura riattiva la RLS
-- di maestre_sezioni, la cui policy richiama di nuovo se stessa — su
-- qualunque riga, non solo la propria — e la ricorsione non si ferma
-- ("infinite recursion detected in policy for relation maestre_sezioni",
-- 42P17). Colpisce qualunque login staff, non solo l'anagrafica: la
-- select su profili (requireProfilo) valuta anche le policy
-- "profili_select_colleghe"/"profili_select_genitori_per_staff", che a
-- loro volta interrogano maestre_sezioni.
--
-- Fix: stesso pattern di ruolo_corrente() in
-- 0007_fix_ruolo_corrente_ricorsione.sql — una funzione security definer
-- che legge "le mie sezioni" bypassando la RLS invece di riattivarla.
--
-- Incolla questo file nel SQL Editor di Supabase (dopo 0013) ed
-- eseguilo una volta sola.

create or replace function public.sezioni_di_maestra_corrente()
returns setof uuid
language sql stable security definer
set search_path = public
as $$
  select sezione_id from public.maestre_sezioni where maestra_id = auth.uid();
$$;

drop policy if exists "maestre_sezioni_select_colleghe" on public.maestre_sezioni;
create policy "maestre_sezioni_select_colleghe" on public.maestre_sezioni
  for select using (
    sezione_id in (select public.sezioni_di_maestra_corrente())
  );
