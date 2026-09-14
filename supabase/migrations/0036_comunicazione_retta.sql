-- Girasole — Comunicazione retta mensile (specs/56 -
-- comunicazione-retta-mensile.md): log immutabile delle comunicazioni
-- inviate ai genitori (un record per bambino e mese) e template
-- configurabile della mail (oggetto + corpo con placeholder).
--
-- Incolla questo file nel SQL Editor di Supabase (test e produzione),
-- dopo 0035_costi_bambini.sql, ed eseguilo una volta sola.

-- =========================================================
-- Log delle comunicazioni inviate: un solo record per bambino e mese
-- (`mese` in formato "YYYY-MM", stessa convenzione di lib/date.ts).
-- Importi salvati come snapshot di quanto effettivamente comunicato,
-- non ricalcolati in seguito. Nessuna policy di update/delete:
-- immutabile per costruzione, stesso pattern di pasti_comunicati
-- (0020_pasti_comunicati_globale.sql).
-- =========================================================
create table public.comunicazioni_retta (
  id uuid primary key default gen_random_uuid(),
  bambino_id uuid not null references public.bambini(id) on delete cascade,
  mese text not null,
  retta_mensile numeric(10, 2) not null,
  costo_pasti numeric(10, 2) not null,
  conguaglio_pasti numeric(10, 2) not null,
  costo_pre_asilo numeric(10, 2) not null,
  costo_post_asilo numeric(10, 2) not null,
  costi_extra numeric(10, 2) not null,
  note_costi_extra text,
  totale numeric(10, 2) not null,
  email_destinatario text not null,
  inviata_da uuid references public.profili(id),
  inviata_da_nome text not null,
  inviata_il timestamptz not null default now(),
  unique (bambino_id, mese)
);

alter table public.comunicazioni_retta enable row level security;

create policy "comunicazioni_retta_admin_select" on public.comunicazioni_retta
  for select using (public.ruolo_corrente() = 'admin');

create policy "comunicazioni_retta_admin_insert" on public.comunicazioni_retta
  for insert with check (public.ruolo_corrente() = 'admin');

grant select, insert on public.comunicazioni_retta to authenticated;

-- =========================================================
-- Template della mail: riga singola (chiave primaria booleana forzata
-- a "true" — trucco standard per una tabella a una sola riga, nessuna
-- altra riga può soddisfare il check). Seed con un modello di base
-- funzionante, modificabile dall'admin da subito.
-- =========================================================
create table public.impostazioni_email_retta (
  id boolean primary key default true check (id),
  oggetto text not null default 'Promemoria retta {{mese}} — {{nome}} {{cognome}}',
  corpo text not null default 'Gentile famiglia,

di seguito il riepilogo della retta di {{mese}} per {{nome}} {{cognome}}:

- Retta mensile: € {{retta_mensile}}
- Costo pasti (stima mese corrente): € {{costo_pasti}}
- Conguaglio pasti (mese precedente): € {{conguaglio_pasti}}
- Servizio pre-asilo: € {{costo_pre_asilo}}
- Servizio post-asilo: € {{costo_post_asilo}}
- Costi extra: € {{costi_extra}}

Totale da versare: € {{totale}}

Vi ringraziamo per la collaborazione.

Asilo Sartorio',
  updated_at timestamptz not null default now()
);

insert into public.impostazioni_email_retta (id) values (true);

alter table public.impostazioni_email_retta enable row level security;

create policy "impostazioni_email_retta_admin_all" on public.impostazioni_email_retta
  for all using (public.ruolo_corrente() = 'admin')
  with check (public.ruolo_corrente() = 'admin');

grant select, insert, update on public.impostazioni_email_retta to authenticated;
