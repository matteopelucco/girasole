# 16 — Comunicazione pasti a Rojac

## Attori
Maestra (sulle proprie sezioni), Admin (su qualunque sezione).
**L'assistente non è un attore di questo requisito**: non ha accesso al
registro pasti (vedi
[03 - utenti-e-ruoli.md](03%20-%20utenti-e-ruoli.md),
[14 - segna-pasto.md](14%20-%20segna-pasto.md)), quindi nemmeno a questa
funzione.

## Obiettivo
Una volta che i pasti di una classe per la giornata sono comunicati
telefonicamente/via app a Rojac (la mensa esterna), il numero comunicato
deve restare fisso: nessuna modifica successiva ai pasti di quella
classe per quella data, per evitare uno scostamento tra quello che
risulta nell'app e quello per cui Rojac fattura a fine mese. Ogni
comunicazione resta tracciata in un log permanente, consultabile nei
report (a schermo e via email), per poter confrontare il totale del
mese con la fattura Rojac.

## Scenario: comunicare i pasti di una classe
Dato che ho aperto Pasti per la mia classe, per la data odierna, e ho
finito di segnare i pasti dei bambini
Quando premo "Pasti comunicati a Rojac" e confermo
Allora viene registrata una comunicazione con la data, l'ora, il numero
di pasti segnati "sì" in quel momento per quella classe, e chi ha
premuto il pulsante
E da quel momento vedo, al posto del pulsante, un messaggio con la data,
l'ora e il numero di pasti comunicati

## Scenario: dopo la comunicazione i pasti non sono più modificabili per la maestra
Dato che sono autenticata come maestra e i pasti della mia classe per
una data sono già stati comunicati a Rojac
Quando guardo l'elenco bambini di Pasti per quella classe e quella data
Allora non vedo più i pulsanti Sì/No né "Salva nota" per nessun
bambino della classe: i valori restano visibili ma in sola lettura
E questo vale anche per un bambino il cui pasto non era ancora stato
segnato prima della comunicazione (registrarlo ora sarebbe comunque una
modifica al totale già comunicato)
E vedo comunque il messaggio con data, ora e numero dei pasti comunicati

## Scenario: l'admin può sempre modificare, anche dopo la comunicazione
Dato che sono autenticato come admin e i pasti di una classe per una
data sono già stati comunicati a Rojac
Quando guardo l'elenco bambini di Pasti per quella classe e quella data
Allora vedo comunque il messaggio con data, ora e numero dei pasti
comunicati
E i pulsanti Sì/No e "Salva nota" restano comunque attivi: l'admin può
sempre modificare i pasti, la comunicazione non lo limita (nessuna
eccezione di ruolo, coerente con il resto dell'app — vedi
[14 - segna-pasto.md](14%20-%20segna-pasto.md), "il ruolo admin può
scrivere su qualunque data")

## Scenario: la comunicazione è irreversibile e una tantum
Dato che i pasti di una classe per una data sono già stati comunicati
Quando riguardo quella pagina, anche ricaricandola o riaprendola in un
altro momento
Allora il pulsante "Pasti comunicati a Rojac" non ricompare più per
quella classe e quella data: non è possibile comunicare due volte, né
annullare una comunicazione già fatta

## Scenario: il pulsante chiede conferma prima di comunicare
Dato che sto per premere "Pasti comunicati a Rojac"
Quando premo il pulsante
Allora mi viene chiesta una conferma esplicita (Sì/Annulla) prima che la
comunicazione venga registrata, essendo un'azione irreversibile

## Scenario: sezione "Comunicazione pasti" nel report a schermo
Dato che sto guardando il Report (giornaliero, settimanale o mensile) di
una o più classi
Quando la pagina mostra i dati del periodo
Allora vedo, per ogni classe con almeno una comunicazione nel periodo,
una sezione "Comunicazione pasti" con una riga per ciascuna
comunicazione nel formato
`{data}_{ora}: {numero pasti} pasti ({chi ha comunicato})`
E vedo il totale dei pasti comunicati in quel periodo per quella classe
E se più classi hanno comunicazioni nel periodo, vedo anche un totale
complessivo su tutte le classi visibili

## Scenario: sezione "Comunicazione pasti" nel report via email
Dato che il report notturno viene generato e inviato (specs/52)
Quando uno degli allegati PDF (giornaliero/settimanale/mensile) copre un
periodo con almeno una comunicazione
Allora quell'allegato include la stessa sezione "Comunicazione pasti"
(log per classe + totale per classe + totale complessivo), in testo
semplice (i font dei PDF non supportano emoji, stessa nota già in
[06 - controllo-consistenza.md](06%20-%20controllo-consistenza.md))
E la scheda HTML giornaliera di specs/52 non è toccata da questo
requisito: resta il riepilogo rapido di presenze già esistente, la
sezione "Comunicazione pasti" riguarda solo gli allegati PDF

## Regole
- Una comunicazione è per coppia (classe, data): al più una per
  ciascuna, applicato anche a livello di database (vincolo di unicità).
- Il numero di pasti registrato è quello dei bambini segnati "sì" in
  quella classe per quella data **al momento della comunicazione**: un
  valore fisso, non ricalcolato in seguito, perché rappresenta
  esattamente quello comunicato a voce/per iscritto a Rojac in quel
  momento.
- Chi ha comunicato è registrato come testo (nome e cognome) al momento
  dell'azione, non solo come riferimento al profilo: il log deve restare
  leggibile e corretto anche se in futuro quel profilo viene rinominato
  o eliminato — è un log contabile, non deve cambiare retroattivamente.
- Il blocco della modifica pasti vale solo per la maestra: l'admin può
  **sempre** modificare i pasti, anche dopo una comunicazione, coerente
  con la regola generale "l'admin può scrivere su qualunque data" già
  in vigore per i pasti (vedi
  [14 - segna-pasto.md](14%20-%20segna-pasto.md)) — nessuna eccezione
  nuova per questo requisito. Se l'admin corregge un pasto dopo una
  comunicazione già registrata, il log della comunicazione **non** viene
  aggiornato (resta il numero comunicato in quel momento a Rojac): è un
  log storico immutabile, l'eventuale scostamento tra il log e i dati
  correnti è visibile e va gestito manualmente nel confronto con la
  fattura, non nascosto ricalcolando il log a posteriori.
- Vincolo di sola-modifica-oggi (specs/14: la maestra scrive solo la
  data odierna, l'admin qualunque data) resta invariato per la
  *comunicazione* stessa: si può comunicare solo una data che si
  potrebbe altrimenti modificare.
- Sia il blocco sui pasti sia l'inserimento della comunicazione sono
  applicati anche a livello di database (trigger su `pasti`, vincolo di
  unicità su `pasti_comunicati`), non solo in UI — stesso principio già
  in uso per le altre regole pasti (vedi
  `supabase/migrations/0012_pasto_senza_parziale.sql`,
  `0017_pasto_blocca_anche_malattia.sql`).
- Il formato del log (`{data}_{ora}: {numero} pasti ({chi}))`) è lo
  stesso sia a schermo sia nei PDF via email, per poter confrontare
  facilmente le due fonti.
