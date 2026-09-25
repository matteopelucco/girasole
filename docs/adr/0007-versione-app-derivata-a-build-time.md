# ADR-0007 — `VERSIONE_APP`/`DATA_BUILD` derivate a build-time, non scritte a mano

- Stato: Accettata
- Data: 2026-09-23 (A14)

## Contesto
Il footer dell'app mostra versione e data di build. In precedenza
`lib/versione.ts` conteneva costanti aggiornate a mano ad ogni rilascio
— un passo facile da dimenticare, e una fonte di verità duplicata
rispetto a `package.json`/allo SHA del commit.

## Decisione
`VERSIONE_APP` e `DATA_BUILD` sono derivate automaticamente in
`next.config.mjs` ad ogni `next build`/`next dev`: `VERSIONE_APP` legge
`version` da `package.json`, `DATA_BUILD` combina lo SHA del commit
(`VERCEL_GIT_COMMIT_SHA` su Vercel, `git rev-parse HEAD` in locale) con
il timestamp di build. `lib/versione.ts` resta un file di sola logica
pura (`formattaDataBuild`, coperta da `lib/versione.test.ts`, vedi
ADR-0004), non più un elenco di costanti da aggiornare a mano.

## Conseguenze
- Positive: impossibile dimenticare di aggiornare `DATA_BUILD` (non
  esiste più da aggiornare); la versione mostrata in footer è sempre
  coerente con il commit effettivamente deployato.
- Negative: resta comunque necessario il bump manuale di `version` in
  `package.json`/`package-lock.json` prima di ogni push
  (`npm version patch|minor|major`) — `package.json` resta l'unica fonte
  che alimenta `VERSIONE_APP`, quindi quel passo non è stato eliminato
  da questa decisione, solo la data di build.
