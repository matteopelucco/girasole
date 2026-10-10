-- Girasole — registro degli invii della mail mensile a Rojac (specs/61). Applicazione:
-- in test con `supabase db push --project-ref <ref-test>`; in produzione solo
-- Matteo, a mano, con `--project-ref` esplicito (mai SQL Editor, mai
-- automazioni). Non incollare questo file nel SQL Editor.
--
-- Ordine di rilascio: applicare questa migration in produzione PRIMA del
-- deploy del codice. Senza la tabella la mail a Rojac parte lo stesso, ma
-- l'app non riesce a registrare l'invio e avvisa l'admin (specs/61).
--
-- 1) Tabella `invii_rojac`: una riga per ogni invio RIUSCITO della mail
--    mensile a Rojac. `mese` è il mese a cui il riepilogo si riferisce
--    ("YYYY-MM"), `inviato_il` l'istante dell'invio, `inviato_da` l'admin che
--    ha premuto "Conferma invio" (nullable: se il profilo viene eliminato la
--    riga resta, senza autore, grazie a `on delete set null`).
--    Nessun vincolo di unicità: il blocco del doppio invio è fuori scope.
--    Registro in sola aggiunta: RLS attiva, solo l'admin legge (SELECT) e
--    inserisce (INSERT, e solo a proprio nome); nessuna policy né privilegio
--    di UPDATE/DELETE per nessuno. Nessun privilegio per `anon` e per
--    `service_role` (l'allarme della parte b, issue #282, li aggiungerà
--    con la sua migration se servono).
--    Privilegi espliciti: la tabella nasce come `postgres` e con i default
--    privileges di Supabase su `public` i ruoli API potrebbero ricevere
--    privilegi più ampi del necessario (vedi 0058 e 0059; service_role
--    ignora la RLS). Si revoca quindi tutto a tutti i ruoli API e si concede
--    solo select e insert ad authenticated: in test e in produzione il
--    risultato è lo stesso, qualunque siano i default dell'ambiente.
-- 2) Vincolo su allarmi_inviati.tipo (ultima versione: 0061, con il nome
--    automatico `allarmi_inviati_tipo_check`): si aggiunge il quarto valore
--    `rojac_non_inviata`, che userà l'allarme della parte b. Il DROP è senza
--    `if exists` di proposito: se il nome fosse diverso la migration deve
--    fallire (è transazionale), non lasciare il vecchio vincolo che
--    rifiuterebbe il nuovo valore. Nessun allarme in questa migration.

create table public.invii_rojac (
  id uuid primary key default gen_random_uuid(),
  mese text not null check (mese ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  inviato_il timestamptz not null default now(),
  inviato_da uuid references public.profili(id) on delete set null
);

alter table public.invii_rojac enable row level security;

create policy "invii_rojac_admin_select" on public.invii_rojac
  for select using (public.ruolo_corrente() = 'admin');

create policy "invii_rojac_admin_insert" on public.invii_rojac
  for insert with check (public.ruolo_corrente() = 'admin' and inviato_da = auth.uid());

revoke all on public.invii_rojac from public, anon, authenticated, service_role;
grant select, insert on public.invii_rojac to authenticated;

alter table public.allarmi_inviati
  drop constraint allarmi_inviati_tipo_check;

alter table public.allarmi_inviati
  add constraint allarmi_inviati_tipo_check
  check (tipo in (
    'presenze_pasti_mezzogiorno',
    'settimana_ore_non_confermata',
    'rette_non_comunicate',
    'rojac_non_inviata'
  ));
