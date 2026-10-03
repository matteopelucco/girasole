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

Il box di comunicazione (pulsante "Conferma pasti", oppure il messaggio
"presenze mancanti", oppure il messaggio "pasti comunicati") sta in cima
alla schermata unica "Presenze e pasti", come capitolo "Comunicazione
pasti a Rojac" dentro la card del riepilogo aggregato, sotto gli
specchietti (vedi [10 - presenze-e-pasti.md](10%20-%20presenze-e-pasti.md)). Dopo la
comunicazione, oltre ai pasti, per i bambini con pasto "sì" non si
possono più segnare "Assente" o "Malattia" (vedi gli scenari in fondo):
evita il caso "pasto comunicato e fatturato, poi bambino segnato
assente", che produrrebbe un'incoerenza
([06 - controllo-consistenza.md](06%20-%20controllo-consistenza.md)) e
uno scostamento con la fattura Rojac.

**Correzione rispetto a una prima versione di questo requisito**: il
blocco e il pulsante non sono per singola classe, ma per l'intero asilo
in blocco — un'unica comunicazione al giorno copre tutte le classi.

## Scenario: comunicare i pasti del giorno
Dato che sono autenticata come maestra o admin, ho aperto "Presenze e
pasti" per la data odierna, i pasti di oggi non sono ancora stati
comunicati e
tutti i bambini attivi dell'asilo hanno una presenza già segnata per
oggi
Quando premo "Conferma pasti"
Allora si apre un riquadro di conferma con un messaggio breve — il
numero totale di pasti segnati "sì" oggi in tutte le classi dell'asilo
(mostrato in evidenza, più grande del resto del testo) e il numero di
telefono di Rojac (0331 955630); la data non è ripetuta nel riquadro
perché è già quella selezionata in cima alla pagina
E vedo due pulsanti, "Conferma" e "Annulla"

## Scenario: la comunicazione è bloccata se manca la presenza di qualche bambino
Dato che sono autenticata come maestra o admin, ho aperto "Presenze e
pasti" per la data odierna (tutti i bambini, raggruppati per sezione), i
pasti di oggi non sono ancora stati comunicati e almeno un bambino attivo, di una qualunque classe
dell'asilo, non ha ancora una presenza segnata per oggi
Allora al posto del pulsante "Conferma pasti" vedo un messaggio che mi
avvisa che non è ancora possibile comunicare i pasti, con il numero di
bambini a cui manca la presenza
E vedo l'elenco con nome e cognome di ciascun bambino a cui manca la
presenza, anche se appartiene a una classe non assegnata a me
E ogni nome di un bambino la cui card è in questa stessa pagina (cioè di
una mia classe, o di qualunque classe se sono admin) è un link che mi
porta direttamente alla sua card, come scorciatoia per segnare la
presenza mancante; i bambini di classi non mie restano testo semplice
(la loro card non è in pagina)
E non è possibile aprire il riquadro di conferma: nessun pulsante
"Conferma pasti" è presente nella pagina
E quando tutte le presenze mancanti vengono segnate (in una qualunque
classe, anche non tra quelle assegnate a me) e ricarico la pagina, il
messaggio sparisce e ricompare il pulsante "Conferma pasti"

## Scenario: la comunicazione è bloccata se i dati sono incoerenti
Dato che sono autenticata come maestra o admin, ho aperto "Presenze e
pasti" per la data odierna, i pasti di oggi non sono ancora stati
comunicati e almeno un bambino attivo, di una qualunque classe
dell'asilo, ha il pasto "sì" ma risulta assente o in malattia (quindi i
pasti segnati sono più dei bambini presenti)
Allora al posto del pulsante "Conferma pasti" vedo un messaggio che mi
avvisa che non è ancora possibile comunicare i pasti perché ci sono dati
incoerenti, con il numero di bambini interessati
E vedo l'elenco con nome e cognome di ciascuno e il motivo
dell'incoerenza (stessi messaggi di
[06 - controllo-consistenza.md](06%20-%20controllo-consistenza.md)),
anche se appartiene a una classe non assegnata a me
E ogni nome di un bambino la cui card è in questa stessa pagina è un
link alla sua card, per correggere il dato
E quando i dati sono corretti e ricarico la pagina il messaggio sparisce
e ricompare il pulsante "Conferma pasti"

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
Quando apro "Presenze e pasti" per oggi
Allora nella sezione "Pasto" non vedo più i pulsanti Sì/No per nessun
bambino: i valori restano visibili ma in sola lettura
E questo vale per ogni classe dell'asilo, non solo per quella
eventualmente aperta al momento della comunicazione
E questo vale anche per un bambino il cui pasto non era ancora stato
segnato prima della comunicazione
E vedo comunque, in cima alla pagina, un messaggio con data, ora e
numero dei pasti comunicati

## Scenario: l'admin può sempre modificare, anche dopo la comunicazione
Dato che sono autenticato come admin e i pasti di oggi sono già stati
comunicati a Rojac
Quando apro "Presenze e pasti" per oggi
Allora vedo comunque il messaggio con data, ora e numero dei pasti
comunicati
E i pulsanti Sì/No restano comunque attivi, per
qualunque classe: l'admin può sempre modificare i pasti, la
comunicazione non lo limita (nessuna eccezione di ruolo, coerente con
[14 - segna-pasto.md](14%20-%20segna-pasto.md), "il ruolo admin può
scrivere su qualunque data")

## Scenario: la comunicazione è irreversibile e una tantum
Dato che i pasti di oggi sono già stati comunicati a Rojac
Quando riapro "Presenze e pasti" in un altro momento della stessa
giornata, anche ricaricando la pagina
Allora il pulsante "Conferma pasti" non ricompare più: non è possibile
comunicare due volte nello stesso giorno, né annullare una
comunicazione già fatta

## Scenario: dopo la comunicazione la maestra non può segnare Assente o Malattia un bambino con pasto "sì"
Dato che sono autenticata come maestra, i pasti di oggi sono già stati
comunicati a Rojac e un bambino di una mia classe ha il pasto di oggi
segnato "sì" e una presenza diversa da "assente"/"malattia"
Quando guardo la sezione "Presenza" della sua card in "Presenze e pasti"
Allora i pulsanti "Assente" e "Malattia" sono disabilitati, con la breve
spiegazione "Pasto già comunicato a Rojac"
E i pulsanti "Presente", "Pre-asilo", "Post-asilo" e il "Salva nota"
della presenza restano disponibili (non cambiano il conteggio dei pasti)

## Scenario: dopo la comunicazione un bambino senza pasto "sì" può ancora essere segnato Assente o Malattia
Dato che sono autenticata come maestra, i pasti di oggi sono già stati
comunicati a Rojac e un bambino di una mia classe ha il pasto di oggi
segnato "no" (o non segnato)
Quando guardo la sezione "Presenza" della sua card
Allora i pulsanti "Assente" e "Malattia" restano disponibili: quel
bambino non è nel conteggio comunicato

## Scenario: l'admin può segnare Assente o Malattia anche dopo la comunicazione
Dato che sono autenticato come admin e i pasti di oggi sono già stati
comunicati a Rojac
Quando guardo la sezione "Presenza" della card di un bambino con pasto
"sì"
Allora i pulsanti "Assente" e "Malattia" restano disponibili (l'admin
deve poter correggere errori reali; il log della comunicazione resta
comunque immutabile)

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
- La comunicazione richiede che **ogni** bambino attivo dell'asilo (non
  solo quelli delle classi assegnate a chi comunica) abbia già una
  presenza segnata per quella data — qualunque stato (`presente`,
  `assente` o `malattia`), non necessariamente "presente": un bambino
  senza alcuna presenza segnata è un dato mancante, non un'assenza
  implicita, e comunicare pasti senza sapere ancora chi c'è rischia di
  disallinearsi dal conteggio reale non appena quella presenza verrà
  segnata. Se ne manca anche solo una, il pulsante "Conferma pasti" non
  compare affatto (sostituito da un messaggio con il numero di bambini
  a cui manca la presenza e il loro elenco nome e cognome, in cui ogni
  bambino con la card nella stessa pagina è un link alla sua card):
  non è un errore mostrato dopo aver aperto il riquadro di conferma, il
  pulsante stesso non è disponibile finché la condizione non è
  soddisfatta. L'elenco include anche bambini di classi non assegnate a
  chi guarda (lo stesso dato, calcolato da funzioni Postgres `security
  definer` richiamate via RPC con la sessione di chi guarda — migration
  0056 — che già oggi determina il conteggio; riservate ad admin e
  maestra, la maestra solo per la giornata odierna, l'assistente è
  respinta — vedi sotto): serve a far capire *chi*
  manca, non solo *quanti*, senza dover chiedere in giro. Applicato
  anche a livello di database (trigger su `pasti_comunicati`, stesso
  principio dei trigger già in uso per le altre regole pasti — vedi
  sotto), non solo in UI.
- La comunicazione richiede anche che i dati dell'intero asilo siano
  **coerenti** (regole di [06 - controllo-consistenza.md](06%20-%20controllo-consistenza.md):
  in pratica, nessun bambino con pasto "sì" e presenza assente/malattia,
  il che equivale a pasti ≤ presenti). Un'incoerenza, come una presenza
  mancante, toglie il pulsante "Conferma pasti" e lo sostituisce con
  l'elenco dei bambini da correggere (se mancano anche delle presenze, i
  due messaggi compaiono entrambi). Il controllo è ripetuto lato server
  alla conferma (la pagina potrebbe essere stata aperta prima di una
  modifica): se trova un'incoerenza, la comunicazione non viene
  registrata e viene mostrato un messaggio con i bambini interessati.
  Motivo: un pasto segnato su un bambino poi risultato assente finiva
  nel totale comunicato a Rojac (e nella retta del mese dopo). Il caso
  si previene alla fonte quando si segna Assente/Malattia
  ([13 - segna-presenza.md](13%20-%20segna-presenza.md), con avviso e
  azzeramento del pasto); questo controllo copre ciò che sfugge (es.
  l'assistente, che non vede i pasti, o dati preesistenti). Non è
  applicato come trigger sul database: solo lato app (pagina e azione).
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
- Chiunque abbia accesso ai pasti (qualunque maestra, non solo quelle
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
- Sia il blocco sui pasti sia l'inserimento della comunicazione (incluso
  il controllo sulle presenze mancanti) sono applicati anche a livello
  di database (trigger su `pasti`, vincolo di unicità e trigger su
  `pasti_comunicati`), non solo in UI — stesso principio già in uso per
  le altre regole pasti (vedi
  `supabase/migrations/0012_pasto_senza_parziale.sql`,
  `0017_pasto_blocca_anche_malattia.sql`).
- **Blocco di Assente/Malattia dopo la comunicazione**: da quando esiste
  la comunicazione di una data, maestra e assistente non possono più far
  passare a "assente" o "malattia" la presenza di un bambino che ha il
  pasto di quella data segnato "sì". Vale per un bambino senza ancora
  una presenza e per uno "presente" (con o senza pre/post-asilo); non
  riguarda chi è già "assente"/"malattia" (può ancora salvare la nota o
  passare dall'uno all'altro: non cambia il conteggio dei pasti), né chi
  ha il pasto "no" o non segnato. Presente, Pre-asilo, Post-asilo e la
  nota di presenza restano sempre consentiti. L'admin è esentato (può
  comunque correggere prima il pasto e poi la presenza, quindi
  bloccarlo non servirebbe). Il pasto considerato è quello **attuale**
  del bambino per quella data (che dopo la comunicazione solo l'admin
  può cambiare), non una fotografia al momento della comunicazione.
- Il blocco di Assente/Malattia è applicato anche a livello di database
  (trigger su `presenze`, vedi
  `supabase/migrations/0052_presenza_blocca_assenza_se_pasto_comunicato.sql`),
  non solo in UI: vale anche forzando la richiesta senza passare dai
  pulsanti. Se il database rifiuta la modifica, l'app mostra un
  messaggio comprensibile ("il pasto di questo bambino è già stato
  comunicato a Rojac…"), non l'errore grezzo.
- Per l'assistente la schermata non legge i pasti (vedi
  [10 - presenze-e-pasti.md](10%20-%20presenze-e-pasti.md)), quindi non
  può sapere in anticipo quali bambini sono bloccati: i suoi pulsanti
  Assente/Malattia restano visibili e, se il bambino ha il pasto
  comunicato, è il database a rifiutare la modifica, con lo stesso
  messaggio comprensibile.
- Il trigger scatta **dopo** i controlli RLS (trigger `AFTER`): valuta
  solo modifiche che chi scrive è già autorizzato a fare (bambini della
  propria sezione, data scrivibile). Un tentativo su un bambino di
  un'altra sezione o su una data non scrivibile riceve sempre il solito
  rifiuto RLS, qualunque sia il pasto: il blocco non rivela nulla su
  bambini o date fuori dal proprio perimetro.
- **Limiti noti, accettati consapevolmente** (review di sicurezza di
  #101):
  - *Informazione dedotta dal rifiuto*: una maestra o un'assistente che
    prova a segnare Assente/Malattia su un bambino della propria
    sezione, oggi, e riceve il rifiuto, ne deduce che quel bambino ha il
    pasto "sì" già comunicato. Per l'assistente è un'informazione sul
    pasto a cui altrimenti non avrebbe accesso
    ([03 - utenti-e-ruoli.md](03%20-%20utenti-e-ruoli.md)): è la
    conseguenza diretta di questo requisito (il database deve rifiutare
    e l'app deve spiegare perché), limitata ai bambini che può già
    modificare.
  - *Concorrenza*: se una maestra segna Assente nello stesso istante in
    cui un'altra conferma i pasti, il controllo può non vedere ancora la
    comunicazione in corso (finestra di pochi millisecondi) e il bambino
    risulta assente pur essendo contato nel totale comunicato. L'impatto
    è solo contabile (resta visibile col warning di
    [06 - controllo-consistenza.md](06%20-%20controllo-consistenza.md)
    e si gestisce nel confronto con la fattura): chiuderlo del tutto
    richiederebbe un lock sulla data in entrambe le operazioni, non
    giustificato oggi.
  - *Pasto corrente, non fotografia*: il blocco guarda il pasto
    **attuale** del bambino, non quello al momento della comunicazione
    (vedi sopra). Nel caso peggiore (l'admin porta un pasto a "sì" dopo
    la comunicazione) un bambino non incluso nel totale resta bloccato
    per maestra/assistente: fail-closed, corregge l'admin.
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
