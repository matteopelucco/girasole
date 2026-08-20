# 12 — Dashboard maestra

## Attori
Maestra, admin. (Genitore: fuori scope in questa fase.)

## Obiettivo
Un'unica schermata dove la maestra vede e aggiorna lo stato del giorno dei
bambini delle sue sezioni, e dove admin e maestra pubblicano promemoria.

## Scenario: la maestra apre la dashboard
Dato che sono autenticata come maestra e ho almeno una sezione assegnata
Quando apro la dashboard
Allora vedo l'elenco dei bambini delle mie sezioni, ciascuno con lo stato
di presenza e di pasto di oggi, se già segnati (dettagli in
[13 - segna-presenza.md](13%20-%20segna-presenza.md) e
[14 - segna-pasto.md](14%20-%20segna-pasto.md))

## Scenario: la maestra non ha sezioni assegnate
Dato che sono autenticata come maestra ma non ho ancora nessuna sezione
Quando apro la dashboard
Allora vedo un messaggio che mi invita a chiedere all'admin di assegnarmi
una sezione, e nessun elenco bambini

## Scenario: l'admin apre la dashboard
Dato che sono autenticato come admin
Quando apro la dashboard
Allora vedo un rimando alle pagine di amministrazione (`/admin` e
`/admin/maestre`) invece dell'elenco bambini di una singola sezione
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
  altro), non dal solo fatto di essere autenticati.
- Priorità a interfaccia rapida, pochi tap, testo leggibile: le maestre
  useranno l'app prevalentemente da smartphone, opzionalmente da tablet e
  desktop in sezione.
