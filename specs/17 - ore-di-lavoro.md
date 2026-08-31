# 17 — Ore di lavoro

## Attori
Personale retribuito (maestra, assistente o admin) abilitato dall'admin.

## Obiettivo
Introdurre, in modo progressivo, la possibilità per il personale
retribuito di registrare le ore di lavoro effettuate o le assenze. In
questa prima fase si abilita solo l'accesso alla sezione, utente per
utente, deciso dall'admin: **come** le ore vengono effettivamente
segnate (form, calcolo del totale, riepiloghi, export) è fuori scope,
sarà definito in una fase successiva.

## Scenario: l'admin abilita un utente al report ore in fase di creazione
Dato che sono autenticato come admin
Quando su `/admin/maestre` creo un nuovo utente e spunto "Abilita al
report ore di lavoro", poi confermo
Allora l'utente viene creato con l'abilitazione già attiva

## Scenario: l'admin abilita o disabilita il report ore modificando un utente esistente
Dato che un utente esiste già
Quando su `/admin/maestre` spunto o tolgo la spunta "Ore di lavoro" per
quell'utente e premo "Aggiorna"
Allora l'abilitazione è aggiornata e resta visibile (spuntata o meno)
riaprendo la pagina

## Scenario: un utente abilitato vede la sezione "Ore di lavoro" in dashboard
Dato che sono autenticata come maestra, assistente o admin e il mio
profilo è abilitato al report ore
Quando apro la dashboard
Allora vedo, insieme a Presenze/Pasti/Report, anche il pulsante/scheda
"Ore di lavoro" con la sua icona (🕒)
E tappandolo apro la sezione dedicata (`/dashboard/ore-lavoro`)

## Scenario: un utente non abilitato non vede la sezione
Dato che sono autenticata come maestra, assistente o admin e il mio
profilo NON è abilitato al report ore
Quando apro la dashboard
Allora non vedo il pulsante/scheda "Ore di lavoro"
E se provo ad aprire direttamente `/dashboard/ore-lavoro`, vengo
reindirizzata alla dashboard invece di vedere il contenuto della sezione

## Scenario: contenuto della sezione in questa fase
Dato che sono abilitata al report ore e apro `/dashboard/ore-lavoro`
Allora vedo un messaggio che spiega che la registrazione vera e propria
(ore lavorate o assenze) sarà disponibile in una fase successiva
E non vedo alcuna form per inserire dati: questa fase abilita solo
l'accesso alla sezione, non la sua funzione

## Regole
- Nuovo campo `profili.abilitato_ore_lavoro` (booleano, default falso):
  decide da solo la visibilità della sezione e l'accesso alla pagina,
  indipendentemente dal ruolo — anche l'admin non la vede finché non
  abilita anche il proprio profilo, esattamente come per qualunque altro
  utente (nessun bypass per il ruolo `admin`).
- Solo l'admin può modificare questo campo, dallo stesso form di
  creazione/modifica utente di
  [03 - utenti-e-ruoli.md](03%20-%20utenti-e-ruoli.md) — non è
  disponibile altrove.
- La dashboard (vedi [12 - dashboard-maestre.md](12%20-%20dashboard-maestre.md))
  ridistribuisce le card/pulsanti (Presenze, Pasti, Report, Ore di
  lavoro) in un'unica griglia bilanciata a due colonne: quali card
  compaiono dipende da ruolo/sezioni assegnate/abilitazione (come già
  oggi per Presenze/Pasti), ma la disposizione è sempre quella — quando
  il numero di card visibili è dispari, l'ultima occupa l'intera
  larghezza invece di lasciare un buco vuoto in griglia.
- Fuori scope in questa fase: come le ore vengono effettivamente
  registrate (form di inserimento, calcolo ore/assenze, riepiloghi,
  export, eventuali approvazioni) — qui si abilita solo l'accesso al
  punto d'ingresso della sezione.
- L'admin può anche definire un "orario tipo" settimanale (ore previste
  per giorno) e assegnarlo a ciascuna persona, indipendentemente
  dall'abilitazione descritta qui — vedi
  [54 - profili-orari.md](54%20-%20profili-orari.md).
