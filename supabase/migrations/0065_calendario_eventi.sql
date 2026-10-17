-- Girasole — eventi del Google Calendar e indirizzo del feed (specs/64).
-- Applicazione: in test con `supabase db push --project-ref <ref-test>`; in
-- produzione solo Matteo, a mano, con `--project-ref` esplicito (mai SQL
-- Editor, mai automazioni). Non incollare questo file nel SQL Editor.
--
-- Ordine di rilascio: applicare questa migration in produzione PRIMA del
-- deploy del codice. Senza le tabelle il cron notturno fa comunque il report
-- (la sincronizzazione del calendario si ferma con un errore leggibile nel
-- registro "Cron Job"), ma la pagina "Parametri di funzionamento" non
-- riuscirebbe a leggere l'impostazione.
--
-- Cosa aggiunge (issue #319, sotto-issue "a" di #318):
--   1) `impostazioni_calendario`: tabella a riga singola (stesso schema di
--      `impostazioni_email_rojac`, 0060) con l'indirizzo iCal SEGRETO del
--      Google Calendar dell'asilo. Chi ha l'indirizzo legge il calendario: per
--      questo lo leggono e lo scrivono solo l'admin (RLS) e il cron (service_role,
--      solo SELECT). Maestra, assistente, genitore e anon: nessun accesso.
--      L'app valida l'indirizzo (https, host Google, finale .ics) prima di
--      salvarlo: il database non ripete il controllo sul formato, per poter
--      puntare a un feed finto nei test e2e (l'unico che può scrivere è l'admin).
--   2) `calendario_eventi`: gli eventi letti dal feed, già espansi (una riga per
--      occorrenza di un evento ripetuto). Lettura per admin, maestra e
--      assistente (non il genitore, non anon); nessun utente scrive.
--   3) `sostituisci_eventi_calendario(jsonb)`: l'unico modo di scrivere gli
--      eventi. `security definer`, eseguibile solo dalla service_role (il cron):
--      in una sola transazione inserisce/aggiorna gli eventi del feed e toglie
--      quelli che nel feed non ci sono più. Un errore a metà annulla tutto.
--
-- Privilegi espliciti: la tabella nasce come `postgres` e con i default
-- privileges di Supabase su `public` i ruoli API potrebbero ricevere privilegi
-- più ampi del necessario (vedi 0058, 0059, 0062, 0063): si revoca tutto e si
-- concede solo ciò che serve.

-- ---------------------------------------------------------------------
-- 1) Indirizzo del feed (riga singola, solo admin)
-- ---------------------------------------------------------------------
create table public.impostazioni_calendario (
  id boolean primary key default true check (id),
  ical_url text check (ical_url is null or char_length(ical_url) <= 2000),
  updated_at timestamptz not null default now()
);

insert into public.impostazioni_calendario (id) values (true);

alter table public.impostazioni_calendario enable row level security;

create policy "impostazioni_calendario_admin_select" on public.impostazioni_calendario
  for select to authenticated using (public.ruolo_corrente() = 'admin');

create policy "impostazioni_calendario_admin_update" on public.impostazioni_calendario
  for update to authenticated
  using (public.ruolo_corrente() = 'admin')
  with check (public.ruolo_corrente() = 'admin');

revoke all on public.impostazioni_calendario from public, anon, authenticated, service_role;
-- Nessun INSERT né DELETE: la riga esiste già, si fa sempre UPDATE (solo le
-- due colonne che l'app modifica).
grant select on public.impostazioni_calendario to authenticated;
grant update (ical_url, updated_at) on public.impostazioni_calendario to authenticated;
-- Il cron legge l'indirizzo con la service_role (bypassa la RLS, serve il GRANT).
grant select on public.impostazioni_calendario to service_role;

-- ---------------------------------------------------------------------
-- 2) Eventi del calendario (lettura staff, scrittura solo via funzione)
-- ---------------------------------------------------------------------
-- `id_esterno`: UID dell'evento nel feed, più l'occorrenza originale per gli
-- eventi ripetuti (così uno spostamento aggiorna la stessa riga).
-- Eventi di tutto il giorno: `inizio` è la mezzanotte (Europe/Rome) del primo
-- giorno e `fine` la mezzanotte del giorno dopo l'ultimo (fine esclusa).
-- Titolo, descrizione e luogo sono testo semplice (chi li mostra non li
-- interpreta come HTML).
create table public.calendario_eventi (
  id uuid primary key default gen_random_uuid(),
  id_esterno text not null unique check (char_length(id_esterno) between 1 and 600),
  titolo text not null check (char_length(titolo) <= 300),
  descrizione text check (char_length(descrizione) <= 5000),
  luogo text check (char_length(luogo) <= 500),
  inizio timestamptz not null,
  fine timestamptz not null,
  tutto_il_giorno boolean not null default false,
  aggiornato_il timestamptz not null default now(),
  check (fine >= inizio)
);

create index calendario_eventi_inizio_idx on public.calendario_eventi (inizio);

alter table public.calendario_eventi enable row level security;

create policy "calendario_eventi_staff_select" on public.calendario_eventi
  for select to authenticated
  using (public.ruolo_corrente() in ('admin', 'maestra', 'assistente'));

revoke all on public.calendario_eventi from public, anon, authenticated, service_role;
grant select on public.calendario_eventi to authenticated;
-- Nessun privilegio diretto per service_role: scrive solo tramite la funzione.

-- ---------------------------------------------------------------------
-- 3) sostituisci_eventi_calendario(p_eventi)
-- ---------------------------------------------------------------------
-- p_eventi: array JSON di oggetti { id_esterno, titolo, descrizione, luogo,
-- inizio, fine, tutto_il_giorno }. Ritorna { inseriti, aggiornati, rimossi,
-- totale }. Idempotente: con lo stesso feed non inserisce, non aggiorna e non
-- rimuove nulla (un evento si aggiorna solo se un campo è cambiato davvero).
-- `security definer` con search_path vuoto: gira col proprietario, quindi non
-- servono privilegi di tabella a chi la chiama; eseguibile solo dalla
-- service_role.
create or replace function public.sostituisci_eventi_calendario(p_eventi jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_inseriti integer;
  v_aggiornati integer;
  v_rimossi integer;
  v_totale integer;
begin
  if p_eventi is null or jsonb_typeof(p_eventi) <> 'array' then
    raise exception 'Elenco eventi non valido.';
  end if;
  if jsonb_array_length(p_eventi) > 20000 then
    raise exception 'Troppi eventi.';
  end if;

  with src as (
    select distinct on (e->>'id_esterno')
           e->>'id_esterno' as id_esterno,
           e->>'titolo' as titolo,
           nullif(e->>'descrizione', '') as descrizione,
           nullif(e->>'luogo', '') as luogo,
           (e->>'inizio')::timestamptz as inizio,
           (e->>'fine')::timestamptz as fine,
           coalesce((e->>'tutto_il_giorno')::boolean, false) as tutto_il_giorno
      from jsonb_array_elements(p_eventi) as e
     order by e->>'id_esterno'
  ),
  scritti as (
    insert into public.calendario_eventi as c
           (id_esterno, titolo, descrizione, luogo, inizio, fine, tutto_il_giorno)
    select id_esterno, titolo, descrizione, luogo, inizio, fine, tutto_il_giorno from src
    on conflict (id_esterno) do update
       set titolo = excluded.titolo,
           descrizione = excluded.descrizione,
           luogo = excluded.luogo,
           inizio = excluded.inizio,
           fine = excluded.fine,
           tutto_il_giorno = excluded.tutto_il_giorno,
           aggiornato_il = now()
     where (c.titolo, c.descrizione, c.luogo, c.inizio, c.fine, c.tutto_il_giorno)
           is distinct from
           (excluded.titolo, excluded.descrizione, excluded.luogo, excluded.inizio, excluded.fine, excluded.tutto_il_giorno)
    returning (xmax = 0) as inserito
  ),
  tolti as (
    delete from public.calendario_eventi c
     where not exists (select 1 from src where src.id_esterno = c.id_esterno)
    returning 1
  )
  select count(*) filter (where inserito),
         count(*) filter (where not inserito),
         (select count(*) from tolti)
    into v_inseriti, v_aggiornati, v_rimossi
    from scritti;

  select count(*)::integer into v_totale from public.calendario_eventi;

  return jsonb_build_object(
    'inseriti', v_inseriti,
    'aggiornati', v_aggiornati,
    'rimossi', v_rimossi,
    'totale', v_totale
  );
end;
$$;

revoke all on function public.sostituisci_eventi_calendario(jsonb) from public, anon, authenticated;
grant execute on function public.sostituisci_eventi_calendario(jsonb) to service_role;
