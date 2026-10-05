-- Girasole — modello della mail mensile dei pasti a Rojac (specs/61).
-- Applicazione: in test con `supabase db push --project-ref <ref-test>`;
-- in produzione solo Matteo, a mano, con `--project-ref` esplicito (mai
-- SQL Editor, mai automazioni). Non incollare questo file nel SQL Editor.
--
-- Tabella a riga singola (stesso schema di impostazioni_email_retta,
-- migration 0036): chiave primaria booleana forzata a "true", seed con un
-- modello di base funzionante, modificabile dall'admin da subito.
-- Leggibile e modificabile solo dall'admin: maestra, assistente e genitore
-- non hanno nessun accesso (né SELECT né scrittura). Nessun INSERT né
-- DELETE per authenticated: la riga esiste già, si fa sempre UPDATE.
create table public.impostazioni_email_rojac (
  id boolean primary key default true check (id),
  oggetto text not null default 'Pasti {{mese}} — Asilo Sartorio',
  corpo text not null default 'Buongiorno,

di seguito il riepilogo dei pasti di {{mese}} per l''Asilo Sartorio:

- Pasti bambini: {{pasti_bambini}}
- Pasti insegnanti ({{giorni_scuola}} giorni di scuola): {{pasti_insegnanti}}

Totale pasti: {{totale_pasti}}

Grazie e cordiali saluti.

Asilo Sartorio',
  updated_at timestamptz not null default now()
);

insert into public.impostazioni_email_rojac (id) values (true);

alter table public.impostazioni_email_rojac enable row level security;

create policy "impostazioni_email_rojac_admin_select" on public.impostazioni_email_rojac
  for select using (public.ruolo_corrente() = 'admin');

create policy "impostazioni_email_rojac_admin_update" on public.impostazioni_email_rojac
  for update using (public.ruolo_corrente() = 'admin')
  with check (public.ruolo_corrente() = 'admin');

grant select, update on public.impostazioni_email_rojac to authenticated;
