# 12 — Dashboard maestra/admin

## Attori
Maestra, assistente, admin. (Genitore: fuori scope in questa fase.)

## Obiettivo
Un punto d'ingresso unico da cui maestra e admin scelgono una data e
raggiungono le due attività quotidiane — Presenze e Pasti — e da cui
pubblicano promemoria.

## Scenario: aprire la dashboard mostra il calendario e le due attività
Dato che sono autenticata come maestra (con almeno una sezione assegnata)
o come admin
Quando apro la dashboard
Allora vedo un selettore di data con selezionata la data odierna
E vedo due pulsanti/schede "Presenze" e "Pasti"

## Scenario: da Presenze si arriva alle classi e poi ai bambini
Dato che sono sulla dashboard con una data selezionata
Quando tappo su "Presenze"
Allora vedo l'elenco delle classi attive a cui sono assegnata (tutte le
classi attive se sono admin), per la data selezionata
E selezionando una classe vedo l'elenco dei bambini di quella classe, per
consultare/segnare la presenza di ciascuno (dettagli in
[13 - segna-presenza.md](13%20-%20segna-presenza.md))

## Scenario: da Pasti si arriva alle classi e poi ai bambini
Dato che sono sulla dashboard con una data selezionata
Quando tappo su "Pasti"
Allora vedo lo stesso elenco di classi, per la data selezionata
E selezionando una classe vedo l'elenco dei bambini di quella classe, per
consultare/segnare il pasto di ciascuno (dettagli in
[14 - segna-pasto.md](14%20-%20segna-pasto.md))

## Scenario: l'assistente apre la dashboard
Dato che sono autenticata come assistente (con almeno una sezione
assegnata)
Quando apro la dashboard
Allora vedo il selettore di data e il pulsante/scheda "Presenze", con lo
stesso comportamento di una maestra (vedi
[13 - segna-presenza.md](13%20-%20segna-presenza.md))
E NON vedo il pulsante/scheda "Pasti": il registro pasti non è
accessibile al ruolo assistente (vedi
[14 - segna-pasto.md](14%20-%20segna-pasto.md))
E vedo comunque la sezione promemoria, con la possibilità di crearne uno
per le sezioni a cui sono assegnata o per i loro bambini

## Scenario: la maestra non ha sezioni assegnate
Dato che sono autenticata come maestra o assistente ma non ho ancora
nessuna sezione
Quando apro la dashboard
Allora vedo un messaggio che mi invita a chiedere all'admin di assegnarmi
una sezione, e non vedo i pulsanti Presenze/Pasti (né Presenze soltanto,
per l'assistente)

## Scenario: l'admin apre la dashboard
Dato che sono autenticato come admin
Quando apro la dashboard
Allora vedo, oltre al calendario e a Presenze/Pasti, anche un rimando alle
pagine di amministrazione (`/admin` e `/admin/maestre`)
E vedo comunque la sezione promemoria, con la possibilità di crearne uno
per qualsiasi sezione o bambino

## Scenario: un genitore apre la dashboard
Dato che il mio profilo ha ruolo `genitore` (o nessun ruolo riconosciuto)
Quando apro la dashboard
Allora vedo un messaggio che il portale genitori è in arrivo in una fase
successiva, e nessun dato di altri bambini

## Regole
- L'accesso a `/dashboard` richiede autenticazione (vedi
  [11 - login.md](11%20-%20login.md)).
- Il contenuto mostrato dipende dal ruolo del profilo (`admin`, `maestra`,
  `assistente`, altro), non dal solo fatto di essere autenticati.
- Il selettore di data permette di consultare presenze/pasti di qualunque
  data passata o futura; se e quando quei dati sono modificabili dipende
  dal ruolo e dalla data (vedi le Regole in
  [13 - segna-presenza.md](13%20-%20segna-presenza.md) e
  [14 - segna-pasto.md](14%20-%20segna-pasto.md)).
- Priorità a interfaccia rapida, pochi tap, testo leggibile: le maestre
  useranno l'app prevalentemente da smartphone, opzionalmente da tablet e
  desktop in sezione — vedi [01 - ux.md](01%20-%20ux.md).
