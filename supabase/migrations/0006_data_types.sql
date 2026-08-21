-- Girasole — Requisito 04 (specs/04 - data-types.md): campi ed entità
-- aggiuntive per Utente / Classe / Anno Scolastico / Alunno.
--
-- Additivo: nessuna colonna esistente viene rimossa o resa
-- obbligatoria, per non rompere le funzionalità già in produzione.
-- In particolare `bambini.sezione_id` resta la "classe corrente" usata
-- da presenze/pasti/RLS esistenti — questa migration NON la tocca. La
-- relazione storica alunno↔classe multi-anno (specs/04) è modellata a
-- parte in `bambini_sezioni_storico`, pronta a schema ma senza UI in
-- questa fase (stesso pattern già usato per il portale genitori, vedi
-- specs/00 - overview.md).
--
-- Incolla questo file nel SQL Editor di Supabase (dopo
-- 0005_utenti_gestiti_da_app.sql) ed eseguilo una volta sola.

-- =========================================================
-- Utente: indirizzo di residenza e note (facoltativi)
-- =========================================================
alter table public.profili add column if not exists indirizzo_residenza text not null default '';
alter table public.profili add column if not exists note text not null default '';

-- =========================================================
-- Anno Scolastico
-- =========================================================
create table if not exists public.anni_scolastici (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  created_at timestamptz not null default now()
);

alter table public.anni_scolastici enable row level security;

create policy "anni_scolastici_select_staff" on public.anni_scolastici
  for select using (public.ruolo_corrente() in ('admin', 'maestra'));

create policy "anni_scolastici_admin_write" on public.anni_scolastici
  for all using (public.ruolo_corrente() = 'admin')
  with check (public.ruolo_corrente() = 'admin');

-- =========================================================
-- Classe (sezioni): flag attiva + anno scolastico di appartenenza.
-- Le classi non attive smetteranno di essere visibili ai genitori
-- quando verrà costruito il portale genitori (Fase 3); lo staff
-- (admin/maestra) le vede comunque, per poterle riattivare.
-- =========================================================
alter table public.sezioni add column if not exists attiva boolean not null default true;
alter table public.sezioni add column if not exists anno_scolastico_id uuid references public.anni_scolastici(id) on delete set null;

-- =========================================================
-- Alunno (bambini): data di nascita, sesso, altre note — oltre alle
-- note alimentari/allergie già presenti in `note_allergie`.
-- Nullable per compatibilità con i bambini già inseriti prima di
-- questa migration; il form admin le richiede per i nuovi.
-- =========================================================
alter table public.bambini add column if not exists data_nascita date;
alter table public.bambini add column if not exists sesso text check (sesso in ('M', 'F'));
alter table public.bambini add column if not exists altre_note text;

-- =========================================================
-- Alunno --> Classe nel tempo: uno storico multi-classe (un alunno può
-- passare per più classi/anni scolastici), additivo rispetto a
-- bambini.sezione_id. Schema pronto, senza UI in questa fase.
-- =========================================================
create table if not exists public.bambini_sezioni_storico (
  id uuid primary key default gen_random_uuid(),
  bambino_id uuid not null references public.bambini(id) on delete cascade,
  sezione_id uuid not null references public.sezioni(id) on delete cascade,
  anno_scolastico_id uuid references public.anni_scolastici(id) on delete set null,
  dal date not null default current_date,
  al date,
  created_at timestamptz not null default now()
);

alter table public.bambini_sezioni_storico enable row level security;

create policy "bambini_sezioni_storico_select_staff" on public.bambini_sezioni_storico
  for select using (public.ruolo_corrente() in ('admin', 'maestra'));

create policy "bambini_sezioni_storico_admin_write" on public.bambini_sezioni_storico
  for all using (public.ruolo_corrente() = 'admin')
  with check (public.ruolo_corrente() = 'admin');

-- =========================================================
-- Alunno --> Utente "genitore": al massimo un padre e una madre per
-- alunno. Colonna facoltativa (le righe già esistenti restano valide
-- senza tipo_genitore) con vincolo di unicità solo quando valorizzata.
-- Schema pronto, senza UI in questa fase (nessuna pagina gestisce
-- ancora bambini_genitori — vedi specs/00 - overview.md).
-- =========================================================
alter table public.bambini_genitori add column if not exists tipo_genitore text check (tipo_genitore in ('padre', 'madre'));

create unique index if not exists bambini_genitori_un_genitore_per_tipo
  on public.bambini_genitori (bambino_id, tipo_genitore)
  where tipo_genitore is not null;
