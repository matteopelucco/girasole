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
E per i giorni lunedì-venerdì le "Ore ordinarie" mostrate sono le ore
previste dal mio profilo orario per quel giorno della settimana; per
sabato e domenica (non previsti dal profilo, vedi specs/54) sono 0
E vedo anche un campo "Differenza ore", a 0 di default, e il "Totale
ore erogate" del giorno (uguale alle ore ordinarie finché la
differenza è 0)

## Scenario: senza profilo orario assegnato le ore ordinarie partono da zero
Dato che sono abilitata al report ore ma non ho un profilo orario
assegnato
Quando apro "Ore di lavoro"
Allora le "Ore ordinarie" di ogni giorno sono 0 (non modificabili) e
per registrare le ore fatte inserisco una "Differenza ore" positiva,
con il motivo obbligatorio (vedi lo scenario sulla differenza)
E vedo un suggerimento a chiedere all'admin di assegnarmi un profilo
orario

## Scenario: il profilo orario resta sempre visibile come riferimento statico
Dato che sono autenticata come personale abilitato al report ore, con un
profilo orario assegnato
Quando apro "Ore di lavoro", per qualunque giorno lavorativo della
settimana (corrente o passata, modificabile o in sola lettura)
Allora vedo, accanto al valore "Ore ordinarie", un testo statico
"Previsto: Xh" con le ore previste dal profilo orario per quel giorno
della settimana — non è mai dentro un campo di input, resta un
riferimento anche dopo che ho modificato la differenza
E se non ho un profilo orario assegnato vedo invece "Nessun profilo
orario assegnato"

## Scenario: le ore ordinarie non sono modificabili e non c'è il pulsante "Copia"
Dato che sto compilando un giorno lavorativo
Quando guardo le "Ore ordinarie"
Allora sono mostrate ma non modificabili (nessun campo di input), pari
alle ore previste dal profilo orario per quel giorno (0 senza profilo)
E non esiste alcun pulsante "Copia": le ore ordinarie sono già quelle
previste, l'unico campo che modifico è la "Differenza ore"

## Scenario: la differenza ore aggiorna il totale erogato e il colore della card
Dato che sto compilando un giorno lavorativo
Quando la "Differenza ore" è 0
Allora il "Totale ore erogate" (in evidenza, non modificabile) è uguale
alle ore ordinarie, e la card è verde con un testo che dice che le ore
sono quelle previste
E quando inserisco una differenza diversa da 0 (positiva o negativa) il
totale diventa ore ordinarie + differenza, la card diventa rossa e un
testo (non solo il colore) indica quante ore in più o in meno rispetto
al previsto
E l'intestazione della card (giorno e selettore di stato) e le viste
"Malattia" e "Assenza" non cambiano

## Scenario: una differenza diversa da zero richiede un motivo
Quando per un giorno inserisco una differenza ore diversa da 0 (in più o
in meno) senza indicarne il motivo, e premo "Salva modifiche"
Allora vedo un messaggio d'errore che richiede il motivo
E nessuna modifica di quel salvataggio viene registrata
E con differenza 0 il campo "Motivo" non è mostrato e non è richiesto

## Scenario: le ore ammettono solo multipli di un quarto d'ora e il totale non è mai negativo
Quando inserisco una differenza che non è multiplo di 0,25 (es. 0,2) o
che porterebbe il totale sotto zero (differenza inferiore a −ore
ordinarie), e premo "Salva modifiche"
Allora vedo un messaggio d'errore in italiano semplice che spiega il
problema, e nessuna modifica di quel salvataggio viene registrata
E differenze come 1, 2,5, −0,5, −1,25 sono accettate
E la stessa regola è applicata dal server, non solo dal campo

## Scenario: la differenza è salvata nei dati esistenti senza cambiare monte ore e report
Quando salvo un giorno con differenza positiva, negativa o nulla
Allora i dati salvati restano ore ordinarie, ore straordinarie e motivo
(nessuna nuova colonna): differenza > 0 ⇒ ordinarie = previste e
straordinarie = differenza; differenza < 0 ⇒ ordinarie = previste +
differenza e straordinarie = 0; differenza 0 ⇒ ordinarie = previste e
straordinarie = 0
E riaprendo la pagina la differenza mostrata è (ordinarie +
straordinarie) − previste, la stessa formula usata da report e monte
ore, quindi i dati storici restano compatibili e monte ore e report
non cambiano

## Scenario: i dati storici non a quarti d'ora sono mostrati arrotondati e non vengono modificati finché non si salva
Dato che un giorno salvato in passato ha una differenza (ordinarie +
straordinarie − previste) che non è multiplo di 0,25 (es. 0,2 o 0,37)
Quando apro la settimana
Allora la "Differenza ore" mostrata nel campo è arrotondata al quarto
d'ora più vicino (0,2 ⇒ 0,25; 0,37 ⇒ 0,25; a metà strada, come 0,125,
si arrotonda per eccesso, verso +∞), e il "Totale ore erogate" e il
colore della card sono calcolati sul valore arrotondato
E l'arrotondamento è solo in lettura: nessuna migration e nessuna
modifica ai dati salvati, che cambiano solo se salvo la card (così il
salvataggio non è rifiutato per i dati storici)
E monte ore, report e PDF continuano a usare i dati salvati così
come sono, e la validazione lato server resta rigida sui valori inviati

## Scenario: salvare le ore della settimana
Quando modifico le ore di uno o più giorni e premo "Salva modifiche"
Allora i valori inseriti sono salvati e restano tali riaprendo la pagina
E vedo il totale delle ore della settimana (ordinarie + straordinarie)
aggiornato di conseguenza

## Scenario: la scheda della settimana mostra ore previste e differenza ore
Quando sono su "Ore di lavoro", per qualunque settimana (modificabile o
in sola lettura)
Allora vedo, in un riquadro riassuntivo separato dai singoli giorni, due
valori: "Ore previste" (il totale delle ore previste dal profilo orario
per i soli giorni in stato lavorativo di quella settimana, 0 se non ho
un profilo assegnato o se nessun giorno è lavorativo) e "Differenza ore"
(con segno: quante ore ho fatto in più o in meno rispetto al previsto,
somma delle differenze dei giorni lavorativi, es. "+5h")
E la differenza è sempre "erogate − previste": non compare più la
distinzione tra ore ordinarie e straordinarie erogate
E la differenza ore è solo un calcolo informativo: il monte ore è gestito
a mano dall'admin e non cambia mai da solo (vedi
[19 - monte-ore.md](19%20-%20monte-ore.md))

## Scenario: il riepilogo si aggiorna con quanto digitato, prima di salvare
Dato che la settimana non è confermata
Quando cambio la differenza o lo stato di un giorno, senza ancora
premere "Salva modifiche"
Allora "Ore previste" e "Differenza ore" si aggiornano subito, coerenti
con le card dei giorni mostrate
E lo stesso vale per una settimana già confermata che l'admin corregge:
"Differenza ore" è sempre la somma delle differenze dei giorni lavorativi
mostrati nelle card (mai un valore congelato alla conferma), così il
riquadro non diverge dalle card dopo una correzione

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
(la conferma blocca la modifica autonoma delle ore, e non registra alcun
movimento di monte ore)
mostrate a schermo
E ogni giorno non ancora salvato esplicitamente viene comunque
registrato, con le ore precaricate dal profilo orario (o 0 se nessun
profilo è assegnato), oppure nello stato "Chiusura" se è un giorno di
chiusura scolastica

## Scenario: una settimana confermata non è più modificabile dal personale
Dato che la settimana corrente è già stata confermata
Quando apro "Ore di lavoro"
Allora vedo i dati della settimana in sola lettura (nessun campo
modificabile, nessun pulsante "Salva modifiche" o "Conferma settimana")
E ogni giorno lavorativo è mostrato con lo stesso linguaggio della card
modificabile, ma senza campi: le ore previste, la differenza ore con
segno (+/−, in quarti d'ora, arrotondata in lettura come nella card
modificabile), il "Totale ore erogate" in evidenza, la card verde con
"✓ Ore come previsto" se la differenza è 0 oppure rossa con "⚠ Xh in
più/in meno del previsto" (un testo, non solo il colore), e il motivo
quando la differenza è diversa da 0; l'intestazione e le viste
"Malattia" e "Assenza" non cambiano, e non compare più la dicitura
"Ordinarie / Straordinarie" per giorno. Nessun dato, calcolo o
validazione cambia: solo cosa si legge

## Scenario: un giorno di chiusura scolastica è "Chiusura" per impostazione predefinita
Dato che un giorno della settimana è un giorno di chiusura scolastica
(weekend, o un intervallo registrato dall'admin — vedi
[53 - calendario-scolastico.md](53%20-%20calendario-scolastico.md)) e non
è ancora stato salvato
Quando apro "Ore di lavoro"
Allora quel giorno è nello stato "Chiusura", con l'informazione di
chiusura, e non mostra campi da compilare (né ore previste, né
differenza, né motivo)
E il giorno è "di vacanza": non è considerato nel calcolo delle ore
dovute e del monte ore, come se avessi fatto tutto quello che dovevo

## Scenario: il personale può registrare ore anche nei giorni di chiusura scolastica
Dato che un giorno di chiusura scolastica è nello stato "Chiusura"
Quando scelgo lo stato "Lavorativo" per quel giorno e premo "Salva
modifiche"
Allora quel giorno diventa modificabile come un giorno normale: posso
registrare la differenza ore (con motivo) o malattia/assenza — il
personale può lavorare (es. pulizie, attività amministrative,
formazione) anche quando l'asilo non è operativo
E lo stato scelto resta salvato: non torna a "Chiusura" al
ricaricamento

## Scenario: segnare un giorno di ferie
Quando per un giorno qualunque scelgo lo stato "Ferie" e premo "Salva
modifiche"
Allora quel giorno risulta segnato come ferie, senza campi da compilare
E non è considerato nel calcolo delle ore previste e della differenza
(stesso comportamento di "Chiusura"): non conta né in più né in meno

## Scenario: Chiusura e Ferie non alterano il calcolo delle ore
Dato che in una settimana ho un giorno in stato "Chiusura" o "Ferie"
Quando guardo il riepilogo della settimana e il calcolo mese per mese
Allora quel giorno non aggiunge né toglie ore: né dovute, né erogate,
né differenza, come se fosse stato lavorato esattamente come previsto

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

## Scenario: l'admin apre un dipendente e vede per prima la vista mensile
Dato che sono autenticato come admin
E su `/admin/ore-lavoro` tocco una persona abilitata
Quando arrivo su "Ore di lavoro"
Allora vedo per default la **vista mensile** del mese corrente, con
un'intestazione che indica di chi sono le ore, e un selettore per
passare alla **vista settimanale** (quella descritta negli altri
scenari, invariata)
E questo vale anche se il mio profilo non è personalmente abilitato al
report ore: l'accesso qui dipende dal mio ruolo admin, non dalla mia
abilitazione personale

## Scenario: la vista mensile mostra i giorni del mese e i totali
Dato che sono sulla vista mensile di un dipendente
Allora vedo un riga per ogni giorno del mese, con lo stato (Lavorativo,
Malattia, Assenza, Chiusura, Ferie), le ore previste dal profilo, le ore
erogate, la differenza con segno e il dettaglio (motivo, codice
malattia o nota)
E in un riquadro riassuntivo i totali del mese: "Ore previste" e
"Differenza ore" (con segno), calcolati come nella vista settimanale sui
soli giorni lavorativi già trascorsi, più il saldo attuale del monte ore
E i giorni non ancora accaduti del mese corrente sono mostrati ma non
entrano nei totali
E i giorni in stato Chiusura o Ferie sono mostrati come "di vacanza" e
non entrano nei totali (neutri)
E per ogni settimana del mese vedo se è confermata

## Scenario: navigare tra i mesi nella vista mensile
Dato che sono sulla vista mensile di un dipendente
Quando premo "Mese precedente" o "Mese successivo"
Allora vedo lo stesso dipendente sul mese scelto (il parametro `utente`
resta nell'URL: `?mese=AAAA-MM&utente=<id>`)
E non è mai possibile andare a un mese futuro: "Mese successivo" non è
disponibile sul mese corrente, e un `mese` non valido o futuro in
query string mostra silenziosamente il mese corrente

## Scenario: passare tra vista mensile e vista settimanale
Dato che sono su una delle due viste di un dipendente
Quando uso il selettore "Mese / Settimana", oppure tocco un giorno (o
una settimana) nella vista mensile
Allora arrivo alla vista settimanale della relativa settimana, per
correggere le ore, con la stessa persona
E dalla vista settimanale posso tornare alla vista mensile del mese di
quella settimana

## Scenario: la vista mensile è riservata all'admin
Dato che non sono admin
Quando apro la vista mensile (`/dashboard/ore-lavoro/mese`)
Allora vengo riportato alla dashboard: il personale continua a usare la
vista settimanale delle proprie ore

## Scenario: l'admin modifica le ore di un dipendente, anche se la settimana è già confermata
Dato che sono sulle ore di un dipendente (via `/admin/ore-lavoro`), per
una settimana già confermata da quella persona
Quando guardo la pagina
Allora vedo comunque tutti i campi modificabili e il pulsante "Salva
modifiche" (a differenza di quando la stessa settimana confermata è
aperta dal diretto interessato, che la vede in sola lettura — vedi
"una settimana confermata non è più modificabile dal personale")
E posso modificare uno o più giorni e salvare, con le stesse
validazioni (motivo/quarti d'ora/codice/nota) già in vigore per chiunque
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
  mostra l'informazione (stessa provenienza dati di specs/53) ed è per
  impostazione predefinita nello stato "Chiusura", modificabile in
  "Lavorativo": nulla è mai bloccato.
- Un giorno è in uno di cinque stati, esclusivi: **lavorativo** (ore
  ordinarie/straordinarie), **malattia** (richiede il codice ricevuto
  dal medico), **assenza** (richiede una nota giustificativa),
  **chiusura** o **ferie**. "Chiusura" è lo stato predefinito di un
  giorno di chiusura scolastica non ancora salvato (specs/53), l'utente
  può cambiarlo; "Ferie" lo sceglie l'utente su qualunque giorno. Le
  due voci si comportano allo stesso modo: nessun campo da compilare,
  nessuna ora registrata, e il giorno è escluso dal calcolo di ore
  dovute, differenza e monte ore (come se avessi fatto tutto quello
  che dovevo; a differenza di malattia/assenza, che nei report
  risultano in meno del previsto). Passare a uno stato diverso da
  lavorativo azzera le ore ordinarie/straordinarie di quel giorno;
  passare a lavorativo azzera codice malattia/nota assenza.
- Le ore ordinarie di un giorno lavorativo sono quelle previste dal
  profilo orario assegnato all'utente (campo del giorno della settimana
  corrispondente, specs/54; 0 senza profilo) e **non sono modificabili**.
  Il personale registra solo la **differenza ore** (positiva o
  negativa, multipli di 0,25 h, default 0) rispetto al previsto, con un
  **motivo obbligatorio** se è diversa da 0. Il **totale ore erogate**
  (ordinarie + differenza, mai negativo) è calcolato e in evidenza; la
  card è verde se la differenza è 0, rossa altrimenti (sempre con un
  testo, mai solo il colore). Mappatura sui dati esistenti, nessuna
  migration: vedi lo scenario "la differenza è salvata nei dati
  esistenti". Il valore previsto resta visibile come testo statico
  ("Previsto: Xh", mai dentro un campo di input). La validazione è
  lato server (`validaGiornoOreLavoro`), oltre ai vincoli del campo.
- Le ore erogate, confrontate con le ore previste dal profilo orario,
  alimentano il calcolo mese per mese mostrato nella scheda ore; il
  monte ore invece è gestito a mano dall'admin e la conferma della
  settimana non lo modifica — vedi
  [19 - monte-ore.md](19%20-%20monte-ore.md).
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
  validazione (motivo/quarti d'ora/codice/nota) non salva nessuno dei giorni
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
- "Riaprire" una settimana già confermata (renderla di nuovo
  modificabile dal personale): nessuna azione la offre in questa fase.
  Backlog: issue [#90](https://github.com/matteopelucco/girasole/issues/90).
