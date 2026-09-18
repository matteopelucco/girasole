# TASKS.md

## Database di sviluppo: riattivato, 0031 applicata (2026-09-06)
Il progetto Supabase di sviluppo/test era stato messo in pausa
temporaneamente dall'utente; riattivato lo stesso giorno.
`0031_monte_ore.sql` è stata applicata (confermato dall'utente). Resta
da verificare `0030_profili_orari_self_select.sql` (vedi la voce
corrispondente in TASKS.md più sotto, ancora segnata come da fare) — se
il progetto di produzione è distinto da quello di test, controllare che
entrambe siano applicate anche lì.

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

## Bug: "Conferma settimana" andava in errore (Server Components render)
- [x] Segnalato dall'utente: cliccare "Conferma settimana" in
      `/dashboard/ore-lavoro` mostrava la pagina di errore generica
      ("Qualcosa è andato storto"), senza dettagli in produzione. Audit
      completo di tutte le `grant`/policy RLS di `supabase/migrations/`
      contro l'uso reale nel codice per escludere altre "grant mancanti"
      dello stesso tipo già capitate più volte (0004/0008/0018/0021).
- [x] Trovato un bug reale, anche se distinto dal crash: la policy RLS
      di `profili_orari` (`0024_profili_orari.sql`) era "solo admin" in
      lettura, scritta quando la tabella non era ancora usata da nessuna
      pagina (specs/54). Da `0025_report_ore_lavoro.sql` in poi, però,
      `lib/profiliOrari.ts:recuperaProfiloOrario` la interroga anche per
      il DIRETTO interessato (precaricamento ore ordinarie, specs/18):
      per chiunque non fosse admin la lettura falliva silenziosamente
      (RLS filtra, nessun errore) e le ore ordinarie precaricate erano
      sempre 0. Non intercettato dall'unico test e2e esistente perché
      gira con l'account admin, a cui la vecchia policy permetteva
      comunque la lettura. Fix:
      `supabase/migrations/0030_profili_orari_self_select.sql` (nuova
      policy select "il proprio profilo assegnato"), specs/54
      aggiornata, nuovo scenario in `e2e/18-report-ore-lavoro.spec.ts`
      che verifica il precaricamento con l'account maestra.
- [x] Il crash vero (diagnosticato leggendo i Function Logs di Vercel,
      non indovinabile da un `try/catch` nella pagina — vedi sotto) NON
      era un problema di grant/RLS né di dati mancanti, ma un limite del
      bundler React Server Components: `components/RigaOreLavoro.tsx`
      (`'use client'`) esportava sia il componente sia una costante dati
      pura, `ETICHETTE_STATO_ORE_LAVORO` (le etichette italiane dello
      stato), e `app/dashboard/ore-lavoro/page.tsx` (Server Component)
      la importava e usava direttamente nel ramo di sola lettura di una
      settimana confermata. Un valore non-componente importato da un
      modulo client e usato in un Server Component non è risolvibile dal
      Client Reference Manifest in build di produzione ("Could not find
      the module .../RigaOreLavoro.tsx#ETICHETTE_STATO_ORE_LAVORO#lavorativo
      in the React Client Manifest") — funzionava in sviluppo, motivo per
      cui non si era mai visto prima. Per questo scattava solo entrando
      nel ramo "settimana confermata" (dopo il primo click su "Conferma",
      la cui insert nel frattempo era comunque andata a buon fine) e
      restava identico ad ogni tentativo di `try/catch` nella pagina: è
      un errore di serializzazione dell'albero React che avviene DOPO che
      la funzione della pagina è già tornata, non un'eccezione nel suo
      corpo. Fix: spostata la costante (e il tipo `StatoGiornoOreLavoro`,
      già duplicato) in `lib/oreLavoro.ts` (nessun `'use client'`),
      importata da entrambi i file.
- [x] Trovata anche una seconda causa (distinta, RLS reale) durante
      l'audit prima di arrivare al log Vercel: la policy select di
      `profili_orari` (`0024_profili_orari.sql`) era "solo admin",
      scritta quando la tabella non era ancora usata da nessuna pagina
      (specs/54). Da `0025_report_ore_lavoro.sql` in poi,
      `lib/profiliOrari.ts:recuperaProfiloOrario` la interroga anche per
      il DIRETTO interessato (precaricamento ore ordinarie, specs/18):
      per chiunque non fosse admin la lettura falliva silenziosamente
      (RLS filtra, nessun errore) e le ore ordinarie precaricate erano
      sempre 0. Non intercettato dall'unico test e2e esistente perché
      gira con l'account admin. Fix:
      `supabase/migrations/0030_profili_orari_self_select.sql` (nuova
      policy select "il proprio profilo assegnato"), specs/54
      aggiornata, nuovo scenario in `e2e/18-report-ore-lavoro.spec.ts`
      che verifica il precaricamento con l'account maestra.
- [x] Verificato l'intero elenco `grant`/policy di `supabase/migrations/`
      contro ogni tabella e ogni chiamata `.from(...)` nel codice: nessun'
      altra tabella risulta priva del grant necessario al ruolo che la
      usa (`authenticated`/`service_role`).
- [x] Rimosso il debug temporaneo aggiunto durante la diagnosi (log,
      pannello d'errore in pagina, `try/catch` allargato) da
      `app/dashboard/ore-lavoro/page.tsx` una volta trovata la causa
      reale; resta permanente solo il fix (`confermata` da
      `settimana?.confermata_at`, log dell'errore se le query falliscono)
      e la visualizzazione di `error.digest` in
      `components/ErroreAzione.tsx` (utile per ogni futuro crash simile).
- [ ] **Da fare da parte tua**: applica
      `supabase/migrations/0030_profili_orari_self_select.sql` nel SQL
      Editor di Supabase (test e produzione) — senza, il precaricamento
      delle ore ordinarie resta a 0 per chiunque non sia admin.

## Feature: Monte ore + riepilogo ore/PDF mensile nella mail giornaliera
- [x] Nuovo requisito `specs/19 - monte-ore.md`: contatore di ore per
      persona, aggiornato automaticamente alla conferma di ogni
      settimana (esubero di straordinario lo scala, carenza rispetto al
      profilo orario lo aumenta — attenzione alla direzione, confermata
      esplicitamente con l'utente: NON è una banca ore classica),
      precaricabile/correggibile manualmente dall'admin con nota
      obbligatoria. `specs/18`, `specs/54`, `specs/52` e l'indice
      `specs/00` aggiornati di conseguenza.
- [x] `supabase/migrations/0031_monte_ore.sql`: tabella
      `monte_ore_movimenti` (ledger insert-only, saldo = somma di
      `variazione`), RLS che permette al proprietario di inserire solo
      un movimento `settimanale` legato a una conferma reale della
      stessa settimana (mai un `precarico`, mai per conto di altri).
- [x] `lib/monteOre.ts` (funzioni pure, unit test in
      `lib/monteOre.test.ts`): calcolo esubero/carenza settimanale e
      saldo aggregato.
- [x] `confermaSettimanaOreLavoro` registra il movimento `settimanale`
      subito dopo la conferma; nuova azione admin
      `aggiungiMovimentoMonteOre` per il precarico manuale.
- [x] UI: saldo monte ore in sola lettura per il diretto interessato e
      colonna monte ore nell'elenco admin (`/admin/ore-lavoro`); form +
      storico movimenti nella vista admin di un dipendente.
- [x] `lib/reportOreLavoro.ts` + `lib/pdfOreLavoro.ts` (riusa i
      primitivi di disegno di `lib/pdfReport.ts`): riepilogo ore nel
      corpo della mail giornaliera e PDF mensile (una pagina per
      persona, solo settimane confermate) allegato insieme al report
      mensile di presenze/pasti — stessa idempotenza, nessuna tabella
      nuova.
- [x] **Da fare da parte tua**: applica
      `supabase/migrations/0031_monte_ore.sql` nel SQL Editor di
      Supabase (test e produzione) — senza, conferma settimana e
      precarico monte ore falliscono. Applicata (confermato
      dall'utente il 2026-09-06); se il progetto di produzione è
      distinto da quello di test, verificare che sia applicata anche lì.

## Feature: profilo orario come riferimento statico + straordinario residuo (v0.22.0)
- [x] Richiesta dell'utente: il profilo orario deve restare una guida
      visibile in modo statico (mai dentro un campo di input), con un
      pulsante "Copia" per riportarne il valore nel campo "Ore
      ordinarie" con un tap; la scheda della settimana deve mostrare
      chiaramente ore dovute/ordinarie erogate/straordinarie erogate; e
      alla conferma di una settimana, un'eventuale carenza va coperta
      prima dallo straordinario della stessa settimana (solo il resto
      aumenta il monte ore) — lo straordinario che avanza dopo questa
      copertura ("straordinario residuo") non scala più il monte ore in
      automatico, ma resta in attesa che l'admin scelga se metterlo a
      pagamento mensile o scalarlo dal monte ore.
- [x] `specs/18 - report-ore-lavoro.md`: nuovi scenari "il profilo
      orario resta sempre visibile come riferimento statico", "copiare
      le ore previste dal profilo orario con un tap" e "la scheda della
      settimana mostra ore dovute, ordinarie e straordinarie erogate".
- [x] `specs/19 - monte-ore.md`: riscritto lo scenario del calcolo
      automatico (carenza coperta prima dallo straordinario della
      stessa settimana, solo la carenza residua aumenta il monte ore) e
      aggiunti gli scenari sulla decisione dell'admin sullo
      straordinario residuo (pagamento mensile / scalo dal monte ore),
      col caso "nessuna decisione richiesta" quando è zero. `specs/00`
      e `specs/52` aggiornate di conseguenza (quest'ultima: la
      variazione mensile di monte ore ora somma anche i movimenti
      `straordinario_residuo`, non solo `settimanale`).
- [x] `supabase/migrations/0032_straordinario_residuo.sql`: nuove
      colonne di snapshot su `ore_lavoro_settimane` (ore dovute/
      ordinarie/straordinarie erogate, straordinario residuo, decisione
      e chi/quando l'ha presa) con la sua prima policy di update (solo
      admin); nuovo tipo di movimento `straordinario_residuo` su
      `monte_ore_movimenti` (sempre <= 0, al più uno per settimana per
      persona) e vincolo che un movimento `settimanale` sia sempre >= 0
      (non più una compensazione automatica dell'esubero).
- [x] `lib/monteOre.ts`: `calcolaEsuberoCarenza`/`variazioneMonteOre`
      sostituite da `controlloSettimanaOreLavoro` (ore dovute/erogate,
      carenza residua, straordinario residuo — funzione pura, unit test
      aggiornati in `lib/monteOre.test.ts` con tutti i casi limite:
      carenza coperta parzialmente/interamente, senza profilo,
      weekend, malattia/assenza esclusi).
- [x] `app/dashboard/ore-lavoro/actions.ts`: `confermaSettimanaOreLavoro`
      registra ora lo snapshot del controllo e un movimento automatico
      pari alla sola carenza residua; nuova azione admin
      `decidiStraordinarioResiduo` (pagamento mensile, senza toccare il
      monte ore; oppure scalo, con un secondo movimento negativo).
- [x] UI: `components/RigaOreLavoro.tsx` mostra il previsto dal profilo
      come testo statico accanto al campo "Ore ordinarie" con un
      pulsante "Copia" (client-side, nessun invio del form);
      `app/dashboard/ore-lavoro/page.tsx` mostra il riquadro ore
      dovute/ordinarie/straordinarie erogate (dal vivo se la settimana
      non è confermata, dallo snapshot se lo è) e, quando c'è
      straordinario residuo, il nuovo `components/StraordinarioResiduo.tsx`
      (avviso per il diretto interessato, pulsanti di decisione per
      l'admin).
- [x] `e2e/18-report-ore-lavoro.spec.ts` esteso con gli scenari del
      riferimento statico/pulsante "Copia" e del riquadro ore dovute/
      erogate. Gli scenari di `specs/19` sulla decisione dell'admin
      restano coperti solo da unit test (nota aggiornata in
      `e2e/19-monte-ore.spec.ts`): richiedono una settimana già
      confermata, cosa che questa suite non fa mai per davvero
      sull'account di test condiviso (stessa cautela già in vigore per
      "Conferma settimana").
- [x] `supabase/migrations/0032_straordinario_residuo.sql` applicata
      (confermato dall'utente il 2026-09-07); se il progetto di
      produzione è distinto da quello di test, verificare che sia
      applicata anche lì — senza, confermare una settimana fallisce (le
      nuove colonne non esistono) e la decisione dell'admin sullo
      straordinario residuo non è disponibile.

## Blocco comunicazione pasti se mancano presenze
- [x] `specs/16 - comunicazione-pasti-rojac.md`: nuovo requisito — la
      comunicazione pasti a Rojac è bloccata (pulsante "Conferma pasti"
      sostituito da un messaggio) finché anche un solo bambino attivo
      dell'asilo non ha ancora una presenza segnata per oggi (qualunque
      stato: presente/assente/malattia, non necessariamente "presente").
      Nuovo scenario "la comunicazione è bloccata se manca la presenza
      di qualche bambino" e nuova regola.
- [x] `lib/pastiRojac.ts`: nuova `contaBambiniSenzaPresenzaOggiTuttoAsilo(data)`
      (stesso pattern di `contaPastiSiOggiTuttoAsilo`: service_role key,
      nessun I/O testabile in unità).
- [x] `components/PaginaClassi.tsx`: quando ci sono bambini senza
      presenza, mostra il messaggio di blocco al posto di
      `ConfermaAzione`. `app/dashboard/pasti/actions.ts:comunicaPastiRojac`
      ripete lo stesso controllo lato server prima dell'insert (difesa
      in profondità, oltre al trigger DB).
- [x] `supabase/migrations/0033_pasti_comunicati_richiede_presenze.sql`
      (nuovo): trigger `pasti_comunicati_blocca_se_presenze_mancanti` —
      la difesa reale, non solo la UI.
- [x] `e2e/16-comunicazione-pasti-rojac.spec.ts`: nuovo test per il
      messaggio di blocco (si salta se oggi non ci sono presenze
      mancanti o i pasti sono già stati comunicati).
- [x] `supabase/migrations/0033_pasti_comunicati_richiede_presenze.sql`
      applicata (confermato dall'utente il 2026-09-07).

## Fix: cron notturno in errore su "Ore di lavoro" (permission denied per profili)
- [x] Diagnosi: log di produzione `Error: lettura personale abilitato al
      report ore: permission denied for table profili` — stesso bug già
      capitato più volte (0018/0025/0031): `service_role` bypassa la RLS
      ma non ha mai ricevuto il GRANT di tabella su `public.profili`,
      che `lib/reportOreLavoro.ts` (introdotto con il riepilogo ore nella
      mail, 2ee85bf) è il primo a leggere con quel ruolo.
- [x] `supabase/migrations/0034_grant_service_role_profili.sql` (nuovo):
      `grant select on public.profili to service_role`.
- [ ] Da applicare nel SQL Editor di Supabase (progetto di test E di
      produzione) — senza, il cron notturno continua a fallire sul
      riepilogo ore.

## Fix: impaginazione PDF ore di lavoro + ore dovute/delta per giorno
- [x] Segnalazione dell'utente (screenshot): il PDF mensile delle ore di
      lavoro spaginava — la data per esteso (`formattaDataItaliana`,
      es. "martedì 1 settembre 2026") sconfinava nella colonna
      "Giorno" accanto, sovrapponendo il testo e rendendolo illeggibile.
- [x] `lib/date.ts`: nuova `formattaDataCorta` — formato "cortissimo"
      con giorno della settimana abbreviato (es. "lun 23/9/26"), che
      sostituisce le due colonne separate Data + Giorno con una sola,
      abbastanza stretta da non spaginare.
- [x] `lib/oreLavoro.ts`: nuove funzioni pure `deltaGiornoOreLavoro`
      (ore ordinarie effettuate meno ore dovute più straordinario) e
      `formattaOreConSegno` (segno esplicito sui positivi, arrotondato a
      due decimali) — quest'ultima riusata anche per la variazione
      mensile di monte ore nel PDF, al posto della stessa logica del
      segno ripetuta inline.
- [x] `lib/pdfOreLavoro.ts`: tabella del PDF con le nuove colonne Data
      (corta), Stato, Ore dovute, Ore ord., Ore straord., Delta,
      Dettaglio — pesi di colonna ricalcolati per stare nella larghezza
      A4 anche con un dettaglio lungo.
- [x] `lib/reportOreLavoro.ts`: `personePdfOreLavoroMensile` calcola ore
      dovute (dal profilo orario del giorno, `oreOrdinariePreviste`) e
      delta per ciascun giorno prima di passarli al generatore PDF.
- [x] `specs/52 - report-email-automatico.md`: scenario "PDF mensile
      delle ore del personale in allegato" aggiornato con le nuove
      colonne e il formato data corto.
- [x] `lib/date.test.ts`, `lib/oreLavoro.test.ts`: nuovi unit test per
      `formattaDataCorta`, `deltaGiornoOreLavoro` e
      `formattaOreConSegno` (nessun I/O, criterio di CLAUDE.md). Nessuna
      modifica e2e: il contenuto del PDF non è ispezionabile da
      Playwright (vedi nota già in `e2e/52-report-email-automatico.spec.ts`),
      resta coperto solo indirettamente (la route fallirebbe se
      `lib/pdfOreLavoro.ts` sollevasse un errore) più dagli unit test.
- [x] Verificato manualmente generando un PDF di prova con dati simili
      allo screenshot segnalato: tabella allineata, nessuna
      sovrapposizione, anche con un dettaglio lungo su una riga.

## Comunicazione retta mensile — Fase 2 (specs/55, specs/56)
Requisito ridisegnato da capo (revert dei due commit precedenti,
parametri di retta "generici" + tabella per anno scolastico) su
richiesta esplicita, con lo scenario reale completo: ogni mese l'admin
controlla una tabella con gli importi calcolati per ciascun bambino e
invia con un click il promemoria via email ai genitori.
- [x] `specs/55 - costi-bambino.md`: sezione "Costi" sulla scheda
      bambino — prezzo retta mensile, prezzo buono pasto, abbonamento
      pre-asilo/post-asilo (flag + prezzo fisso mensile ciascuno),
      email di promemoria. Indice e nota "Fuori scope" aggiornati in
      `specs/00 - overview.md`.
- [x] `specs/56 - comunicazione-retta-mensile.md`: voce di menu
      "Rette" — tabella di revisione del mese corrente (retta, costo
      pasti proiettato sui giorni di apertura, conguaglio pasti sulle
      assenze del mese precedente, pre/post-asilo, costi extra inseriti
      al momento dall'admin con nota), invio con un click via Resend,
      log immutabile delle comunicazioni (una per bambino/mese, evita
      doppi invii), template configurabile con placeholder.
- [x] `supabase/migrations/0035_costi_bambini.sql`: tabella
      `costi_bambini`, RLS solo admin — **da applicare nel SQL Editor
      di Supabase** (dev/test e produzione).
- [x] `supabase/migrations/0036_comunicazione_retta.sql`: tabelle
      `comunicazioni_retta` (log insert-only) e
      `impostazioni_email_retta` (riga singola, seed con un modello di
      base) — **da applicare insieme alla 0035**.
- [x] `lib/costiBambino.ts` + test: `emailValida` (nessun I/O).
- [x] `lib/comunicazioneRetta.ts` + test: `giorniAperturaMese` (riusa
      `lib/calendarioScolastico.ts`/`lib/date.ts`, niente logica di
      calendario duplicata), `calcolaRiepilogoRetta` (motore di calcolo
      puro, coperto a fondo — conguaglio negativo, totale che può
      risultare negativo, pre/post-asilo non richiesto che non conta),
      `sostituisciPlaceholder`, `formattaImporto`. Tutte pure, nessun
      I/O (criterio di CLAUDE.md).
- [x] `lib/navigazione.ts` + test: nuova voce di menu "Rette".
- [x] `app/admin/actions.ts`: nuova `aggiornaCostiBambino`.
      `app/admin/bambini/[id]/page.tsx`: nuova sezione "Costi".
- [x] `app/admin/rette/page.tsx` + `actions.ts`: tabella di revisione,
      `inviaComunicazioniRetta` ricalcola tutto lato server (non si
      fida di valori arrivati dal client, tranne costi extra/nota) e
      determina da sé chi è idoneo — bambino attivo, costi+email
      configurati, non già comunicato questo mese.
- [x] `app/admin/rette/template/page.tsx` + `actions.ts`: editor
      oggetto/corpo del modello email, con i placeholder documentati in
      pagina.
- [x] `e2e/55-costi-bambino.spec.ts`, `e2e/56-comunicazione-retta-mensile.spec.ts`:
      un test per ciascun `## Scenario:` dei due requisiti, più
      accessibilità. Il file 56 usa `test.describe.configure({ mode:
      'serial' })` perché "Invia comunicazioni" agisce su tutti i
      bambini idonei del mese corrente, non solo su quello del singolo
      test — con l'esecuzione parallela di default rischierebbe di
      intercettare un bambino "in attesa" creato da un altro test
      ancora in corso (stesso pattern di
      `06-controllo-consistenza.spec.ts`). Non eseguibile in questo
      ambiente sandbox: il login admin fallisce già nel setup condiviso
      (non causato da questo cambiamento, vedi le note ricorrenti più
      sopra in questo file) — **da eseguire con
      `npx playwright test e2e/55-costi-bambino.spec.ts e2e/56-comunicazione-retta-mensile.spec.ts`
      in locale** (dopo aver applicato le migration 0035 e 0036, e con
      RESEND_API_KEY configurata per coprire anche l'invio reale) per
      la conferma finale.

## Marca da bollo: nuova voce di costo fissa (specs/55, specs/56)
Richiesta dell'utente: aggiungere ai costi di un bambino la marca da
bollo, di default 2€ (il valore amministrativo corrente).
- [x] `specs/55 - costi-bambino.md`: nuovo campo "prezzo marca da
      bollo" (voce di costo fissa come retta/buono pasto, non un
      servizio opzionale come pre/post-asilo), con un valore predefinito
      di 2€ invece di 0 — nuovo scenario dedicato a questo default.
- [x] `specs/56 - comunicazione-retta-mensile.md`: colonna "Marca da
      bollo" nella tabella di revisione, inclusa nel totale, nuovo
      placeholder `{{marca_da_bollo}}` per il template email.
- [x] `supabase/migrations/0037_marca_da_bollo.sql`: nuova colonna
      `costi_bambini.prezzo_marca_da_bollo` (default 2, backfilla anche
      i bambini con costi già salvati) e `comunicazioni_retta.marca_da_bollo`
      (default 0, solo per le righe storiche — i nuovi invii scrivono
      sempre il valore calcolato esplicitamente) — **da applicare nel
      SQL Editor di Supabase (dev/test e produzione), dopo la 0036**.
- [x] `lib/comunicazioneRetta.ts` + test: `calcolaRiepilogoRetta` e
      `RiepilogoRetta` includono `marcaDaBollo` nel totale.
- [x] `app/admin/actions.ts` (`aggiornaCostiBambino`) e
      `app/admin/bambini/[id]/page.tsx`: nuovo campo "Prezzo marca da
      bollo (€)" nella sezione "Costi", precompilato a 2 per un bambino
      senza costi ancora salvati.
- [x] `app/admin/rette/page.tsx` + `actions.ts`: nuova colonna "Marca da
      bollo" in tabella, inclusa nel totale calcolato e in quello
      registrato all'invio.
- [x] `app/admin/rette/template/page.tsx`: nuovo placeholder
      `{{marca_da_bollo}}` nell'elenco di quelli disponibili (un
      modello già salvato resta valido così com'è, il placeholder va
      aggiunto a mano se lo si vuole nel testo).
- [x] `e2e/55-costi-bambino.spec.ts`, `e2e/56-comunicazione-retta-mensile.spec.ts`:
      nuovi scenari (valore predefinito 2€, modifica e persistenza,
      colonna in tabella) e aggiornato l'importo totale atteso nel test
      di invio reale (200 retta + 10 extra + 2 marca da bollo = 212,00,
      non più 210,00). Verificato `npx tsc --noEmit`, `npx next lint`,
      `npx vitest run` e `npx jscpd` puliti. Suite e2e non eseguibile in
      questo ambiente sandbox (login admin che fallisce già nel setup
      condiviso, non causato da questo cambiamento) — da eseguire in
      locale/CI dopo aver applicato la migration 0037.

## Annullare l'invio di una comunicazione retta (specs/56)
Richiesta dell'utente: poter "sbiancare" il fatto che una comunicazione
retta sia stata inviata, per poterla reinviare (es. dopo un errore negli
importi comunicati).
- [x] `specs/56 - comunicazione-retta-mensile.md`: nuovo scenario
      "annullare l'invio di una comunicazione per poterla reinviare";
      spostato fuori da "Fuori scope" (restano fuori scope solo la
      modifica degli importi mantenendo la riga, e la tracciabilità di
      chi/quando ha annullato).
- [x] `supabase/migrations/0038_annulla_comunicazione_retta.sql`: nuova
      policy di delete su `comunicazioni_retta`, solo admin (finora
      nessuna policy di update/delete esisteva da interfaccia) —
      **da applicare nel SQL Editor di Supabase (dev/test e
      produzione), dopo la 0037**.
- [x] `app/admin/rette/actions.ts`: nuova `annullaComunicazioneRetta`
      (bambinoId, mese) — elimina la riga del log, libera il vincolo
      unique, nessuna nuova email. Non è wired tramite `useFormState`
      (niente `EsitoAzione`): la tabella di `/admin/rette` è già dentro
      un `<FormConEsito action={inviaComunicazioniRetta}>`, quindi non
      può contenere un secondo `<form>` annidato (HTML non valido) — il
      pulsante "Annulla invio" la richiama con un `formAction` proprio
      (bind di bambinoId/mese) sullo stesso form, stesso pattern già
      usato in `app/dashboard/presenze/[sezioneId]/page.tsx` per più
      azioni in un solo form.
- [x] `app/admin/rette/page.tsx`: pulsante "Annulla invio" (rosso)
      accanto a "Inviata il..." per ogni riga già comunicata.
- [x] `e2e/56-comunicazione-retta-mensile.spec.ts`: nuovo scenario
      (annulla, verifica che la riga torni "da inviare", reinvia
      davvero) — stesso gate `RESEND_API_KEY` dei test di invio già
      esistenti. Verificato `npx tsc --noEmit`, `npx next lint`,
      `npx vitest run` e `npx jscpd` puliti. Suite e2e non eseguibile in
      questo ambiente sandbox (stesso problema di login ricorrente,
      indipendente da questo cambiamento) — da eseguire in locale/CI
      dopo aver applicato la migration 0038.

## Navigazione tra mesi in "Rette" per rivedere le comunicazioni passate (specs/56)
Richiesta dell'utente: poter rivedere le comunicazioni inviate un mese
precedente, con una semplice navigazione a frecce (come già in "Ore di
lavoro", specs/18).
- [x] `specs/56 - comunicazione-retta-mensile.md`: nuovi scenari
      (navigare a un mese passato, non oltre il mese corrente, tornare
      al mese corrente, un mese passato senza comunicazioni); "Fuori
      scope" riformulato — la *revisione* di un mese passato è in
      scope, inviare/annullare resta possibile solo per il mese
      corrente.
- [x] `lib/comunicazioneRetta.ts` + test: `meseRettaRichiesto` (stesso
      pattern di `lib/oreLavoro.ts:settimanaOreLavoroRichiesta` —
      risolve/clampa `?mese=`, mai un mese futuro).
- [x] `app/admin/rette/page.tsx`: riscritta con due viste. Mese
      corrente: tabella interattiva invariata (nessuna migration
      necessaria). Mese passato: sola lettura, solo i bambini con una
      comunicazione registrata quel mese (non filtrati per `attiva`:
      un bambino comunicato e poi disattivato resta visibile nella
      revisione storica), niente form/pulsanti di invio o
      annullamento. Frecce "←"/"→" (la "→" sparisce sul mese corrente).
      Estratto `RigaComunicazione` (componente locale) per non
      duplicare le celle tra le due viste che mostrano un bambino già
      comunicato (CLAUDE.md, jscpd).
- [x] `e2e/56-comunicazione-retta-mensile.spec.ts`: nuovi scenari
      (niente freccia "→" sul mese corrente, navigazione a un mese
      passato + verifica sola lettura + a11y, ritorno al mese corrente,
      mese lontano nel passato senza comunicazioni). Verificato
      `npx tsc --noEmit`, `npx next lint`, `npx vitest run` e
      `npx jscpd` puliti. Suite e2e non eseguibile in questo ambiente
      sandbox (stesso problema di login ricorrente, indipendente da
      questo cambiamento) — da eseguire in locale/CI.

## Valori predefiniti di buono pasto e pre/post-asilo (specs/55)
Richiesta dell'utente: buono pasto 6€, pre/post-asilo 70€ ciascuno.
- [x] `specs/55 - costi-bambino.md`: nuovi default nello scenario di
      creazione, scenario "hanno un valore predefinito" esteso a
      includere buono pasto e pre/post-asilo (non più solo marca da
      bollo). Nuova regola che spiega la scelta di **non** fare
      backfill delle righe già esistenti (a differenza della marca da
      bollo, campo nuovo): buono pasto/pre-asilo/post-asilo sono già in
      uso con importi reali scelti dall'admin, un backfill di massa
      rischierebbe di alterare dati economici reali senza che nessuno
      l'abbia chiesto — il nuovo default si vede solo per un bambino
      senza ancora nessun costo salvato.
- [x] `supabase/migrations/0039_default_buono_pasto_pre_post_asilo.sql`:
      solo `ALTER COLUMN ... SET DEFAULT` (nessun backfill, a differenza
      della 0037) — **da applicare nel SQL Editor di Supabase (dev/test
      e produzione), dopo la 0038**. Di fatto inerte per l'app stessa
      (che scrive sempre un valore esplicito nell'upsert), utile solo
      per coerenza dello schema.
- [x] `app/admin/bambini/[id]/page.tsx`: `defaultValue` dei tre campi
      aggiornato (`?? 6`, `?? 70`, `?? 70`) solo per il ramo "nessuna
      riga costi ancora salvata" (`costi` nullo) — un bambino con costi
      già salvati, anche a 0, non cambia.
- [x] `e2e/55-costi-bambino.spec.ts`: aggiornato l'assert del valore
      predefinito del buono pasto (era '0', ora '6') ed esteso lo
      scenario dei default a coprire anche pre/post-asilo. Verificato
      `npx tsc --noEmit`, `npx next lint`, `npx vitest run` e
      `npx jscpd` puliti. Suite e2e non eseguibile in questo ambiente
      sandbox (stesso problema di login ricorrente, indipendente da
      questo cambiamento) — da eseguire in locale/CI dopo aver
      applicato la migration 0039.

## Rette: voci di costo modificabili, colonna Email, conferme d'invio (specs/56)
Richiesta dell'utente, in più passi sulla stessa tabella "Rette":
correggere ad-hoc una voce di costo prima di inviare (non solo i costi
extra), vedere l'email di destinazione, confermare l'invio massivo con
un popup, inviare a un solo bambino con anteprima della mail.
- [x] `specs/56 - comunicazione-retta-mensile.md`: nuovi scenari
      (colonna Email, modificare una voce di costo prima dell'invio,
      conferma dell'invio massivo, invio singolo con anteprima) e nuove
      Regole per ciascuno.
- [x] `lib/comunicazioneRetta.ts`: `RiepilogoRetta` resta l'unica forma
      condivisa, nessuna funzione nuova qui (la lettura dei campi vive
      nell'action, non essendo usata altrove).
- [x] `app/admin/rette/actions.ts`: **cambio di fondo** —
      `inviaComunicazioniRetta` non ricalcola più gli importi da
      `costi_bambini`/presenze (rimossa la dipendenza da
      `calcolaRiepilogoRetta`/`giorniAperturaMese`/`chiusurePerPeriodo`
      in questa action, restano solo in `page.tsx` per precompilare la
      pagina): legge ogni voce direttamente dal form
      (`riepilogoDalForm`, nuova), con `importoEuro` (non negativo,
      come sempre) per tutte tranne `importoConSegno` (nuova) per il
      conguaglio pasti, l'unica per natura negativa. Estratti
      `placeholderRetta` e `inviaEPersistiComunicazione` (nuove,
      condivise) per non duplicare la costruzione dei placeholder e la
      sequenza "invia, poi registra solo se l'invio è riuscito" tra
      invio massivo e nuova `inviaComunicazioneRettaSingola` (invio a
      un solo bambino, formAction diretto con bind di bambinoId, stesso
      motivo di `annullaComunicazioneRetta` — niente `<form>` annidati
      nella tabella).
- [x] `app/admin/rette/page.tsx`: nuova colonna "Email" (per un bambino
      da comunicare, `costi_bambini.email_promemoria`; per uno già
      comunicato, `comunicazione.email_destinatario` — l'indirizzo
      storicamente usato, non quello attuale se nel frattempo cambiato).
      Retta/Costo pasti/Conguaglio pasti/Marca da bollo/Pre-asilo/
      Post-asilo non sono più testo statico ma campi `<input>`
      precompilati col valore calcolato, sovrascrivibili — stesso
      pattern già in uso per Costi extra. Il totale mostrato in tabella
      resta una stima non live (invariato, era già così per i costi
      extra). Nuovo import di `impostazioni_email_retta` (template),
      prima letto solo dall'action, ora serve anche per l'anteprima
      dell'invio singolo.
- [x] `components/PulsanteInvio.tsx`: nuova prop `confermaMessaggio`
      (popup nativo `window.confirm` prima del submit, annullabile) —
      usata sul pulsante "Invia comunicazioni" (invio massivo). Non
      `ConfermaAzione` (che crea un proprio `<form>`, non componibile
      qui: il pulsante sta già dentro il form che raccoglie tutti i
      campi della tabella).
- [x] `components/InvioSingoloRetta.tsx` (nuovo, client): pulsante
      "Invia comunicazione" per riga con popup di anteprima (a,
      oggetto, corpo) calcolata lato client leggendo i campi della riga
      dal DOM (stesso genere di lettura diretta già usato dal pulsante
      "Copia" di `RigaOreLavoro.tsx`) con le stesse funzioni pure di
      `lib/comunicazioneRetta.ts` usate anche lato server — "Conferma
      invio" sottopone lo stesso form della tabella con un formAction
      diretto (bind del bambinoId), coerente con quanto mostrato in
      anteprima perché legge dagli stessi campi.
- [x] `e2e/56-comunicazione-retta-mensile.spec.ts`: nuovi scenari
      (colonna Email, valore modificato usato per l'invio, popup di
      conferma dell'invio massivo — confermato e annullato, anteprima
      dell'invio singolo — aperta/annullata/confermata, isolamento
      dell'invio singolo dagli altri bambini). Riscritte le due
      asserzioni che leggevano Costo pasti/Conguaglio pasti come testo
      statico (ora sono `<input>`: confronto su `value`, non più su
      `text`, e senza la formattazione italiana con la virgola che vale
      solo per il testo). Aggiunto `page.once('dialog', ...)` prima di
      ogni click su "Invia comunicazioni" (altrimenti Playwright
      annulla da solo il popup nativo di conferma, di default).
      Verificato `npx tsc --noEmit`, `npx next lint`, `npx vitest run`
      e `npx jscpd` puliti. Suite e2e non eseguibile in questo ambiente
      sandbox (stesso problema di login ricorrente, indipendente da
      questo cambiamento) — da eseguire in locale/CI.

## Rette: retta e marca da bollo tornano non modificabili, tabella più compatta
Richiesta dell'utente dopo aver visto la tabella con tutte le voci
modificabili: retta e marca da bollo NON devono essere editabili (la
retta si cambia sulla scheda del bambino, la marca da bollo è fissa per
legge) — restano modificabili solo costo pasti, conguaglio pasti,
pre-asilo, post-asilo (oltre ai già modificabili costi extra/nota).
Chiesta anche una tabella più compatta, uso solo da desktop.
- [x] `specs/56 - comunicazione-retta-mensile.md`: nuovo scenario
      "retta e marca da bollo non sono modificabili dalla tabella";
      corretti gli scenari/regole precedenti che le includevano tra le
      voci modificabili.
- [x] `app/admin/rette/actions.ts`: `riepilogoDalForm` non legge più
      retta/marca da bollo dal form — le riceve come parametri fissi
      (letti da `costi_bambini.prezzo_mensile`/`prezzo_marca_da_bollo`
      da chi chiama, sia l'invio massivo sia quello singolo). Le altre
      quattro voci restano lette dal form come prima.
- [x] `app/admin/rette/page.tsx`: colonne "Retta" e "Marca da bollo"
      tornate testo (`formattaImporto`), non più `<input>`. Ridotto
      padding delle celle (`px-3 py-2` → `px-2 py-1.5`) e larghezza dei
      campi (`w-20`/`w-24`/`w-40` → `w-14`/`w-16`/`w-32`, con padding
      interno ridotto) per una tabella più compatta su schermi grandi —
      nessuna modifica pensata per mobile, come richiesto.
- [x] `components/InvioSingoloRetta.tsx`: l'anteprima dell'invio
      singolo riceve retta/marca da bollo come prop fisse (non più
      lette dal DOM, non essendo più campi) — le altre voci restano
      lette dai campi della riga come prima.
- [x] `e2e/56-comunicazione-retta-mensile.spec.ts`: il test di
      correzione ad-hoc ora modifica "Pre-asilo" invece di "Retta" (non
      più modificabile); nuovo scenario che verifica esplicitamente
      l'assenza dei campi "Retta"/"Marca da bollo" (restano visibili
      come testo). Verificato `npx tsc --noEmit`, `npx next lint`,
      `npx vitest run` e `npx jscpd` puliti. Suite e2e non eseguibile
      in questo ambiente sandbox (stesso problema di login ricorrente,
      indipendente da questo cambiamento) — da eseguire in locale/CI.

## Rette: tabelle raggruppate per sezione, larghezza pagina aumentata
Richiesta dell'utente: solo look&feel, nessun cambio a calcolo costi o
invio email. Raggruppare la tabella di "Rette" per classe (nome classe
come titolo), e allargare la pagina su schermi larghi (uso solo
desktop) dove restava tanto spazio inutilizzato ai lati.
- [x] `specs/56 - comunicazione-retta-mensile.md`: nuovo scenario "i
      bambini sono raggruppati per sezione" (una tabella per sezione,
      "Senza sezione" a parte, niente tabelle vuote) e nuove Regole —
      puro raggruppamento visivo, non cambia chi è ammesso all'invio né
      come vengono calcolati/registrati gli importi; per un mese
      passato il raggruppamento usa la sezione ATTUALE del bambino, non
      quella al momento dell'invio (mai registrata). Nuova regola sulla
      larghezza pagina (`max-w-[1800px]` invece di `max-w-6xl`).
- [x] `app/admin/rette/page.tsx`: nuova `raggruppaPerSezione` (pura,
      generica) e nuovo componente locale `TabellaSezione` (titolo +
      tabella, intestazione colonne condivisa via `INTESTAZIONE_COLONNE`
      per non duplicarla tra i gruppi). Sia la vista del mese corrente
      sia quella di revisione di un mese passato ora rendono un gruppo
      di tabelle invece di una sola; il messaggio "Nessun bambino
      attivo"/"Nessuna comunicazione..." resta ma solo quando non c'è
      nessun gruppo (non più una riga con colSpan dentro una tabella
      vuota). Aggiunto `sezione_id` alle query `bambini` di entrambe le
      viste (mancava). Nessuna modifica al calcolo dei costi né alle
      server action di invio/annullamento (`actions.ts` invariato).
- [x] `e2e/56-comunicazione-retta-mensile.spec.ts`: i controlli sulle
      intestazioni colonna ora usano `.first()` (più tabelle ripetono le
      stesse colonne); due nuovi scenari (bambino senza sezione nella
      tabella "Senza sezione", bambino con sezione sotto il titolo della
      sua sezione — quest'ultimo si salta da sé se il progetto di test
      non ha ancora nessuna sezione). Verificato `npx tsc --noEmit`,
      `npx next lint`, `npx vitest run` e `npx jscpd` puliti, oltre a un
      avvio del dev server per confermare che `/admin/rette` compila
      senza errori runtime (redirect atteso a `/login` da anonimo,
      niente crash). Suite e2e non eseguibile in questo ambiente
      sandbox (stesso problema di login ricorrente, indipendente da
      questo cambiamento) — da eseguire in locale/CI.

## Reset presenze e pasti di una giornata (specs/57, nuovo)
Richiesta dell'utente: ad agosto 2026 delle prove fatte in produzione
hanno "sporcato" presenze/pasti; serve uno strumento admin per
resettare una giornata (anche passata), con doppia conferma e
disclaimer sulle comunicazioni già inviate che potrebbero non
corrispondere più ai dati.
- [x] Nuovo `specs/57 - reset-giornata.md` (aggiunto all'indice in
      `specs/00 - overview.md`): elimina tutte le presenze e i pasti di
      una data, tutte le classi insieme (non per singola sezione/
      bambino — strumento semplice per il caso d'uso reale). Non tocca
      `pasti_comunicati`/`comunicazioni_retta` (log immutabili): è
      proprio il motivo del disclaimer.
- [x] `supabase/migrations/0040_reset_giornata.sql`: nuove policy di
      delete su `presenze`/`pasti`, solo admin — **prima non esisteva
      nessuna policy di delete su queste due tabelle** (il grant da
      solo, 0004_fix_grant_tabelle.sql, non bastava). **Da applicare
      nel SQL Editor di Supabase (dev/test e produzione), dopo la
      0039.**
- [x] `app/admin/reset-giornata/page.tsx` + `actions.ts` (nuovi):
      riusa `components/SelettoreData.tsx` (stesso ←/→/calendario di
      Presenze/Pasti) per scegliere la data, mostra quante presenze/
      pasti ci sono e un avviso se quella data è già stata comunicata a
      Rojac (`pasti_comunicati`). Riusa `components/ConfermaAzione.tsx`
      (tono "distruttivo") per la doppia conferma col disclaimer;
      pulsante disabilitato se non c'è nulla da resettare.
- [x] `lib/navigazione.ts` + test: nuova voce "Reset giornata" nel menu
      admin, ultima della lista.
- [x] `e2e/57-reset-giornata.spec.ts`: scenari (pagina raggiungibile +
      a11y, data vuota con pulsante disabilitato, registrare
      presenza/pasto su una data fissa lontana e resettarli — annulla
      non elimina, conferma sì —, accesso negato ai non-admin).
      Verificato `npx tsc --noEmit`, `npx next lint`, `npx vitest run`
      e `npx jscpd` puliti, oltre a un avvio del dev server per
      confermare che `/admin/reset-giornata` compila senza errori
      runtime. Suite e2e non eseguibile in questo ambiente sandbox
      (stesso problema di login ricorrente, indipendente da questo
      cambiamento) — da eseguire in locale/CI dopo aver applicato la
      migration 0040.

## Rette: email sotto il nome del bambino, marca da bollo dopo retta
Richiesta dell'utente, solo look&feel: risparmiare una colonna
mostrando l'email tra parentesi sotto nome/cognome (carattere più
piccolo) invece che in una colonna a parte; spostare "Marca da bollo"
subito dopo "Retta" (erano entrambe non modificabili, ora vicine).
- [x] `specs/56 - comunicazione-retta-mensile.md`: scenari e regole
      aggiornati (niente più colonna "Email", email sotto il nome;
      nuovo ordine colonne con marca da bollo dopo retta).
- [x] `app/admin/rette/page.tsx`: rimossa la colonna "Email"
      dall'intestazione e da entrambe le righe (`RigaComunicazione` e
      quella "da inviare"); email aggiunta come riga secondaria sotto
      nome/cognome nella cella `<th>` (`text-xs text-stone-500`, tra
      parentesi). Riordinate le celle Retta/Marca da bollo. Aggiornato
      il colSpan della riga "Costi o email non configurati" (10 → 9,
      una colonna in meno).
- [x] `e2e/56-comunicazione-retta-mensile.spec.ts`: rimosso il controllo
      sull'intestazione colonna "Email" (non esiste più); il test
      sull'email rinominato e aggiornato per verificarla nella cella
      Bambino, tra parentesi. Verificato `npx tsc --noEmit`,
      `npx next lint`, `npx vitest run` e `npx jscpd` puliti, oltre a
      un avvio del dev server per confermare che `/admin/rette` compila
      senza errori runtime. Suite e2e non eseguibile in questo ambiente
      sandbox (stesso problema di login ricorrente, indipendente da
      questo cambiamento) — da eseguire in locale/CI.

## Rette: placeholder {{note_costi_extra}} nella mail
Bug segnalato dall'utente: la nota scritta accanto a un costo extra
(specs/56, "inserire un costo extra del mese e vederlo nel totale")
era visibile solo in tabella, non recuperabile nel testo della mail —
mancava il placeholder corrispondente.
- [x] `specs/56 - comunicazione-retta-mensile.md`: nuovo scenario "la
      nota del costo extra è disponibile nella mail" e
      `{{note_costi_extra}}` aggiunto all'elenco placeholder disponibili
      (stringa vuota se la nota non è compilata, stesso pattern già
      usato per `{{marca_da_bollo}}` sui modelli preesistenti).
- [x] `app/admin/rette/actions.ts`: `placeholderRetta` accetta ora
      `noteExtra` e lo espone come `note_costi_extra`.
- [x] `components/InvioSingoloRetta.tsx`: l'anteprima lato client legge
      anche il campo nota della riga e lo espone come
      `note_costi_extra`, coerente con quanto verrà davvero inviato.
- [x] `app/admin/rette/template/page.tsx`: `{{note_costi_extra}}`
      aggiunto all'elenco dei placeholder mostrato in "Modello email".
- [x] `e2e/56-comunicazione-retta-mensile.spec.ts`: nuovo test che
      configura un template con `{{note_costi_extra}}`, verifica che
      l'anteprima lo sostituisca con la nota scritta, e che resti una
      stringa vuota (non "undefined"/"null") quando la nota è assente.
      Verificato `npx tsc --noEmit`, `npx next lint`, `npx vitest run`
      e `npx jscpd` puliti. Suite e2e non eseguibile in questo ambiente
      sandbox (stesso problema di login ricorrente, indipendente da
      questo cambiamento) — da eseguire in locale/CI prima del merge.

## Rette: CC all'asilo su ogni comunicazione
Richiesta dell'utente: ogni mail di comunicazione retta va spedita in
copia conoscenza a `info@asilosartorio.it`, lo stesso indirizzo già
usato dal cron del report notturno (specs/52) e dagli allarmi
(specs/07), così l'asilo ha sempre traccia di cosa è stato comunicato.
- [x] `specs/56 - comunicazione-retta-mensile.md`: nuova regola sulla
      CC fissa (`destinatarioNotifiche()`, non configurabile dall'admin
      in pagina).
- [x] `lib/email.ts`: `inviaEmail` accetta un `cc` opzionale, passato a
      Resend solo se presente (nessuna modifica per i chiamanti
      esistenti che non lo passano — report notturno, allarmi,
      comunicazione pasti Rojac).
- [x] `app/admin/rette/actions.ts`: `inviaEPersistiComunicazione` passa
      `cc: destinatarioNotifiche()` a ogni invio (massivo e singolo,
      stessa funzione condivisa).
      Verificato `npx tsc --noEmit`, `npx next lint`, `npx vitest run`
      e `npx jscpd` puliti. Nessun test e2e aggiunto per la CC in sé:
      la suite non ispeziona il contenuto reale delle email inviate
      (stesso limite già presente per oggetto/corpo), solo DB e UI.

## Rette: più indirizzi email di promemoria per bambino
Richiesta dell'utente: il campo "Email promemoria retta" può contenere
più indirizzi separati da `;`, e la comunicazione retta (specs/56) va
inviata a tutti.
- [x] `specs/55 - costi-bambino.md`: due nuovi scenari ("più indirizzi
      email... separati da ;" e "uno solo dei più indirizzi non è
      valido") e regola sul salvataggio as-is/invio a tutti gli
      indirizzi.
- [x] `lib/costiBambino.ts`: nuove `emailsDaCampo` (separa e ripulisce)
      ed `emailListaValida` (ogni indirizzo valido, almeno uno),
      `emailValida` riusata internamente.
- [x] `lib/costiBambino.test.ts`: nuova copertura per `emailsDaCampo`/
      `emailListaValida` (separatore con/senza spazi, `;` finale, campo
      vuoto, un solo indirizzo non valido su più) accanto a quella già
      esistente di `emailValida`.
- [x] `app/admin/actions.ts` (`aggiornaCostiBambino`): valida con
      `emailListaValida` invece di `emailValida`, messaggio d'errore
      aggiornato.
- [x] `app/admin/bambini/[id]/page.tsx`: rimosso `type="email"` dal
      campo (la validazione nativa del browser non ammette `;` come
      separatore) e placeholder aggiornato.
- [x] `lib/email.ts` (`inviaEmail`): `a` accetta ora anche un array di
      destinatari.
- [x] `app/admin/rette/actions.ts`: l'invio (massivo e singolo) separa
      il campo con `emailsDaCampo` prima di chiamare `inviaEmail`;
      `email_destinatario` continua a salvare la stringa originale
      as-is.
- [x] `e2e/55-costi-bambino.spec.ts`: due nuovi test (più indirizzi
      salvati e ripresentati dopo reload; uno non valido rifiuta tutto
      il salvataggio). Verificato `npx tsc --noEmit`, `npx next lint`,
      `npx vitest run`, `npx jscpd` e `npm run build` puliti. Suite e2e
      non eseguibile in questo ambiente sandbox (stesso problema di
      credenziali ricorrente) — da eseguire in locale/CI.

## Crediti/debiti di un bambino e verifica del bonifico retta
Richiesta dell'utente (backlog Fase 2, "Registrare i bonifici ricevuti"
e "Stato di pagamento/saldo per bambino"): un bambino può avere un
credito/debito verso l'asilo non derivante dal calcolo automatico della
retta, inserito dalla scheda con una nota obbligatoria e un mese di
competenza — applicato automaticamente alla comunicazione di quel mese.
Sopra a questo, la verifica rapida del bonifico ricevuto per ogni
comunicazione inviata: se l'importo non corrisponde, la differenza
diventa automaticamente un nuovo credito/debito.
- [x] `specs/58 - crediti-debiti-bambino.md` (nuovo) e
      `specs/59 - verifica-bonifico-retta.md` (nuovo), indice
      aggiornato in `specs/00 - overview.md`; `specs/56` aggiornato
      (colonne "Credito/Debito"/"Nota cred./deb.", nuova regola
      sull'"Annulla invio" che libera il credito/debito applicato e che
      resta possibile solo a bonifico ancora "da verificare", nuovi
      placeholder `{{credito_debito}}`/`{{nota_credito_debito}}`).
- [x] `supabase/migrations/0041_crediti_debiti_bambini.sql`: nuova
      tabella, RLS solo admin, indice unico parziale "un solo
      credito/debito da conteggiare per bambino e mese"
      (`crediti_debiti_bambini_pendenti_uniq`, `where applicato_il is
      null`).
- [x] `supabase/migrations/0042_credito_debito_comunicazione_retta.sql`:
      `comunicazioni_retta.credito_debito`/`.nota_credito_debito`.
- [x] `supabase/migrations/0043_bonifico_comunicazione_retta.sql`:
      `comunicazioni_retta.bonifico_stato`/`.bonifico_importo_ricevuto`/
      `.bonifico_nota`/`.bonifico_verificato_da(_nome/_il)`.
- [x] `lib/comunicazioneRetta.ts`: `calcolaRiepilogoRetta` include
      `creditoDebito` nel totale; nuova `calcolaDifferenzaBonifico`
      (differenza atteso/ricevuto, stessa convenzione di segno).
      Copertura in `lib/comunicazioneRetta.test.ts`.
- [x] `app/admin/actions.ts`: nuove `aggiungiCreditoDebito`
      (validazione tipo/importo/mese/nota, gestione dell'errore di
      unicità 23505 con un messaggio comprensibile) ed
      `eliminaCreditoDebito` (la RLS rifiuta già un applicato).
- [x] `app/admin/bambini/[id]/page.tsx`: nuova sezione "Crediti e
      debiti" (elenco + form di aggiunta, mese precompilato con
      `meseSuccessivo(oggi)`).
- [x] `app/admin/rette/actions.ts`: `riepilogoDalForm`/
      `placeholderRetta`/`inviaEPersistiComunicazione` includono
      credito/debito; l'invio applica (`applicato_il`) il
      credito/debito pendente del mese; `annullaComunicazioneRetta` lo
      libera di nuovo e si rifiuta se il bonifico non è più "in
      attesa"; nuove `marcaBonificoCorretto`/`marcaBonificoImportoErrato`
      (quest'ultima crea il credito/debito dalla differenza), con
      `comunicazioneDaVerificare`/`registraVerificaBonifico` estratte
      per non duplicare la logica comune tra le due (CLAUDE.md, jscpd).
- [x] `app/admin/rette/page.tsx`: colonne "Credito/Debito"/"Nota
      cred./deb." (precompilate dal credito/debito pendente del mese),
      componente `VerificaBonifico` in ogni riga comunicata (mese
      corrente e passato).
- [x] `components/VerificaBonifico.tsx` (nuovo): stato/azioni del
      bonifico, ogni riga con il proprio `<form>` indipendente (deve
      funzionare anche nella vista di sola lettura di un mese passato,
      che non ha un form che la contenga).
- [x] `app/admin/rette/template/page.tsx`: nuovi placeholder in elenco.
- [x] `e2e/58-crediti-debiti-bambino.spec.ts` ed
      `e2e/59-verifica-bonifico-retta.spec.ts` (nuovi, uno scenario e2e
      per ciascun `## Scenario:` dei due requisiti). Verificato
      `npx tsc --noEmit`, `npx next lint`, `npx vitest run`, `npx jscpd`
      e `npm run build` puliti. Suite e2e non eseguibile in questo
      ambiente sandbox (stesso problema di credenziali ricorrente) — da
      eseguire in locale/CI prima di considerare la feature chiusa.

## Monte ore: eliminare un movimento manuale inserito per errore
Bug segnalato dall'utente (con screenshot): un movimento manuale
("+28h, Ore INPS settembre 26") inserito per errore non poteva essere
tolto dallo storico, solo compensato con un contro-movimento — non
c'era alcun modo di eliminarlo.
- [x] `specs/19 - monte-ore.md`: due nuovi scenari ("l'admin elimina un
      movimento manuale inserito per errore" e "i movimenti automatici
      non sono eliminabili") e Regole aggiornate (l'immutabilità resta
      piena solo per `settimanale`/`straordinario_residuo`; un
      `precarico` è ora eliminabile).
- [x] `supabase/migrations/0044_elimina_movimento_precarico.sql`: nuova
      policy di delete, solo admin e solo `tipo = 'precarico'` — un
      `settimanale`/`straordinario_residuo` resta rifiutato dalla RLS
      anche aggirando la UI.
- [x] `lib/monteOre.ts`: nuova `movimentoEliminabile(tipo)` (vero solo
      per `precarico`), condivisa fra UI (mostra/nasconde "Elimina") e
      controllo difensivo lato server. Copertura in
      `lib/monteOre.test.ts`.
- [x] `app/dashboard/ore-lavoro/actions.ts`: nuova
      `eliminaMovimentoMonteOre` (verifica tipo prima di eliminare,
      messaggio chiaro se non eliminabile o non trovato).
- [x] `components/MonteOre.tsx`: pulsante "Elimina" (con conferma) su
      ogni riga eliminabile dello storico; `app/dashboard/ore-lavoro/page.tsx`
      collega la nuova action.
- [x] `e2e/19-monte-ore.spec.ts`: nuovo test (registra un movimento
      manuale, lo elimina, verifica che sparisca e che il saldo torni
      al valore di partenza; verifica anche, sulle righe non manuali
      eventualmente presenti, che "Elimina" non compaia). Verificato
      `npx tsc --noEmit`, `npx next lint`, `npx vitest run`, `npx jscpd`
      e `npm run build` puliti. Suite e2e non eseguibile in questo
      momento (DB di test offline, comunicato dall'utente) — da
      eseguire in locale/CI appena disponibile.

## Monte ore: anteprima e calcolo a netto pieno
Richiesta dell'utente: vedere in anteprima, nella tabellina di
riepilogo settimanale ("Ore dovute"/"Ore ordinarie erogate"/"Ore
straordinarie erogate"), l'effetto della conferma sul monte ore. I tre
esempi numerici forniti implicavano però una formula diversa da quella
esistente (netto pieno fra dovute ed erogate, con scalo automatico se
il risultato è negativo) — confermato esplicitamente con l'utente prima
di procedere, dato che elimina la necessità del passaggio "decisione
admin sullo straordinario residuo" per le nuove settimane (specs/19,
"Attenzione alla direzione").
- [x] `specs/19 - monte-ore.md`: riscritto il calcolo automatico
      (netto pieno, può scalare), nuovo scenario "vedere in anteprima
      l'effetto sul monte ore prima di confermare", gli scenari sulla
      decisione admin spostati in una sezione dedicata "Settimane
      confermate prima del calcolo a netto pieno" (restano validi solo
      per lo storico pregresso — nessuna nuova settimana può più
      generare uno straordinario residuo da decidere).
- [x] `lib/monteOre.ts`: `controlloSettimanaOreLavoro` restituisce ora
      `variazioneMonteOre` (può essere negativa) al posto di
      carenza/carenzaResidua/straordinarioResiduo; nuova
      `descrizioneEffettoMonteOre` (testo condiviso fra l'anteprima e
      la nota del movimento, CLAUDE.md/jscpd); `notaMovimentoSettimanale`
      aggiornata. `notaMovimentoStraordinarioResiduo` resta invariata
      (serve ancora per risolvere lo storico pregresso).
- [x] `lib/monteOre.test.ts`: riscritto per la nuova formula — i casi
      di test coprono esattamente i tre esempi numerici dell'utente,
      oltre a `descrizioneEffettoMonteOre`.
- [x] `supabase/migrations/0045_movimento_settimanale_netto_pieno.sql`:
      rimosso il vincolo che imponeva `variazione >= 0` per un
      movimento `settimanale` (ora può scalare il monte ore
      direttamente). `decidiStraordinarioResiduo`,
      `components/StraordinarioResiduo.tsx` e le colonne
      `ore_lavoro_settimane.straordinario_residuo`/
      `decisione_straordinari*` restano intatte per lo storico
      pregresso, ma da questo momento ogni nuova conferma scrive
      sempre `straordinario_residuo = 0`.
- [x] `app/dashboard/ore-lavoro/actions.ts`
      (`confermaSettimanaOreLavoro`): il movimento automatico usa
      `controllo.variazioneMonteOre` (può essere negativo).
- [x] `app/dashboard/ore-lavoro/page.tsx`: nuova riga "A settimana
      confermata: ...h in più/meno sul monte ore" nella tabellina di
      riepilogo, visibile solo finché la settimana non è confermata,
      calcolata dal vivo sugli stessi dati mostrati nel form.
- [x] `e2e/18-report-ore-lavoro.spec.ts`: nuova asserzione sull'anteprima
      (non richiede una conferma reale, quindi verificabile in e2e a
      differenza del movimento vero e proprio).
      Verificato `npx tsc --noEmit`, `npx next lint`, `npx vitest run`
      (312 test), `npx jscpd` e `npm run build` puliti. Suite e2e non
      eseguibile in questo momento (DB di test offline) — da eseguire
      in locale/CI appena disponibile.

## Modello email retta: feedback dopo il salvataggio
Bug segnalato dall'utente: salvare "Modello email" non dava alcun
riscontro di successo o errore — il form già mostrava l'errore
(FormConEsito), ma un salvataggio riuscito non aveva alcun effetto
visibile (il testo in pagina resta lo stesso appena scritto), a
differenza del resto dell'app dove "l'effetto è la conferma"
(specs/05).
- [x] `specs/56 - comunicazione-retta-mensile.md`: scenario
      "configurare il template della mail" aggiornato con la data/ora
      dell'ultimo salvataggio come effetto visibile della conferma.
- [x] `app/admin/rette/template/page.tsx`: seleziona anche `updated_at`
      (colonna già scritta da `aggiornaTemplateEmailRetta`, solo non
      ancora letta/mostrata) e la visualizza come "Ultimo salvataggio:
      ..." sotto il pulsante — si aggiorna ad ogni salvataggio riuscito
      grazie a `revalidatePath` già presente nell'azione.
- [x] `e2e/56-comunicazione-retta-mensile.spec.ts`: nuova asserzione
      sulla presenza della data/ora dopo il salvataggio. Verificato
      `npx tsc --noEmit`, `npx next lint`, `npx vitest run` e
      `npx jscpd` puliti. Suite e2e non eseguibile in questo momento
      (DB di test offline) — da eseguire in locale/CI appena
      disponibile.

## Rette: rinomina colonna "Conguaglio pasti" → "Conguaglio pasti mese precedente"
Richiesta dell'utente, per chiarezza (il conguaglio riguarda le assenze
del mese precedente, non del mese in corso, e senza precisarlo può
confondere).
- [x] `specs/56 - comunicazione-retta-mensile.md`: testo dello
      scenario aggiornato.
- [x] `app/admin/rette/page.tsx`: intestazione colonna e `aria-label`
      del campo aggiornati (la seconda per coerenza, oltre
      all'intestazione).
- [x] `e2e/56-comunicazione-retta-mensile.spec.ts`: le due asserzioni
      che leggevano il testo precedente aggiornate. Verificato
      `npx tsc --noEmit`, `npx next lint`, `npx vitest run` e
      `npx jscpd` puliti (nessuna logica toccata, solo etichette).

## Bugfix: popup verifica bonifico annidava un <form>, spaginava e non salvava
Due segnalazioni dell'utente sullo stesso bug, con screenshot: il popup
"Importo diverso" spaginava la tabella "Rette", e "Bonifico corretto"/
"Importo diverso" non avevano alcun effetto sullo stato del bonifico.
Causa: `components/VerificaBonifico.tsx` usava `FormConEsito` (un
proprio `<form>`) per entrambe le azioni; nella vista del mese
corrente, `RigaComunicazione` vive già dentro il `<form>` "Invia
comunicazioni" che avvolge l'intera tabella (specs/56) — un `<form>`
annidato in un altro è HTML non valido, e il browser lo gestisce
spaginando il contenuto e non inviando in modo affidabile i dati
all'azione prevista (coerente con entrambi i sintomi osservati).
- [x] `components/VerificaBonifico.tsx`: riscritto senza alcun
      `<form>` — le Server Action (`marcaCorretto`/`marcaImportoErrato`)
      vengono chiamate direttamente come funzioni async dentro
      `useTransition`, con pending/esito gestiti a mano (stesso
      contenuto/testo mostrato all'utente, solo l'implementazione
      cambia). La validazione "campo obbligatorio" di importo/nota, che
      prima veniva dal browser via `required` dentro un `<form>`, è ora
      esplicita in JS (lo stesso `<form>` che sparisce se ne porta via
      anche la validazione nativa).
- [x] Nessuna migration necessaria per questo fix (nessuna modifica allo
      schema): le colonne `bonifico_*` di `comunicazioni_retta` sono
      già quelle di `0043_bonifico_comunicazione_retta.sql`, già
      applicata. Restano invece da applicare, se non ancora fatto,
      `0044_elimina_movimento_precarico.sql` e
      `0045_movimento_settimanale_netto_pieno.sql` (monte ore, non
      collegate a questo bug).
- [x] Verificato `npx tsc --noEmit`, `npx next lint`, `npx vitest run`,
      `npx jscpd` e `npm run build` puliti. I test e2e già scritti per
      specs/59 (button/aria-label invariati) restano validi senza
      modifiche, ma non eseguibili in questo momento (DB di test
      offline) — da eseguire appena disponibile.

## Bugfix: mancava la policy di update per la verifica bonifico
Segnalato dall'utente con screenshot: "Impossibile registrare la
verifica del bonifico. permission denied for table comunicazioni_retta".
Causa: `comunicazioni_retta` non ha mai avuto una policy/grant di
update (pensata come insert/delete soltanto,
`0038_annulla_comunicazione_retta.sql`, che escludeva esplicitamente
l'update) — la verifica del bonifico (specs/59) è il primo caso reale
che deve aggiornare una riga sul posto (`bonifico_stato` e colonne
collegate), e la migration corrispondente non era mai stata scritta.
- [x] `supabase/migrations/0046_update_bonifico_comunicazione_retta.sql`
      (nuova): policy di update solo admin + grant su
      `comunicazioni_retta`.
- [x] `specs/59 - verifica-bonifico-retta.md`: corretta la Regola che
      affermava (erroneamente) che non servisse una nuova policy RLS.
- [x] Verificato `npx tsc --noEmit` e `npx next lint` puliti (nessun
      codice applicativo toccato, solo la migration mancante).

## Verifica bonifico: annullare una verifica presa per errore
Richiesta dell'utente: poter "tornare indietro" dopo aver marcato un
bonifico (corretto o con importo diverso) — nel primo caso senza
ulteriori azioni, nel secondo con un avviso che invita a ricontrollare
i crediti/debiti del bambino, con un link di cortesia alla sua scheda.
- [x] `specs/59 - verifica-bonifico-retta.md`: due nuovi scenari
      ("annullare la verifica di un bonifico marcato corretto"/"...con
      importo diverso"), scenario "un bonifico già verificato non è
      più modificabile" riscritto (ora mostra "Annulla verifica"
      invece di essere définitivamente bloccato), nuova Regola che
      descrive `resettaVerificaBonifico` e la distingue da "Annulla
      invio" (specs/56, che cancella l'intera comunicazione, non solo
      lo stato del bonifico).
- [x] `app/admin/rette/actions.ts`: nuova `resettaVerificaBonifico`
      (azzera `bonifico_stato`/`bonifico_importo_ricevuto`/
      `bonifico_nota`/`bonifico_verificato_da(_nome/_il)`; rifiuta se
      il bonifico è già "da verificare"). Nessun credito/debito viene
      toccato: resta compito dell'admin correggerlo a mano se serve.
- [x] `components/VerificaBonifico.tsx`: pulsante "Annulla verifica" su
      entrambi gli stati verificati (con conferma); dopo un annullo di
      "importo diverso", un avviso persistente con link alla scheda del
      bambino (`bambinoId` è tornato tra le prop, serviva solo per
      questo).
- [x] `app/admin/rette/page.tsx`: passa `bambinoId` e la nuova azione
      bindata (`resettaVerificaBonifico.bind(null, comunicazione.id)`).
- [x] `e2e/59-verifica-bonifico-retta.spec.ts`: tre nuovi/aggiornati
      test (pulsante "Annulla verifica" presente sullo stato
      verificato; annullo da "corretto" torna "da verificare" senza
      avvisi; annullo da "importo diverso" mostra l'avviso col link,
      verificato fino ad atterrare sulla scheda del bambino giusta).
      Verificato `npx tsc --noEmit`, `npx next lint`, `npx vitest run`
      (312 test), `npx jscpd` e `npm run build` puliti. Nessuna nuova
      migration (nessuna modifica allo schema, solo nuovi valori
      possibili per colonne già esistenti). Suite e2e non eseguibile in
      questo momento (DB di test offline) — da eseguire in locale/CI
      appena disponibile.

## Rette: costo pasti e credito/debito non più modificabili dalla tabella
Richiesta dell'utente: nella tabella "Rette" gli importi "Retta",
"Marca da bollo", "Costo pasti" e "Credito/Debito" (con la sua nota)
non devono essere modificabili; conguaglio pasti, pre-asilo, post-asilo
e costi extra (con nota) restano invece compilabili come già erano.
Visivamente, importo e nota del credito/debito condividono un'unica
cella per ridurre l'occupazione orizzontale della tabella. Un primo
tentativo (commit `bc7e1b1`) aveva reso di sola lettura anche
conguaglio pasti/pre-asilo/post-asilo/costi extra per errore — annullato
con `git revert` e rifatto qui secondo l'elenco corretto.
- [x] `specs/56 - comunicazione-retta-mensile.md`: scenario "retta e
      marca da bollo non sono modificabili dalla tabella" esteso a
      "retta, marca da bollo, costo pasti e credito/debito..."; scenario
      "modificare manualmente una voce di costo" non cita più costo
      pasti tra le voci sovrascrivibili; scenario "vedere la tabella di
      revisione..." e Regole aggiornati di conseguenza (ordine colonne,
      quali voci sono compilabili, come vengono persistite retta/marca
      da bollo/costo pasti/credito-debito al momento dell'invio).
- [x] `specs/58 - crediti-debiti-bambino.md`: scenari sulla colonna
      "Credito/Debito" in "Rette" riscritti (sola lettura, unica
      colonna con importo e nota); Regola corrispondente aggiornata (il
      valore comunicato è sempre letto da `crediti_debiti_bambini` al
      momento dell'invio, non dal form).
- [x] `app/admin/rette/page.tsx`: colonna "Costo pasti" da `<input>` a
      testo; colonne "Credito/Debito"/"Nota cred./deb." unificate in una
      sola intestazione "Credito/Debito" (importo sopra, nota sotto in
      corpo minore, sia nella riga "da inviare" sia in quella già
      inviata); `colSpan` dell'avviso "Costi o email non configurati"
      corretto da 12 a 11; sottotitolo aggiornato per elencare solo le
      voci davvero ancora modificabili.
- [x] `app/admin/rette/actions.ts`: nuova `giorniAperturaMeseCorrente`
      (stesso calcolo di `page.tsx`: chiusure registrate + giorni feriali
      del mese) e `costoPastiProiettato` (pura, giorni × prezzo buono
      pasto) — il costo pasti non è più letto dal form ma
      ricalcolato qui, una sola query di chiusure condivisa da tutti i
      bambini dello stesso invio (non una per bambino). `riepilogoDalForm`
      riceve ora `costoPasti`/`creditoDebito` come parametri invece di
      leggerli dal form; sia l'invio massivo sia quello singolo
      interrogano `crediti_debiti_bambini` (mese corrente, `applicato_il
      is null`) per importo e nota del credito/debito, invece di
      fidarsi di `credito_debito_*`/`nota_credito_debito_*` dal form
      (campi che non esistono più).
- [x] `components/InvioSingoloRetta.tsx`: `costo_pasti` e
      `credito_debito` rimossi da `CAMPI_IMPORTO` (non più letti dal DOM
      della riga); nuove prop fisse `costoPasti`/`creditoDebito`/
      `notaCreditoDebito` per calcolare l'anteprima coerente con quanto
      verrà davvero inviato.
- [x] `app/admin/bambini/[id]/page.tsx`: testo esplicativo della
      sezione "Crediti e debiti" aggiornato (non più "resterà
      modificabile" nella comunicazione).
- [x] `e2e/56-comunicazione-retta-mensile.spec.ts`: test "il costo
      pasti mostrato è proporzionale ai giorni di apertura" aggiornato
      (confronta il testo formattato invece del `value` di un input,
      ormai assente); test "Retta e Marca da bollo non sono campi
      modificabili" esteso e rinominato per includere Costo pasti e
      Credito/Debito, con controllo che Costi extra resti invece
      modificabile.
- [x] `e2e/58-crediti-debiti-bambino.spec.ts`: nuovo test — credito/
      debito spostato sul mese corrente, verificato che importo e nota
      compaiano nella stessa riga di "Rette" senza alcun `<input>` per
      "Credito/Debito"/"Nota credito/debito", più controllo di
      accessibilità. Colma anche una lacuna di copertura pre-esistente
      (lo scenario non aveva ancora un test e2e dedicato).
      Verificato `npx tsc --noEmit`, `npx next lint`, `npx vitest run`
      (312 test) e `npx jscpd` puliti. Suite e2e sospesa su richiesta
      dell'utente (DB di test e2e temporaneamente non disponibile) — da
      eseguire in locale/CI appena disponibile.

**Rifinitura visiva successiva, stesso rilascio** — richiesta
dell'utente dopo aver visto la tabella: intestazioni più equilibrate,
simbolo "€" su alcuni importi, rinomina di una colonna, nota
credito/debito allineata a sinistra.
- [x] `specs/56 - comunicazione-retta-mensile.md`: colonna "Costo
      pasti" rinominata "Pasti mese corrente" negli scenari che la
      citano; nuove Regole su intestazioni a capo su più righe e sul
      simbolo "€" (retta e i quattro campi ancora modificabili, fuori
      dal campo).
- [x] `app/admin/rette/page.tsx`: intestazione "Costo pasti" →
      "Pasti mese corrente"; tutte le intestazioni (tranne "Bambino",
      lasciata invariata su richiesta) con `max-w-[6.5rem]` per andare a
      capo su più righe invece di allargare la colonna; Retta con "€"
      accanto al valore (riga "da inviare" e già inviata); nuovo
      componente `CampoImportoConEuro` (input + "€" fuori dal campo,
      allineato a destra) condiviso da conguaglio pasti/pre-asilo/
      post-asilo/costi extra invece di ripetere lo stesso markup quattro
      volte (CLAUDE.md, jscpd — jscpd segnalava correttamente la
      duplicazione prima di questa estrazione). La nota del
      credito/debito era già allineata a sinistra nella cella
      (`text-left` già presente): nessuna modifica necessaria lì, solo
      verificata.
- [x] `e2e/56-comunicazione-retta-mensile.spec.ts`: intestazione attesa
      "Costo pasti" → "Pasti mese corrente"; nuovo test "gli importi in
      euro mostrano il simbolo €" (retta + i quattro campi
      modificabili).
      Verificato `npx tsc --noEmit`, `npx next lint`, `npx vitest run`
      (312 test) e `npx jscpd` puliti (il refactor in
      `CampoImportoConEuro` è nato proprio da un nuovo clone segnalato
      da jscpd sulle quattro coppie input+"€"). Suite e2e sospesa, come
      sopra.

**Correzione immediata, stesso rilascio**: l'utente ha segnalato con
screenshot che mancava il simbolo "€" su Marca da bollo, Pasti mese
corrente, Credito/Debito e Totale — non era una scelta voluta, solo
un'estensione incompleta della richiesta precedente. Aggiunto "€" anche
a questi quattro (`app/admin/rette/page.tsx`, riga "da inviare" e già
inviata), aggiornata la Regola di specs/56 che elencava esplicitamente
quali colonne NE erano escluse, e ampliato il test e2e "gli importi in
euro mostrano il simbolo €" per coprirli tutti.

## Presenze/Pasti: navigazione a 2 livelli, bambini raggruppati per sezione
Richiesta dell'utente: "Presenze"/"Pasti" avevano 3 livelli di
navigazione (dashboard → elenco classi → elenco bambini di una classe),
2 click per arrivare ai bambini quando ne basta uno. Portati a 2 livelli
(dashboard → elenco bambini di tutte le classi visibili, raggruppati
visivamente per sezione, stesso pattern di "Rette" — specs/56), senza
toccare le regole di visibilità per ruolo né la logica di
lettura/scrittura di presenze/pasti, solo la navigazione per arrivarci.
- [x] `specs/12 - dashboard-maestre.md`: scenari "da Presenze/Pasti si
      arriva alle classi e poi ai bambini" riscritti (arrivo diretto,
      raggruppamento per sezione, gruppo "Senza sezione" per l'admin);
      scenario "riepilogo aggregato" aggiornato (compare sopra i gruppi
      per sezione, non più sopra un elenco di link classe).
- [x] `specs/13 - segna-presenza.md` e `specs/14 - segna-pasto.md`:
      riferimenti a "selezionare una classe" rimossi dagli scenari
      (l'elenco bambini è già nella pagina); nuova Regola sul
      raggruppamento per sezione e sul gruppo "Senza sezione" (solo
      admin, mai per maestra/assistente che vedono solo le proprie
      sezioni per costruzione).
- [x] `components/PaginaAttivitaGiornaliera.tsx` (nuovo): involucro
      condiviso da Presenze/Pasti (header, selettore data, riepilogo
      aggregato, riepilogo extra opzionale per la comunicazione pasti a
      Rojac, banner di sola lettura/chiusura scolastica) — sostituisce
      `PaginaClassi`/`ElencoClassi`/`PaginaClasseAttivita` (rimossi,
      erano usati solo dalle pagine ora accorpate).
- [x] `app/dashboard/presenze/page.tsx` e `app/dashboard/pasti/page.tsx`:
      riscritte da zero, accorpando la vecchia pagina "elenco classi"
      (livello 2) e "elenco bambini di una classe" (livello 3, ex
      `[sezioneId]/page.tsx`, ora rimossa): una sola query bulk per
      presenze/pasti/allergie su tutti i bambini visibili (`.in(
      'bambino_id', idBambini)`) invece di una query per classe visitata;
      raggruppamento con `raggruppaPerSezione` (vedi sotto), una card
      "Presenze/Pasti giornaliere - Sezione X" sopra l'elenco bambini di
      ciascun gruppo (stesso testo/calcolo di prima, solo non più su una
      pagina a parte). Pasti mantiene lo stesso ordine verticale di
      prima (riepilogo aggregato, poi il riquadro comunicazione Rojac,
      poi i gruppi).
- [x] `lib/sezioni.ts`: `raggruppaPerSezione` (spostata qui da
      `app/admin/rette/page.tsx`, ora esportata e riusata da tre pagine
      invece di essere ridefinita — CLAUDE.md, jscpd) e nuova
      `messaggioSezioniVuote`; rimossa `sezionePerId` (non più usata,
      serviva solo alle pagine `[sezioneId]` eliminate).
- [x] `lib/calendarioScolastico.ts`: nuova `editabilitaGiorno` (combina
      la chiusura del giorno con `puoScrivereData`, lib/auth.ts) — lo
      stesso calcolo era ripetuto identico in Presenze e Pasti prima di
      questa estrazione, jscpd lo segnalava come clone dopo la prima
      stesura delle due pagine.
- [x] `app/dashboard/presenze/actions.ts` e `app/dashboard/pasti/actions.ts`:
      `sezioneId` rimosso dalla firma di tutte le azioni (serviva solo a
      un `revalidatePath` per-classe che non ha più senso con un'unica
      pagina); `revalidatePath('/dashboard/presenze')`/
      `('/dashboard/pasti')` al posto del percorso con `[sezioneId]`.
- [x] `app/admin/rette/page.tsx`: importa `raggruppaPerSezione` da
      `lib/sezioni.ts` invece della propria copia locale (nessun cambio
      di comportamento, solo la stessa funzione condivisa).
- [x] `e2e/12-dashboard-maestre.spec.ts`, `e2e/13-segna-presenza.spec.ts`,
      `e2e/14-segna-pasto.spec.ts`: riscritti per il nuovo flusso — via
      il click sul link `a.bg-emerald-50` di una classe e l'attesa
      dell'URL `/dashboard/{presenze,pasti}/{sezioneId}`; i test
      verificano ora direttamente l'elenco bambini raggruppato, con
      `.first()` dove riepilogo aggregato e riepilogo per sezione
      condividono lo stesso testo (più corrispondenze possibili quando
      un account ha più di una sezione). I cross-check tra Presenze e
      Pasti (tag malattia/assente) navigano ora con `?data=` soltanto,
      senza più bisogno di estrarre un `sezioneId` dall'URL.
      Verificato `npx tsc --noEmit`, `npx next lint`, `npx vitest run`
      (312 test) e `npx jscpd` puliti. Suite e2e sospesa su richiesta
      dell'utente (DB di test e2e temporaneamente non disponibile) — da
      eseguire in locale/CI appena disponibile, con particolare
      attenzione a questi tre file dato il refactor non banale dei
      locator.

## Bugfix: "Salva costi" (e altri form di modifica) senza feedback di successo
Segnalato dall'utente: il pulsante "Salva costi" tornava attivo dopo il
salvataggio senza dare alcun riscontro concreto. L'utente ha inizialmente
chiesto una barra di avanzamento globale + disabilitazione di tutti i
pulsanti della pagina + icona ok/ko esplicita per ogni azione dell'app —
proposta che contraddice una scelta deliberata già documentata in
specs/05 - feedback.md ("Niente barra di avanzamento globale... il
successo non genera notifiche aggiuntive oltre all'effetto visibile").
Chiarito il conflitto con l'utente, che ha scelto di mantenere
l'architettura di specs/05 e limitarsi al fix mirato: "Salva costi" (e
gli altri form di modifica scoperti dallo stesso audit) non avevano
NESSUN effetto visibile dopo un salvataggio riuscito (i campi restano
con gli stessi valori appena scritti) — un buco reale nell'applicazione
dello scenario "azione completata con successo", non coperto
dall'eccezione "Salva modello" (specs/56) che invece mostra già "Ultimo
salvataggio".
- [x] `specs/05 - feedback.md`: nuovo scenario "un form di modifica
      senza altro effetto visibile mostra 'Ultimo salvataggio'" e nuova
      Regola che generalizza il pattern (già introdotto per "Salva
      modello", specs/56) a tutti i form di modifica dell'app.
- [x] Sei form corretti con lo stesso pattern (colonna/riga
      `updated_at` bumpata esplicitamente nell'azione — un upsert/update
      non la tocca da sola, mai passata nel payload prima d'ora — testo
      "Ultimo salvataggio: {data} alle {ora}" sotto il pulsante):
      - `app/admin/bambini/[id]/page.tsx` + `app/admin/actions.ts`:
        "Salva costi" (`aggiornaCostiBambino`, il bug originale) e
        "Salva modifiche" (`aggiornaBambino`).
      - `app/admin/calendario/[id]/page.tsx` + `.../actions.ts`: "Salva
        modifiche" di un giorno di chiusura (`aggiornaGiornoChiusura`).
      - `app/admin/profili-orari/[id]/page.tsx` + `.../actions.ts`:
        "Salva modifiche" di un profilo orario (`aggiornaProfiloOrario`).
      - `app/admin/maestre/page.tsx` + `.../actions.ts`: "Aggiorna" di
        un utente (`aggiornaUtente`).
      - `app/dashboard/promemoria/[id]/page.tsx` +
        `app/dashboard/actions.ts`: "Salva modifiche" di un avviso
        (`aggiornaPromemoria`).
      - `app/dashboard/ore-lavoro/page.tsx`: "Salva modifiche" della
        settimana (`salvaSettimanaOreLavoro` in `.../actions.ts` bumpava
        già `updated_at` correttamente — mancava solo leggerlo/mostrarlo
        in pagina, il più recente tra i 7 giorni salvati).
- [x] `supabase/migrations/0047_updated_at_bambini.sql` … `0051_updated_at_promemoria.sql`
      (cinque nuove migration): aggiungono `updated_at timestamptz not
      null default now()` a `bambini`, `giorni_chiusura`,
      `profili_orari`, `profili`, `promemoria` — nessuna delle cinque
      tabelle ne aveva già una. `costi_bambini` e `ore_lavoro_giorni`
      ce l'avevano già (nessuna nuova migration per loro). **Da
      applicare da parte tua** sul progetto Supabase di test e su quello
      di produzione (SQL Editor, una volta ciascuna) prima che l'effetto
      sia visibile in produzione.
- [x] `e2e/05-feedback.spec.ts`: nuovo test — crea un bambino, salva i
      costi coi valori precompilati di default (nessun cambiamento reale
      nei dati) e verifica che compaia comunque "Ultimo salvataggio"
      col formato data/ora atteso. Un solo test rappresentativo per il
      pattern condiviso, non uno per ciascuno dei sei form (stessa
      logica, stesso componente `FormConEsito`/pattern `updated_at`).
      Verificato `npx tsc --noEmit`, `npx next lint`, `npx vitest run`
      (312 test) e `npx jscpd` puliti. Suite e2e sospesa, come sopra.

## Bugfix: due deploy Vercel di fila falliti (v0.39.0, v0.40.0 mai andate in produzione)
Segnalato dall'utente: "vedo la versione 0.38.1 in prod... non la 0.40".
Verificato via l'API di GitHub (`/commits/{sha}/status`) che i deploy
Vercel dei due commit precedenti (v0.39.0 "Presenze/Pasti: navigazione a
2 livelli", v0.40.0 "Fix: form di modifica...") erano entrambi falliti
in build — l'ultimo deploy riuscito restava v0.38.1. `npm run build`
locale ha riprodotto lo stesso identico errore del log Vercel incollato
dall'utente: `lib/supabase/server.ts` (che importa `next/headers`,
un'API valida solo nei Server Component) veniva trascinato dentro il
bundle di `components/VerificaBonifico.tsx` (`'use client'`), tramite
`lib/comunicazioneRetta.ts` → `lib/calendarioScolastico.ts` →
`lib/auth.ts` → `lib/supabase/server.ts`.
- **Causa**: introdotta da me stesso in questa stessa sessione, aggiungendo
  `editabilitaGiorno` a `lib/calendarioScolastico.ts` con un import di
  `puoScrivereData` da `lib/auth.ts` (vedi la sezione "Presenze/Pasti:
  navigazione a 2 livelli" sopra) — prima di allora
  `calendarioScolastico.ts` non dipendeva mai da `auth.ts`, ed era per
  questo sicuro da importare anche in codice client (tramite
  `comunicazioneRetta.ts`). Il pre-push hook (tsc/ESLint/vitest/jscpd)
  non intercetta questo genere di violazione di confine client/server:
  serve `next build` (o `npm run build`), che né il hook né questa
  sessione avevano eseguito prima di quei due push.
- [x] `lib/calendarioScolastico.ts`: rimossi `editabilitaGiorno` e
  l'import di `puoScrivereData`/`lib/auth.ts` — torna a non dipendere
  da nulla lato server/auth, sicuro da importare in codice client.
- [x] `lib/auth.ts`: `editabilitaGiorno` spostata qui (importa
  `chiusuraPerData`/`isGiornoChiuso`/`messaggioChiusura` da
  `calendarioScolastico.ts`, direzione sicura — `auth.ts` non è mai
  importato da componenti client, quindi può dipendere da lì senza
  rischio, mai il contrario).
- [x] `app/dashboard/presenze/page.tsx` e `app/dashboard/pasti/page.tsx`:
  importano `editabilitaGiorno` da `@/lib/auth` invece che da
  `@/lib/calendarioScolastico`.
- [x] Verificato che `npm run build` (non solo `tsc --noEmit`) completi
  senza errori prima di ripushare — replica esattamente il webpack
  bundler usato da Vercel, a differenza del solo type-check. Verificato
  anche `npx tsc --noEmit`, `npx next lint`, `npx vitest run` (312
  test) e `npx jscpd` puliti.
- **Nota per il futuro**: quando un modulo `lib/` che finisce (anche
  transitivamente) in un componente client acquisisce un nuovo import,
  controllare che la nuova dipendenza non porti con sé `next/headers`/
  `next/navigation` lato server (`lib/auth.ts`, `lib/supabase/server.ts`
  sono i punti di ingresso più a rischio in questo progetto) — il
  pre-push hook non lo rileva, va verificato con `npm run build` prima
  di un push che tocca `lib/`.

## Blocco comunicazione pasti: elenco bambini senza presenza + link alle presenze
Segnalato dall'utente: le maestre vedono il blocco alla conferma pasti e
il numero di bambini senza presenza, ma non sanno *quali*, e devono
cercare da sole la schermata Presenze per sistemarle.
- [x] `specs/16 - comunicazione-pasti-rojac.md`: scenario "la
      comunicazione è bloccata se manca la presenza di qualche bambino"
      esteso — il messaggio di blocco mostra anche l'elenco nome e
      cognome dei bambini mancanti (incluse classi non assegnate a chi
      guarda) e un link "Vai alle presenze" verso `/dashboard/presenze`
      sulla stessa data. Nuova frase in "Regole" a corredo.
- [x] `lib/pastiRojac.ts`: `contaBambiniSenzaPresenzaOggiTuttoAsilo(data)`
      rinominata/sostituita da `bambiniSenzaPresenzaOggiTuttoAsilo(data)`,
      che restituisce l'elenco `{id, nome, cognome}` invece del solo
      conteggio (il conteggio resta disponibile come `.length` per chi
      ne ha bisogno, `app/dashboard/pasti/actions.ts:comunicaPastiRojac`
      incluso) — stesso pattern service_role key, nessun I/O testabile in
      unità (CLAUDE.md), coperta da e2e.
- [x] `app/dashboard/pasti/page.tsx`: il messaggio di blocco mostra ora
      l'elenco (`<ul aria-label="Bambini senza presenza">`) e un link
      `Link` verso `/dashboard/presenze?data=...` — stessa route già
      usata dalle card della dashboard (`lib/dashboardSezioni.ts`), non
      la vecchia route per-sezione `/dashboard/presenze/[id]` (rimossa
      dal refactor "Presenze/Pasti: navigazione a 2 livelli" ma rimasta,
      per un bug preesistente non toccato qui, nel link dell'allarme
      10:00 in `app/dashboard/page.tsx` e in alcuni `a.bg-emerald-50` di
      vecchi test e2e — da sistemare separatamente).
- [x] `e2e/16-comunicazione-pasti-rojac.spec.ts`: il test del messaggio
      di blocco verifica ora anche che il numero di nomi elencati
      corrisponda al numero citato nel messaggio, e che il link "Vai
      alle presenze" porti a `/dashboard/presenze`.
- [x] Verificato `npx tsc --noEmit`, `npx next lint`, `npx vitest run`
      (312 test), `npx jscpd` e `npm run build` puliti. Suite e2e non
      eseguibile in questa sessione (nessun progetto Supabase di test
      configurato in `.env.local`): da verificare manualmente in locale
      prima del prossimo rilascio, come da CLAUDE.md.

## A12 · Workflow CI unificato su PR, con `next build` (2026-09-18)
Issue #16 del programma di attività (`docs/programma-attivita.md`).
- [x] `.github/workflows/ci.yml`: un solo job `verifica` su ogni PR
      verso `main`, sei passi in sequenza: tsc → lint → jscpd → vitest →
      `next build` → e2e (Playwright). Sostituisce `analisi-statica.yml`
      e `playwright.yml`, rimossi. Un solo check da rendere obbligatorio
      nella protezione di `main` (A10), dipendenze installate una volta.
- [x] `next build` in CI chiude il buco di v0.39.0/v0.40.0 (vedi
      "Bugfix: due deploy Vercel di fila falliti" sopra): verificato in
      locale che reintrodurre l'import di `lib/auth.ts` dentro
      `lib/calendarioScolastico.ts` fa fallire `npm run build` con
      "You're importing a component that needs next/headers", mentre
      tsc/lint/vitest/jscpd restano verdi.
- [x] `concurrency` per PR (un push nuovo annulla il run precedente),
      `permissions: contents: read`, report Playwright caricato come
      artifact anche in caso di fallimento (come prima).
- [x] CLAUDE.md aggiornato (sezione "Repo pubblico"): cita `ci.yml`
      invece di `playwright.yml`.
- Nota: la e2e in CI continua a girare contro `next dev` (come in
  locale, vedi `playwright.config.ts`), non contro la build appena
  prodotta — farla girare su `next start` sarebbe più fedele alla
  produzione e più veloce, ma cambia le condizioni dei test: da
  valutare a parte, non in questa attività.

## Backlog — Fase 2/3
- [x] Registrare i bonifici ricevuti, con le opportune note — vedi
      "Crediti/debiti di un bambino e verifica del bonifico retta" sopra
      (`specs/59 - verifica-bonifico-retta.md`)
- [ ] Stato di pagamento/saldo per bambino — solo parzialmente coperto:
      crediti/debiti (`specs/58`) e verifica bonifico (`specs/59`) sono
      per singola comunicazione/mese, non ancora una vista di saldo
      complessivo aggregato per bambino
- [ ] Portale genitori (UI dedicata)
