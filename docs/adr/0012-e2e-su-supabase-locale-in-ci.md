# ADR-0012 — e2e su Supabase locale in CI: niente più DB di test condiviso né coda per l'e2e

- Stato: Accettata (supera [ADR-0006](0006-db-di-test-condiviso-reset-ad-ogni-ci.md) e [ADR-0008](0008-coda-globale-e2e-db-di-test.md); precisa [ADR-0009](0009-giro-di-fumo-sull-anteprima-vercel.md))
- Data: 2026-11-13 (issue #419)

## Contesto
Fino a oggi l'e2e di `ci.yml` resettava il DB di test remoto `girasole_dev`
(ADR-0006) e, per non far pestare i piedi a due PR, stava in una coda globale
(ADR-0008). Con circa 530 test il giro durava 25-35 minuti e con più PR aperte
si sommava l'attesa. La prova della issue #419 (job `e2e-locale`, PR #420) ha
fatto girare gli stessi controlli (pgTAP, grant-check, rls-check, account di
test, Playwright) contro un Supabase acceso nel runner con `supabase start`:
5 giri verdi di seguito, nessun test passato sul remoto e fallito in locale per
differenze di ambiente, ~10 minuti contro ~30 sullo stesso commit. Un giro rosso
per l'ambiente (limite del registro Docker) è stato mitigato con 3 tentativi
all'avvio.

## Decisione
Decisioni di Matteo (issue #419):

1. Il job che usa Supabase locale diventa **l'e2e bloccante**: sta in `ci.yml`
   con il nome `e2e`, entra in `verifica` (che non cambia: `CI / verifica`
   resta il check del ruleset di `main`), senza `continue-on-error`, timeout
   25 minuti. Il vecchio job `e2e` sul DB remoto condiviso sparisce, insieme al
   gruppo di coda globale `db-test-girasole-dev` e ai segreti che servivano
   solo a lui.
2. Il job locale **non usa segreti né variabili del repository**: indirizzo e
   chiavi sono quelli dimostrativi dello stack locale, le password degli
   account di test si generano a ogni giro. Non tocca nessun progetto Supabase
   vero. Ogni run ha il suo database: niente reset condiviso, niente coda, PR
   diverse in parallelo.
3. Il **giro di fumo** sull'anteprima (ADR-0009) tiene il suo reset del DB di
   test remoto, ma in un gruppo di coda proprio, `db-test-remoto-fumo`
   (`cancel-in-progress: false`, `queue: max`): dura 2-3 minuti, non 30, e non
   si sovrappone a nessun altro reset. Poiché l'e2e non ricrea più gli account
   dopo il reset, lo fa il fumo stesso, con la `service_role`. Per non esporre
   quei segreti a codice di una PR, gli step privilegiati (installazione della
   CLI, reset, creazione account) usano lo script del ramo principale con
   `npm ci --ignore-scripts`; le migration e il seed sono quelli della PR
   (solo SQL sul DB di test); il codice della PR (`npm ci`, Playwright) gira
   dopo, solo con i quattro account di test.
4. **Dependabot e PR esterne**: fuori ambito. Il comportamento di `ci.yml`
   non cambia (l'e2e non parte su Dependabot, come prima). Il job locale non
   usa segreti, quindi in futuro non è un ostacolo tecnico a farlo girare
   anche per loro: sarà una decisione separata.
5. **Sviluppo a mano**: `girasole_dev` resta per provare l'app (`.env.local`).
   La CI delle PR non lo azzera più. Lo azzera solo il fumo (punto 3).

Cosa resta del DB di test remoto `girasole_dev`, secondo i documenti del
repository: (a) il reset del giro di fumo; (b) l'uso a mano di Matteo in sviluppo
locale; (c) il progetto a cui, per i documenti, puntano le variabili "Preview"
di Vercel (da verificare nella console di Vercel: non è controllabile dal
repository). Nessun altro workflow lo tocca.

## Conseguenze
- Positive: giro di CI ~10 minuti invece di ~30, senza attesa in coda; più PR
  in parallelo; l'e2e non dipende dalla disponibilità del DB remoto (pausa del
  progetto, limiti); i dati di prova di Matteo su `girasole_dev` non vengono più
  cancellati a ogni PR; meno segreti usati dalla CI di PR.
- Negative: lo stack locale non è identico al servizio ospitato. Si allinea ciò
  che si è trovato diverso: i privilegi di default (file
  `supabase/ci/privilegi-default-ospitato.sql`, copiato come prima migration solo
  nel runner) e i limiti di accesso (`supabase/config.toml`, valido solo per il
  locale, mai `supabase config push` verso test o produzione). Differenze non
  ancora viste possono emergere in futuro.
- L'avvio dipende dal registro Docker: un limite di richieste può far fallire un
  giro (3 tentativi con pulizia dei container). Un rosso per questo motivo si
  rilancia con "Re-run failed jobs".
- Il fumo fa la coda solo con se stesso: un fumo che parte mentre un altro azzera
  il DB aspetta. Resettando con le migration della propria PR, non incontra più
  lo schema vecchio che ADR-0009 citava come causa di falsi rossi.
- Una sessione di sviluppo a mano su `girasole_dev` può ancora essere azzerata
  da un fumo (la coda vale solo tra run di CI).
- `scripts/grant-check.mts` e `scripts/rls-check.mts` mantengono anche la strada
  verso il progetto di test (Management API), oggi non usata dalla CI.
- Il nuovo workflow del fumo parte solo dal ramo `main` (`deployment_status`): la
  prima prova reale arriva dopo il merge. Dopo il merge va verificato un giro
  del fumo prima di chiudere la issue.
- Azioni fuori dal repository (Matteo): vedi la PR. Non vengono toccate da
  questa decisione né da questa PR.
