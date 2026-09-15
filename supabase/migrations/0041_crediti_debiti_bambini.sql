-- Girasole — Crediti e debiti di un bambino (specs/58 -
-- crediti-debiti-bambino.md): un credito o debito economico verso
-- l'asilo che non deriva dal calcolo automatico della retta (specs/56)
-- — inserito dall'admin dalla scheda del bambino con una nota
-- obbligatoria, in attesa ("da conteggiare") finché la comunicazione
-- retta del suo mese di competenza non viene inviata, momento in cui
-- diventa immutabile (stesso pattern di comunicazioni_retta,
-- 0036_comunicazione_retta.sql).
--
-- Incolla questo file nel SQL Editor di Supabase (test e produzione),
-- dopo 0040_reset_giornata.sql, ed eseguilo una volta sola.

create table public.crediti_debiti_bambini (
  id uuid primary key default gen_random_uuid(),
  bambino_id uuid not null references public.bambini(id) on delete cascade,
  mese_competenza text not null,
  importo numeric(10, 2) not null,
  nota text not null,
  origine text not null default 'manuale' check (origine in ('manuale', 'bonifico')),
  creato_da uuid references public.profili(id),
  creato_da_nome text not null,
  created_at timestamptz not null default now(),
  applicato_il timestamptz
);

-- Un solo credito/debito "da conteggiare" per bambino e mese di
-- competenza alla volta (specs/58): l'indice è parziale (solo le righe
-- ancora non applicate), quindi non impedisce a più righe già applicate
-- in mesi diversi di coesistere, né a una nuova riga di riusare lo
-- stesso mese una volta che quella precedente è stata applicata o
-- eliminata.
create unique index crediti_debiti_bambini_pendenti_uniq
  on public.crediti_debiti_bambini (bambino_id, mese_competenza)
  where applicato_il is null;

create index crediti_debiti_bambini_bambino_idx on public.crediti_debiti_bambini (bambino_id);

alter table public.crediti_debiti_bambini enable row level security;

create policy "crediti_debiti_bambini_admin_select" on public.crediti_debiti_bambini
  for select using (public.ruolo_corrente() = 'admin');

create policy "crediti_debiti_bambini_admin_insert" on public.crediti_debiti_bambini
  for insert with check (public.ruolo_corrente() = 'admin');

-- Solo per "applicare"/"liberare" (applicato_il), mai un'altra
-- modifica manuale (specs/58): l'importo/nota/mese di un credito o
-- debito non applicato si corregge eliminandolo e ricreandolo, non
-- aggiornandolo sul posto.
create policy "crediti_debiti_bambini_admin_update" on public.crediti_debiti_bambini
  for update using (public.ruolo_corrente() = 'admin')
  with check (public.ruolo_corrente() = 'admin');

-- Eliminabile solo finché non applicato (specs/58, "un credito o
-- debito già applicato non è più modificabile né eliminabile").
create policy "crediti_debiti_bambini_admin_delete" on public.crediti_debiti_bambini
  for delete using (public.ruolo_corrente() = 'admin' and applicato_il is null);

grant select, insert, update, delete on public.crediti_debiti_bambini to authenticated;
