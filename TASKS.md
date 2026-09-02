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
- [x] Azione "segna pasto" (sì/no + nota), con evidenza allergie da
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

## Sessione di test con un'insegnante: bug fix, miglioramenti, requisito 51 (Report)
- [x] Riepilogo numerico in cima a Presenze/Pasti (`components/RiepilogoConteggio.tsx`,
      es. "Presenti: 8/12", "Pasti: 6/8"). Vedi specs/13, specs/14.
- [x] Rimosso lo stato "parziale" dal pasto: solo sì/no, con eventuale
      dettaglio nella nota libera (`supabase/migrations/0012_pasto_senza_parziale.sql`,
      dati storici migrati automaticamente). Un bambino assente ora
      compare come "🚫 Assente" anche in Pasti e non è più selezionabile
      (blocco sia in UI sia con un trigger DB). Vedi specs/14.
- [x] Bug: il pulsante di stato selezionato (Assente/No) appariva come
      uno spazio bianco invece che colorato — `tailwind.config.ts` non
      includeva `lib/**` nel `content`, quindi le classi Tailwind usate
      in `lib/classiStato.ts` non venivano mai generate nel CSS finale.
- [x] Bug: un errore nel form di creazione utente (es. password troppo
      debole) svuotava tutti i campi già compilati — riscritto
      `app/admin/maestre/actions.ts` sul pattern `EsitoAzione`/
      `FormConEsito` già usato altrove, che preserva i valori inseriti.
      Vedi specs/03.
- [x] Bug: il form promemoria restava compilato dopo un invio riuscito —
      aggiunto un remount opt-in (`FormConEsito`: prop `resetSuOk`).
- [x] Bug: non era possibile modificare né eliminare un promemoria —
      nuova pagina `/dashboard/promemoria/[id]` con modifica ed
      eliminazione (con conferma), permessi RLS estesi a tutto lo staff
      (non solo l'autore) in `0012_pasto_senza_parziale.sql`. Vedi specs/15.
- [x] Occhietto mostra/nascondi password su login e creazione utente
      (`components/CampoPassword.tsx`). Vedi specs/11.
- [x] Conferma password (con riscontro in tempo reale "coincidono"/"non
      coincidono") alla creazione di un utente
      (`components/CampiPasswordConferma.tsx`). Vedi specs/03.
- [x] Nuovo requisito 51 (specs/51 - report.md): report tabellare
      presenze/pasti per classe (mensile/settimanale/giornaliero, con
      navigazione tra periodi e drill-down giorno per giorno su un
      bambino) più un'anagrafica classi (maestre, bambini, genitori) —
      `app/dashboard/report/`, `lib/report.ts`, `lib/date.ts` (nuovi
      helper periodo). Nuove policy RLS in
      `supabase/migrations/0013_report_anagrafica.sql` (una maestra deve
      vedere le colleghe sulla stessa classe e i genitori dei propri
      bambini, permessi prima non necessari).
- [ ] **Da fare da parte tua**: applica
      `supabase/migrations/0012_pasto_senza_parziale.sql` e
      `supabase/migrations/0013_report_anagrafica.sql` nel SQL Editor di
      Supabase (test e produzione) — senza la 0012, modificare/eliminare
      un promemoria non ha effetto (RLS silenziosamente non aggiorna/
      elimina nulla, 2 test restano rossi:
      `e2e/15-memo.spec.ts`); senza la 0013, l'anagrafica classi non
      mostra colleghe/genitori a una maestra.

## Test unitari (Vitest) per la logica pura
- [x] Aggiunto Vitest (`vitest.config.mts`) come secondo livello di test,
      accanto a Playwright: unit test per le funzioni pure di `lib/`
      (nessun I/O — niente Supabase, niente fetch, niente filesystem),
      per coprire in millisecondi i casi limite (bisestili, cambi di
      mese/anno, combinazioni della regex password) che gli scenari e2e
      non enumerano uno per uno. Copertura e2e invariata: nessuno
      scenario Playwright è stato rimosso. Vedi `CLAUDE.md`, sezione
      "Test-first".
- [x] `lib/date.test.ts`, `lib/classiStato.test.ts`, `lib/password.test.ts`,
      `lib/report.test.ts`, `lib/auth.test.ts` (solo `puoScrivereData`/
      `assicuraScrivibile`, le uniche funzioni pure di `lib/auth.ts` — il
      resto fa I/O e resta coperto solo da e2e). 52 test, ~0.3s.
- [x] `npm run test:unit` (una tantum) / `test:unit:watch`; incluso in
      `npm run analyze` e nel git hook `pre-push`
      (`.githooks/pre-push`), che ora blocca il push anche su un unit
      test rotto — a differenza di Playwright, non richiede un server
      dev né credenziali, quindi può girare ad ogni push senza costo.
- [x] `.jscpd.json`: esclusi i file `**/*.test.ts` dal controllo
      duplicati (le asserzioni ripetute per casi diversi non sono
      duplicazione reale).

## Ruolo Assistente, pre/post-asilo, report email automatico
Requisiti (specs 00, 03, 04, 12, 13, 14, 15, 50, 51 aggiornati, nuovo
specs/52) implementati: migration, RLS, server action, pagine,
componenti, unit test (Vitest) e test e2e (Playwright) scritti.
`npm run analyze` (lint + unit test + duplicati) è verde. Libreria PDF
usata: `pdf-lib` (pura JS, nessun binario nativo — concordata prima di
installarla).

- [x] Ruolo `assistente`: nuovo valore dell'enum `ruolo_utente`
      (`supabase/migrations/0015_ruolo_assistente.sql`, isolato in una
      migration a parte perché un valore aggiunto a un enum non è
      utilizzabile nella stessa transazione in cui viene aggiunto).
      Selezionabile da `/admin/maestre` in creazione/modifica utente.
- [x] Permessi assistente (matrice in specs/03): stesso perimetro della
      maestra su `presenze` (RLS ridefinita) e `promemoria`; **nessun
      accesso** a `pasti` (RLS + UI, `lib/auth.ts:assicuraAccessoPasti`)
      — vedi `supabase/migrations/0016_assistente_e_pre_post_asilo.sql`,
      che corregge anche un buco di RLS pre-esistente sui pasti (le
      policy insert/update di `0009` non controllavano il ruolo, solo
      l'appartenenza a `maestre_sezioni` — innocuo finché solo le
      maestre vi comparivano, non più ora che vi compaiono anche le
      assistenti). `maestre_sezioni` resta la tabella di assegnazione
      condivisa (non rinominata).
- [x] Dashboard (specs/12), `app/dashboard/page.tsx`: un'assistente vede
      "Presenze" ma non "Pasti".
- [x] Colonne `presenze.pre_asilo`/`presenze.post_asilo` (booleane,
      default falso) con vincolo "vere solo se `stato = 'presente'`" —
      in `0016_assistente_e_pre_post_asilo.sql`.
- [x] Pulsanti "Pre-asilo"/"Post-asilo" (specs/13): toggle indipendenti
      — logica pura in `lib/presenza.ts:prossimaPresenza` (unit test in
      `lib/presenza.test.ts`), azioni in
      `app/dashboard/presenze/actions.ts`.
- [x] Riepilogo Presenze: "Pre-asilo: P" / "Post-asilo: Q" accanto a
      "Presenti: X/Y" (`components/RiepilogoConteggio.tsx`, denominatore
      ora opzionale).
- [x] Report (specs/51): colonne pre-asilo/post-asilo nella tabella e
      nel drill-down; anagrafica classi mostra il ruolo di ogni membro
      dello staff assegnato. Aggregazione estratta in
      `lib/report.ts:aggregaConteggiPresenzePasti` (pura, unit test),
      riusata sia dalla pagina Report sia dal report email notturno.
- [x] Report email automatico (nuovo specs/52),
      `app/api/cron/report-presenze/route.ts`: genera e allega fino a 3
      PDF (giornaliero/settimanale/mensile — `lib/pdfReport.ts`, unit
      test in `lib/pdfReport.test.ts`), idempotenza per tipo+giorno
      (`report_giornalieri_inviati` per il giornaliero, invariata; nuova
      `report_periodici_inviati` per settimanale/mensile). Configurabile
      via `REPORT_EMAIL_DESTINATARIO` (default `info@asilosartorio.it`)
      e `REPORT_EMAIL_MODALITA_PERIODICI` (`sempre` di default, o
      `fine_periodo` — vedi `lib/date.ts:isUltimoGiornoSettimana/Mese`).

- [x] Migration `0015_ruolo_assistente.sql` e
      `0016_assistente_e_pre_post_asilo.sql` applicate sul progetto
      Supabase di test. Verificato: `npx playwright test` sulle suite
      toccate da questi requisiti (03, 12, 13, 14, 15, 50, 51) è verde —
      66+ scenari passano, gli unici skip sono quelli che richiedono
      l'account di test assistente (punto successivo). **Da fare da
      parte tua**: applica le stesse due migration (in quest'ordine,
      come "Run" separati) anche sul progetto di produzione prima del
      deploy.
- [ ] **Da fare da parte tua — verificato due volte, ancora mancante**:
      l'account di test `assistente.test@example.com` non esiste ancora
      in Supabase Auth. Il blocco SQL in `supabase/helper.sql` da solo
      non può crearlo: esegue una `select ... from auth.users where
      email = '...'`, e se quella select non trova righe (perché
      l'utente Auth non esiste) l'insert successivo su `profili` non
      inserisce nulla, silenziosamente — la query "va a buon fine" (0
      righe interessate) ma non fa quello che serve. Prima di rilanciare
      quel blocco SQL, l'utente Auth va creato **dalla Dashboard
      Supabase**: Authentication → Users → Add user → email
      `assistente.test@example.com`, password `testtest` (o il valore
      che hai in `E2E_ASSISTENTE_PASSWORD` su `.env.local`), spunta
      "Auto Confirm User". Solo dopo, rilancia il blocco SQL per
      assistente in `supabase/helper.sql`. Verificabile da riga di
      comando senza aprire il browser: `node -e "..."` con
      `admin.auth.admin.listUsers()` (service role) per controllare se
      l'email compare — è così che ho verificato che manca ancora.
      Dopo questo passaggio gli scenari assistente di specs/03, 12, 13,
      14, 15, 51 smettono di saltarsi.
- [ ] Lo scenario "idempotenza per tipo" di `e2e/52-report-email-automatico.spec.ts`
      chiama davvero l'API di Resend: non verificabile dall'ambiente
      sandbox di sviluppo usato per questa sessione (nessun accesso di
      rete in uscita). La sotto-parte "rifiuta senza il secret corretto"
      (nessuna chiamata di rete) è verde. Consigliato un giro manuale
      (`npx playwright test e2e/52-report-email-automatico.spec.ts`) dal
      tuo ambiente locale con accesso a Internet.
- [ ] Facoltativo: se vuoi provare l'invio reale del report notturno con
      PDF allegati, `RESEND_API_KEY`/`CRON_SECRET` sono già configurati
      da requisiti precedenti — nessun secret nuovo necessario.

## "Promemoria" rinominato in "Avviso" + selezione destinatario a cascata (specs/15)
- [x] Rinominato in tutta l'interfaccia (titoli, pulsanti, messaggi,
      placeholder): "Promemoria" → "Avviso"/"Avvisi". Tabella DB,
      colonne, nomi di server action (`creaPromemoria`/
      `aggiornaPromemoria`/`eliminaPromemoria`) e route
      (`/dashboard/promemoria/[id]`) NON rinominati — stessa scelta già
      fatta per Classe/Alunno rispetto a `sezioni`/`bambini` (vedi nota
      terminologica in specs/15), per non introdurre una rinomina ad
      ampio raggio di tabelle/route già in produzione. Nessuna migration
      necessaria.
- [x] Selezione del destinatario ridisegnata come menu a cascata
      (`components/SelettoreDestinatarioAvviso.tsx`, nuovo client
      component condiviso da creazione e modifica): "Tutti" non mostra
      altri campi; "Una sezione" rivela il campo sezione; "Un bambino"
      rivela prima il campo sezione (solo filtro, non salvato) poi,
      scelta la sezione, il campo bambino con il solo elenco di quella
      sezione — non più un unico elenco con tutti i bambini di tutte le
      classi insieme (il problema concreto dietro al "macchinoso"
      segnalato: con una sezione "seed" che nel progetto di test ha
      accumulato ~75 bambini fixture, l'elenco piatto precedente era
      impraticabile — verificato riproducendo il comportamento a mano).
- [x] Validazione aggiunta (prima mancante): pubblicare/aggiornare un
      avviso con destinatario "Una sezione"/"Un bambino" senza aver
      scelto rispettivamente una sezione o un bambino ora viene
      rifiutato con un messaggio chiaro, sia lato client (`required` sui
      campi comparsi) sia lato server (`app/dashboard/actions.ts`).
- [x] Estratto `lib/sezioni.ts:bambiniAttiviVisibili` (bambini attivi
      visibili per ruolo: tutti per l'admin, solo delle proprie sezioni
      per maestra/assistente) — riusato da Avvisi, dalla pagina di
      modifica avviso e dal Report (specs/51), eliminando una
      duplicazione reale di query segnalata da `jscpd` durante lo
      sviluppo (stesso pattern ripetuto in 3 file).
- [x] Test aggiornati/aggiunti in `e2e/15-memo.spec.ts` (terminologia +
      nuovi scenari per la cascata: rivelare/nascondere i campi,
      aggiornamento dell'elenco bambini al cambio sezione, validazione,
      pre-compilazione della sezione filtro in modifica) ed
      `e2e/12-dashboard-maestre.spec.ts` (intestazione "Avvisi"). Suite
      verde (30 scenari passano, gli unici skip richiedono l'account di
      test assistente, vedi sopra).

## Rinfresco grafico ispirato a Falcon (specs/01 - ux.md)
- [x] Tipografia Poppins (titoli, `font-heading`) + Open Sans (testo,
      `font-sans`) via `next/font/google` (`app/layout.tsx`,
      `tailwind.config.ts`) — self-hosting automatico, nessuna
      dipendenza nuova. `font-heading` applicato una volta sola a
      `h1`-`h4` in `app/globals.css` (`@layer base`), non pagina per
      pagina.
- [x] Sfondo pagina `bg-slate-100` (era `bg-stone-50`) contro cui le
      card `bg-white` risaltano; card uniformate con `shadow-sm` in
      ~12 pagine; `NavHeader` ora `sticky` con ombra leggera; le tessere
      principali (Presenze/Pasti/Report, classi) hanno una leggera
      elevazione al passaggio del mouse.
- [x] Non toccati (deliberatamente): i 4 colori di stato verificati dai
      test e2e (`bg-emerald-700`, `bg-stone-600`, `bg-rose-600`,
      `bg-sky-700`) e lo stile "subtle badge" già esistente per
      allergie/malattia/assente (era già in linea con l'ispirazione).
- [x] **Bug trovato e corretto durante la verifica**: il nuovo sfondo
      `bg-slate-100`, leggermente più scuro del precedente `bg-stone-50`,
      faceva scendere il contrasto di `text-stone-500` sotto la soglia
      WCAG AA (4.37:1 invece di 4.5:1) ovunque quel testo comparisse
      direttamente sullo sfondo pagina (non dentro una card bianca) —
      scoperto da un test di accessibilità (axe-core) su `/login`,
      poi verificato sistemico e corretto ovunque
      (`text-stone-500` → `text-stone-600`, ~24 punti in app/ e
      components/, tranne l'icona emoji "occhio" che non ne risente).
- [x] Verificato: `npx tsc`/`next lint` puliti, 85 unit test invariati,
      e2e verde su tutte le pagine toccate (73 scenari passano su
      server "caldo" — vedi nota sulla lentezza a freddo qui sotto).
      Le vere glyph di Poppins/Open Sans non sono verificabili
      dall'ambiente sandbox di questa sessione (nessun accesso di rete
      in uscita per scaricarle da Google Fonts): degradano in modo
      pulito a un font di sistema equivalente (nessun crash, nessun
      layout rotto — verificato), ma vanno controllate visivamente nel
      tuo ambiente con accesso a Internet.

## Bug: form utente non si svuotava + occhietto password disallineato
Due bug segnalati dopo l'uso reale di `/admin/maestre`.
- [x] **Bug 1**: dopo aver creato un utente con successo, il form
      restava compilato con i suoi dati. Fix: aggiunto `resetSuOk` al
      `FormConEsito` di creazione (stesso pattern già in uso per gli
      avvisi, specs/15) — `app/admin/maestre/page.tsx`. Nuovo scenario
      in specs/03 e test in `e2e/03-utenti-e-ruoli.spec.ts`.
- [x] **Bug 2**: quando compariva il riscontro "le password
      coincidono/non coincidono" sotto al campo conferma, l'occhietto
      del campo *password* si spostava dal campo. Causa: il form usa
      una griglia a 2 colonne (`grid sm:grid-cols-2`); il riscontro
      comparendo allungava la cella "conferma password", e CSS Grid
      (`align-items: stretch`, il default) stirava anche la cella
      "password" — più corta — alla stessa altezza; l'occhio, posizionato
      in assoluto rispetto al proprio contenitore (non al campo), seguiva
      quello stiramento. Fix: `self-start` sul contenitore di
      `CampoPassword` (`components/CampoPassword.tsx`,
      `components/CampiPasswordConferma.tsx`), che impedisce a
      griglia/flex di stirarlo — resta sempre alto quanto il suo
      contenuto. Nota in specs/03 e test dedicato in
      `e2e/03-utenti-e-ruoli.spec.ts` (confronta le bounding box di
      occhio e campo, prima e dopo la comparsa del riscontro).
- [x] **Test scoperto instabile durante la verifica** (non un bug
      applicativo): "creazione con campi obbligatori mancanti" rimuoveva
      l'attributo `required` via JS troppo presto, in corsa con
      l'idratazione React — a volte l'idratazione "vinceva" e
      ripristinava l'attributo, facendo bloccare l'invio dal tooltip
      nativo del browser invece di arrivare alla validazione server (il
      comportamento dell'app era sempre corretto, testato anche a mano).
      Corretto aspettando un segnale di idratazione completa (comparsa
      del pulsante "occhio", componente client) prima di rimuovere
      l'attributo.
- [x] Verificato: `npx tsc`/`next lint` puliti, e2e verde (rieseguito 3
      volte di fila lo scenario dell'occhietto e quello del "required",
      nessuna intermittenza residua).

## Bug: report notturno "Nessuna classe attiva" nonostante dati presenti
- [x] Diagnosticato in produzione: `aggregaReportPeriodoTutteLeClassi`/
      `generaSchedaGiornalieraHtml` (`lib/reportPresenze.ts`) non
      controllavano l'errore delle query Supabase — se falliscono (es.
      `SUPABASE_SERVICE_ROLE_KEY` mancante/sbagliata su Vercel), `data`
      arrivava `null` e `(sezioni ?? []).map(...)` lo trattava in modo
      indistinguibile da "davvero zero classi attive", producendo PDF
      con "Nessuna classe attiva" senza alcun errore visibile nei log.
      Prima ipotesi (SUPABASE_SERVICE_ROLE_KEY mancante su Vercel) non
      confermata: dopo aver verificato le chiavi il report è arrivato
      ancora vuoto, quindi il vero errore restava comunque mascherato.
- [x] **Fix**: `lib/reportPresenze.ts` ora controlla l'`error` di ogni
      query e solleva un'eccezione con il messaggio reale di Postgrest
      invece di trattarlo come "nessun dato" (nuova `righeOSollevaErrore`,
      unit test in `lib/reportPresenze.test.ts` — è pura, nessun I/O).
      Un errore di query fa quindi fallire la route con un 500
      diagnosticabile nei log Vercel (stesso comportamento già visto per
      l'errore Resend), invece di restituire silenziosamente "ok" con un
      PDF vuoto — e, come già garantito dal flusso esistente, non marca
      il periodo come inviato (l'insert in `report_*_inviati` avviene
      solo dopo un invio riuscito). **Prossimo passo**: rilanciare il
      cron e leggere il messaggio d'errore ora visibile nei log Vercel
      per individuare la causa reale (permessi RLS/service_role, dati
      mancanti in `sezioni`/`bambini`, o altro).
- [x] **Causa reale trovata**, grazie al fix sopra: l'errore nei log era
      `permission denied for table sezioni` — non un filtro RLS (che dà 0
      righe, non un errore), ma la mancanza del GRANT di base sulla
      tabella per il ruolo `service_role` usato dal cron
      (`lib/supabase/admin.ts:createAdminClient`). **Stesso bug già
      capitato una volta nel progetto per il ruolo `authenticated`**,
      corretto allora da `0004_fix_grant_tabelle.sql`/
      `0008_fix_grant_tabelle_04.sql` — mai esteso a `service_role`,
      perché finora nessuna route lo usava per leggere tabelle
      `public.*` (le altre azioni con la service_role key, creare/
      eliminare utenti in `app/admin/maestre/actions.ts`, passano
      dall'Admin Auth API su `auth.users`, non da tabelle `public.*`).
      Fix: `supabase/migrations/0018_grant_service_role_report.sql`,
      grant `select` a `service_role` su `sezioni`/`bambini`/`presenze`/
      `pasti`, `select, insert` su `report_giornalieri_inviati`/
      `report_periodici_inviati`.
- [ ] **Da fare da parte tua**: applica
      `supabase/migrations/0018_grant_service_role_report.sql` nel SQL
      Editor di Supabase (test e produzione) — senza, il report notturno
      continua a fallire con lo stesso errore di permessi.

## Il pasto non è selezionabile anche per un bambino malato (specs/14)
- [x] Estesa a "malattia" la stessa regola già in vigore per "assente"
      (specs/14 - segna-pasto.md): un bambino malato non viene servito
      a pranzo, quindi non è più selezionabile il pasto per lui — prima
      la regola valeva solo per "assente" (un malato poteva comunque
      aver mangiato a casa prima di rientrare), scelta esplicitamente
      ribaltata su richiesta.
- [x] `app/dashboard/pasti/[sezioneId]/page.tsx`: pulsanti Sì/No
      sostituiti dall'etichetta "🤒 Malattia" e dal messaggio "Bambino
      malato: il pasto non è applicabile", stesso trattamento
      dell'assente. Il denominatore del riepilogo "Pasti: X/Y" ora
      esclude anche i bambini malati (rinominato
      `bambiniConPastoApplicabile`).
- [x] Vincolo esteso anche a livello di database (non solo UI), stesso
      approccio già usato per "assente":
      `supabase/migrations/0017_pasto_blocca_anche_malattia.sql`
      ridefinisce la funzione trigger esistente per bloccare l'insert/
      update su `pasti` sia per "assente" sia per "malattia".
- [x] Nuovo scenario in specs/14 ("un bambino malato non è selezionabile
      per il pasto") e test corrispondente in
      `e2e/14-segna-pasto.spec.ts`.
- [ ] **Da fare da parte tua**: applica
      `supabase/migrations/0017_pasto_blocca_anche_malattia.sql` nel SQL
      Editor di Supabase (test e produzione) — senza, il blocco vale
      solo in UI: un tentativo diretto via API/DB potrebbe ancora
      inserire un pasto per un bambino malato.

## Controllo di consistenza dei dati (nuovo specs/06)
- [x] Nuovo requisito trasversale `specs/06 - controllo-consistenza.md`:
      warning quando presenza/pasto/pre-asilo/post-asilo di un bambino
      sono incoerenti fra loro, in Presenze, Pasti, Report (tabella
      aggregata e drill-down) e report via email. Regole controllate:
      pasto "sì" con presenza assente o malattia; pre-asilo o post-asilo
      attivi con presenza diversa da "presente". Due combinazioni chieste
      ma **omesse** perché strutturalmente impossibili con lo schema
      attuale (`presente` insieme ad `assente`/`malattia`: è un'unica
      colonna a valore singolo, non tre flag indipendenti) — vedi la nota
      nello spec.
- [x] `lib/consistenza.ts:inconsistenzeGiorno` — funzione pura, nessun
      I/O, unit test in `lib/consistenza.test.ts`. Riusata ovunque per
      non duplicare le regole (CLAUDE.md, jscpd).
- [x] `lib/report.ts:aggregaConteggiPresenzePasti` estesa con un nuovo
      campo `inconsistenze: string[]` per riga: correla presenze e pasti
      per giorno (richiede ora `data` nei record passati, prima non
      necessaria per i soli conteggi) e applica `inconsistenzeGiorno` a
      ogni giorno del periodo. Questa funzione è già il punto condiviso
      tra report a schermo (`app/dashboard/report/page.tsx`) e report
      email (`lib/reportPresenze.ts:aggregaReportPeriodoTutteLeClassi`):
      un solo cambiamento copre entrambe le superfici.
- [x] UI: badge "⚠️ Inconsistenza" (`components/AvvisoInconsistenza.tsx`,
      col messaggio specifico nel tooltip) in Presenze e Pasti (la
      pagina Presenze ora recupera anche i pasti del giorno, prima non
      le servivano), nella tabella aggregata di Report e nel drill-down
      giorno per giorno (nuova colonna "Avviso").
- [x] Email: la scheda HTML giornaliera (`generaSchedaGiornalieraHtml`)
      mostra lo stesso avviso in corsivo accanto alla riga; i PDF
      allegati (`app/api/cron/report-presenze/route.ts:righeInCelle`)
      usano un marcatore testuale ASCII (`[!] INCONSISTENZA`) invece
      dell'emoji, perché il font standard di pdf-lib (Helvetica,
      WinAnsi/Latin-1) non può codificare "⚠".
- [x] Test: `e2e/06-controllo-consistenza.spec.ts` (nuovo, in sequenza —
      crea deliberatamente l'incoerenza segnando prima il pasto "sì" e
      poi correggendo la presenza in "assente" sullo stesso bambino,
      verificando il warning in Presenze, Pasti, report giornaliero a
      schermo e drill-down mensile). Non è stato scritto un test e2e
      dedicato per il contenuto dei PDF/HTML email: nessun test esistente
      in questo progetto ispeziona il contenuto dei PDF via Playwright
      (solo `lib/pdfReport.test.ts` verifica che il PDF sia valido), la
      logica di inconsistenza è comunque la stessa già coperta da unit
      test (`lib/consistenza.test.ts`, `lib/report.test.ts`) e riusata
      dallo stesso codice del report a schermo.
- [x] Verificato: `npm run analyze` (lint, unit test — 102 ora, jscpd
      sotto soglia) e `npx tsc --noEmit` puliti. La suite e2e Playwright
      non è eseguibile da questo ambiente sandbox (nessun dev server né
      credenziali Supabase — stesso limite di sempre, vedi note
      precedenti in questo file): va verificata con
      `npx playwright test e2e/06-controllo-consistenza.spec.ts` (e le
      altre suite toccate: 13, 14, 51) dal tuo ambiente locale.

## Riepilogo aggregato di tutte le classi su Presenze/Pasti (specs/12)
- [x] Nuovo scenario in `specs/12 - dashboard-maestre.md`: l'elenco
      classi di Presenze e di Pasti mostra, ancora prima di selezionare
      una classe, uno specchietto identico a quello di una singola
      classe ma con la somma di tutte le classi visibili (tutte le mie
      sezioni se maestra/assistente, tutte le classi attive se admin) —
      "Presenti: X/Y" + "Pre-asilo: P" + "Post-asilo: Q" su Presenze,
      "Pasti: X/Y" su Pasti.
- [x] **Denominatore "Pasti: X/Y" diverso di proposito** da quello della
      singola classe: qui Y conta *tutti* i bambini, senza escludere chi
      è assente o malato (a differenza di `bambiniConPastoApplicabile`
      nella pagina di dettaglio) — richiesto esplicitamente, documentato
      in specs/12 per non sembrare un'incoerenza.
- [x] `components/PaginaClassi.tsx` (già condivisa da entrambe le
      route) ora accetta un prop `tipo: 'presenze' | 'pasti'` e calcola
      il riepilogo con una query dedicata; `components/ElencoClassi.tsx`
      espone lo slot `riepilogo` (stesso pattern già usato in
      `PaginaClasseAttivita`, per coerenza).
- [x] Duplicazione reale eliminata (segnalata da `jscpd` durante lo
      sviluppo): la sequenza "sezioni visibili → bambini visibili" era
      ripetuta identica in `PaginaClassi.tsx` e
      `app/dashboard/report/page.tsx` — estratta in
      `lib/sezioni.ts:sezioniEBambiniVisibili`.
- [x] Test aggiunti in `e2e/12-dashboard-maestre.spec.ts` (riepilogo
      presente su entrambe le pagine, posizionato prima dell'elenco
      classi).
- [x] Verificato: `npm run analyze` (lint, 102 unit test, jscpd sotto
      soglia) e `npx tsc --noEmit` puliti. Suite e2e non eseguibile da
      questo ambiente sandbox (nessun dev server/credenziali Supabase),
      da verificare con `npx playwright test e2e/12-dashboard-maestre.spec.ts`
      dal tuo ambiente locale.

## Card con titolo per gli specchietti riassuntivi (specs/12, 13, 14)
- [x] Gli specchietti riassuntivi di Presenze/Pasti sono ora dentro una
      card con titolo, invece di stare "nudi" in pagina — stesso stile
      card già usato altrove (`components/CardRiepilogo.tsx`): "Presenze
      giornaliere" / "Pasti giornalieri" sull'elenco classi (aggregato su
      tutte le classi), "Presenze giornaliere - Sezione {nome}" /
      "Pasti giornalieri - Sezione {nome}" dentro la singola classe.
- [x] Aggiornati `specs/12 - dashboard-maestre.md`,
      `specs/13 - segna-presenza.md`, `specs/14 - segna-pasto.md` e i
      rispettivi test in `e2e/12-dashboard-maestre.spec.ts`,
      `e2e/13-segna-presenza.spec.ts`, `e2e/14-segna-pasto.spec.ts`
      (verificano l'heading della card, oltre al testo del numero già
      controllato prima).
- [x] Verificato: `npm run analyze` e `npx tsc --noEmit` puliti, nessuna
      duplicazione nuova. Suite e2e non eseguibile da questo ambiente
      sandbox (nessun dev server/credenziali Supabase).

## Barra di caricamento durante la navigazione (specs/01 - ux.md)
- [x] Nuovo requisito trasversale in `specs/01 - ux.md`: ogni
      navigazione tra pagine mostra una sottile barra di avanzamento in
      cima allo schermo (pattern standard del web, es.
      YouTube/GitHub), non invasiva — segnala il "giro di rete" di
      qualche secondo che un'app a Server Components come questa
      comporta ad ogni cambio pagina, prima silenzioso.
- [x] `components/BarraCaricamento.tsx` (client component, montato una
      sola volta in `app/layout.tsx` dentro un `<Suspense>` per
      `useSearchParams`): un listener globale sul click intercetta i
      link interni (esclusi link esterni, ancore `#`, `mailto:`/`tel:`,
      `target` diverso da `_self`, download, click con modificatori) e
      avvia l'animazione; il cambio di pathname/query — segno che la
      nuova pagina è arrivata — la interrompe. Nessuna dipendenza nuova:
      solo `next/navigation` (già in uso) e un `@keyframes` CSS in
      `app/globals.css`.
- [x] Deliberatamente **distinto** dal feedback già esistente su
      `PulsanteInvio` (specs/05 - feedback.md): quello è locale al
      pulsante di un form/Server Action, questo è globale e riguarda
      solo il passaggio da una pagina all'altra — i due casi non si
      sovrappongono (un click su un pulsante di stato in Presenze/Pasti
      non cambia pagina, quindi non attiva la barra).
- [x] Test aggiunto in `e2e/01-ux.spec.ts`: rallenta deliberatamente
      (via `page.route`) la richiesta di navigazione per rendere
      l'assert sulla barra deterministico, invece di dipendere dalla
      velocità reale della rete (che la farebbe comparire/sparire
      troppo in fretta per un assert affidabile).
- [x] Verificato: `npm run analyze` e `npx tsc --noEmit` puliti, nessuna
      duplicazione nuova. Suite e2e non eseguibile da questo ambiente
      sandbox (nessun dev server/credenziali Supabase).

## Icone sui 3 box della dashboard (specs/12)
- [x] Le tre schede della dashboard (`app/dashboard/page.tsx`) hanno ora
      un'icona oltre al testo: ☑️ Presenze, 🍝 Pasti, 📊 Report. Stesso
      linguaggio visivo già in uso nell'app (emoji, come 🌻 nel logo, 🚫
      Assente, 🤒 Malattia, ⚠️ Inconsistenza) — nessuna dipendenza nuova
      (niente set di icone SVG). Icone `aria-hidden="true"` (decorative,
      il testo del pulsante resta il nome accessibile).
- [x] Aggiornato `specs/12 - dashboard-maestre.md` e il test in
      `e2e/12-dashboard-maestre.spec.ts` (verifica la presenza delle tre
      icone).
- [x] Verificato: `npm run analyze` e `npx tsc --noEmit` puliti.

## Comunicazione pasti a Rojac (nuovo specs/16)
- [x] Nuovo requisito `specs/16 - comunicazione-pasti-rojac.md`: la
      maestra comunica i pasti di una classe a Rojac (mensa esterna)
      con un pulsante dedicato in Pasti; da quel momento non può più
      modificare i pasti di quella classe/data (l'admin sì, sempre —
      corretto in corso d'opera su richiesta esplicita, nessuna
      eccezione di ruolo per l'admin). Ogni comunicazione resta in un
      log immutabile, consultabile nei report (a schermo e via email)
      per il confronto con la fattura Rojac di fine mese.
- [x] `supabase/migrations/0019_pasti_comunicati_rojac.sql`: tabella
      `pasti_comunicati` (una per sezione+data, `unique`), nome di chi
      ha comunicato salvato come testo al momento dell'azione (non solo
      come riferimento al profilo — un log contabile non deve cambiare
      retroattivamente). Nessuna policy update/delete: immutabile per
      costruzione. Trigger `pasti_blocca_se_comunicato` su `pasti` che
      blocca insert/update per la maestra (non per l'admin, controllato
      via `ruolo_corrente()`) quando esiste già una comunicazione per
      quella sezione/data. Grant a `service_role` incluso da subito
      (imparato dal bug del report notturno, vedi sopra in questo file).
- [x] `lib/comunicazionePasti.ts` (puro): formato del log
      `{data}_{ora}: {numero} pasti ({chi})`, totale periodo,
      raggruppamento per sezione — riusato identico a schermo e nei PDF
      email. `lib/date.ts:formattaDataOraItaliana` (nuova, con test per
      cambio ora legale/solare).
- [x] `components/ConfermaAzione.tsx` (nuovo, generalizzato da
      `ConfermaEliminazione.tsx`, rimosso): conferma sì/annulla prima
      di un'azione irreversibile, con una palette "distruttivo" (rosso,
      comportamento identico a prima) o "neutro" (ambra, per il
      pulsante "Pasti comunicati a Rojac"). `app/dashboard/promemoria/[id]/page.tsx`
      aggiornato di conseguenza, stesso comportamento/testi di prima
      (verificato contro `e2e/15-memo.spec.ts`, invariato).
- [x] `app/dashboard/pasti/actions.ts:comunicaPastiRojac` — conta i
      pasti "sì" al momento dell'azione, registra la comunicazione.
      `app/dashboard/pasti/[sezioneId]/page.tsx`: pulsante/banner nel
      riepilogo, pulsanti Sì/No/Salva nota nascosti per la maestra dopo
      la comunicazione (resta attivo per l'admin, con nota esplicita a
      schermo).
- [x] Sezione "Comunicazione pasti" (log + totale per classe + totale
      complessivo) aggiunta al Report a schermo
      (`app/dashboard/report/page.tsx`) e ai 3 PDF del report email
      (`lib/reportPresenze.ts`, `lib/pdfReport.ts`,
      `app/api/cron/report-presenze/route.ts`) — non alla scheda HTML
      giornaliera rapida, che resta invariata (specs/52). Testo
      semplice nei PDF, niente emoji (stessa nota di specs/06).
- [x] Test: `e2e/16-comunicazione-pasti-rojac.spec.ts` (nuovo — conferma
      con Annulla, comunicazione con blocco per la maestra, persistenza
      dopo reload, override admin, sezione nel report). Sceglie
      deliberatamente l'**ultima** classe della lista, non la prima
      (usata invece da `e2e/13`/`e2e/14`): la comunicazione è
      irreversibile e Playwright esegue i file in parallelo
      (`fullyParallel: true`), quindi evita che i due si contendano la
      stessa classe/giorno. Unit test nuovi/estesi:
      `lib/comunicazionePasti.test.ts`, `lib/date.test.ts`,
      `lib/pdfReport.test.ts` (116 unit test totali).
- [x] Verificato: `npm run analyze` (lint, unit test, jscpd sotto
      soglia) e `npx tsc --noEmit` puliti. Suite e2e Playwright non
      eseguibile da questo ambiente sandbox (nessun dev server/
      credenziali Supabase) — da verificare con
      `npx playwright test e2e/16-comunicazione-pasti-rojac.spec.ts`
      (e rieseguire `e2e/13`, `e2e/14`, `e2e/15`, `e2e/51`, `e2e/52` per
      la parte toccata) dal tuo ambiente locale.
- [ ] **Da fare da parte tua**: applica
      `supabase/migrations/0019_pasti_comunicati_rojac.sql` nel SQL
      Editor di Supabase (test e produzione) — senza, il pulsante
      "Pasti comunicati a Rojac" fallisce (tabella inesistente) e il
      trigger di blocco non esiste.

### Correzione: comunicazione unica per l'intero asilo, non per classe
- [x] Errore nella prima versione: la comunicazione a Rojac era pensata
      per singola sezione (pulsante dentro `pasti/[sezioneId]`, tabella
      `pasti_comunicati` con chiave `sezione_id + data`). Corretto su
      richiesta esplicita: Rojac fattura sull'intero asilo, quindi la
      comunicazione è **una sola al giorno, cumulativa su tutte le
      sezioni**. Il pulsante si sposta sulla pagina lista `/dashboard/pasti`
      (prima di scegliere una classe); una volta confermata, blocca la
      modifica dei pasti per la maestra in **ogni** classe per quel
      giorno (l'admin può sempre modificare, invariato). `specs/16 -
      comunicazione-pasti-rojac.md` riscritto di conseguenza, con una
      nota esplicita "Correzione rispetto a una prima versione".
- [x] Nuova UX richiesta esplicitamente: 1) la maestra apre
      `/dashboard/pasti` sulla data odierna; 2) clicca "Conferma pasti";
      3) un popup di conferma (`components/ConfermaAzione.tsx`, tono
      "neutro") mostra il numero di pasti da comunicare (ricalcolato al
      momento del click), il telefono di Rojac (**0331 955630**) e la
      data odierna; 4) due pulsanti, Conferma/Annulla; 5) alla conferma,
      parte anche una mail (best-effort, non bloccante) a
      `info@asilosartorio.it` con il numero di pasti comunicati e chi
      l'ha fatto.
- [x] `supabase/migrations/0020_pasti_comunicati_globale.sql` (nuovo,
      **sostituisce** `0019_pasti_comunicati_rojac.sql`): elimina
      trigger/tabella `0019` (`drop ... if exists ... cascade`, sicuro
      sia che `0019` non sia mai stata applicata sia che lo sia stata
      senza dati reali) e ricrea `pasti_comunicati` con chiave `data`
      **unique** (non più `sezione_id + data`). Stessa logica di
      immutabilità/grant/trigger di prima, solo senza `sezione_id`.
- [x] `lib/pastiRojac.ts` (nuovo): `contaPastiSiOggiTuttoAsilo(data)` —
      conta i pasti "sì" su tutti i bambini attivi dell'asilo (non filtra
      per sezione), usa `createAdminClient()` perché una maestra vede
      via RLS solo le proprie sezioni ma il totale Rojac deve coprire
      tutto l'asilo; l'autorizzazione per questa azione è quindi a
      livello applicativo (`assicuraAccessoPasti` + `puoScrivereData`),
      non RLS. `TELEFONO_ROJAC` esportata da qui. `lib/comunicazionePasti.ts`
      semplificato: rimossi `sezioneId` e `raggruppaPerSezione` (non più
      pertinenti con una comunicazione unica per asilo).
- [x] `app/dashboard/pasti/actions.ts:comunicaPastiRojac` riscritta:
      nessun parametro sezione, conta e registra il totale asilo,
      gestisce l'errore di unicità (`23505`, già comunicato oggi) con un
      messaggio dedicato, invia la mail di notifica in un `try/catch`
      separato (un fallimento dell'email non deve far fallire la
      comunicazione già registrata).
- [x] `components/PaginaClassi.tsx` (pagina lista, non più
      `pasti/[sezioneId]/page.tsx`) mostra ora il pulsante/popup o, se
      già comunicato oggi, il banner con data/ora/numero — condizionato
      a `tipo === 'pasti'`. Importa deliberatamente `comunicaPastiRojac`
      da `app/dashboard/pasti/actions.ts` (commento nel codice che
      spiega la scelta: evita di duplicare in un componente condiviso la
      logica di bootstrap già centralizzata nella action). La pagina di
      classe (`pasti/[sezioneId]/page.tsx`) ora mostra solo un banner
      informativo di sola lettura (query globale sulla data, senza
      filtro sezione) e blocca comunque Sì/No/nota per la maestra.
- [x] Report a schermo (`app/dashboard/report/page.tsx`) e i 3 PDF
      email (`lib/reportPresenze.ts:recuperaComunicazioniPastiPeriodo`,
      `lib/pdfReport.ts`, `app/api/cron/report-presenze/route.ts`):
      **una sola** sezione "Comunicazione pasti" per l'intero documento
      (non più una per sezione).
- [x] `e2e/16-comunicazione-pasti-rojac.spec.ts` riscritto — con una
      differenza importante rispetto agli altri file e2e del progetto:
      **non preme mai "Conferma"**. La comunicazione ora è unica per
      l'intero asilo e blocca la maestra in ogni classe per il resto
      della giornata sul progetto Supabase di test condiviso; un click
      automatico romperebbe `e2e/06-controllo-consistenza.spec.ts` e
      `e2e/14-segna-pasto.spec.ts` per il resto del giorno
      (`fullyParallel: true`). I test verificano quindi solo che il
      popup mostri i dati corretti e che "Annulla" non registri nulla;
      gli scenari che presuppongono una comunicazione già avvenuta
      (blocco su ogni classe, override admin, sezione nel report) si
      attivano da soli (`test.skip` altrimenti) solo se qualcuno l'ha
      già confermata manualmente nello stesso giorno.
- [x] Verificato: `npx tsc --noEmit`, `npx next lint`, `npx vitest run`
      (113 test) e `npx jscpd` (2 clone preesistenti tollerati, sotto
      soglia) tutti puliti.
- [x] Bug trovato in produzione dopo l'applicazione di `0020`: il
      pulsante "Conferma pasti" falliva con "permission denied for
      table pasti_comunicati". Causa: `0020` concedeva a `service_role`
      solo `select` (serviva per il report notturno), ma
      `comunicaPastiRojac` (`app/dashboard/pasti/actions.ts`) *inserisce*
      con la service_role key, non con il client autenticato — stesso
      tipo di bug già capitato con `0018_grant_service_role_report.sql`
      (un GRANT di tabella non è coperto dalle policy RLS, va concesso
      esplicitamente per ogni operazione usata, non solo per quelle
      previste all'inizio). Fix in
      `supabase/migrations/0021_fix_grant_insert_pasti_comunicati.sql`
      (nuova migration, quella già applicata `0020` non si tocca).
- [ ] **Da fare da parte tua**:
      1. Applica `supabase/migrations/0020_pasti_comunicati_globale.sql`
         nel SQL Editor di Supabase (test e produzione) — sostituisce
         `0019`, sicuro da eseguire anche se `0019` non è mai stata
         applicata.
      2. Applica anche
         `supabase/migrations/0021_fix_grant_insert_pasti_comunicati.sql`
         (dopo la 0020) — senza questo grant il pulsante "Conferma
         pasti" fallisce con "permission denied", come già capitato in
         produzione.
      3. Verifica manualmente **una volta** il click reale su "Conferma"
         (numero pasti, invio mail a info@asilosartorio.it, blocco
         effettivo su tutte le classi) — non coperto da e2e per il
         motivo spiegato sopra.

## Icona per "Aggiungi a schermata Home" (Android/iOS)
- [x] Prima di questa modifica il progetto non aveva né favicon né web
      manifest: su Android, "Aggiungi a schermata Home" mostrava
      un'icona generica (la "V" di Vercel, di fallback per un deploy
      senza favicon) e il titolo intero della pagina ("Girasole — Asilo
      Sartorio"), troppo lungo per stare sotto l'icona.
- [x] `app/icon.svg` (nuovo, convenzione file di Next.js — servito in
      automatico come favicon): un ritaglio quadrato del solo fiore del
      logo esistente (`public/girasole.svg`, invariato — resta usato
      così com'è nella pagina di login), senza smartphone/scritta/
      tagline, che a icona piccola sarebbero illeggibili.
- [x] `public/icons/*.png` (nuovi, generati dallo stesso SVG via
      Chromium headless — nessuna dipendenza nuova, riusa
      `@playwright/test` già presente): `icon-192.png`/`icon-512.png`
      ("any", fiore a piena pagina) e `icon-maskable-512.png` (fiore
      ridotto al 65% con margine, per non farlo tagliare dalla maschera
      circolare/squircle di Android) e `apple-touch-icon.png` (180×180,
      iOS).
- [x] `app/manifest.ts` (nuovo, convenzione Next.js —
      `/manifest.webmanifest` automatico): `short_name: "Girasole"` è
      quello che compare sotto l'icona in home (risolve il testo
      lungo), più `name` completo, icone sopra, `theme_color`/
      `background_color`, `display: "standalone"`.
- [x] `app/layout.tsx`: aggiunto `icons.apple` (per l'apple-touch-icon,
      Safari/iOS non legge il manifest per questo) e `appleWebApp.title`
      ("Girasole", stesso motivo di `short_name` ma per iOS).
- [x] Verificato: `npx tsc --noEmit`, `npx next lint`, `npx vitest run`
      (113 test), `npx jscpd` (2 clone preesistenti, sotto soglia) e
      `npx next build` (le nuove route `/icon.svg` e
      `/manifest.webmanifest` compilano ed entrano nell'output).
- [ ] **Da verificare da parte tua**: su un telefono Android, apri il
      sito, menu Chrome → "Aggiungi a schermata Home" — deve comparire
      l'icona del girasole (non più la "V") e la scritta "Girasole"
      sotto (non più il titolo intero). L'icona già installata prima di
      questa modifica non si aggiorna da sola: va rimossa e
      riaggiunta.

## Calendario scolastico: giorni di chiusura (nuovo specs/53)
- [x] Nuovo requisito `specs/53 - calendario-scolastico.md`: l'admin
      inserisce/modifica/elimina giorni di chiusura scolastica (intervallo
      da/a + nota opzionale) su `/admin/calendario`. In un giorno chiuso
      (registrato dall'admin, oppure sabato/domenica — chiusura implicita,
      nessun record necessario) non è possibile registrare presenze o
      pasti, per **nessun ruolo, admin incluso** — a differenza della
      regola "sola data odierna" di specs/13/14, che esenta l'admin,
      questo è un vincolo di coerenza dei dati (asilo chiuso = nessuna
      presenza/pasto da registrare), non un permesso di scrittura. Le
      pagine Presenze/Pasti mostrano l'informazione (nota, se presente) al
      posto dei pulsanti. specs/13 e specs/14 aggiornate (sezione Regole)
      con un rimando incrociato a specs/53, stesso pattern già usato per
      specs/06 - controllo-consistenza.md (nessuna duplicazione di
      scenario/test tra i requisiti).
- [x] `supabase/migrations/0022_calendario_scolastico.sql`: tabella
      `giorni_chiusura` (intervallo con vincolo `data_fine >= data_inizio`,
      nota libera), RLS (select per tutto lo staff, insert/update/delete
      solo admin), funzione `giorno_chiuso(data)` (weekend via
      `extract(isodow ...)` OR intervallo registrato) e due trigger
      (`presenze_blocca_se_chiuso`, `pasti_blocca_se_chiuso`) che
      bloccano insert/update su `presenze`/`pasti` per qualunque ruolo —
      stesso principio già in vigore per "pasto di un bambino
      assente/malato" (0012/0017), non un'eccezione per l'admin come
      invece 0009. Grant a `service_role` incluso da subito (imparato dal
      bug del report notturno, vedi sopra in questo file).
- [x] `lib/date.ts:isWeekend` (pura, unit test) + `lib/calendarioScolastico.ts`:
      `trovaChiusura`/`isGiornoChiuso`/`messaggioChiusura` (pure, unit
      test in `lib/calendarioScolastico.test.ts`) e `chiusuraPerData`/
      `assicuraGiornoApribile` (fanno I/O, coperte solo da e2e — stesso
      criterio di ammissione già in uso per `lib/auth.ts`).
- [x] `/admin/calendario` (elenco + form di creazione) e
      `/admin/calendario/[id]` (modifica + eliminazione con conferma,
      `ConfermaAzione` già esistente) — stesso pattern list+detail già
      usato per `/admin/bambini/[id]`. Nuove server action in
      `app/admin/calendario/actions.ts`
      (`creaGiornoChiusura`/`aggiornaGiornoChiusura`/`eliminaGiornoChiusura`).
      Link "Calendario scolastico" aggiunto a `NavHeader` per l'admin.
- [x] `app/dashboard/presenze/[sezioneId]/page.tsx` e
      `app/dashboard/pasti/[sezioneId]/page.tsx`: caricano il giorno di
      chiusura per la data corrente, ricalcolano `editable` includendo
      `!chiuso` (per tutti i ruoli) e passano il messaggio a
      `PaginaClasseAttivita` (nuovo prop `messaggioChiusura`, banner
      rosso con priorità sul banner "sola lettura" esistente, che riguarda
      solo maestra/assistente). Le server action `segnaPresenza`/
      `segnaPreAsilo`/`segnaPostAsilo`/`salvaNotaPresenza`/`segnaPasto`/
      `salvaNotaPasto` chiamano `assicuraGiornoApribile` prima di
      scrivere, per un messaggio d'errore chiaro oltre al trigger DB.
- [x] Test aggiunti: `lib/date.test.ts` (`isWeekend`),
      `lib/calendarioScolastico.test.ts` (funzioni pure), nuovo
      `e2e/53-calendario-scolastico.spec.ts` (un test per ogni
      `## Scenario:` di specs/53, incluso il controllo axe-core su
      `/admin/calendario` e sulla scheda di dettaglio). I test che creano
      un giorno di chiusura usano date lontane nel futuro (per non
      collidere con "oggi"/"ieri" di altri test) e lo eliminano a fine
      test (anche in caso di asserzione fallita, via `try`/`finally` nel
      test che verifica il blocco di Presenze/Pasti).
- [x] Verificato: `npx tsc --noEmit`, `npx next lint`, `npx vitest run`
      (131 test) e `npx jscpd` (3 clone preesistenti, sotto soglia,
      nessuno nuovo) puliti. Suite e2e Playwright non eseguibile da questo
      ambiente sandbox (nessun dev server né credenziali Supabase — stesso
      limite di sempre, vedi note precedenti in questo file): da
      verificare con `npx playwright test e2e/53-calendario-scolastico.spec.ts`
      (e le altre suite toccate: 13, 14) dal tuo ambiente locale.
- [ ] **Da fare da parte tua**: applica
      `supabase/migrations/0022_calendario_scolastico.sql` nel SQL Editor
      di Supabase (test e produzione) prima di usare `/admin/calendario`
      — senza, la tabella `giorni_chiusura` non esiste e la pagina fallisce
      nel caricare l'elenco.

## Corpo dell'email del report notturno in forma tabellare (v0.12.1)
- [x] Richiesta dell'utente: il report notturno via email
      (specs/52 - report-email-automatico.md) arrivava con i 3 PDF già
      tabellari, ma il corpo dell'email stessa (visibile senza aprire
      allegati) era ancora un elenco puntato (`<ul><li>`), residuo della
      versione precedente all'introduzione dei PDF. Richiesto che anche
      il corpo mostri la stessa tabella vista nella sezione Report a
      schermo.
- [x] `specs/52 - report-email-automatico.md` aggiornata: nuova frase
      nello scenario "invio notturno dei tre report" e nella nota di
      implementazione che richiede esplicitamente che anche il corpo
      dell'email (non solo gli allegati PDF) sia una tabella per classe
      con le colonne del report a schermo.
- [x] `lib/reportPresenze.ts`: nuova funzione pura
      `formattaTabellaReportHtml(titolo, sezioni)` (una `<table>` per
      classe attiva, colonne Bambino/Presenze/Pre-asilo/Post-asilo/
      Pasti, avviso ⚠️ accanto al nome quando ci sono inconsistenze —
      stessa dicitura di `components/AvvisoInconsistenza.tsx`), unit
      test in `lib/reportPresenze.test.ts`. `generaSchedaGiornalieraHtml`
      (che eseguiva query proprie e produceva l'elenco puntato) sostituita
      da `generaTabellaGiornalieraHtml`, che riusa
      `aggregaReportPeriodoTutteLeClassi` (già usata per gli allegati PDF
      settimanale/mensile) con `inizio = fine = data`, evitando di
      duplicare la logica di aggregazione (CLAUDE.md, jscpd) — effetto
      collaterale positivo: il corpo mail ora filtra bambini/classi
      attivi come lo schermo (prima interrogava anche i bambini non
      attivi).
- [x] `app/api/cron/report-presenze/route.ts` aggiornata al nuovo nome di
      funzione.
- [x] Nessuna modifica alla generazione dei 3 PDF allegati
      (`lib/pdfReport.ts`), già tabellari e allineati al report a schermo
      da una sessione precedente.
- [x] Verificato: `npx tsc --noEmit`, `npx next lint`, `npx vitest run`
      (136 test) e `npx jscpd` (3 clone preesistenti, sotto soglia,
      nessuno nuovo) puliti. Suite e2e Playwright non eseguibile da
      questo ambiente sandbox (nessun dev server né credenziali
      Supabase): da verificare con
      `npx playwright test e2e/52-report-email-automatico.spec.ts` dal
      tuo ambiente locale — quel file non fa assert sul contenuto HTML
      del corpo email (nessuna infrastruttura di lettura casella email
      nella suite), solo sull'idempotenza della route, quindi non è
      impattato dal cambio di formato.

## Ore di lavoro: abilitazione per utente e quarta sezione in dashboard (v0.13.0)
- [x] Richiesta dell'utente: primo passo verso la possibilità, per il
      personale retribuito, di segnare le ore di lavoro effettuate o le
      assenze. In questa fase si abilita solo l'accesso a una nuova
      sezione "Ore di lavoro" (quarta, insieme a Presenze/Pasti/Report),
      per utente, decisa dall'admin — **non** come le ore vengono
      effettivamente registrate (fuori scope, fase successiva).
- [x] Nuovo `specs/17 - ore-di-lavoro.md` (aggiunto all'indice in
      `specs/00 - overview.md`); `specs/03 - utenti-e-ruoli.md` esteso
      con il nuovo campo utente; `specs/12 - dashboard-maestre.md`
      esteso con lo scenario della quarta card e la regola della griglia
      bilanciata.
- [x] `supabase/migrations/0023_ore_lavoro_abilitazione.sql`: nuova
      colonna `profili.abilitato_ore_lavoro` (booleano, default falso).
      Nessuna nuova policy RLS necessaria (colonna coperta dalle policy
      di riga già esistenti su `profili`).
- [x] `lib/auth.ts`: `Profilo` include ora `abilitato_ore_lavoro`
      (letto da `requireProfilo`); nuova `assicuraAccessoOreLavoro`
      (redirect a `/dashboard` se non abilitato — stesso pattern di
      `assicuraAccessoPasti`), usata dalla nuova pagina
      `app/dashboard/ore-lavoro/page.tsx` (placeholder: nessuna form,
      solo il messaggio che la funzione arriva in una fase successiva).
- [x] `lib/dashboardSezioni.ts` (nuovo, puro): `cardsDashboard` costruisce
      l'elenco delle card Presenze/Pasti/Report/Ore di lavoro secondo
      ruolo/sezioni assegnate/abilitazione, con la logica della griglia
      bilanciata a due colonne (l'ultima card occupa l'intera larghezza
      quando il numero visibile è dispari) — unit test in
      `lib/dashboardSezioni.test.ts`. `app/dashboard/page.tsx`
      semplificata: un'unica griglia invece del blocco Presenze/Pasti
      più il pulsante Report separato di prima (Report ora ha lo stesso
      stile "card grande" degli altri, non più una barra sottile).
- [x] `/admin/maestre`: nuovo checkbox "Abilita al report ore di lavoro"
      nel form di creazione e "Ore di lavoro" nella riga di modifica di
      ogni utente (`app/admin/maestre/page.tsx`,
      `app/admin/maestre/actions.ts:campiUtente/creaUtente/aggiornaUtente`).
- [x] Verificato: `npx tsc --noEmit`, `npx next lint`, `npx vitest run`
      (144 test) e `npx jscpd` (3 clone preesistenti, sotto soglia,
      nessuno nuovo) puliti. Suite e2e Playwright non eseguibile da
      questo ambiente sandbox (nessun dev server né credenziali
      Supabase): nuovo `e2e/17-ore-di-lavoro.spec.ts` (un test per
      ciascuno dei 5 scenari di specs/17, incluso axe-core sulla nuova
      pagina) da verificare con
      `npx playwright test e2e/17-ore-di-lavoro.spec.ts` (e riesegui
      12, 03) dal tuo ambiente locale.
- [ ] **Da fare da parte tua**: applica
      `supabase/migrations/0023_ore_lavoro_abilitazione.sql` nel SQL
      Editor di Supabase (test e produzione) prima di usare la nuova
      abilitazione — senza, `/admin/maestre` e la dashboard falliscono
      a leggere/scrivere la colonna `abilitato_ore_lavoro`.

## Profili orari: definizione e assegnazione al personale (v0.14.0)
- [x] Richiesta dell'utente: secondo passo verso le ore di lavoro del
      personale. L'admin deve poter definire "orari tipo" settimanali
      (es. "35 ore settimanali" = 7h lun-ven, "32 ore settimanali" = 4
      giorni a 7h + 1 a 4h, "Assistente 15h" = 3h lun-ven) in un pannello
      dedicato, e assegnarne uno a ciascuna persona. **Non** come questi
      profili verranno poi usati per calcolare/validare le ore segnate
      (fuori scope, fase successiva).
- [x] Nuovo `specs/54 - profili-orari.md` (aggiunto all'indice in
      `specs/00 - overview.md`); `specs/17 - ore-di-lavoro.md` e
      `specs/03 - utenti-e-ruoli.md` estese con un riferimento incrociato
      — l'assegnazione del profilo orario è **indipendente**
      dall'abilitazione al report ore (due controlli separati, scelta
      esplicita per restare semplici: CLAUDE.md, niente validazioni per
      scenari che non servono ora).
- [x] `supabase/migrations/0024_profili_orari.sql`: nuova tabella
      `profili_orari` (nome + ore lun-ven, `numeric(4,2)`), RLS solo
      admin (nessun altro ruolo la legge ancora); nuova colonna
      `profili.profilo_orario_id` (`on delete set null`: eliminare un
      profilo non blocca nulla, svuota solo l'assegnazione — stesso
      pattern di `sezioni.anno_scolastico_id`).
- [x] `lib/profiliOrari.ts` (nuovo, puro): `totaleOreSettimanali` somma
      i 5 giorni (accetta anche stringhe numeriche, per come Postgres
      può restituire una colonna `numeric` via PostgREST) — unit test in
      `lib/profiliOrari.test.ts`.
- [x] Nuova sezione admin `/admin/profili-orari` (elenco + creazione) e
      `/admin/profili-orari/[id]` (modifica/eliminazione), stesso
      pattern list+detail già usato per `/admin/calendario` (specs/53).
      `components/CampiOreSettimana.tsx` (nuovo) condivide i 5 input
      ore lun-ven tra creazione e modifica (CLAUDE.md, jscpd — evitato un
      duplicato reale, non solo simile per forma). Link "Profili orari"
      aggiunto a `NavHeader` per l'admin.
- [x] `/admin/maestre`: nuovo menu "Profilo orario" (opzionale) nel form
      di creazione e nella riga di modifica di ogni utente
      (`app/admin/maestre/page.tsx`,
      `app/admin/maestre/actions.ts:campiUtente/creaUtente/aggiornaUtente`),
      indipendente dal checkbox "Ore di lavoro" già esistente.
- [x] Verificato: `npx tsc --noEmit`, `npx next lint`, `npx vitest run`
      (150 test) e `npx jscpd` (3 clone preesistenti, sotto soglia,
      nessuno nuovo) puliti. Suite e2e Playwright non eseguibile da
      questo ambiente sandbox (nessun dev server né credenziali
      Supabase): nuovo `e2e/54-profili-orari.spec.ts` (7 test, uno per
      scenario di specs/54, incluso axe-core) da verificare con
      `npx playwright test e2e/54-profili-orari.spec.ts` dal tuo
      ambiente locale.
- [ ] **Da fare da parte tua**: applica
      `supabase/migrations/0024_profili_orari.sql` nel SQL Editor di
      Supabase (test e produzione) prima di usare `/admin/profili-orari`
      — senza, la tabella `profili_orari` e la colonna
      `profili.profilo_orario_id` non esistono.

## Report ore di lavoro: form settimanale, malattia/assenza, conferma (v0.15.0)
- [x] Richiesta dell'utente: terzo passo verso le ore di lavoro del
      personale. `/dashboard/ore-lavoro` (finora un placeholder,
      v0.13.0) mostra ora la settimana corrente in forma tabellare (una
      card per giorno feriale): ore ordinarie precaricate dal profilo
      orario (v0.14.0) e modificabili, ore straordinarie libere (con
      motivo obbligatorio), stato "Malattia" (codice obbligatorio) o
      "Assenza" (nota obbligatoria) in alternativa alle ore. Il
      personale salva le modifiche e conferma la settimana quando
      soddisfatto; da quel momento non può più modificarla (solo
      l'admin può, RLS pronta, interfaccia dedicata fuori scope).
- [x] Nuovo `specs/18 - report-ore-lavoro.md` (in indice su
      `specs/00`); `specs/17 - ore-di-lavoro.md` aggiornata a
      rimandarci per il "come" (non più un placeholder).
- [x] `supabase/migrations/0025_report_ore_lavoro.sql`: nuove tabelle
      `ore_lavoro_giorni` (stato/ore/motivo/codice/nota, con check
      constraint per ciascuna delle tre regole di obbligatorietà) e
      `ore_lavoro_settimane` (l'esistenza della riga è la conferma,
      stesso pattern di `report_giornalieri_inviati`, specs/52). RLS:
      il personale scrive solo le proprie righe e solo se la settimana
      non è confermata (funzione `settimana_ore_lavoro_confermata`),
      l'admin sempre. Trigger `impedisci_ore_lavoro_giorno_chiuso`
      riusa `public.giorno_chiuso` (0022): un giorno di chiusura
      scolastica non è scrivibile da nessuno, come già per
      presenze/pasti (specs/53, che rimandava esplicitamente a questa
      futura funzionalità).
- [x] `lib/date.ts`: nuove `giornoSettimanaIso` (refactor di `isWeekend`
      per riusarla) e `giorniLavorativiSettimana` (i 5 giorni
      lunedì-venerdì della settimana di una data). `lib/oreLavoro.ts`
      (nuovo, puro): `oreOrdinariePreviste` (precaricamento dal profilo
      orario), `validaGiornoOreLavoro` (le tre regole di
      obbligatorietà, azzera ore su malattia/assenza),
      `totaliSettimanaOreLavoro`. `lib/calendarioScolastico.ts`:
      `chiusurePerPeriodo` (chiusure su un intervallo, non solo un
      giorno). `lib/profiliOrari.ts`: `recuperaProfiloOrario`. Unit
      test in `lib/date.test.ts`, `lib/oreLavoro.test.ts` (23 nuovi
      test totali).
- [x] `components/RigaOreLavoro.tsx` (nuovo, client): riga editabile di
      un giorno, mostra solo i campi pertinenti allo stato scelto
      (specs/01 - ux.md, "preferire azioni a un tap a form con molti
      campi") — toggle solo visivo, la sottomissione resta un form
      nativo lato server. `app/dashboard/ore-lavoro/page.tsx` riscritta
      (non più un placeholder): card per giorno (editabile o sola
      lettura se la settimana è confermata, chiusura scolastica se il
      giorno è chiuso), totale settimanale, pulsante "Conferma
      settimana" (`components/ConfermaAzione.tsx`, tono neutro). Nuove
      `app/dashboard/ore-lavoro/actions.ts:salvaSettimanaOreLavoro`
      (valida tutti i giorni prima di scrivere qualunque cosa, nessun
      salvataggio parziale su un errore — specs/05) e
      `confermaSettimanaOreLavoro` (completa i giorni non ancora
      salvati con i valori precaricati, poi registra la conferma).
- [x] Verificato: `npx tsc --noEmit`, `npx next lint`, `npx vitest run`
      (169 test) e `npx jscpd` (3 clone preesistenti, sotto soglia,
      nessuno nuovo) puliti. Suite e2e Playwright non eseguibile da
      questo ambiente sandbox (nessun dev server né credenziali
      Supabase): nuovo `e2e/18-report-ore-lavoro.spec.ts` da verificare
      con `npx playwright test e2e/18-report-ore-lavoro.spec.ts` (e
      rieseguire 17) dal tuo ambiente locale. **Nota importante**: quel
      file non preme mai per davvero "Sì" su "Conferma settimana" —
      confermare è irreversibile fino al lunedì successivo (nessuna
      "riapertura" in questa fase) e bloccherebbe la scrittura
      sull'account di test condiviso per il resto della settimana,
      stessa cautela già presa per "Pasti comunicati a Rojac"
      (specs/16). Lo scenario "settimana confermata" si verifica solo
      se qualcuno l'ha già confermata manualmente questa settimana
      (altrimenti `test.skip`).
- [ ] **Da fare da parte tua**: applica
      `supabase/migrations/0025_report_ore_lavoro.sql` nel SQL Editor
      di Supabase (test e produzione) prima di usare
      `/dashboard/ore-lavoro` — senza, la pagina fallisce a leggere/
      scrivere le tabelle `ore_lavoro_giorni`/`ore_lavoro_settimane`.

## Ore di lavoro: registrabili anche nei giorni di chiusura scolastica (v0.15.1)
- [x] Richiesta esplicita dell'utente, correzione rispetto a v0.15.0: il
      personale può lavorare (pulizie, attività amministrative,
      formazione...) anche nei giorni in cui l'asilo è chiuso (weekend
      o chiusura registrata dall'admin) — il blocco introdotto in
      0025_report_ore_lavoro.sql (che riprendeva la nota "in futuro" di
      specs/53/0022) era quindi sbagliato per questo registro.
- [x] `specs/18 - report-ore-lavoro.md`: la tabella mostra ora tutti i 7
      giorni della settimana (non solo lunedì-venerdì), tutti
      pienamente modificabili; un giorno di chiusura mostra solo
      un'informazione, senza bloccare nulla. `specs/53 -
      calendario-scolastico.md` corretta di conseguenza (l'eccezione
      per le ore di lavoro è ora dichiarata esplicitamente, non più "in
      futuro varrà anche lì").
- [x] `supabase/migrations/0026_ore_lavoro_permesse_giorni_chiusi.sql`
      (nuova, non modifica 0025 già applicata): rimuove il trigger
      `ore_lavoro_giorni_blocca_se_chiuso` e la funzione
      `impedisci_ore_lavoro_giorno_chiuso`. Le RLS restano invariate
      (non facevano riferimento alla chiusura).
- [x] `lib/date.ts:giorniLavorativiSettimana` (5 giorni) sostituita da
      `giorniSettimana` (7 giorni, lunedì-domenica) — unico punto d'uso.
      `lib/oreLavoro.ts`: nuova `notaGiornoChiusoOreLavoro` (pura, con
      unit test), testo dedicato che non riusa
      `calendarioScolastico.ts:messaggioChiusura` (che parla di un
      blocco reale, fuorviante qui) — dice esplicitamente "puoi comunque
      registrare le ore". `components/RigaOreLavoro.tsx` mostra questa
      nota come avviso informativo, non più una card "chiusa" senza
      campi. `app/dashboard/ore-lavoro/actions.ts` non salta più i
      giorni chiusi nel salvataggio/completamento pre-conferma.
- [x] Verificato: `npx tsc --noEmit`, `npx next lint`, `npx vitest run`
      (173 test) e `npx jscpd` (3 clone preesistenti, sotto soglia,
      nessuno nuovo) puliti. `e2e/18-report-ore-lavoro.spec.ts`
      aggiornato (sabato/domenica ora editabili e verificati, niente
      più skip legato a un giorno chiuso) — non eseguibile in questo
      ambiente sandbox, da verificare con
      `npx playwright test e2e/18-report-ore-lavoro.spec.ts` dal tuo
      ambiente locale (stessa cautela di v0.15.0: non preme mai "Sì" su
      "Conferma settimana").
- [ ] **Da fare da parte tua**: applica
      `supabase/migrations/0026_ore_lavoro_permesse_giorni_chiusi.sql`
      nel SQL Editor di Supabase (test e produzione) — senza, il
      trigger continua a bloccare le ore nei giorni di chiusura.

## Evoluzione navigazione: sidebar ispirata a TailAdmin (specs/01 - ux.md)
- [x] `NavHeader` non è più una singola riga di link orizzontali (con le
      4 voci admin non ci stava più a larghezza mobile) ma una sidebar:
      fissa a sinistra da schermo `lg` in su, drawer nascosto aperto da
      un pulsante hamburger sotto quella soglia (overlay per richiuderlo
      con un tap, si chiude anche subito dopo il tap su una voce).
      Riceve ora `children` (il `<main>` della pagina) invece di essere
      un semplice sibling — aggiornati tutti i 15 punti di chiamata
      (`app/admin/**`, `app/dashboard/**`, `components/PaginaClassi.tsx`,
      `components/PaginaClasseAttivita.tsx`).
- [x] `lib/navigazione.ts` (nuovo, con unit test): `vociMenu` (elenco
      voci in base al ruolo — solo "Dashboard" per maestra/assistente/
      genitore, la navigazione loro resta via le card della dashboard;
      in più le 4 voci admin per l'admin) e `vociMenuConStato` (quale
      voce evidenziare in base al pathname corrente, prefisso più
      lungo che corrisponde — così `/admin/maestre/x` evidenzia
      "Utenti" e non il generico "Sezioni e bambini").
- [x] `e2e/01-ux.spec.ts`: due nuovi scenari, "sidebar chiusa di default
      e apribile/richiudibile con l'hamburger" (mobile) e "sidebar
      sempre visibile con voci admin e voce corrente evidenziata"
      (desktop) — non eseguibili in questo ambiente sandbox (nessun
      server dev, nessuna credenziale E2E_*), da verificare con
      `npx playwright test e2e/01-ux.spec.ts` in locale.
- [x] Verificato: `npx tsc --noEmit`, `npx next lint`, `npx vitest run`
      (179 test, +6 nuovi in `lib/navigazione.test.ts`) e `npx jscpd`
      (3 clone preesistenti, sotto soglia, nessuno nuovo) puliti.

## Allarmi: presenze/pasti entro mezzogiorno, settimana ore non confermata (v0.17.0)
- [x] Richiesta dell'utente: due allarmi, ciascuno su due canali (banner
      in dashboard + email). 1) Se entro le 12:00 (Europe/Rome) di un
      giorno attivo non sono state segnate tutte le presenze o non sono
      stati confermati i pasti (comunicazione a Rojac, specs/16),
      banner per **tutto** lo staff ed email a
      `info@asilosartorio.it`. 2) Per ogni utente abilitato al report
      ore (specs/17) la cui settimana scorsa non risulta confermata
      (specs/18), banner **personale** ed email allo stesso indirizzo
      (il secondo indirizzo scritto nel messaggio dell'utente,
      "asilosaetoeio.it", era un refuso — uso lo stesso
      `info@asilosartorio.it`/`REPORT_EMAIL_DESTINATARIO` già in uso
      per i report notturni).
- [x] Nuovo `specs/07 - allarmi.md` (in indice su `specs/00`, numerato
      0x perché trasversale come specs/06).
- [x] `supabase/migrations/0027_allarmi.sql`: nuova tabella
      `allarmi_inviati` (`tipo`, `chiave`, `inviato_at` — esistenza
      della riga = già inviato, stesso pattern di
      `report_giornalieri_inviati`/`ore_lavoro_settimane`), un'unica
      tabella con discriminatore invece di una per allarme. RLS
      abilitata senza policy per `authenticated`: solo il cron
      (service_role) la usa.
- [x] `lib/allarmi.ts` (nuovo): funzioni pure `dopoMezzogiorno`,
      `allarmeMezzogiornoAttivo`, `descrizioneStatoOperativo` (unit
      test in `lib/allarmi.test.ts`, incluso il confine ora
      solare/legale) e funzioni I/O `calcolaStatoOperativoGiorno`
      (richiede la service_role key: serve vedere tutte le sezioni, non
      solo quelle di chi guarda — stesso motivo di specs/52),
      `settimanaPrecedenteConfermata` (RLS normale: un utente legge
      solo la propria riga) e `utentiConSettimanaNonConfermata` (solo
      cron). `lib/date.ts:settimanaPrecedente` (nuova, con unit test).
- [x] Nuova route `app/api/cron/allarmi/route.ts` — un solo cron
      (non due) per restare dentro il limite Vercel Hobby di 2 cron per
      progetto (già a 1 con `report-presenze`), pianificato dopo
      mezzogiorno Europe/Rome (`vercel.json`, `"30 11 * * *"` UTC, dopo
      le 12:00 Rome sia in ora solare sia legale). Valuta entrambi gli
      allarmi, invia le email (idempotenti per tipo+chiave),
      protetto dallo stesso `CRON_SECRET` degli altri cron — nuovo
      `lib/auth.ts:autorizzaCron`, condiviso con
      `report-presenze/route.ts` per non duplicare quel controllo in
      due file (CLAUDE.md, jscpd). `lib/email.ts:destinatarioNotifiche`
      (nuovo) sostituisce la funzione locale `destinatarioReport` di
      `report-presenze/route.ts`, stesso motivo.
- [x] `app/dashboard/page.tsx`: due banner (`role="alert"`) in cima al
      `<main>`, prima di tutto il resto — quello mezzogiorno (rosso,
      calcolato con la service_role key) e quello settimana ore
      (ambra, personale, calcolato con la sessione RLS normale
      dell'utente). Il banner personale non promette di poter
      confermare la settimana scorsa da qui (specs/18 non lo permette
      ancora, solo la settimana corrente): invita a contattare l'admin.
- [x] Verificato: `npx tsc --noEmit`, `npx next lint`, `npx vitest run`
      (198 test) e `npx jscpd` (3 clone preesistenti, sotto soglia,
      nessuno nuovo) puliti. Nuovo `e2e/07-allarmi.spec.ts` — non
      eseguibile in questo ambiente sandbox (nessun dev server né
      credenziali Supabase): diversi scenari dipendono dall'ora reale o
      dallo stato reale dei dati e si saltano da soli quando non
      verificabili al momento (stessa cautela di
      53-calendario-scolastico.spec.ts), da eseguire più volte in
      momenti diversi della giornata dal tuo ambiente locale per
      coprirli tutti. Include anche i test della route cron
      (401 senza secret, idempotenza) sul modello di
      52-report-email-automatico.spec.ts.
- [ ] **Da fare da parte tua**:
      1) applica `supabase/migrations/0027_allarmi.sql` nel SQL Editor
      di Supabase (test e produzione) prima che il cron/i banner
      funzionino;
      2) su Vercel, il nuovo cron in `vercel.json` (`/api/cron/allarmi`)
      viene registrato automaticamente al prossimo deploy — verifica
      però che il piano Vercel copra 2 cron job (Hobby ne consente 2,
      ci arriviamo esattamente con questo); se in futuro serve un terzo
      cron, servirà valutare un piano superiore o accorpare ulteriormente.

## Navigazione tra settimane in "Ore di lavoro" (v0.18.0)
- [x] Richiesta dell'utente: il personale può navigare nelle settimane
      lavorative per verificare le ore inserite o per confermare
      settimane non ancora confermate, mantenendo il vincolo assoluto
      di non poter mai inserire/vedere ore per una settimana futura.
- [x] `specs/18 - report-ore-lavoro.md`: 5 nuovi scenari (navigare a
      una settimana passata, tornare verso quella corrente, impossibile
      andare oltre, modificare/confermare una settimana passata non
      confermata, una settimana passata già confermata resta di sola
      lettura) e nuove Regole sul parametro `?settimana=` e sul vincolo
      "mai futuro" applicato su più livelli. `specs/07 - allarmi.md`
      aggiornato: il banner personale ora linka direttamente alla
      settimana da confermare, invece di rimandare all'admin (Fuori
      scope rimosso).
- [x] `lib/oreLavoro.ts:settimanaOreLavoroRichiesta` (nuova, con unit
      test in `lib/oreLavoro.test.ts`): risolve/clampa la settimana
      richiesta (query string o campo form) a un lunedì valido non
      futuro, altrimenti quella corrente — stessa idea di
      `lib/report.ts:risolviPeriodoReport` per `?periodo=`. Unica fonte
      di verità, riusata sia da `app/dashboard/ore-lavoro/page.tsx` (per
      il parametro `?settimana=`) sia da
      `app/dashboard/ore-lavoro/actions.ts` (per validare il campo
      nascosto `settimana_inizio` inviato dal form), per non duplicare
      lo stesso controllo in due punti (CLAUDE.md, jscpd).
- [x] `app/dashboard/ore-lavoro/page.tsx`: box di navigazione ambra
      (stesso stile del periodo in Report) con "←"/etichetta
      intervallo/"→" — il pulsante "→" non è mai mostrato sulla
      settimana corrente. Tutto il resto della pagina (sola lettura se
      confermata, form editabile altrimenti, totali) resta
      parametrizzato dal lunedì risolto, invariato nella logica.
- [x] `app/dashboard/ore-lavoro/actions.ts`: `salvaSettimanaOreLavoro` e
      `confermaSettimanaOreLavoro` accettano qualunque settimana passata
      valida oltre a quella corrente, rifiutano esplicitamente una
      settimana futura (messaggi "Non puoi modificare/confermare una
      settimana futura.").
- [x] `app/dashboard/page.tsx`: il banner "settimana ore non
      confermata" (specs/07) ora linka direttamente a
      `/dashboard/ore-lavoro?settimana=...` invece di invitare a
      contattare l'admin.
- [x] `supabase/migrations/0028_ore_lavoro_navigazione_settimane.sql`:
      due trigger (`ore_lavoro_giorni`, `ore_lavoro_settimane`) che
      rifiutano a livello database qualunque riga con data/settimana
      futura, per qualunque ruolo — ultimo livello di difesa oltre a UI
      e server action, coerente con le altre regole di integrità del
      progetto.
- [x] `e2e/18-report-ore-lavoro.spec.ts`: estesa la sequenza esistente
      con i 5 nuovi scenari (← verso il passato, → verso il presente,
      assenza di "→"/clamp di un `?settimana=` futuro via URL diretto,
      modifica/conferma di una settimana passata non confermata —
      ripristinata al valore trovato, mai confermata per davvero — e il
      caso di sola lettura se già confermata, che si attiva da solo).
      `e2e/07-allarmi.spec.ts`: verifica che il link del banner
      personale punti a `/dashboard/ore-lavoro?settimana=...`.
- [x] Verificato: `npx tsc --noEmit`, `npx next lint`, `npx vitest run`
      (205 test) e `npx jscpd` (3 clone preesistenti, sotto soglia,
      nessuno nuovo) puliti.
- [ ] **Da fare da parte tua**: applica
      `supabase/migrations/0028_ore_lavoro_navigazione_settimane.sql`
      nel SQL Editor di Supabase (test e produzione). Nessuna modifica
      lato Vercel richiesta da questa feature.

## Bug: impossibile salvare le ore a metà settimana (v0.18.1)
- [x] Segnalazione dell'utente: dopo aver applicato la migration
      0028, salvare le ore non andava più a buon fine a metà settimana
      (es. registrare lunedì/martedì quando oggi è martedì), per il
      vincolo "mai ore future".
- [x] Causa: il trigger `impedisci_ore_lavoro_futura` (0028) confrontava
      `data` del singolo giorno con la data odierna. Il form di
      "Ore di lavoro" invia però sempre tutti e 7 i giorni della
      settimana in un solo upsert, quindi qualunque salvataggio prima
      di domenica includeva anche giorni successivi a oggi (ancora non
      accaduti, ma dentro la settimana corrente, comunque ammessa) —
      Postgres rifiutava l'intera istruzione per quelle righe, bloccando
      di fatto ogni salvataggio che non avvenisse l'ultimo giorno della
      settimana. Il vincolo di specs/18 è "mai una settimana futura", non
      "mai un giorno futuro dentro una settimana ammessa".
- [x] `specs/18 - report-ore-lavoro.md`: nuovo scenario "salvare le ore
      anche a metà settimana"; chiarita la Regola del vincolo assoluto
      per esplicitare che riguarda la settimana, non il singolo giorno.
- [x] `supabase/migrations/0029_fix_ore_lavoro_vincolo_futuro.sql`
      (nuova — 0028 era già applicata, quindi corretta in avanti anziché
      modificata): `impedisci_ore_lavoro_futura` ora confronta la
      settimana (lunedì) di `data` con la settimana corrente
      (`date_trunc('week', ...)`), non `data` con la data odierna.
      Nessuna modifica lato applicazione: la logica in `lib/oreLavoro.ts`,
      nella pagina e nelle server action era già corretta (sempre a
      livello di settimana).
- [x] `e2e/18-report-ore-lavoro.spec.ts`: il primo "Salva modifiche" del
      test principale ora verifica esplicitamente l'assenza di errori,
      a copertura del nuovo scenario (il form invia comunque tutti i
      giorni della settimana, inclusi quelli non ancora accaduti, ad
      ogni salvataggio — prima della fix questo submit falliva se
      eseguito prima dell'ultimo giorno della settimana).
- [x] Verificato: `npx tsc --noEmit`, `npx next lint`, `npx vitest run`
      (205 test) e `npx jscpd` (3 clone preesistenti, nessuno nuovo)
      puliti.
- [ ] **Da fare da parte tua**: applica
      `supabase/migrations/0029_fix_ore_lavoro_vincolo_futuro.sql` nel
      SQL Editor di Supabase (test e produzione), subito dopo la 0028 se
      non ancora applicata, o al suo posto se 0028 è già a posto ma con
      questo bug. Nessuna modifica lato Vercel richiesta.

- [x] `specs/07 - allarmi.md`: allarme presenze/pasti riprogettato da
      banner aggregato asilo-wide (12:00, per tutto lo staff) a banner
      **personale** (10:00, solo le proprie sezioni — tutte per
      l'admin), con un link diretto a Presenze per ciascuna sezione
      incompleta e a Pasti se non ancora comunicati; non richiede più la
      service_role key (RLS della sessione normale già sufficiente).
      Allarme "settimana ore non confermata" esteso con una soglia
      anticipata: dal venerdì alle 18:00 la settimana "di riferimento"
      diventa quella corrente (non ancora finita) invece della
      precedente. Nuovo riepilogo **read-only** per l'admin ("vede gli
      allarmi di ogni dipendente, senza poter agire al loro posto") con
      lo stato di maestre/assistenti. Il ruolo "Segretaria" richiesto
      non esiste ancora nel sistema: annotato in Fuori scope, per ora
      solo l'admin vede il riepilogo.
- [x] `lib/date.ts`: nuova `settimanaCorrente` (lunedì-domenica della
      settimana che contiene una data), gemella di `settimanaPrecedente`
      già esistente.
- [x] `lib/allarmi.ts`: riscritto — `dopoOrarioAllarmePresenzePasti`
      (soglia 10:00, rimpiazza `dopoMezzogiorno`),
      `dopoSogliaVenerdiSera` e `settimanaDiRiferimentoOre` (nuove),
      `calcolaStatoPersonaleGiorno`/`allarmePersonalePresenzePastiAttivo`
      (nuovo banner personale, sessione utente normale),
      `allarmiPerDipendenti` (nuovo riepilogo admin),
      `allarmeAsiloAttivo`/`calcolaStatoOperativoGiorno` (rinominata da
      `allarmeMezzogiornoAttivo`, invariata nella sostanza, usata solo
      dal cron per l'email aggregata),
      `settimanaConfermata` (rinominata da `settimanaPrecedenteConfermata`,
      ora generica rispetto alla settimana). Nessuna migration
      necessaria: tutte le query usano tabelle/RLS già esistenti.
- [x] `app/dashboard/page.tsx`, `app/api/cron/allarmi/route.ts`
      aggiornati al nuovo `lib/allarmi.ts`.
- [x] `e2e/07-allarmi.spec.ts` riscritto per il nuovo comportamento
      (banner personale con link, soglia venerdì sera, riepilogo admin).
- [x] Verificato: `npx tsc --noEmit`, `npx next lint`, `npx vitest run`
      (222 test) e `npx jscpd` (3 clone preesistenti, nessuno nuovo)
      puliti. Suite e2e non eseguibile in questo ambiente (nessun
      progetto Supabase di test configurato in `.env.local`): da
      lanciare in locale/CI prima del merge.

- [x] `specs/18 - report-ore-lavoro.md`: nuova sezione "Amministrazione"
      — l'admin può rivedere e correggere le ore di **chiunque** sia
      abilitato al report ore, anche una settimana già confermata,
      indipendentemente dalla propria abilitazione personale. Le policy
      RLS lo permettevano già dalla v0.15.0 (`ruolo_corrente() =
      'admin'` non ha mai avuto la condizione "non confermata"),
      mancava solo l'interfaccia — nessuna migration necessaria.
- [x] `app/admin/ore-lavoro/page.tsx` (nuova): elenco del personale
      abilitato al report ore (nome, cognome, email, se la settimana
      corrente è confermata), un link per persona verso le sue ore.
- [x] `app/dashboard/ore-lavoro/page.tsx` e `actions.ts`: estesi con un
      parametro `?utente=<id>` (solo per l'admin, altrimenti ignorato —
      chi non è admin scrive/legge sempre e solo i propri dati, sia lato
      pagina sia lato server action) che sceglie di chi sono le ore
      mostrate; per l'admin la settimana resta sempre modificabile anche
      se già confermata (niente vista sola-lettura), e l'accesso non
      richiede la propria abilitazione personale. Nuova funzione pura
      condivisa `lib/oreLavoro.ts:utenteBersaglioOreLavoro` (con unit
      test) per risolvere l'utente su cui scrivere in modo identico tra
      `salvaSettimanaOreLavoro` e `confermaSettimanaOreLavoro`.
- [x] Link "Ore di lavoro del personale" aggiunto ai rimandi admin in
      `app/dashboard/page.tsx`.
- [x] `e2e/18-report-ore-lavoro.spec.ts`: nuovi scenari (elenco,
      apertura/navigazione delle ore di un dipendente, correzione di una
      settimana già confermata, conferma per conto terzi senza premere
      "Sì", parametro `utente` non valido o usato da un non-admin
      ignorato) — stessa cautela della suite esistente (mai confermare
      per davvero su un account condiviso).
- [x] Verificato: `npx tsc --noEmit`, `npx next lint`, `npx vitest run`
      (227 test) e `npx jscpd` (3 clone preesistenti, nessuno nuovo)
      puliti. Suite e2e non eseguibile in questo ambiente (nessun
      progetto Supabase di test configurato in `.env.local`): da
      lanciare in locale/CI.

## Backlog — Fase 2/3
- [ ] Rette mensili e stato pagamento
- [ ] Portale genitori (UI dedicata)
- [ ] Ore di lavoro: calcolo effettivo di un monte ore/straordinari a
      partire dai dati registrati (v0.15.0), riepiloghi, export
