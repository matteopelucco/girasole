# TASKS.md

## Fatto (scaffold iniziale)
- [x] Setup Next.js 14 + Tailwind + TypeScript
- [x] Client Supabase (browser + server) e middleware di sessione
- [x] Pagina di login con Server Action
- [x] Dashboard placeholder con ruolo utente
- [x] Schema SQL iniziale con RLS (profili, sezioni, bambini, presenze,
      pasti, promemoria)

## Da fare — Fase 1
- [x] Pagina admin per creare sezioni e bambini (form semplice)
- [x] Pagina admin per assegnare maestre a sezioni e promuovere un utente a
      maestra/admin
- [x] Dashboard maestra: lista bambini della sezione con stato
      presenza/pasto del giorno
- [x] Azione "segna presenza" (presente/assente/malattia + nota)
- [x] Azione "segna pasto" (sì/no/parziale + nota), con evidenza allergie da
      `bambini.note_allergie`
- [x] Creazione e lista promemoria (tutti / sezione / bambino)
- [x] Seed di dati di prova (una sezione, 3-4 bambini) per testare in locale

Nota: applica `supabase/migrations/0002_admin_e_maestre.sql` (nuove policy
RLS + colonna `email` su `profili`) nel SQL Editor di Supabase prima di
usare le pagine admin — senza quella migration le maestre non riescono a
vedere i bambini della propria sezione (bug corretto nella stessa
migration: mancava la policy di select su `maestre_sezioni`).

## Da fare — requisiti aggiunti dopo lo scaffold iniziale
- [x] Recupero password (specs/02 - password-recovery.md): richiesta via
      `/recupera-password`, reset via `/reimposta-password`, rate limit
      (1/min per email, 5/5min per IP) e anti-enumeration. Applica
      `supabase/migrations/0003_password_recovery.sql` prima di usarlo.
- [x] Captcha (Cloudflare Turnstile) integrato in `/recupera-password` —
      vedi `lib/turnstile.ts`. Secret configurati in `.env.local`
      (attivo in locale). **Restano da impostare su Vercel** (vedi
      procedura sotto) prima che sia attivo anche in produzione.

### Configurare i secret Turnstile (locale + Vercel)
Due variabili, stesso nome ovunque:
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` — pubblica (site key), va bene anche
  vista/condivisa: `0x4AAAAAAEW_QAO5YcXGwdyP` (quella già creata).
- `TURNSTILE_SECRET_KEY` — segreta, **non va mai in chat, in commit o in
  `.env.example`**. Si trova in Cloudflare Dashboard → Turnstile → il tuo
  widget → "Secret Key" (pulsante per rivelarla).

**In locale**, apri `.env.local` (già in `.gitignore`, non serve fare
nulla per tenerlo fuori da git) e aggiungi le due righe:
```
NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAAAAEW_QAO5YcXGwdyP
TURNSTILE_SECRET_KEY=<incolla qui il secret dalla dashboard Cloudflare>
```
Poi riavvia `npm run dev`.

**Su Vercel**: Project Settings → Environment Variables → Add New, due
volte (stessi nomi di sopra), ambiente Production (e Preview se vuoi
testarlo anche lì). Il sito key può stare anche in chiaro nella UI di
Vercel (è pubblica); il secret key va inserito nello stesso posto — è
Vercel stesso a cifrarlo/nasconderlo, non serve altro. Dopo averle
salvate, serve un nuovo deploy perché le env var vengano lette (un
redeploy dall'ultimo commit, oppure il prossimo push su `main`).

Nota: il widget Turnstile su Cloudflare ha anche un elenco di hostname
autorizzati (impostato quando l'hai creato) — assicurati che includa sia
il dominio di produzione su Vercel sia, se vuoi vedere il widget anche in
sviluppo, `localhost`.

- [x] Utenti gestiti direttamente dall'app, non più da Supabase Auth
      (specs/03 - utenti-e-ruoli.md): `/admin/maestre` ora crea, modifica
      ed elimina utenti (email, password, nome, cognome, telefono,
      ruolo) con la service_role key (`lib/supabase/admin.ts`). Applica
      `supabase/migrations/0005_utenti_gestiti_da_app.sql` prima di
      usarlo. **Da fare da parte tua**: aggiungere
      `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API →
      "service_role", MAI la anon key) a `.env.local` e, per la
      produzione, alle Environment Variables del progetto su Vercel —
      senza quella variabile la creazione/eliminazione utenti fallisce a
      runtime.
- [x] Entità Utente/Classe/Anno Scolastico/Alunno (specs/04 - data-types.md):
      campi aggiuntivi (indirizzo/note utente, data di nascita/sesso/altre
      note alunno, classe attiva + anno scolastico) e nuova gestione "Anni
      scolastici" su `/admin`. Applica
      `supabase/migrations/0006_data_types.sql` (dopo la 0005) prima di
      usarlo. Lo storico multi-classe per alunno e la distinzione padre/
      madre sui genitori sono pronti a schema ma senza UI in questa fase
      (vedi "Fuori scope" in specs/04 - data-types.md).

## Test-first — solo Playwright
- [x] I piani di test in Markdown (`tests/xxx.md`) sono stati dismessi:
      l'unica suite di test è quella eseguibile in `e2e/`. Vedi
      `CLAUDE.md`.
- [x] Playwright + `@axe-core/playwright` installati come devDependency,
      configurati per `http://localhost:3000` (`playwright.config.ts`).
- [x] Un file `e2e/xxx.spec.ts` per ogni `specs/xxx.md`, uno scenario di
      test per ogni `## Scenario:` del requisito, più un controllo axe
      su ogni pagina — vedi `CLAUDE.md`.
- [x] Prima esecuzione locale: 9 test eseguibili senza credenziali, tutti
      Pass; 25 test che richiedono sessioni admin/maestra/genitore reali
      saltati (`test.skip`) in attesa delle variabili `E2E_*` — vedi
      `.env.example`.
- [x] `.github/workflows/playwright.yml`: la suite gira su ogni PR verso
      `main` via GitHub Actions (gratuito su repo pubblici). **Da fare
      da parte tua**: aggiungere gli stessi secret di `.env.example`
      (Supabase, Turnstile, `E2E_*`) come "Repository secrets" in
      GitHub (Settings → Secrets and variables → Actions) — puntando
      **sempre a un progetto Supabase di test**, mai a produzione, dato
      che i test scrivono dati veri.

## Fix — performance e deployment
- [x] Bug di ricorsione RLS su `ruolo_corrente()` (non era `security
      definer`, a differenza delle altre funzioni helper): causava
      "stack depth limit exceeded" su azioni scritte via RLS (osservato
      creando un promemoria) e rallentava ogni pagina che legge il
      profilo dell'utente — sostanzialmente tutte, login incluso.
      **Da fare da parte tua**: applica
      `supabase/migrations/0007_fix_ruolo_corrente_ricorsione.sql` nel
      SQL Editor di Supabase (test e produzione) — senza questo passo il
      fix non ha alcun effetto, è una sola funzione da ridefinire.
- [x] Il middleware attivava una chiamata di rete a Supabase Auth
      (`getUser`) anche per gli asset statici in `public/` (es.
      `girasole.svg`, caricato a piena vista sulla pagina di login) —
      esclusi ora dal matcher (`middleware.ts`).
- [x] `creaUtente` interrogava due volte l'utente/profilo admin per la
      stessa richiesta — ridotto a una sola chiamata.

Nota su prestazioni non risolvibili da codice: verifica che il progetto
Supabase e il deploy Vercel siano nella stessa regione (o in regioni
vicine) — un mismatch aggiunge latenza di rete a ogni singola chiamata,
sopra le limitazioni già note del piano free di entrambi (compute
condiviso, cold start delle funzioni serverless).

Nota sulle 5 vulnerabilità "high" segnalate da `npm audit` (non
introdotte da questa modifica, già presenti nella versione di Next.js
già pinnata nel progetto — `next@14.2.35` e la sua dipendenza interna
`postcss`, più `glob` via `eslint-config-next`): il fix automatico
richiederebbe l'aggiornamento a `next@16` (breaking change), fuori
scope per un run di analisi statica. Da valutare a parte.

## Analisi statica
- [x] Configurato ESLint (`.eslintrc.json`, `next/core-web-vitals` —
      era installato ma mai configurato) e `jscpd` per il codice
      duplicato (`.jscpd.json`), con `npm run analyze` e un git hook
      `pre-push` (`.githooks/pre-push`, attivato da `npm install`) che
      blocca il push se falliscono. Vedi `CLAUDE.md`.
- [x] Bug reali corretti dal primo giro: 4 apici non escapati in JSX
      (`app/dashboard/page.tsx`, `react/no-unescaped-entities`).
- [x] Duplicazione reale eliminata: `requireAdmin()` era ridefinita
      identica in tre punti (`app/admin/actions.ts`,
      `app/admin/maestre/actions.ts`, e in forma di query ripetuta in
      tre pagine) — estratta in `lib/auth.ts`
      (`requireUser`/`requireProfilo`/`requireAdmin`), oltre a un
      helper `campiUtente()` condiviso da creazione e modifica utente.

## Nuovo flusso Presenze/Pasti + palette colorata (specs/01, 12, 13, 14)
- [x] Dashboard sostituita da: selettore data (calendario a un tap) +
      due schede "Presenze"/"Pasti" → elenco classi attive → elenco
      bambini della classe, per Presenze e per Pasti (`app/dashboard/`,
      `app/dashboard/presenze/`, `app/dashboard/pasti/`).
- [x] Tag "Malattia" visibile accanto al nome del bambino negli elenchi
      di Presenze e Pasti (`components/EtichettaMalattia.tsx`).
- [x] Sola lettura per la maestra su date diverse da oggi, admin sempre
      editabile: imposto sia in RLS (`supabase/migrations/0009_scrittura_solo_oggi_maestra.sql`)
      sia lato server (`lib/auth.ts`: `puoScrivereData`/`assicuraScrivibile`).
      **Da fare da parte tua**: applica quella migration nel SQL Editor
      di Supabase (test e produzione) prima di usare la nuova UI —
      senza, le policy insert/update restano quelle vecchie (nessuna
      restrizione di data, solo lato UI).
- [x] Report email di mezzanotte per classe (`app/api/cron/report-presenze/route.ts`,
      `lib/reportPresenze.ts`, `lib/email.ts`), pianificato con Vercel
      Cron (`vercel.json`, una volta al giorno). Invio via Resend
      (fetch HTTP diretto, nessun pacchetto npm nuovo). Idempotente per
      data (tabella `report_giornalieri_inviati`, stessa migration 0009).
      **Da fare da parte tua**:
      1. Crea un account gratuito su resend.com, genera una API key.
      2. Aggiungi a `.env.local` (e alle Environment Variables Vercel):
         `RESEND_API_KEY=<la key>`. Opzionale `RESEND_MITTENTE` una
         volta verificato un dominio proprio su Resend (di default usa
         il mittente sandbox `onboarding@resend.dev`, che consegna solo
         alla mail con cui hai creato l'account Resend — utile per
         provare, non per la produzione: verifica il dominio quando sei
         pronto per inviare davvero a info@asilosartorio.it).
      3. Genera un secret (`openssl rand -hex 32`) e impostalo come
         `CRON_SECRET` sia in `.env.local` sia su Vercel — protegge la
         route da chiamate esterne non autorizzate.
      4. Deploy su Vercel: il cron in `vercel.json` si attiva da solo al
         primo deploy successivo.
- [x] Palette colorata "da asilo" ma professionale (specs/01 - ux.md):
      pulsanti primari da neutro (`stone-900`) a `emerald-600`, stati
      Presente/Sì = verde, Assente = grigio, Malattia/No = rosa,
      Parziale = ambra (`lib/classiStato.ts`), selettore data e schede
      classi in tonalità ambra/verde (`components/SelettoreData.tsx`,
      `components/ElencoClassi.tsx`), logo con emoji 🌻 in `NavHeader`.

## Bug fix: alunno duplicato + nota presenza/pasto non salvabile
- [x] Un alunno è ora univoco per Nome+Cognome+Data di nascita
      (case-insensitive): indice unico in DB
      (`supabase/migrations/0010_alunno_univoco.sql`) + messaggio
      d'errore chiaro su `/admin` (`app/admin/actions.ts:creaBambino`,
      codice Postgres `23505`). Vedi specs/04 - data-types.md.
- [x] Aggiunto il pulsante "Salva nota" in Presenze e Pasti
      (`components/BottoneSalvaNota.tsx`): prima l'unico modo per
      salvare la nota era ripremere lo stesso stato già segnato, non
      ovvio da UI e percepito come "la nota non si salva mai". Ora è
      disponibile un'azione dedicata (disabilitata finché non esiste
      già uno stato, perché la colonna `stato`/`mangiato` non è
      nullable). Vedi specs/13 - segna-presenza.md, specs/14 -
      segna-pasto.md.
- [x] Test aggiunti per entrambi (persistenza dopo reload inclusa):
      `e2e/04-data-types.spec.ts`, `e2e/13-segna-presenza.spec.ts`,
      `e2e/14-segna-pasto.spec.ts`. Corretta anche una fragilità nei
      test esistenti: i selettori Playwright per testo fanno match per
      sottostringa case-insensitive di default, quindi `getByPlaceholder('Nome')`
      combaciava anche con "Cognome"/"Nome sezione..." e
      `getByRole('button', { name: 'No' })` con "Salva **no**ta" —
      corretto con `{ exact: true }` o locator più specifici.
- [ ] **Da fare da parte tua**: applica
      `supabase/migrations/0010_alunno_univoco.sql` nel SQL Editor di
      Supabase (test e produzione) — senza, il vincolo non è attivo e
      un alunno duplicato viene comunque creato senza errore. **Nota
      anche**: verificando questo fix ho scoperto che
      `0008_fix_grant_tabelle_04.sql` (permessi su `anni_scolastici`,
      commit precedente) non risulta applicata sul progetto di test —
      creare un anno scolastico da `/admin` fallisce ancora con
      "permission denied for table anni_scolastici". Applica anche
      quella, insieme alla `0009_scrittura_solo_oggi_maestra.sql` già
      segnalata sopra, se non fatto.

## Requisito 50: gestione classi/bambini dall'admin (visualizzazione, modifica, disattivazione)
- [x] `/admin` mostra ora l'elenco completo delle classi con i bambini
      attivi assegnati a ciascuna, più un elenco separato "Bambini
      senza classe o disattivati" con un'azione rapida per assegnare
      una sezione (che riattiva il bambino, se serve).
- [x] La sezione è ora facoltativa alla creazione di un bambino (prima
      era obbligatoria): un bambino senza sezione finisce nell'elenco
      "senza classe".
- [x] Nuova scheda di dettaglio bambino (`/admin/bambini/[id]`): form
      con tutti i dati pre-caricati per la modifica, più un pulsante
      "Disattiva/Riattiva bambino".
- [x] Un bambino disattivato (`bambini.attiva`, nuova colonna —
      `supabase/migrations/0011_bambino_attivo.sql`) sparisce
      dall'elenco della sua classe e dalle funzioni Presenze/Pasto, ma
      i suoi dati e le presenze/pasti passati restano intatti.
- [x] Test aggiornati/aggiunti in `e2e/50-amministrazione_base.spec.ts`
      per ogni scenario; corrette anche due fragilità pre-esistenti nei
      test scoperte durante la verifica: un test ("assegnare e poi
      rimuovere una maestra da una sezione") poteva rimuovere
      un'assegnazione maestra↔sezione già esistente (non creata da lui)
      invece di una fittizia, e diversi selettori Playwright non
      distinguevano l'elenco classi dai form embedded con lo stesso
      `name`.
- [ ] **Da fare da parte tua**: applica
      `supabase/migrations/0011_bambino_attivo.sql` (se non già fatto)
      nel SQL Editor di Supabase (test e produzione). Ho anche
      verificato che `0010_alunno_univoco.sql` non sta bloccando i
      duplicati sul progetto di test: molto probabilmente la sua
      `CREATE UNIQUE INDEX` ha fallito silenziosamente perché esisteva
      già una coppia di alunni duplicati (creata durante lo sviluppo,
      prima che il vincolo esistesse). Per sbloccarla:
      ```sql
      -- 1. Trova i duplicati che bloccano il vincolo
      select lower(nome), lower(cognome), data_nascita, count(*), array_agg(id) as ids
      from public.bambini
      group by lower(nome), lower(cognome), data_nascita
      having count(*) > 1;

      -- 2. Elimina le righe di troppo (scegli quale id tenere)
      -- delete from public.bambini where id = '<id-da-eliminare>';

      -- 3. Riprova
      create unique index if not exists bambini_univoco_nome_cognome_nascita
        on public.bambini (lower(nome), lower(cognome), data_nascita);
      ```
      Anche `0008_fix_grant_tabelle_04.sql` risulta ancora non efficace
      (creare un anno scolastico fallisce con "permission denied for
      table anni_scolastici"): verifica di averla incollata sul
      progetto giusto e rieseguila.

## Backlog — Fase 2/3
- [ ] Rette mensili e stato pagamento
- [ ] Report mensile presenze per amministrazione
- [ ] Portale genitori (UI dedicata)
