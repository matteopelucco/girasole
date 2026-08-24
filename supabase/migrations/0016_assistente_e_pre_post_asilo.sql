-- Girasole — Requisito "Assistente" (specs/03) + presenze a pre-asilo/
-- post-asilo (specs/13). Esegui DOPO 0015 (che aggiunge 'assistente'
-- all'enum ruolo_utente), come "Run" separato.
--
-- Incolla questo file nel SQL Editor di Supabase (dopo 0015) ed
-- eseguilo una volta sola.

-- =========================================================
-- 1) Presenze: pre-asilo/post-asilo (specs/13 - segna-presenza.md).
-- Validi solo quando stato = 'presente' — vincolo anche a livello di
-- database, non solo in UI/server action.
-- =========================================================
alter table public.presenze add column if not exists pre_asilo boolean not null default false;
alter table public.presenze add column if not exists post_asilo boolean not null default false;

alter table public.presenze drop constraint if exists presenze_pre_post_solo_presente;
alter table public.presenze add constraint presenze_pre_post_solo_presente
  check (stato = 'presente' or (pre_asilo = false and post_asilo = false));

-- =========================================================
-- 2) Sezioni/bambini/presenze: l'assistente vede le stesse classi di
-- una maestra (stessa tabella maestre_sezioni) e ha lo stesso perimetro
-- di scrittura su presenze (specs/03 - matrice permessi). Le policy
-- insert/update di presenze (ridefinite in 0009 con la regola "solo
-- oggi") non controllavano esplicitamente il ruolo, solo l'appartenenza
-- a maestre_sezioni: aggiungiamo qui il controllo esplicito, per
-- chiarezza e perché la stessa appartenenza a maestre_sezioni viene ora
-- riusata anche per i pasti (vedi punto 3) dove NON deve bastare.
-- =========================================================
drop policy if exists "sezioni_select_staff" on public.sezioni;
create policy "sezioni_select_staff" on public.sezioni
  for select using (public.ruolo_corrente() in ('admin', 'maestra', 'assistente'));

drop policy if exists "bambini_select_maestra" on public.bambini;
create policy "bambini_select_staff" on public.bambini
  for select using (
    public.ruolo_corrente() in ('maestra', 'assistente')
    and exists (
      select 1 from public.maestre_sezioni ms
      where ms.maestra_id = auth.uid() and ms.sezione_id = bambini.sezione_id
    )
  );

drop policy if exists "presenze_select" on public.presenze;
create policy "presenze_select" on public.presenze
  for select using (
    public.ruolo_corrente() = 'admin'
    or exists (
      select 1 from public.bambini b
      where b.id = presenze.bambino_id and (
        (public.ruolo_corrente() in ('maestra', 'assistente') and exists (
          select 1 from public.maestre_sezioni ms
          where ms.maestra_id = auth.uid() and ms.sezione_id = b.sezione_id
        ))
        or exists (
          select 1 from public.bambini_genitori bg
          where bg.bambino_id = b.id and bg.genitore_id = auth.uid()
        )
      )
    )
  );

drop policy if exists "presenze_insert_staff" on public.presenze;
create policy "presenze_insert_staff" on public.presenze
  for insert with check (
    public.ruolo_corrente() = 'admin'
    or (
      data = public.oggi_roma()
      and public.ruolo_corrente() in ('maestra', 'assistente')
      and exists (
        select 1 from public.bambini b
        join public.maestre_sezioni ms on ms.sezione_id = b.sezione_id
        where b.id = presenze.bambino_id and ms.maestra_id = auth.uid()
      )
    )
  );

drop policy if exists "presenze_update_staff" on public.presenze;
create policy "presenze_update_staff" on public.presenze
  for update using (
    public.ruolo_corrente() = 'admin'
    or (
      data = public.oggi_roma()
      and public.ruolo_corrente() in ('maestra', 'assistente')
      and exists (
        select 1 from public.bambini b
        join public.maestre_sezioni ms on ms.sezione_id = b.sezione_id
        where b.id = presenze.bambino_id and ms.maestra_id = auth.uid()
      )
    )
  );

-- =========================================================
-- 3) Pasti: l'assistente NON ha accesso, né in lettura né in scrittura
-- (specs/14 - segna-pasto.md, specs/03 - matrice permessi). pasti_select
-- già controllava esplicitamente ruolo_corrente() = 'maestra' (nessuna
-- modifica necessaria: un'assistente non la soddisfa). Le policy
-- insert/update (ridefinite in 0009), invece, controllavano solo
-- l'appartenenza a maestre_sezioni, SENZA controllare il ruolo — un
-- buco che restava innocuo finché solo le maestre comparivano in quella
-- tabella, ma diventerebbe una falla reale ora che ci compaiono anche
-- le assistenti. Le ridefiniamo aggiungendo il controllo esplicito del
-- ruolo.
-- =========================================================
drop policy if exists "pasti_insert_staff" on public.pasti;
create policy "pasti_insert_staff" on public.pasti
  for insert with check (
    public.ruolo_corrente() = 'admin'
    or (
      data = public.oggi_roma()
      and public.ruolo_corrente() = 'maestra'
      and exists (
        select 1 from public.bambini b
        join public.maestre_sezioni ms on ms.sezione_id = b.sezione_id
        where b.id = pasti.bambino_id and ms.maestra_id = auth.uid()
      )
    )
  );

drop policy if exists "pasti_update_staff" on public.pasti;
create policy "pasti_update_staff" on public.pasti
  for update using (
    public.ruolo_corrente() = 'admin'
    or (
      data = public.oggi_roma()
      and public.ruolo_corrente() = 'maestra'
      and exists (
        select 1 from public.bambini b
        join public.maestre_sezioni ms on ms.sezione_id = b.sezione_id
        where b.id = pasti.bambino_id and ms.maestra_id = auth.uid()
      )
    )
  );

-- =========================================================
-- 4) Promemoria: l'assistente crea/modifica/elimina come una maestra
-- (specs/15 - memo.md, specs/03 - matrice permessi).
-- =========================================================
drop policy if exists "promemoria_select" on public.promemoria;
create policy "promemoria_select" on public.promemoria
  for select using (
    public.ruolo_corrente() in ('admin', 'maestra', 'assistente')
    or destinatario_tipo = 'tutti'
    or (destinatario_tipo = 'sezione' and exists (
      select 1 from public.bambini_genitori bg
      join public.bambini b on b.id = bg.bambino_id
      where bg.genitore_id = auth.uid() and b.sezione_id = promemoria.sezione_id
    ))
    or (destinatario_tipo = 'bambino' and exists (
      select 1 from public.bambini_genitori bg
      where bg.genitore_id = auth.uid() and bg.bambino_id = promemoria.bambino_id
    ))
  );

drop policy if exists "promemoria_insert_staff" on public.promemoria;
create policy "promemoria_insert_staff" on public.promemoria
  for insert with check (public.ruolo_corrente() in ('admin', 'maestra', 'assistente'));

drop policy if exists "promemoria_update_staff" on public.promemoria;
create policy "promemoria_update_staff" on public.promemoria
  for update using (public.ruolo_corrente() in ('admin', 'maestra', 'assistente'))
  with check (public.ruolo_corrente() in ('admin', 'maestra', 'assistente'));

drop policy if exists "promemoria_delete_staff" on public.promemoria;
create policy "promemoria_delete_staff" on public.promemoria
  for delete using (public.ruolo_corrente() in ('admin', 'maestra', 'assistente'));

-- =========================================================
-- 5) Anagrafica classi (specs/51 - report.md): un membro dello staff
-- (maestra O assistente) deve vedere i colleghi (maestra O assistente)
-- sulla stessa classe, non solo le colleghe maestre come prima.
-- =========================================================
drop policy if exists "profili_select_colleghe" on public.profili;
create policy "profili_select_colleghe" on public.profili
  for select using (
    ruolo in ('maestra', 'assistente')
    and exists (
      select 1 from public.maestre_sezioni mie
      join public.maestre_sezioni sue on sue.sezione_id = mie.sezione_id
      where mie.maestra_id = auth.uid() and sue.maestra_id = profili.id
    )
  );

-- =========================================================
-- 6) Report notturno automatico (specs/52 - report-email-automatico.md):
-- idempotenza per i report settimanale/mensile, tracciata per tipo e
-- per il giorno riepilogato (non per "inizio periodo": in modalità
-- "sempre" lo stesso periodo viene rimandato ogni notte con dati
-- aggiornati, quindi ogni notte è una entry distinta). Il giornaliero
-- resta tracciato dalla tabella già esistente
-- report_giornalieri_inviati (0009), non toccata qui, per non perdere
-- lo storico invii già raccolto. Nessuna policy select/insert per
-- utenti autenticati: la route del cron usa la service_role key.
-- =========================================================
create table if not exists public.report_periodici_inviati (
  tipo text not null check (tipo in ('settimanale', 'mensile')),
  data date not null,
  inviato_at timestamptz not null default now(),
  primary key (tipo, data)
);

alter table public.report_periodici_inviati enable row level security;
