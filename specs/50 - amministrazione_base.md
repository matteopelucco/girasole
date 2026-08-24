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

## Scenario: creare un bambino
Quando su `/admin` compilo nome, cognome, data di nascita, sesso,
(opzionalmente) una sezione e delle note allergie/intolleranze, e
confermo
Allora il bambino compare nell'elenco bambini della sezione scelta (o
nell'elenco "senza sezione", se non ne ho scelta una)
E se ha note allergie, sono mostrate in evidenza accanto al suo nome
(vedi anche [14 - segna-pasto.md](14%20-%20segna-pasto.md))

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
una maestra anche in Pasti, un'assistente solo in Presenze (vedi
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
  (email, password, nome, cognome, telefono, ruolo) — non serve più il
  dashboard di Supabase Auth. Vedi
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
