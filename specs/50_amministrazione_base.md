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
Quando su `/admin` compilo nome, cognome, scelgo una sezione e
(opzionalmente) delle note allergie/intolleranze, e confermo
Allora il bambino compare nell'elenco bambini della sezione scelta
E se ha note allergie, sono mostrate in evidenza accanto al suo nome
(vedi anche [14 - segna-pasto.md](14%20-%20segna-pasto.md))

## Scenario: promuovere un utente a maestra
Dato che un utente si è già registrato (ha un profilo con ruolo
`genitore` di default)
Quando su `/admin/maestre` lo trovo nell'elenco utenti, seleziono ruolo
"Maestra" e confermo
Allora il suo ruolo diventa `maestra` e può accedere alla dashboard
maestra dopo aver effettuato il login

## Scenario: assegnare una maestra a una sezione
Dato che un utente ha ruolo `maestra`
Quando su `/admin/maestre` scelgo la maestra e la sezione, e confermo
Allora quella maestra vede i bambini di quella sezione nella propria
dashboard (vedi [13 - segna-presenza.md](13%20-%20segna-presenza.md))

## Scenario: rimuovere l'assegnazione di una maestra a una sezione
Quando su `/admin/maestre` premo la ✕ su una sezione già assegnata a una
maestra
Allora l'assegnazione viene rimossa e quella maestra non vede più i
bambini di quella sezione

## Regole
- Solo un profilo con ruolo `admin` può creare sezioni/bambini, cambiare
  il ruolo di un profilo, o assegnare/rimuovere maestre dalle sezioni
  (RLS in `supabase/migrations/0002_admin_e_maestre.sql`).
- Non esiste (in questa fase) un modo per creare un nuovo utente da
  `/admin`: gli utenti nascono da un login/registrazione su Supabase
  Auth. L'admin gestisce solo il ruolo e le assegnazioni di chi esiste
  già.
- Il primissimo admin va promosso a mano via SQL Editor (vedi
  [11 - login.md](11%20-%20login.md)).
