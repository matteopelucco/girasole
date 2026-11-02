# 50 — Amministrazione base

## Attori
Admin.

## Obiettivo
Dare all'admin gli strumenti minimi per il bootstrap e la gestione
ordinaria: creare sezioni e bambini, e assegnare le maestre alle sezioni.

## Scenario: creare una sezione
Dato che sono autenticato come admin
Quando su `/admin` inserisco un nome sezione (es. "Girasoli") e confermo
Allora la sezione compare nell'elenco sezioni, subito disponibile per
assegnare bambini e maestre

## Scenario: creare una sezione scegliendo il tipo
**ID AMM-01**
Dato che sono autenticato come admin
Quando su `/admin` inserisco un nome sezione e scelgo nel campo "Tipo"
una delle opzioni "Materna" o "Primavera" (oltre a "Nessuno", valore
iniziale), e confermo
Allora la sezione compare nell'elenco con il suo tipo accanto al nome
(nessuna indicazione se il tipo è "Nessuno")
E il tipo è facoltativo: una sezione senza tipo si crea comunque

## Scenario: modificare il tipo di una sezione
**ID AMM-02**
Dato che esiste una sezione (anche senza tipo, come le sezioni create prima
di questa funzione)
Quando come admin ne modifico il tipo (Materna, Primavera o Nessuno) e
confermo
Allora l'elenco sezioni mostra il tipo nuovo
E i bambini già presenti nella sezione, con o senza costi, non vengono
modificati (la retta dei bambini con costi salvati resta com'è: COS-03 in
specs/55)
E il tipo vale da quel momento per i bambini creati dopo in quella sezione
e per la retta proposta ai bambini che non hanno ancora i costi salvati

## Scenario: creare un bambino
Quando su `/admin` compilo nome, cognome, data di nascita, sesso,
(opzionalmente) una sezione e delle note allergie/intolleranze, e
confermo
Allora il bambino compare nell'elenco bambini della sezione scelta (o
nell'elenco "senza sezione", se non ne ho scelta una)
E se ha note allergie, sono mostrate in evidenza accanto al suo nome
(vedi anche [14 - segna-pasto.md](14%20-%20segna-pasto.md))

## Scenario: creare un bambino in una sezione con tipo: i costi nascono subito
**ID AMM-03**
Dato che in "Parametri di funzionamento > Prezzi" (specs/62) sono
impostati i prezzi e che la sezione "Girasoli" ha tipo Materna o Primavera
Quando l'admin crea un bambino scegliendo la sezione "Girasoli"
Allora il bambino e la sua riga di costi vengono creati insieme, in
un'unica operazione
E la riga di costi contiene la retta del tipo della sezione, il buono pasto,
la marca da bollo e i prezzi dell'abbonamento pre-asilo e post-asilo
dei "Prezzi"; pre-asilo e post-asilo non sono richiesti; i gettoni non
vengono copiati (PRZ-07)
E aprendo la scheda del bambino, la sezione "Costi" mostra già questi valori
come salvati

## Scenario: creare un bambino senza sezione o in una sezione senza tipo
**ID AMM-04**
Dato che l'admin crea un bambino senza scegliere una sezione, oppure in una
sezione senza tipo
Quando conferma
Allora il bambino viene creato senza nessuna riga di costi
E nella sua scheda i costi sono solo proposti (COS-02), non salvati
E non compare nessun errore: la creazione riesce come oggi

## Scenario: se i costi iniziali non si possono scrivere, il bambino non viene creato
**ID AMM-05**
Dato che l'admin crea un bambino in una sezione con tipo
Quando la scrittura dei costi iniziali fallisce (es. errore del database)
Allora non viene creato neanche il bambino e l'admin vede un messaggio
d'errore; riprovando non restano bambini doppi o bambini senza costi
E il form mantiene i dati inseriti

## Scenario: spostare un bambino in un'altra sezione non tocca i suoi costi
**ID AMM-06**
Dato che un bambino ha già la riga di costi
Quando l'admin lo sposta in un'altra sezione (da scheda o con "Assegna")
Allora i suoi costi restano identici (COS-03)
E se non aveva la riga di costi, nemmeno l'assegnazione la crea: la scheda
propone la retta del tipo della nuova sezione (COS-04)

## Scenario: vedere le classi con i bambini assegnati
Dato che sono autenticato come admin
Quando apro `/admin`
Allora vedo l'elenco di tutte le sezioni, ciascuna con l'elenco dei
bambini attivi assegnati
E vedo anche un elenco separato dei bambini senza sezione o disattivati
E da ogni bambino elencato (in entrambi gli elenchi) posso aprire la sua
scheda di dettaglio

## Scenario: assegnare rapidamente una sezione a un bambino senza classe
Dato che un bambino non ha ancora una sezione, oppure è disattivato
Quando dall'elenco "senza sezione o disattivati" scelgo una sezione e
premo "Assegna"
Allora il bambino viene assegnato a quella sezione (e riattivato, se era
disattivato) e compare da quel momento nell'elenco di quella sezione

## Scenario: modificare i dati di un bambino
Dato che apro la scheda di dettaglio di un bambino
Quando trovo un form con tutti i suoi dati pre-caricati, modifico uno o
più campi (nome, cognome, data di nascita, sesso, sezione, note
allergie, altre note) e confermo
Allora i nuovi dati sono salvati e restano visibili riaprendo la scheda

## Scenario: disattivare e riattivare un bambino
Dato che sono sulla scheda di dettaglio di un bambino attivo
Quando premo "Disattiva bambino"
Allora il bambino resta con tutti i suoi dati salvati (presenze, pasti e
avvisi passati restano collegati a lui)
E non compare più nell'elenco bambini della sua sezione, né nelle
funzioni Presenze e Pasto (vedi
[13 - segna-presenza.md](13%20-%20segna-presenza.md),
[14 - segna-pasto.md](14%20-%20segna-pasto.md))
E premendo "Riattiva bambino" torna a comparire nella sua sezione (se ne
ha ancora una) e nelle funzioni Presenze e Pasto

## Scenario: promuovere un utente a maestra o assistente
Dato che un utente esiste già (creato dall'admin con un altro ruolo,
vedi [03 - utenti-e-ruoli.md](03%20-%20utenti-e-ruoli.md))
Quando su `/admin/maestre` lo trovo nell'elenco utenti, seleziono ruolo
"Maestra" (o "Assistente") e confermo
Allora il suo ruolo diventa `maestra` (o `assistente`) e può accedere
alla dashboard dopo aver effettuato il login, con le funzioni previste
per quel ruolo (vedi [03 - utenti-e-ruoli.md](03%20-%20utenti-e-ruoli.md))

## Scenario: assegnare una maestra o un'assistente a una sezione
Dato che un utente ha ruolo `maestra` o `assistente`
Quando su `/admin/maestre` scelgo l'utente e la sezione, e confermo
Allora quell'utente vede i bambini di quella sezione nella propria
dashboard (vedi [13 - segna-presenza.md](13%20-%20segna-presenza.md)) —
una maestra con presenze e pasti, un'assistente solo con le presenze (vedi
[14 - segna-pasto.md](14%20-%20segna-pasto.md))

## Scenario: rimuovere l'assegnazione di una maestra o assistente a una sezione
Quando su `/admin/maestre` premo la ✕ su una sezione già assegnata a una
maestra o a un'assistente
Allora l'assegnazione viene rimossa e quell'utente non vede più i
bambini di quella sezione

## Regole
- Solo un profilo con ruolo `admin` può creare sezioni/bambini, cambiare
  il ruolo di un profilo, o assegnare/rimuovere maestre e assistenti
  dalle sezioni (RLS in `supabase/migrations/0002_admin_e_maestre.sql`,
  tabella `maestre_sezioni` usata per entrambi i ruoli — il nome della
  tabella non è stato cambiato per non introdurre una rinomina ad ampio
  raggio, vedi [04 - data-types.md](04%20-%20data-types.md)).
- L'admin crea/modifica/elimina utenti direttamente da `/admin/maestre`
  (email, password, nome, cognome, telefono, ruolo) e può anche
  impostare una nuova password per un utente già esistente — non serve
  più il dashboard di Supabase Auth. Vedi
  [03 - utenti-e-ruoli.md](03%20-%20utenti-e-ruoli.md) per i dettagli e
  gli scenari.
- Il primissimo admin va promosso a mano via SQL Editor (vedi
  [11 - login.md](11%20-%20login.md)): è l'unico caso residuo che
  richiede un intervento fuori dall'app, perché per creare un utente
  dall'app serve già essere autenticati come admin.
- Un bambino ha un flag `attiva` (default vero, `bambini.attiva` —
  `supabase/migrations/0011_bambino_attivo.sql`): disattivarlo non
  cancella nessun dato, filtra solo la sua visibilità nell'elenco della
  classe e nelle funzioni Presenze/Pasto (stesso pattern già usato per
  `sezioni.attiva`, filtro applicato lato applicazione).
- La sezione è facoltativa alla creazione di un bambino: un bambino
  senza sezione (`sezione_id` nullo) compare nell'elenco "senza sezione
  o disattivati" finché non gli viene assegnata una classe.
- Una sezione ha un campo "Tipo" facoltativo (Materna, Primavera o
  nessuno), colonna `sezioni.tipo` (issue #396). Le sezioni esistenti
  partono senza tipo; l'allarme che le segnala è in #397. Il tipo serve
  solo a scegliere la retta predefinita per i bambini nuovi (AMM-03) e
  quella proposta nella scheda Costi (COS-02, COS-04).
- Creazione bambino + riga di costi iniziali sono atomiche (AMM-05). I
  prezzi copiati vengono dalla sezione "Prezzi" di specs/62; la regola di
  copia completa è in specs/55.
