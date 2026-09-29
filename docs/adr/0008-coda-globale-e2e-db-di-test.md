# ADR-0008 — Le e2e di CI usano il DB di test una alla volta (coda globale)

- Stato: Accettata
- Data: 2026-09-29 (issue #105)

## Contesto
Il DB di test `girasole_dev` è unico e condiviso (ADR-0006) e ogni run di
CI lo resetta prima della e2e. La concorrenza di `ci.yml` era però solo
per singola PR: due PR diverse potevano usare il DB insieme. Il 28/09 il
reset della CI della #101 è caduto a metà della e2e della #104: 15 falsi
rossi su aree che la #104 non toccava. Un secondo progetto Supabase solo
per la CI resta escluso per le ragioni di ADR-0006.

## Decisione
`ci.yml` è diviso in tre job: `statico` (classificazione, tsc, lint,
jscpd, vitest, build), `e2e` (reset del DB, account E2E_*, Playwright) e
`verifica` (gate finale). Solo `e2e` sta in un gruppo di concorrenza
globale, `db-test-girasole-dev`, con `cancel-in-progress: false` e
`queue: max`: un job alla volta usa il DB, gli altri aspettano in ordine
di arrivo (fino a 100), nessuno interrompe chi sta girando.

- Il check richiesto dal ruleset di `main` resta `CI / verifica`: il job
  `verifica` gira sempre (`if: always()`) e passa solo se `statico` è
  verde e `e2e` è verde oppure saltato di proposito (PR "non codice",
  #98, o Dependabot, #68). Il ruleset non cambia.
- `e2e` non parte proprio (`if:` a livello di job) sulle PR "non codice"
  e di Dependabot: non occupano la coda.
- Il gruppo per PR a livello di workflow (`cancel-in-progress: true`)
  resta: un push più recente cancella l'intero run precedente, anche il
  suo `e2e` in coda o in corso.
- Scartato: gruppo globale sull'intero job unico. Più semplice, ma
  serializza anche i passi economici e fa entrare in coda le PR "non
  codice" (la classificazione è uno step, e `jobs.<id>.if` non può
  eseguirla).
- Scartato: il comportamento predefinito della coda (`queue: single`),
  che tiene un solo job in attesa: il terzo cancellerebbe il secondo.

## Conseguenze
- Positive: niente più reset sovrapposti tra CI di PR diverse; i passi
  statici restano paralleli e danno l'esito in un minuto circa.
- Negative: con più PR aperte insieme la CI di ciascuna può durare più
  a lungo (attesa in coda, ~11 minuti per ogni e2e davanti). Il
  `timeout-minutes` di `e2e` conta solo l'esecuzione, non l'attesa.
- Il job `e2e` ricompila l'app (`next start` ne ha bisogno): ~35 s in più
  per run, preferiti a passare `.next` tra job come artifact.
- Un `e2e` cancellato mentre è in coda (coda piena, annullo a mano) fa
  diventare rosso `verifica`: si rilancia con "Re-run failed jobs" o
  `gh run rerun <run-id> --failed`.
- La coda vale solo tra run di CI: una sessione locale sullo stesso DB
  può ancora sovrapporsi a una CI (compromesso di ADR-0006, invariato).
- Nessun altro workflow deve usare il gruppo `db-test-girasole-dev`.
