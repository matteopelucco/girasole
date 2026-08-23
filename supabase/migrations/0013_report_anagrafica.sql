-- Girasole — Requisito 51 (specs/51 - report.md), scenario "anagrafica
-- classi": servono due permessi in più che prima non erano necessari
-- da nessun'altra parte dell'app.
--
-- Incolla questo file nel SQL Editor di Supabase (dopo 0012) ed
-- eseguilo una volta sola.

-- =========================================================
-- 1) Una maestra deve poter vedere il profilo (nome/cognome) di
-- eventuali colleghe assegnate alla stessa classe, per l'elenco
-- "maestre assegnate" dell'anagrafica. Prima poteva vedere solo il
-- proprio profilo (profili_select_own_or_admin, 0001_init.sql).
-- =========================================================
create policy "profili_select_colleghe" on public.profili
  for select using (
    ruolo = 'maestra'
    and exists (
      select 1 from public.maestre_sezioni mie
      join public.maestre_sezioni sue on sue.sezione_id = mie.sezione_id
      where mie.maestra_id = auth.uid() and sue.maestra_id = profili.id
    )
  );

-- Corollario: per calcolare "colleghe sulla stessa sezione" serve poter
-- leggere anche le righe di maestre_sezioni di quelle colleghe, non
-- solo la propria (maestre_sezioni_select_own, 0002_admin_e_maestre.sql).
create policy "maestre_sezioni_select_colleghe" on public.maestre_sezioni
  for select using (
    exists (
      select 1 from public.maestre_sezioni mie
      where mie.maestra_id = auth.uid() and mie.sezione_id = maestre_sezioni.sezione_id
    )
  );

-- =========================================================
-- 2) Una maestra deve poter vedere i dati (nome, cognome, email,
-- telefono) dei genitori dei bambini delle proprie classi, per
-- l'elenco genitori dell'anagrafica. Prima era possibile solo
-- all'admin.
-- =========================================================
create policy "profili_select_genitori_per_staff" on public.profili
  for select using (
    ruolo = 'genitore'
    and exists (
      select 1 from public.bambini_genitori bg
      join public.bambini b on b.id = bg.bambino_id
      where bg.genitore_id = profili.id
        and (
          public.ruolo_corrente() = 'admin'
          or exists (
            select 1 from public.maestre_sezioni ms
            where ms.maestra_id = auth.uid() and ms.sezione_id = b.sezione_id
          )
        )
    )
  );
