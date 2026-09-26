# ADR-0004 — Unit test (Vitest) ammessi solo su funzioni pure, senza I/O

- Stato: Accettata
- Data: 2026-08-23

## Contesto
Il progetto ha già una suite e2e (Playwright) che copre ogni
`## Scenario:` di `specs/` contro un Postgres reale con RLS attiva. Le
policy RLS sono definite come "la difesa primaria dei dati" (CLAUDE.md,
Convenzioni): mockare il client Supabase in un unit test per verificare
un comportamento che dipende dalla RLS darebbe un falso senso di
sicurezza, perché il mock non applica alcuna policy reale.

## Decisione
Un unit test in `lib/xxx.test.ts` è ammesso solo per funzioni senza I/O:
niente chiamate Supabase (nemmeno con un client "finto"), niente
`fetch`, niente filesystem, niente `redirect()` di Next.js. Esempio
concreto in `lib/auth.ts`: `puoScrivereData`/`assicuraScrivibile` (prendono
ruolo e data, nessun I/O) sono unit test; `requireUser`/`requireProfilo`/
`requireAdmin`/`requireStaff` (fanno query Supabase e `redirect()`)
restano coperte solo da e2e. Gli unit test sono co-locati accanto al
modulo (`lib/date.ts` → `lib/date.test.ts`), non mappati 1:1 su
`specs/xxx.md`.

## Conseguenze
- Positive: gli unit test girano in millisecondi, senza server dev né
  credenziali, quindi possono stare nell'hook `pre-push` (che deve
  restare veloce) e vengono usati per iterare rapidamente sulla logica
  pura durante lo sviluppo (`npm run test:unit:watch`).
- Negative: qualunque logica che tocca anche solo in parte I/O (query
  Supabase, RLS, redirect) non ha una rete di sicurezza rapida — resta
  scoperta finché non gira la suite e2e completa (richiede
  `npm run dev` + Playwright), più lenta da eseguire durante lo sviluppo.
- Questo criterio non riduce la copertura e2e: i due livelli non sono
  alternativi, l'unit test è un livello aggiuntivo per i casi limite
  della logica pura (bisestili, cambi mese/anno, confini di regex) che
  sarebbe costoso enumerare uno per uno tramite browser.
