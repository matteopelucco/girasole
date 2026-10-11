-- Girasole — registro dei lanci dei job pianificati (specs/63). Applicazione:
-- in test con `supabase db push --project-ref <ref-test>`; in produzione solo
-- Matteo, a mano, con `--project-ref` esplicito (mai SQL Editor, mai
-- automazioni). Non incollare questo file nel SQL Editor.
--
-- Ordine di rilascio: applicare questa migration in produzione PRIMA del
-- deploy del codice. Senza la tabella i cron fanno comunque il loro lavoro
-- (email di riepilogo allarmi, report notturno): la scrittura del registro
-- fallisce, finisce nei log e non ferma nulla; la pagina "Cron Job" invece
-- mostrerebbe un errore di lettura.
--
-- Tabella `cron_esecuzioni`: una riga per ogni lancio di un job pianificato
-- (Vercel Cron), scritta dal job stesso: all'inizio (nome, `iniziato_il`) e
-- alla fine (`finito_il`, `esito` 'ok'/'ko', `messaggio_errore` già ripulito
-- e accorciato dall'app). `esito` vuoto = lancio in corso o interrotto prima
-- della fine. `nome` è il nome della route in app/api/cron/ (es. `allarmi`,
-- `report-presenze`): vincolo sul formato, non sull'elenco, così un job nuovo
-- non richiede una migration. Nessun dato personale.
--
-- Accessi:
--   * RLS attiva; una sola policy: l'admin legge (SELECT). Nessuna policy di
--     INSERT/UPDATE/DELETE: nessun utente scrive nel registro, nemmeno
--     l'admin; maestra, assistente, genitore e anon non leggono nulla.
--   * Privilegi espliciti: la tabella nasce come `postgres` e con i default
--     privileges di Supabase su `public` i ruoli API potrebbero ricevere
--     privilegi più ampi del necessario (vedi 0058, 0059, 0062; service_role
--     ignora la RLS). Si revoca tutto a tutti i ruoli API, poi:
--       - authenticated: solo SELECT (filtrata dalla policy admin);
--       - service_role (solo i cron `/api/cron/*`): SELECT, INSERT, UPDATE.
--         SELECT serve alla clausola WHERE dell'aggiornamento di fine lancio
--         (e all'upsert). Nessun DELETE: nessuna pulizia automatica in questa
--         fase (due lanci al giorno, circa 730 righe all'anno).
--   * Indice su (nome, iniziato_il desc): la pagina legge gli ultimi N lanci
--     di un job alla volta.

create table public.cron_esecuzioni (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (nome ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  iniziato_il timestamptz not null default now(),
  finito_il timestamptz,
  esito text check (esito in ('ok', 'ko')),
  messaggio_errore text check (char_length(messaggio_errore) <= 500)
);

create index cron_esecuzioni_nome_iniziato_il_idx
  on public.cron_esecuzioni (nome, iniziato_il desc);

alter table public.cron_esecuzioni enable row level security;

create policy "cron_esecuzioni_admin_select" on public.cron_esecuzioni
  for select to authenticated using (public.ruolo_corrente() = 'admin');

revoke all on public.cron_esecuzioni from public, anon, authenticated, service_role;
grant select on public.cron_esecuzioni to authenticated;
grant select, insert, update on public.cron_esecuzioni to service_role;
