# 18 — Report ore di lavoro

## Attori
Personale retribuito (maestra, assistente o admin) abilitato al report
ore (vedi [17 - ore-di-lavoro.md](17%20-%20ore-di-lavoro.md)). In più,
l'admin può rivedere e correggere le ore di **chiunque** sia abilitato,
indipendentemente dalla propria abilitazione personale (vedi la sezione
"Amministrazione" più sotto).

## Obiettivo
Dare al personale abilitato un modo per registrare, settimana per
settimana, le ore di lavoro effettuate — ordinarie e straordinarie — o
un giorno di malattia/assenza, e per confermare la settimana una volta
verificata, così da renderla stabile (non più modificabile in autonomia).
Il personale può anche navigare tra le settimane passate, per
rivedere le ore già inserite o per confermare una settimana dimenticata
(vedi [07 - allarmi.md](07%20-%20allarmi.md), che segnala proprio questo
caso) — non è invece mai possibile inserire ore per una settimana
futura. Questo requisito estende
[17 - ore-di-lavoro.md](17%20-%20ore-di-lavoro.md), che finora abilitava
solo l'accesso a una sezione placeholder: da qui in poi
`/dashboard/ore-lavoro` mostra il contenuto vero e proprio.

## Scenario: aprire la sezione mostra la settimana corrente con le ore precaricate
Dato che sono autenticata come personale abilitato al report ore, con un
profilo orario assegnato (vedi
[54 - profili-orari.md](54%20-%20profili-orari.md))
Quando apro "Ore di lavoro"
Allora vedo una tabella con una riga per ciascun giorno della settimana
corrente, da lunedì a domenica
E per i giorni lunedì-venerdì il campo "Ore ordinarie" è precompilato
con le ore previste dal mio profilo orario per quel giorno della
settimana; per sabato e domenica (non previsti dal profilo, vedi
specs/54) parte da 0
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

## Scenario: salvare le ore anche a metà settimana
Dato che sono sulla settimana corrente e oggi non è l'ultimo giorno
della settimana (alcuni giorni successivi non sono ancora accaduti)
Quando modifico le ore di un giorno già trascorso e premo "Salva
modifiche"
Allora il salvataggio va a buon fine — il form invia sempre tutti e 7 i
giorni della settimana in un solo salvataggio, e i giorni non ancora
accaduti (con i loro valori precaricati/di default) non fanno fallire
il salvataggio: il vincolo di "mai una settimana futura" riguarda la
settimana nel suo complesso, non i singoli giorni non ancora accaduti
dentro una settimana comunque ammessa

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

## Scenario: il personale può registrare ore anche nei giorni di chiusura scolastica
Dato che un giorno della settimana corrente è un giorno di chiusura
scolastica (weekend, o un intervallo registrato dall'admin — vedi
[53 - calendario-scolastico.md](53%20-%20calendario-scolastico.md))
Quando apro "Ore di lavoro"
Allora quel giorno mostra comunque un'informazione di chiusura, ma resta
pienamente modificabile: posso registrare ore ordinarie/straordinarie o
malattia/assenza esattamente come per un giorno normale — il personale
può lavorare (es. pulizie, attività amministrative, formazione) anche
quando l'asilo non è operativo

## Scenario: navigare a una settimana passata
Dato che sono su "Ore di lavoro" (settimana corrente)
Quando premo "←" (settimana precedente)
Allora vedo la stessa tabella calcolata su quella settimana, con le ore
già eventualmente salvate, oppure precaricate dal profilo orario se non
ho ancora salvato nulla per quella settimana
E posso continuare a premere "←" per risalire a settimane sempre più
lontane, senza limiti

## Scenario: tornare verso la settimana corrente
Dato che sto guardando una settimana passata
Quando premo "→" (settimana successiva)
Allora vedo la settimana immediatamente successiva, fino a tornare alla
settimana corrente

## Scenario: non è possibile navigare oltre la settimana corrente
Dato che sto guardando la settimana corrente
Quando guardo i controlli di navigazione
Allora non vedo alcun pulsante "→": non c'è modo di raggiungere una
settimana futura dall'interfaccia
E se apro comunque direttamente un indirizzo che punta a una settimana
futura, vedo la settimana corrente al suo posto (nessun errore, nessuna
settimana futura mostrata)

## Scenario: modificare o confermare una settimana passata non ancora confermata
Dato che sto guardando una settimana passata che non ho ancora
confermato
Quando modifico le ore di un giorno e premo "Salva modifiche", oppure
premo "Conferma settimana"
Allora il comportamento è identico a quello della settimana corrente:
stesse validazioni, stesso salvataggio, stessa conferma con data/ora
mostrate a schermo

## Scenario: una settimana passata già confermata resta di sola lettura
Dato che sto guardando una settimana passata già confermata
Quando apro "Ore di lavoro" su quella settimana
Allora vedo i dati in sola lettura, esattamente come per la settimana
corrente quando è confermata

## Scenario: accesso negato senza abilitazione
Dato che il mio profilo non è abilitato al report ore
Quando provo ad aprire `/dashboard/ore-lavoro`
Allora vengo reindirizzata alla dashboard (vedi
[17 - ore-di-lavoro.md](17%20-%20ore-di-lavoro.md))

## Amministrazione: l'admin rivede e corregge le ore di chiunque

## Scenario: l'admin apre l'elenco del personale abilitato al report ore
Dato che sono autenticato come admin
Quando apro `/admin/ore-lavoro`
Allora vedo un elenco di tutto il personale abilitato al report ore
(tranne me stesso), con nome, cognome e se la settimana corrente
risulta già confermata o no
E ciascuna riga porta alle ore di quella persona

## Scenario: l'admin apre le ore di un dipendente
Dato che sono autenticato come admin
E su `/admin/ore-lavoro` tocco una persona abilitata
Quando arrivo su "Ore di lavoro"
Allora vedo la stessa identica schermata che vedrebbe quella persona
per la settimana corrente (tabella dei 7 giorni, ore precaricate dal
suo profilo orario, totale settimana), con in più un'intestazione che
indica di chi sono le ore che sto guardando
E questo vale anche se il mio profilo non è personalmente abilitato al
report ore: l'accesso qui dipende dal mio ruolo admin, non dalla mia
abilitazione personale

## Scenario: l'admin modifica le ore di un dipendente, anche se la settimana è già confermata
Dato che sono sulle ore di un dipendente (via `/admin/ore-lavoro`), per
una settimana già confermata da quella persona
Quando guardo la pagina
Allora vedo comunque tutti i campi modificabili e il pulsante "Salva
modifiche" (a differenza di quando la stessa settimana confermata è
aperta dal diretto interessato, che la vede in sola lettura — vedi
"una settimana confermata non è più modificabile dal personale")
E posso modificare uno o più giorni e salvare, con le stesse
validazioni (motivo/codice/nota) già in vigore per chiunque
E il messaggio "Settimana confermata il ..." resta visibile, per
sapere che si tratta di una correzione su dati già confermati

## Scenario: l'admin conferma per conto di un dipendente una settimana non ancora confermata
Dato che sono sulle ore di un dipendente, per una settimana non ancora
confermata da quella persona
Quando premo "Conferma settimana" e confermo l'azione
Allora la settimana risulta confermata, con data/ora della conferma
mostrate a schermo — esattamente come se l'avesse confermata la persona
stessa

## Scenario: l'admin naviga tra le settimane di un dipendente
Dato che sono sulle ore di un dipendente
Quando premo "←" o "→" per cambiare settimana
Allora resto sulle ore della stessa persona, non torno alle mie
E valgono le stesse regole di navigazione già in vigore per chiunque
(mai una settimana futura, nessun limite verso il passato)

## Scenario: un parametro `utente` non valido, o usato da chi non è admin, viene ignorato
Quando apro `/dashboard/ore-lavoro?utente=...` con un id che non
corrisponde a nessun profilo abilitato al report ore, oppure sono
autenticata come maestra o assistente (non admin) e la URL contiene
comunque quel parametro
Allora vedo le mie proprie ore, non quelle di qualcun altro (stesso
principio "parametro non valido ⇒ valore di default" già in uso per
`?settimana=`)

## Regole
- Tutti i 7 giorni della settimana corrente sono mostrati (lunedì-
  domenica), non solo i feriali: a differenza di presenze/pasti
  (specs/53), il registro ore di lavoro non considera sabato/domenica o
  un giorno di chiusura registrato dall'admin come "non scrivibili" — il
  personale può lavorare anche quando l'asilo non è operativo (es.
  pulizie, attività amministrative, formazione). Un giorno di chiusura
  mostra comunque l'informazione (stessa provenienza dati di specs/53),
  a puro scopo informativo, senza bloccare nulla.
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
  `supabase/migrations/0025_report_ore_lavoro.sql`); l'admin sì,
  sempre, per la propria settimana e per quella di chiunque altro —
  nessuna migration nuova necessaria per questo requisito, le policy
  RLS lo permettevano già (`ruolo_corrente() = 'admin'` non ha mai
  avuto la condizione "settimana non confermata"), mancava solo
  l'interfaccia.
- **Amministrazione** (`/admin/ore-lavoro` e
  `/dashboard/ore-lavoro?utente=<id>`): riusa la stessa pagina/gli
  stessi componenti della vista personale, non una pagina duplicata
  (CLAUDE.md, jscpd) — cambia solo l'utente di riferimento (di default
  quello autenticato, quello indicato da `?utente=` se chi guarda è
  admin e quell'id corrisponde a un profilo abilitato) e il fatto che,
  per l'admin, la settimana resta sempre modificabile anche se già
  confermata (nessuna vista "sola lettura" per l'admin). Le server
  action (`salvaSettimanaOreLavoro`, `confermaSettimanaOreLavoro`)
  scrivono sull'utente indicato da un campo nascosto `utente_id` del
  form SOLO se chi invia è admin; altrimenti scrivono sempre e solo
  sul proprio utente, ignorando qualunque valore ricevuto dal client —
  la RLS resta comunque la difesa reale anche se questo controllo lato
  server action venisse bypassato.
- L'accesso alla vista di un altro utente non richiede la propria
  abilitazione personale al report ore (a differenza della propria
  vista, vedi [17 - ore-di-lavoro.md](17%20-%20ore-di-lavoro.md)):
  dipende solo dal ruolo admin e dal fatto che l'utente indicato sia a
  sua volta abilitato.
- Nessuna scrittura silenziosa: un salvataggio che fallisce la
  validazione (motivo/codice/nota mancante) non salva nessuno dei giorni
  di quel submit, nemmeno quelli validi — il personale corregge il
  giorno segnalato e reinvia (stesso pattern "errore ⇒ dati preservati"
  di specs/05 - feedback.md, i campi già compilati restano tali).
- Navigazione: un parametro in query string (`?settimana=`, un lunedì)
  indica quale settimana mostrare, di default quella corrente. Ogni
  settimana passata (confermata o no) si comporta esattamente come la
  settimana corrente nello stesso stato — stessa UI, stesse regole di
  salvataggio/conferma — semplicemente riferita a un'altra data.
- **Vincolo assoluto: non è mai possibile inserire o vedere ore per una
  settimana futura.** Se il parametro `settimana` non è un lunedì
  valido, oppure è un lunedì futuro rispetto a oggi (fuso Europe/Rome),
  la pagina mostra silenziosamente la settimana corrente al suo posto
  (nessun errore: stesso principio di "parametro non valido ⇒ valore di
  default" già usato per `?periodo=` nel Report, specs/51). Applicato su
  più livelli, come per le altre regole di integrità del progetto: il
  pulsante "→" non è disponibile oltre la settimana corrente, la pagina
  clampa un parametro fuori range, le server action rifiutano un
  `settimana_inizio` futuro passato via form, e un trigger sul database
  (`supabase/migrations/0028_ore_lavoro_navigazione_settimane.sql`)
  rifiuta comunque qualunque riga con data (o settimana confermata)
  futura — vale per QUALUNQUE ruolo, admin incluso: non è un permesso di
  scrittura ma un vincolo di coerenza dei dati (non si possono lavorare
  ore che non sono ancora accadute). Il vincolo è sulla **settimana**,
  non sul singolo giorno: dentro una settimana ammessa (corrente o
  passata) restano scrivibili anche i giorni che non sono ancora
  accaduti (es. venerdì, quando oggi è lunedì) — il form invia sempre
  tutti e 7 i giorni in un solo salvataggio, e lo scenario "confermare
  la settimana" già prevede di registrare con valori precaricati anche i
  giorni non ancora salvati esplicitamente. Bloccare un giorno futuro
  dentro una settimana ammessa impedirebbe di salvare qualunque cosa a
  metà settimana: il trigger sul database confronta perciò la settimana
  di `data` (il lunedì che la contiene) con la settimana corrente, non
  `data` stessa con la data odierna.

## Fuori scope in questa fase
- Il calcolo effettivo di un monte ore/straordinari a partire dai dati
  registrati, ed eventuali riepiloghi o export.
- "Riaprire" una settimana già confermata (renderla di nuovo
  modificabile dal personale): nessuna azione la offre in questa fase.
