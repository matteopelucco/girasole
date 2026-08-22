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

## Backlog — Fase 2/3
- [ ] Rette mensili e stato pagamento
- [ ] Report mensile presenze per amministrazione
- [ ] Portale genitori (UI dedicata)
