# ADR-0001 — I nomi di tabelle/colonne/route non seguono i cambi di terminologia UI

- Stato: Accettata
- Data: 2026-08-22 (Classe/Alunno vs `sezioni`/`bambini`), confermata il
  2026-08-24 (Promemoria → Avviso)

## Contesto
La UI usa in più punti un termine diverso da quello storico nello schema
del database: "Classe" in interfaccia corrisponde alla tabella `sezioni`,
"Alunno" alla tabella `bambini` (specs/04 - data-types.md); "Avviso" (poi
scelto per l'utente finale al posto di "Promemoria") corrisponde ancora
alla tabella `promemoria`, alle server action `creaPromemoria`/
`aggiornaPromemoria`/`eliminaPromemoria` e alla route
`/dashboard/promemoria/[id]` (specs/15 - memo.md). In entrambi i casi la
terminologia rivolta all'utente è cambiata rispetto al nome tecnico
originale.

## Decisione
Non rinominare tabelle, colonne, server action o route quando cambia solo
il termine mostrato in UI. Il termine utente-facing (Classe, Alunno,
Avviso) vive solo in testi, titoli, pulsanti e messaggi; il nome tecnico
(`sezioni`, `bambini`, `promemoria`) resta quello già in produzione.

## Conseguenze
- Positive: nessuna migration, nessun rischio di rottura di RLS/policy
  esistenti, nessuna rinomina ad ampio raggio di codice già in
  produzione solo per un cambio lessicale.
- Negative: chi legge il codice/schema deve conoscere la corrispondenza
  tra nome tecnico e termine UI attuale (documentata in
  specs/04 - data-types.md e specs/15 - memo.md); un nuovo contributor
  può inizialmente confondersi vedendo `promemoria` nel codice e
  "Avviso" in pagina.
- Il criterio non è assoluto: se in futuro il nome tecnico diventasse
  esso stesso fuorviante (non solo il termine UI), resta un caso da
  valutare singolarmente, non coperto automaticamente da questo ADR.
