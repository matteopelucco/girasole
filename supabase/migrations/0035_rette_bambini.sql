-- Girasole — Parametri di retta per bambino (specs/55 -
-- parametri-retta.md): prezzo della retta mensile, prezzo del buono
-- pasto ed email a cui inviare il promemoria mensile degli importi.
-- Tabella dedicata (non colonne su `bambini`) perché è un dato
-- economico che resta fuori dalla visibilità di maestre/assistenti.
-- Solo la configurazione dei parametri in questa fase: calcolo
-- dell'importo dovuto, invio del promemoria e stato pagamento restano
-- fuori scope (vedi specs/00 - overview.md).
--
-- Incolla questo file nel SQL Editor di Supabase (dopo
-- 0034_grant_service_role_profili.sql) ed eseguilo una volta sola.

create table public.rette_bambini (
  bambino_id uuid primary key references public.bambini(id) on delete cascade,
  prezzo_mensile numeric(10, 2) not null default 0,
  prezzo_buono_pasto numeric(10, 2) not null default 0,
  email_promemoria text,
  updated_at timestamptz not null default now()
);

alter table public.rette_bambini enable row level security;

-- Solo l'admin, in ogni operazione: dato economico, non ancora
-- visibile a maestre/genitori in questa fase (stesso pattern di
-- profili_orari, vedi 0024_profili_orari.sql).
create policy "rette_bambini_admin_all" on public.rette_bambini
  for all using (public.ruolo_corrente() = 'admin')
  with check (public.ruolo_corrente() = 'admin');

grant select, insert, update, delete on public.rette_bambini to authenticated;
