# ADR-0010 — Next 16: `proxy.ts` al posto di `middleware.ts`, ESLint senza `next lint`

- Stato: Accettata
- Data: 2026-10-11 (issue #306, decisione di Matteo; contesto in #304)

## Contesto
Con Next 15.5 i form con Server Action a volte restano su "Attendere…" anche
se il server ha già risposto e salvato: è un difetto di React incluso in Next
15.5, corretto solo da Next 16.3 (dettagli in #304). Matteo ha deciso di
passare a Next 16.4. Next 16 cambia tre cose che toccano la struttura del
repo:
- il file `middleware.ts` è deprecato e si chiama `proxy.ts` (funzione
  `proxy`); il proxy gira sempre sul runtime Node.js, il vecchio middleware
  per default girava su Edge;
- il comando `next lint` non esiste più, ed `eslint-config-next` 16 esiste
  solo nel formato "flat" di ESLint 9;
- `next build` e `next dev` usano Turbopack per default.

## Decisione
- `middleware.ts` diventa `proxy.ts`. Cambiano solo il nome del file e della
  funzione: il rinnovo della sessione Supabase, il rinvio da `/dashboard` a
  `/login` per chi non è autenticato e il `matcher` restano identici.
  `@supabase/ssr` funziona anche sul runtime Node.js.
- Il lint passa all'ESLint CLI: `npm run lint` lancia `eslint .` (più
  `check:service-role`), con la configurazione in `eslint.config.mjs` al posto
  di `.eslintrc.json`. Restano `core-web-vitals` e i due blocchi
  `no-restricted-imports` sul confine client/server (#17). Il lint ora copre
  tutto il repo (anche `e2e/`, `scripts/` e i file di configurazione), non
  solo `app/`, `components/`, `lib/`.
- Le regole nuove di `eslint-plugin-react-hooks` 7 restano come arrivano,
  tranne `react-hooks/set-state-in-effect`, abbassata ad avviso (segnala due
  effetti esistenti che funzionano) e `react-hooks/rules-of-hooks`, spenta
  nei test Playwright (`use` lì è la funzione delle fixture, non l'hook di
  React).
- Si resta su Turbopack, il default: la build di produzione passa senza
  configurazioni aggiuntive. Nessun flag `--webpack`.
- Non si attivano `reactCompiler` né `cacheComponents`: non servono per
  l'aggiornamento.

## Conseguenze
- Chi cerca il codice che protegge le pagine `/dashboard` lo trova in
  `proxy.ts`; i controlli OWASP e la review di sicurezza guardano quel file.
- Il pre-push e la CI chiamano già `npm run lint`/`eslint .`: nessun
  `next lint` rimasto negli script.
- Se si volesse riscrivere i due effetti segnalati da `set-state-in-effect`
  (`components/BarraCaricamento.tsx`, `components/FormConEsito.tsx`), serve
  una issue a parte: cambia il comportamento di componenti client.
