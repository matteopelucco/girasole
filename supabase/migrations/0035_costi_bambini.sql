-- Girasole — Costi bambino (specs/55 - costi-bambino.md): prezzo della
-- retta mensile, prezzo del buono pasto, abbonamento pre-asilo/
-- post-asilo (flag + prezzo mensile) ed email a cui inviare il
-- promemoria mensile. Base dati usata dalla comunicazione mensile
-- della retta (specs/56 - comunicazione-retta-mensile.md).
--
-- Incolla questo file nel SQL Editor di Supabase (test e produzione)
-- ed eseguilo una volta sola.

create table public.costi_bambini (
  bambino_id uuid primary key references public.bambini(id) on delete cascade,
  prezzo_mensile numeric(10, 2) not null default 0,
  prezzo_buono_pasto numeric(10, 2) not null default 0,
  pre_asilo_richiesto boolean not null default false,
  prezzo_pre_asilo numeric(10, 2) not null default 0,
  post_asilo_richiesto boolean not null default false,
  prezzo_post_asilo numeric(10, 2) not null default 0,
  email_promemoria text,
  updated_at timestamptz not null default now()
);

alter table public.costi_bambini enable row level security;

-- Solo l'admin, in ogni operazione: dato economico, non visibile a
-- maestre/genitori in questa fase (stesso pattern di profili_orari,
-- vedi 0024_profili_orari.sql).
create policy "costi_bambini_admin_all" on public.costi_bambini
  for all using (public.ruolo_corrente() = 'admin')
  with check (public.ruolo_corrente() = 'admin');

grant select, insert, update, delete on public.costi_bambini to authenticated;
