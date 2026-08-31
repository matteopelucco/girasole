# 18 — Report ore di lavoro

## Attori
Personale retribuito (maestra, assistente o admin) abilitato al report
ore (vedi [17 - ore-di-lavoro.md](17%20-%20ore-di-lavoro.md)).

## Obiettivo
Dare al personale abilitato un modo per registrare, settimana per
settimana, le ore di lavoro effettuate — ordinarie e straordinarie — o
un giorno di malattia/assenza, e per confermare la settimana una volta
verificata, così da renderla stabile (non più modificabile in autonomia).
Questo requisito estende
[17 - ore-di-lavoro.md](17%20-%20ore-di-lavoro.md), che finora abilitava
solo l'accesso a una sezione placeholder: da qui in poi
`/dashboard/ore-lavoro` mostra il contenuto vero e proprio.

## Scenario: aprire la sezione mostra la settimana corrente con le ore precaricate
Dato che sono autenticata come personale abilitato al report ore, con un
profilo orario assegnato (vedi
[54 - profili-orari.md](54%20-%20profili-orari.md))
Quando apro "Ore di lavoro"
Allora vedo una tabella con una riga per ciascun giorno feriale
(lunedì-venerdì) della settimana corrente
E per ogni giorno il campo "Ore ordinarie" è precompilato con le ore
previste dal mio profilo orario per quel giorno della settimana
E vedo anche un campo "Ore straordinarie", a 0 di default

## Scenario: senza profilo orario assegnato le ore ordinarie partono da zero
Dato che sono abilitata al report ore ma non ho un profilo orario
assegnato
Quando apro "Ore di lavoro"
Allora il campo "Ore ordinarie" di ogni giorno parte da 0, comunque
modificabile a mano

## Scenario: salvare le ore della settimana
Quando modifico le ore di uno o più giorni e premo "Salva modifiche"
Allora i valori inseriti sono salvati e restano tali riaprendo la pagina
E vedo il totale delle ore della settimana (ordinarie + straordinarie)
aggiornato di conseguenza

## Scenario: le ore straordinarie richiedono un motivo
Quando per un giorno inserisco delle ore straordinarie senza indicarne
il motivo, e premo "Salva modifiche"
Allora vedo un messaggio d'errore che richiede il motivo
E nessuna modifica di quel salvataggio viene registrata

## Scenario: segnare un giorno di malattia
Quando per un giorno scelgo lo stato "Malattia" e indico il codice
malattia ricevuto dal medico, e premo "Salva modifiche"
Allora quel giorno risulta segnato come malattia con il codice indicato,
senza ore ordinarie né straordinarie

## Scenario: la malattia richiede il codice
Quando per un giorno scelgo lo stato "Malattia" senza indicare il
codice, e premo "Salva modifiche"
Allora vedo un messaggio d'errore che richiede il codice malattia
E nessuna modifica di quel salvataggio viene registrata

## Scenario: segnare un giorno di assenza
Quando per un giorno scelgo lo stato "Assenza" e indico una nota
giustificativa, e premo "Salva modifiche"
Allora quel giorno risulta segnato come assenza con la nota indicata,
senza ore ordinarie né straordinarie

## Scenario: l'assenza richiede una nota giustificativa
Quando per un giorno scelgo lo stato "Assenza" senza indicare una nota,
e premo "Salva modifiche"
Allora vedo un messaggio d'errore che richiede la nota
E nessuna modifica di quel salvataggio viene registrata

## Scenario: confermare la settimana
Quando, dopo aver verificato le ore, premo "Conferma settimana" e
confermo l'azione
Allora la settimana risulta confermata, con la data/ora della conferma
mostrate a schermo
E ogni giorno non ancora salvato esplicitamente viene comunque
registrato, con le ore precaricate dal profilo orario (o 0 se nessun
profilo è assegnato)

## Scenario: una settimana confermata non è più modificabile dal personale
Dato che la settimana corrente è già stata confermata
Quando apro "Ore di lavoro"
Allora vedo i dati della settimana in sola lettura (nessun campo
modificabile, nessun pulsante "Salva modifiche" o "Conferma settimana")

## Scenario: un giorno di chiusura scolastica non è modificabile
Dato che un giorno della settimana corrente è un giorno di chiusura
scolastica (weekend, o un intervallo registrato dall'admin — vedi
[53 - calendario-scolastico.md](53%20-%20calendario-scolastico.md))
Quando apro "Ore di lavoro"
Allora quel giorno mostra l'informazione di chiusura, senza alcun campo
da compilare

## Scenario: accesso negato senza abilitazione
Dato che il mio profilo non è abilitato al report ore
Quando provo ad aprire `/dashboard/ore-lavoro`
Allora vengo reindirizzata alla dashboard (vedi
[17 - ore-di-lavoro.md](17%20-%20ore-di-lavoro.md))

## Regole
- Solo i giorni feriali (lunedì-venerdì) della settimana corrente sono
  mostrati: sabato e domenica sono chiusura implicita
  (specs/53), coerente con i profili orari (specs/54) che non prevedono
  ore in quei due giorni.
- Un giorno è in uno di tre stati, esclusivi: **lavorativo** (ore
  ordinarie/straordinarie), **malattia** (richiede il codice ricevuto
  dal medico) o **assenza** (richiede una nota giustificativa). Passare
  a malattia o assenza azzera le ore ordinarie/straordinarie di quel
  giorno; passare a lavorativo azzera codice malattia/nota assenza.
- Le ore ordinarie di un giorno sono precaricate dal profilo orario
  assegnato all'utente (campo del giorno della settimana corrispondente,
  specs/54), ma restano modificabili prima della conferma: il personale
  "verifica" il precaricato, non lo subisce.
- Le ore straordinarie concorrono al calcolo del monte ore del
  personale: qui si registra solo il dato (ore + motivo), il calcolo e
  la presentazione di un monte ore aggregato sono fuori scope (vedi
  sotto).
- La settimana è "confermata" quando esiste una riga corrispondente
  nella tabella `ore_lavoro_settimane` (stesso pattern di
  `report_giornalieri_inviati`/`report_periodici_inviati`, specs/52:
  l'esistenza della riga è la conferma, non un flag booleano separato
  da tenere sincronizzato). Una volta confermata, il personale non può
  più modificare i giorni di quella settimana (RLS in
  `supabase/migrations/0025_report_ore_lavoro.sql`); l'admin sì, sempre
  — anche se non c'è ancora un'interfaccia per farlo (vedi Fuori scope).
- Il blocco di un giorno di chiusura scolastica vale per QUALUNQUE ruolo,
  admin incluso — stesso principio già in vigore per presenze e pasti
  (specs/53): un asilo chiuso non ha ore di lavoro da registrare per
  nessuno, non è un permesso di scrittura ma un vincolo di coerenza dei
  dati. Imposto anche con un trigger sul database, non solo in UI.
- Nessuna scrittura silenziosa: un salvataggio che fallisce la
  validazione (motivo/codice/nota mancante) non salva nessuno dei giorni
  di quel submit, nemmeno quelli validi — il personale corregge il
  giorno segnalato e reinvia (stesso pattern "errore ⇒ dati preservati"
  di specs/05 - feedback.md, i campi già compilati restano tali).

## Fuori scope in questa fase
- Un'interfaccia dedicata per l'admin per rivedere/correggere le
  settimane (confermate o no) di un altro utente: i permessi RLS sono
  già pronti (l'admin può leggere/scrivere qualunque riga), ma non c'è
  ancora una pagina che lo consenta. Nel frattempo l'admin può
  intervenire dal SQL Editor di Supabase se necessario.
- Il calcolo effettivo di un monte ore/straordinari a partire dai dati
  registrati, ed eventuali riepiloghi o export.
- Navigazione tra settimane passate o future: si vede sempre e solo la
  settimana corrente.
- "Riaprire" una settimana già confermata (renderla di nuovo
  modificabile dal personale): nessuna azione la offre in questa fase.
