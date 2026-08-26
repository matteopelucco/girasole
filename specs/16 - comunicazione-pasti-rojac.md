# 16 — Comunicazione pasti a Rojac

## Attori
Maestra, Admin. **L'assistente non è un attore di questo requisito**:
non ha accesso al registro pasti (vedi
[03 - utenti-e-ruoli.md](03%20-%20utenti-e-ruoli.md),
[14 - segna-pasto.md](14%20-%20segna-pasto.md)), quindi nemmeno a questa
funzione.

## Obiettivo
Una volta al giorno, quando i pasti di **tutte** le classi sono stati
segnati, una maestra (di norma quella che ha finito per ultima)
comunica a Rojac (la mensa esterna) il numero totale di pasti
dell'intero asilo per quella giornata. Da quel momento il numero
comunicato deve restare fisso: nessuna maestra può più modificare i
pasti di **nessuna** classe per quella data, per evitare uno
scostamento tra quello che risulta nell'app e quello per cui Rojac
fattura a fine mese. Ogni comunicazione resta tracciata in un log
permanente — con conferma via email allo staff — consultabile nei
report (a schermo e via email) per confrontare il totale del mese con
la fattura Rojac.

**Correzione rispetto a una prima versione di questo requisito**: il
blocco e il pulsante non sono per singola classe, ma per l'intero asilo
in blocco — un'unica comunicazione al giorno copre tutte le classi.

## Scenario: comunicare i pasti del giorno
Dato che sono autenticata come maestra o admin, ho aperto "Pasti" per
la data odierna (l'elenco delle classi, non ancora entrata in una
classe specifica) e i pasti di oggi non sono ancora stati comunicati
Quando premo "Conferma pasti"
Allora si apre un riquadro di conferma con un messaggio breve — il
numero totale di pasti segnati "sì" oggi in tutte le classi dell'asilo
(mostrato in evidenza, più grande del resto del testo) e il numero di
telefono di Rojac (0331 955630); la data non è ripetuta nel riquadro
perché è già quella selezionata in cima alla pagina
E vedo due pulsanti, "Conferma" e "Annulla"

## Scenario: confermare la comunicazione
Dato che sto guardando il riquadro di conferma comunicazione pasti
Quando premo "Conferma"
Allora viene registrata una comunicazione con data, ora, il numero
totale di pasti "sì" di oggi ricalcolato in quel momento su tutte le
classi, e chi ha confermato
E parte una email a info@asilosartorio.it che riporta l'operazione e il
numero di pasti confermato
E da quel momento vedo, al posto del pulsante "Conferma pasti", un
messaggio con data, ora e numero dei pasti comunicati

## Scenario: annullare prima di confermare
Dato che sto guardando il riquadro di conferma comunicazione pasti
Quando premo "Annulla"
Allora il riquadro si chiude, nessuna comunicazione viene registrata e
il pulsante "Conferma pasti" resta disponibile

## Scenario: dopo la comunicazione i pasti non sono più modificabili per la maestra, in nessuna classe
Dato che sono autenticata come maestra e i pasti di oggi sono già stati
comunicati a Rojac
Quando apro l'elenco bambini di Pasti di una qualunque delle mie classi
per oggi
Allora non vedo più i pulsanti Sì/No né "Salva nota" per nessun
bambino di quella classe: i valori restano visibili ma in sola lettura
E questo vale per ogni classe dell'asilo, non solo per quella
eventualmente aperta al momento della comunicazione
E questo vale anche per un bambino il cui pasto non era ancora stato
segnato prima della comunicazione
E vedo comunque, in cima a quella classe, un messaggio con data, ora e
numero dei pasti comunicati

## Scenario: l'admin può sempre modificare, anche dopo la comunicazione
Dato che sono autenticato come admin e i pasti di oggi sono già stati
comunicati a Rojac
Quando apro l'elenco bambini di Pasti di una qualunque classe per oggi
Allora vedo comunque il messaggio con data, ora e numero dei pasti
comunicati
E i pulsanti Sì/No e "Salva nota" restano comunque attivi, per
qualunque classe: l'admin può sempre modificare i pasti, la
comunicazione non lo limita (nessuna eccezione di ruolo, coerente con
[14 - segna-pasto.md](14%20-%20segna-pasto.md), "il ruolo admin può
scrivere su qualunque data")

## Scenario: la comunicazione è irreversibile e una tantum
Dato che i pasti di oggi sono già stati comunicati a Rojac
Quando riapro "Pasti" (l'elenco classi) in un altro momento della stessa
giornata, anche ricaricando la pagina
Allora il pulsante "Conferma pasti" non ricompare più: non è possibile
comunicare due volte nello stesso giorno, né annullare una
comunicazione già fatta

## Scenario: sezione "Comunicazione pasti" nel report a schermo
Dato che sto guardando il Report (giornaliero, settimanale o mensile)
Quando la pagina mostra i dati del periodo
Allora vedo una sezione "Comunicazione pasti" con una riga per ciascuna
comunicazione del periodo, nel formato
`{data}_{ora}: {numero pasti} pasti ({chi ha comunicato})`
E vedo il totale dei pasti comunicati in quel periodo
E questa sezione è unica per l'intero report (non una per classe,
essendo la comunicazione un'unica cosa al giorno per tutto l'asilo)

## Scenario: sezione "Comunicazione pasti" nel report via email
Dato che il report notturno viene generato e inviato (specs/52)
Quando uno degli allegati PDF (giornaliero/settimanale/mensile) copre un
periodo con almeno una comunicazione
Allora quell'allegato include la stessa sezione "Comunicazione pasti"
(log + totale del periodo), in testo semplice (i font dei PDF non
supportano emoji, stessa nota già in
[06 - controllo-consistenza.md](06%20-%20controllo-consistenza.md))
E la scheda HTML giornaliera di specs/52 non è toccata da questo
requisito: resta il riepilogo rapido di presenze già esistente, la
sezione "Comunicazione pasti" riguarda solo gli allegati PDF

## Regole
- Una sola comunicazione per data, per l'intero asilo: applicato anche
  a livello di database (vincolo di unicità su `data`, non più su
  classe+data).
- Il numero di pasti registrato è la somma dei bambini attivi segnati
  "sì" in **tutte** le classi dell'asilo, ricalcolata al momento della
  conferma (non il numero eventualmente mostrato nell'anteprima del
  riquadro, che può essere lievemente diverso se qualcuno segna un
  pasto nel frattempo) — un valore fisso da quel momento, non
  ricalcolato in seguito, perché rappresenta esattamente quanto
  comunicato a Rojac in quel momento.
- Chi ha confermato è registrato come testo (nome e cognome) al momento
  dell'azione, non solo come riferimento al profilo: il log deve
  restare leggibile e corretto anche se in futuro quel profilo viene
  rinominato o eliminato — è un log contabile, non deve cambiare
  retroattivamente.
- Chiunque abbia accesso a Pasti (qualunque maestra, non solo quelle
  assegnate a una classe specifica, o l'admin) può confermare la
  comunicazione: è un'azione sull'intero asilo, non su una singola
  classe, quindi non è ristretta alle sole classi assegnate a chi la
  preme.
- Il blocco della modifica pasti vale solo per la maestra, su tutte le
  classi: l'admin può **sempre** modificare i pasti di qualunque
  classe, anche dopo una comunicazione, coerente con la regola generale
  "l'admin può scrivere su qualunque data" già in vigore per i pasti
  (vedi [14 - segna-pasto.md](14%20-%20segna-pasto.md)) — nessuna
  eccezione nuova per questo requisito. Se l'admin corregge un pasto
  dopo una comunicazione già registrata, il log della comunicazione
  **non** viene aggiornato (resta il numero comunicato in quel momento):
  è un log storico immutabile, l'eventuale scostamento tra log e dati
  correnti va gestito manualmente nel confronto con la fattura, non
  nascosto ricalcolando il log a posteriori.
- Vincolo di sola-modifica-oggi (specs/14: la maestra scrive solo la
  data odierna, l'admin qualunque data) resta invariato per la
  *comunicazione* stessa: si può comunicare solo una data che si
  potrebbe altrimenti modificare — in pratica, per la maestra, solo
  "oggi".
- Sia il blocco sui pasti sia l'inserimento della comunicazione sono
  applicati anche a livello di database (trigger su `pasti`, vincolo di
  unicità su `pasti_comunicati`), non solo in UI — stesso principio già
  in uso per le altre regole pasti (vedi
  `supabase/migrations/0012_pasto_senza_parziale.sql`,
  `0017_pasto_blocca_anche_malattia.sql`).
- L'email di notifica (a info@asilosartorio.it) è un effetto collaterale
  best-effort: se l'invio fallisce (es. servizio email non
  configurato/irraggiungibile), la comunicazione resta comunque
  registrata e il blocco resta comunque attivo — non ha senso far
  fallire l'azione principale (il dato che conta per il confronto con
  la fattura) per un problema del servizio email, secondario. L'errore
  di invio viene loggato per diagnosticabilità, non mostrato come
  fallimento dell'azione all'utente.
- Il formato del log (`{data}_{ora}: {numero} pasti ({chi})`) è lo
  stesso a schermo e nei PDF via email, per confrontare facilmente le
  due fonti.
