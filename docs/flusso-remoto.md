# Flusso remoto (dal telefono) — issue → merge

Questo documento descrive, passo per passo, il flusso oggi realmente
disponibile per portare un'attività piccola da issue a merge lavorando
**solo da telefono** (app GitHub mobile / browser mobile + app Claude,
senza aprire un laptop), con i pezzi già esistenti nel repo dopo A10, A12,
A16. È la voce **A17** di `docs/programma-attivita.md`.

**Stato di questo documento**: descrive il flusso e i suoi limiti. Il
criterio "Fatto quando" di A17 (un'attività reale portata da issue a merge
interamente da telefono) **non è verificato da questo documento**: richiede
un test dal vivo che solo Matteo può eseguire con il proprio telefono. Vedi
la sezione [Cosa resta da validare dal vivo](#cosa-resta-da-validare-dal-vivo).

## 1. Apertura dell'issue (da telefono)

Da app GitHub mobile o browser mobile, si apre una issue sul repo come al
solito: titolo + descrizione. Non serve mettere a mano le label — il job
`triage` di `.github/workflows/claude-board.yml` scatta in automatico su
`issues: opened` e (vedi `.claude/agents/triage.md`):
- riformula il problema e ne verifica la tracciabilità rispetto a `specs/`;
- assegna `type:`, `area:`, `tier:`;
- decide se aggiungere `status:ready` (con una checklist di accettazione di
  3-6 punti) oppure `status:needs-info` (con domande puntuali, se manca
  qualcosa di essenziale).

Se l'esito è `status:needs-info`, il flusso da telefono si ferma qui finché
non si risponde alle domande del triage: non ha senso avviare una sessione
cloud su un'issue ancora ambigua.

## 2. Avviare una sessione cloud di Claude Code sull'issue

**Limite da segnalare esplicitamente**: il meccanismo tecnico per avviare
da telefono una sessione cloud di Claude Code agganciata a
un'issue/repo specifici **non è documentato da nessuna parte in questo
repository**. `claude-board.yml` copre solo triage (Haiku, su issue aperta)
e review (Sonnet, su PR aperta) — non implementazione: il commento in
cima al file lo dice esplicitamente ("Il lavoro pesante [...] resta locale
in Claude Code Desktop: quella parte non deve girare da sola sul cloud").
`TASKS.md` (nota sotto `SETUP-BOARD.md`) menziona come idea futura, non
ancora fatta, "promuovere un secondo step in cloud (es. far partire
l'implementer su `status:ready` con assegnazione a `@claude`)".

Quello che oggi permette comunque il passo "issue → sessione cloud → draft
PR" da telefono è la funzionalità nativa del prodotto Claude Code (app
mobile o claude.ai), non un'automazione specifica di questo repo: si
collega il repository GitHub, si sceglie o si referenzia l'issue (es.
incollando il link o il numero), si avvia una sessione in un sandbox cloud
gestito da Anthropic, che clona il repo e può aprire branch/PR via `gh`.
Questo documento non descrive i passaggi esatti dell'interfaccia (nome dei
pulsanti, menu) perché non fanno parte della configurazione di questo
repo e possono cambiare senza che il repo ne sappia nulla — se in futuro
si aggiunge un'automazione repo-specifica (es. l'idea di `TASKS.md` sopra),
va documentata qui con il suo meccanismo reale, non ipotizzata.

La sandbox cloud, qualunque sia il modo in cui viene avviata, opera con lo
stesso file `.claude/agents/implementer.md` che guida anche le sessioni
locali (`/next-task`): branch `feat/issue-<n>-slug` o `fix/issue-<n>-slug`,
implementazione minima per soddisfare la checklist, commit atomici,
`status:in-progress` → `status:review`.

## 3. Cosa NON può fare la sandbox cloud

La sandbox cloud non ha (e non deve avere) accesso di rete al progetto
Supabase, né quello di test né quello di produzione: niente `.env.local`
con credenziali reali, niente possibilità di eseguire query, migration o
verificare RLS contro un Postgres vero. Qualunque verifica che richieda
I/O reale è delegata alla CI (sezione successiva):
- **e2e (Playwright)**: richiedono un browser + il server Next.js in
  esecuzione contro un DB reale — non girano nella sandbox, girano solo in
  CI (step 6 di `ci.yml`).
- **RLS**: si verificano solo con una sessione Postgres reale (vedi
  CLAUDE.md, "Test-first", sezione Unit: "un mock del client Supabase
  darebbe un falso senso di sicurezza proprio sulle RLS"). La sandbox può
  scrivere/aggiornare una migration in `supabase/migrations/`, ma non può
  verificarla contro un DB — vedi il limite nella sezione 6.
- **`npm run test:unit` (Vitest)**: questi sì girano nella sandbox, perché
  sono puri, senza I/O (vedi CLAUDE.md, criterio di ammissione unit test).
- **`npx tsc --noEmit`, lint, `next build`**: girano nella sandbox (nessun
  I/O verso Supabase), quindi un'implementazione "da telefono" può comunque
  autoverificarsi type-check/lint/build prima di aprire la PR, riducendo (ma
  non eliminando) le sorprese in CI.

## 4. Apertura della draft PR

L'agente **implementer** (`.claude/agents/implementer.md`), nella sandbox
cloud come in locale, apre una **draft PR** con `gh pr create --draft`:
titolo che referenzia l'issue, corpo con cosa cambia, checklist spuntata,
`Closes #<n>` (così la issue si chiude in automatico al merge), note per il
reviewer. Sposta la issue in `status:review`.

## 5. Cosa succede in CI

Alla apertura della PR (evento `pull_request: opened`), partono due cose in
parallelo:

**`ci.yml`** (unico workflow di verifica, A12), sei step in sequenza,
sempre nello stesso ordine dal più veloce al più lento:
1. `tsc --noEmit` — type-check
2. `next lint` — ESLint
3. `jscpd` — codice duplicato
4. `npx vitest run` — unit test (nessun I/O, nessun secret)
5. `next build` — build di produzione, lo stesso bundler di Vercel:
   intercetta un import lato server trascinato in un componente client
6. `npx playwright test` — e2e contro il progetto Supabase di **test**
   (mai produzione), con i secret configurati come "Repository secrets"

**`claude-board.yml`, job `review`** (A16): scatta su
`pull_request: opened, ready_for_review` (solo se la PR non arriva da un
fork, per non spendere crediti su PR esterne), gira l'agente
**reviewer** (Sonnet) che legge `CLAUDE.md`, la checklist della issue
collegata e lo scenario pertinente in `specs/`, e pubblica un commento di
review (verdetto OK / cambi richiesti / serve rls-guardian). Non approva
mai da solo, non mergia mai: se la PR tocca RLS/auth/migrazioni, lascia
esplicitamente scritto che serve la review dell'agente **rls-guardian**
(Opus, locale) prima del merge.

## 6. Come Matteo revisiona e mergia dal telefono

Da app GitHub mobile o browser mobile, Matteo guarda:
- i check della PR (i 6 step di `ci.yml`, esposti come contesto unico
  `CI / verifica` grazie ad A12) e il commento di review pubblicato da
  `claude-board.yml`;
- se il commento di review segnala "serve rls-guardian", il merge aspetta
  quella review (fatta in locale, non da telefono — è la parte che questo
  flusso non copre);
- se tutto è verde, marca la PR "Ready for review" (se era draft) e mergia
  da telefono con lo stesso pulsante dell'app/browser mobile.

**Vincolo del ruleset (A10)**: il ruleset su `main` richiede il check
`CI / verifica` verde per chiunque tranne il ruolo repository "Admin", che
ha `bypass_actors` con `bypass_mode: always`. Il motivo del bypass non è
"comodità": lo step 6 (e2e) della CI è **strutturalmente rosso** finché il
progetto Supabase di test resta in pausa prolungata (credenziali/DB non
raggiungibili — non una regressione, vedi CLAUDE.md sezione "Repo
pubblico" e `docs/programma-attivita.md`, voce A10). Solo Matteo, come
Admin, può quindi mergiare dal telefono una PR con quello step rosso;
chiunque altro collabori al repo deve avere il check verde. Questo bypass
esiste solo per lo scenario "DB di test in pausa": non è un lasciapassare
generico per ignorare check rossi legittimi (lint, build, tsc rotti restano
un blocco reale anche per Matteo, dato che sono contenuti nello stesso
context `CI / verifica`).

## Limiti noti (da tenere a mente prima di usare questo flusso)

1. **Il meccanismo esatto di avvio della sessione cloud da telefono non è
   documentato in questo repo** (vedi sezione 2): dipende dalla
   funzionalità nativa del prodotto Claude Code, non da un'automazione
   specifica di girasole. Se cambia lato prodotto, questo documento va
   aggiornato.
2. **La sandbox cloud non testa contro un vero Supabase**: RLS, e2e e
   l'effetto reale di una migration si scoprono solo in CI (o mai, se la
   migration non viene applicata a un DB — vedi punto successivo).
3. **Una migration su test prima del merge non è automatizzata**: oggi non
   esiste uno step CI che applichi automaticamente una nuova migration di
   `supabase/migrations/` al progetto Supabase di test prima di far girare
   la e2e (dipende da A20 "Supabase CLI: init e link", A21
   "Riconciliazione una tantum", A23 "DB di test pulito per ogni run" —
   nessuna delle tre è ancora fatta). In pratica, la e2e in CI oggi gira
   contro lo schema già presente sul DB di test, applicato a mano in
   precedenza: se una PR introduce una migration nuova, la CI **non** la
   applica da sola, quindi non verifica lo scenario che dipende da quello
   schema.
4. **Conseguenza pratica dei punti 2 e 3**: il flusso "dal telefono"
   descritto qui è oggi sicuro solo per attività che **non richiedono
   modifiche allo schema del database verificabili prima del merge** (es.
   fix di copy, refactor di logica pura in `lib/` con solo unit test,
   piccoli aggiustamenti UI). Un'issue che tocca `supabase/migrations/`
   richiede comunque un passaggio manuale (applicare la migration sul
   progetto di test, verificarla) che oggi nessuna automazione fa al posto
   di un umano — e resta comunque soggetta alla regola di CLAUDE.md secondo
   cui le policy RLS non si toccano senza coinvolgere **rls-guardian**.

## Cosa resta da validare dal vivo

Questo documento descrive il flusso con i pezzi oggi presenti nel repo, ma
il criterio "Fatto quando" di A17/#21 — **un'attività piccola portata
davvero da issue a merge, interamente da telefono** — richiede un test dal
vivo che solo Matteo può fare con il proprio telefono (avviare la sessione
cloud, verificare che la PR nasca, che la CI e la review girino, e mergiare
da lì). Questo documento non sostituisce quella verifica: la issue #21
resta in `status:review`, non `status:done`, finché quel test non è stato
eseguito e il suo esito non è stato annotato qui (o nella issue).
