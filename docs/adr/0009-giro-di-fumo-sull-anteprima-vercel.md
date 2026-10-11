# ADR-0009 — Giro di fumo sull'anteprima di Vercel: workflow a parte, non bloccante

- Stato: Accettata
- Data: 2026-10-11 (issue #267)

## Contesto
L'e2e di `ci.yml` prova l'app con `next start` sul runner di GitHub. Non vede
cosa serve davvero Vercel: variabili d'ambiente dell'anteprima, build di
Vercel, collegamento dell'anteprima al DB. Serve un controllo che provi
l'anteprima vera, con gli account di test, senza rallentare né rendere più
fragile la CI esistente. Il DB di test `girasole_dev` è unico e condiviso
(ADR-0006, ADR-0008).

## Decisione
Un workflow nuovo, `anteprima-fumo.yml`, su evento `deployment_status`, con
una suite Playwright piccola e separata (`e2e-anteprima/`, config
`playwright.anteprima.config.ts`). Decisioni di Matteo: anteprime non
protette (nessuna chiave di bypass di Vercel), controllo non bloccante (non
nel ruleset di `main`), mai in parallelo a un'altra e2e.

- Due job. `guardia` non ha secret: `lib/guardiaAnteprima.ts` (logica pura,
  unit test) rifiuta stato diverso da `success`, ambiente diverso da Preview,
  ogni indirizzo che non sia `girasole-<...>.vercel.app` (esclusi produzione
  e indirizzo di ramo di `main`) e ogni commit senza PR dello stesso
  repository (fork). `fumo` riceve i secret `E2E_*` solo dopo.
- `fumo` sta nel gruppo `db-test-girasole-dev` (`cancel-in-progress: false`,
  `queue: max`) come il job `e2e` di `ci.yml`: un solo giro alla volta sul DB,
  nessuna e2e interrotta.
- Solo i quattro account di test; niente `service_role`, quindi gli account
  non si ricreano qui: li ricrea la CI e2e dopo ogni reset.
- Cartella, config, report e output propri: la regola `specs/NN <-> e2e/NN`
  e la suite esistente non cambiano. Dati di prova con nome riconoscibile
  (`Fumo anteprima ...`), cancellati nello stesso test.
- Scartato: aggiungere il giro come job di `ci.yml`. `deployment_status`
  arriva dopo il deploy, che `ci.yml` (su `pull_request`) non aspetta;
  attenderlo dentro la CI allungherebbe il check obbligatorio e lo
  legherebbe a Vercel.
- Scartato: chiave di bypass della protezione di Vercel. Le anteprime non
  sono protette, quindi non serve un secret in più da custodire.
- Scartato: usare la `service_role` per ricreare gli account. Aumenterebbe i
  secret esposti a un workflow avviato da un evento esterno.

## Conseguenze
- Positive: un'anteprima rotta si vede prima del merge; l'e2e non cambia né
  rallenta; la guardia impedisce per costruzione di toccare la produzione.
- Negative: `deployment_status` parte solo da un workflow presente su
  `main`, quindi la prima run reale arriva dopo il merge. Il nome
  dell'ambiente (`Preview`) dipende da Vercel. Se il fumo parte prima
  dell'e2e della stessa PR, con una migration nuova può incontrare lo schema
  vecchio del DB di test (falso rosso, si rilancia).
- Rendere il giro obbligatorio richiede prima un job-gate che passi anche
  quando il fumo non parte (deploy fallito, PR "non codice"), per non bloccare
  il merge con un check che non arriva: vedi docs/sviluppo-dettagli.md.
- Come per ADR-0006/0008, una sessione locale sullo stesso DB resta fuori
  dalla coda.
