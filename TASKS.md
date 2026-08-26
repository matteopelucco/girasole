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

## Backlog — Fase 2/3
- [ ] Rette mensili e stato pagamento
- [ ] Portale genitori (UI dedicata)
