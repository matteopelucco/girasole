# 56 — Comunicazione retta mensile

## Attori
Admin.

## Obiettivo
Ogni mese, di norma intorno al giorno 1-2, l'admin invia ai genitori
un'email di promemoria con il dettaglio degli importi da versare per la
retta del mese corrente. Questo requisito copre: la tabella di revisione
mensile con tutti i bambini attivi, il calcolo automatico degli
importi, l'inserimento di eventuali costi extra del mese, l'invio delle
email (una per bambino) e la configurazione del template. Si basa sui
dati impostati in
[55 - costi-bambino.md](55%20-%20costi-bambino.md). Un eventuale
credito/debito "da conteggiare" quel mese (specs/58) compare come voce
aggiuntiva nella stessa tabella; la verifica del bonifico ricevuto per
ogni comunicazione già inviata è invece descritta in
[59 - verifica-bonifico-retta.md](59%20-%20verifica-bonifico-retta.md).

## Scenario: vedere la tabella di revisione della comunicazione del mese corrente
Dato che sono autenticato come admin
Quando apro "Rette" dal menu (gruppo "Pagamenti", specs/60)
Allora vedo il nome del mese corrente in intestazione, e una riga per
ciascun bambino attivo con: nome e cognome (con l'email a cui verrà
inviata la comunicazione subito sotto, tra parentesi), retta mensile,
marca da bollo e costo pasti proiettato (testo, in quest'ordine),
eventuale conguaglio pasti del mese precedente, costo pre-asilo e costo
post-asilo (modificabili), i gettoni pre-asilo e post-asilo del mese
precedente (RET-01, modificabili), un campo "Costi extra" (con una
nota facoltativa) da compilare, un eventuale credito/debito "da
conteggiare" questo mese con la sua nota (specs/58, di sola lettura,
importo e nota condivisi in un'unica colonna), e il totale calcolato

## Scenario: i bambini sono raggruppati per sezione
Dato che sono sulla tabella di revisione (mese corrente o un mese
passato)
Quando guardo la pagina
Allora vedo una tabella separata per ciascuna sezione che ha almeno un
bambino da mostrare in quel momento, con il nome della sezione come
titolo sopra la sua tabella (stesse colonne per tutte)
E i bambini senza sezione assegnata sono in una tabella a parte,
intitolata "Senza sezione"
E una sezione senza nessun bambino da mostrare in quel momento non ha
una tabella (niente titoli con sotto una tabella vuota)

## Scenario: vedere l'email a cui verrà inviata la comunicazione
Dato che sono sulla tabella di revisione del mese corrente
Quando guardo la riga di un bambino con l'email di promemoria
configurata (specs/55), sotto il suo nome
Allora vedo esattamente quell'indirizzo tra parentesi, con un carattere
più piccolo del nome — lo stesso a cui arriverà la comunicazione se
invio

## Scenario: modificare manualmente una voce di costo prima dell'invio
Dato che sono sulla tabella di revisione del mese corrente, su un
bambino non ancora comunicato
Quando modifico il valore di conguaglio pasti, pre-asilo, post-asilo o
dei gettoni pre/post-asilo (importo) —
non solo i già modificabili costi extra/nota — rispetto a quello
proposto, e premo "Invia comunicazioni"
Allora l'email inviata e il log della comunicazione registrano il
valore che ho scritto io, non quello ricalcolato automaticamente —
utile per una correzione o uno sconto una tantum che non deriva da
nessun calcolo

## Scenario: retta, marca da bollo, costo pasti e credito/debito non sono modificabili dalla tabella
Dato che sono sulla tabella di revisione del mese corrente, su un
bambino non ancora comunicato
Quando guardo le colonne "Retta", "Marca da bollo", "Pasti mese
corrente" e "Credito/Debito"
Allora le vedo come testo, non come campi compilabili: per cambiare il
prezzo della retta si va sulla scheda del bambino (specs/55); la marca
da bollo non è modificabile da nessuna parte, è un importo fisso per
legge; il costo pasti resta la proiezione automatica sui giorni di
apertura (vedi sotto), non pensata per una correzione ad-hoc da qui —
per un aggiustamento puntuale (es. un pasto non contabilizzato) c'è
"Costi extra"; il credito/debito si corregge dalla scheda del bambino
(specs/58)

## Scenario: il costo pasti del mese corrente è proiettato sui giorni di apertura
Dato che il mese corrente ha un certo numero di giorni feriali di
apertura (weekend e giorni di chiusura registrati esclusi, vedi
[53 - calendario-scolastico.md](53%20-%20calendario-scolastico.md))
Quando guardo la colonna "Pasti mese corrente" di un bambino in tabella
Allora l'importo mostrato è (giorni di apertura del mese corrente) ×
(prezzo del suo buono pasto) — una stima, dato che il mese corrente non
è ancora trascorso, di sola lettura come retta e marca da bollo

## Scenario: il conguaglio pasti è la differenza tra pasti potenziali ed effettivi del mese precedente
Dato che i genitori hanno pagato in anticipo, per il mese precedente,
un pasto per ogni giorno di apertura (i "pasti potenziali": giorni in
cui c'è il servizio pasto Rojac, cioè weekend e giorni di chiusura
registrati esclusi) — e che nello stesso mese il bambino ha effettivamente
mangiato in alcuni giorni (i "pasti effettivi": pasti segnati "Sì",
specs/14)
Quando guardo la colonna "Conguaglio pasti mese precedente" di quel
bambino
Allora l'importo mostrato è negativo, pari a
−((pasti potenziali) − (pasti effettivi)) × (prezzo del suo buono pasto)
— un rimborso per i pasti pagati e non consumati, qualunque ne sia il
motivo (assenza, malattia, o presente senza pranzo)
E se i pasti effettivi uguagliano i potenziali il conguaglio è zero
E se un bambino non ha nessun pasto "Sì" nel mese precedente il
conguaglio è l'intero importo pagato in anticipo per quel mese
E i giorni di apertura del mese precedente (= i pasti potenziali) sono
indicati nell'intestazione della pagina, accanto a quelli del mese
corrente

## Scenario: inserire un costo extra del mese e vederlo nel totale
Quando scrivo un importo nel campo "Costi extra" di un bambino (ed
eventualmente una nota che lo descrive)
Allora il totale calcolato per quella riga lo include

## Scenario: la nota del costo extra è disponibile nella mail
Dato che ho scritto un importo nel campo "Costi extra" di un bambino e
una nota che ne spiega il motivo
Quando invio (o apro l'anteprima del)la comunicazione
Allora la mail può includere quella nota tramite il placeholder
`{{note_costi_extra}}` nel template — utile per far sapere ai genitori a
cosa corrisponde l'importo extra addebitato
E se non ho scritto nessuna nota, il placeholder viene sostituito con
una stringa vuota (nessun errore, nessun testo residuo tipo "null")

## Scenario: inviare le comunicazioni con un click
Dato che ho controllato (ed eventualmente corretto) i dati in tabella
per il mese corrente
Quando premo "Invia comunicazioni" e confermo il popup "Sei sicuro di
voler inviare le comunicazioni?"
Allora per ogni bambino con un'email di promemoria configurata
(specs/55) e non ancora comunicato questo mese, viene inviata un'email
con gli importi presenti nel form in quel momento (usando il template
configurato) e viene registrato un log della comunicazione (bambino,
mese, ciascun importo, email destinatario, chi e quando)
E i bambini senza email di promemoria configurata non ricevono nulla e
restano segnalati in tabella come tali

## Scenario: annullare il popup di conferma dell'invio massivo non invia nulla
Dato che ho premuto "Invia comunicazioni"
Quando annullo il popup di conferma invece di confermarlo
Allora nessuna email viene inviata e nessun bambino risulta comunicato:
la tabella resta quella di prima, tutti i bambini "da inviare" restano
tali

## Scenario: inviare la comunicazione a un solo bambino con anteprima
Dato che sono sulla tabella di revisione del mese corrente, su un
bambino non ancora comunicato con email configurata
Quando premo "Invia comunicazione" sulla sua riga
Allora vedo un popup con l'anteprima esatta della mail: a chi (l'email
di promemoria), oggetto e corpo — calcolati con i valori attualmente
nel form per quella riga, comprese eventuali correzioni ad-hoc non
ancora inviate
E se premo "Conferma invio" quell'unica email parte e viene registrata
(la riga passa a "Inviata", gli altri bambini non vengono toccati)
E se premo "Annulla" il popup si chiude senza inviare nulla, la riga
resta "da inviare" con i valori che avevo scritto

## Scenario: confermare senza inviare registra la comunicazione ma non manda nessuna email
Dato che ho aperto l'anteprima con "Invia comunicazione" sulla riga di un
bambino non ancora comunicato (per esempio perché la famiglia è già stata
avvisata in altro modo)
Quando premo "Conferma senza inviare", un comando meno evidente di
"Conferma invio"
Allora succede la stessa sequenza di "Conferma invio" (stessi controlli,
stessa registrazione con gli stessi importi e la stessa data/ora, stesso
aggiornamento della pagina, credito/debito conteggiato) e la riga passa a
"Inviata"
E non parte nessuna email: né alla famiglia né all'asilo in copia
E "Conferma invio" continua a inviare la mail come prima

## Scenario: Esc chiude l'anteprima della comunicazione singola
Dato che ho aperto l'anteprima con "Invia comunicazione" sulla riga di un
bambino
Quando premo il tasto Esc
Allora l'anteprima si chiude senza inviare nulla e la riga resta "da
inviare"

## Scenario: l'anteprima della comunicazione singola trattiene il focus
Dato che ho aperto l'anteprima con "Invia comunicazione"
Quando premo ripetutamente Tab (o Maiusc+Tab)
Allora il focus resta sempre dentro l'anteprima e non raggiunge la
tabella dietro di essa

## Scenario: chiudendo l'anteprima il focus torna a "Invia comunicazione"
Dato che ho aperto l'anteprima con "Invia comunicazione" sulla riga di un
bambino
Quando la chiudo con "Annulla" oppure con Esc
Allora il focus torna sul pulsante "Invia comunicazione" di quella riga

## Scenario: un bambino già comunicato questo mese non viene reinviato
Dato che un bambino ha già una comunicazione registrata per il mese
corrente
Quando apro la tabella di revisione
Allora quel bambino mostra "Inviata" con gli importi e la data/ora
effettivamente comunicati, al posto dei campi da compilare
E non viene incluso in un nuovo invio dello stesso mese

## Scenario: annullare l'invio di una comunicazione per poterla reinviare
Dato che un bambino ha già una comunicazione registrata per il mese
corrente (es. inviata con importi sbagliati)
Quando premo "Annulla invio" sulla sua riga
Allora la comunicazione registrata per quel bambino e quel mese viene
eliminata, la riga torna a mostrare i campi da compilare (come un
bambino non ancora comunicato) e un nuovo click su "Invia comunicazioni"
può inviargliela di nuovo

## Scenario: navigare a un mese passato per rivedere le comunicazioni inviate
Dato che sono sulla tabella "Rette" del mese corrente
Quando premo la freccia "←"
Allora vedo il mese precedente in intestazione, con l'elenco dei soli
bambini che hanno una comunicazione registrata per quel mese (gli
importi e la data/ora effettivamente comunicati)
E non vedo né il pulsante "Invia comunicazioni" né "Annulla invio" (la
comunicazione resta possibile solo per il mese corrente)

## Scenario: non si può navigare a un mese futuro
Dato che sono sul mese corrente in "Rette"
Quando guardo i controlli di navigazione
Allora non trovo la freccia "→" (non posso andare oltre il mese
corrente)

## Scenario: tornare al mese corrente dalla revisione di un mese passato
Dato che sto rivedendo un mese passato
Quando premo "→" abbastanza volte da tornare al mese corrente
Allora ritrovo la tabella interattiva con i campi da compilare e i
pulsanti "Invia comunicazioni"/"Annulla invio"

## Scenario: un mese passato senza nessuna comunicazione inviata
Dato che navigo a un mese passato in cui non è stata inviata nessuna
comunicazione
Allora vedo un messaggio che lo indica, invece di una tabella vuota

## Scenario: configurare il template della mail
Dato che sono su "Modello email" (raggiungibile da "Rette")
Quando modifico oggetto e/o corpo, usando i placeholder disponibili
documentati in pagina, e confermo
Allora il nuovo modello viene salvato e usato dai prossimi invii
E vedo la data/ora dell'ultimo salvataggio aggiornarsi sotto il
pulsante "Salva modello" — l'effetto visibile della conferma (specs/05):
a differenza di un elenco dove compare un nuovo elemento, qui il
contenuto del form resta lo stesso testo appena scritto, quindi senza
questa data non ci sarebbe alcun modo di accorgersi che il salvataggio
è davvero avvenuto

## Scenario: il markup nel template o nei dati è mostrato come testo nella mail
Dato che il template della mail o un valore di un segnaposto (es. il
nome del bambino, la nota dei costi extra) contiene caratteri speciali
HTML, come `<b>`, `<script>`, `&` o virgolette
Quando apro l'anteprima o invio la comunicazione
Allora il testo compare in anteprima e nella mail esattamente come
scritto, come testo semplice: nessun markup viene interpretato
E il template è solo testo (non HTML): per andare a capo basta un a capo
nel testo, che la mail rende come tale
E l'oggetto resta testo semplice, senza alcuna trasformazione HTML

## Scenario: una risposta dei genitori arriva all'asilo, non al mittente tecnico
Dato che una comunicazione di retta viene inviata (massiva o singola)
Quando il genitore, o l'asilo, risponde alla mail
Allora la risposta ("Rispondi") va all'indirizzo dell'asilo
(`destinatarioNotifiche()`, `Reply-To`) e non all'indirizzo mittente
tecnico (`RESEND_MITTENTE`, es. `girasole@asilosartorio.it`, che non è
una casella letta da nessuno)
E i genitori restano in A (TO) e l'asilo in CC, invariati
E il `Reply-To` vale solo per le mail a destinatari esterni (genitori;
Rojac, specs/61): le mail
interne (report notturno specs/52, allarmi specs/07, notifiche
all'asilo) non lo impostano

## Scenario: invio email simulato nei test (`EMAIL_DRY_RUN`)
Dato che l'ambiente ha `EMAIL_DRY_RUN` attiva (`1`, `true`, `yes`, `on`;
nella CI e2e, mai in produzione) e non ha `RESEND_API_KEY`
Quando l'admin invia una comunicazione di retta (massiva o singola)
Allora l'invio ha esito positivo e la riga risulta "Inviata il ..." come
con una mail vera
E nessuna richiesta parte verso Resend
E i log non riportano indirizzo, oggetto né testo della mail (solo una
riga generica "invio email simulato")
E vale per ogni mail dell'app (report notturno specs/52, allarmi
specs/07, Rojac specs/61), perché passa tutta da `inviaEmail`
(`lib/email.ts`)

## Scenario: l'invio simulato è ignorato in produzione
Dato che l'ambiente è la produzione (`VERCEL_ENV=production`)
E per errore `EMAIL_DRY_RUN` è attiva
Quando l'app invia una mail
Allora la variabile viene ignorata e la mail parte davvero, se c'è la chiave
E nei log compare un avviso che la variabile è stata ignorata, così le
mail vere non si bloccano per errore
(la scelta è logica pura in `lib/email.ts`, coperta dai test unit di
`lib/email.test.ts`)

## Scenario: i gettoni pre e post-asilo del mese precedente compaiono nella retta
**ID RET-01**
Dato che un bambino ha, nel mese precedente M-1, 3 giorni con pre-asilo e
2 giorni con post-asilo non coperti, e il suo gettone pre-asilo è 7,00 e
quello post-asilo è 8,00 (specs/55)
Quando apro "Rette" sul mese M (corrente)
Allora nella sua riga vedo due voci separate: gettoni pre-asilo
21,00 € (3 gettoni) e gettoni post-asilo 16,00 € (2 gettoni)
E il numero è calcolato per ogni bambino e per ogni voce: giorni non
coperti di M-1 (RET-02); non dipende dall'abbonamento del mese M
E l'importo è numero × prezzo del gettone di quella voce, salvo RET-13
(abbonamento della voce nel mese M: importo 0,00 €)
E se una voce non ha giorni non coperti mostra 0,00 € e 0 gettoni

## Scenario: un giorno è coperto se l'abbonamento della voce c'era nella retta di quel mese
**ID RET-02**
Dato che la retta del mese M-1 del bambino è già stata inviata
Quando vedo i gettoni del mese M
Allora i giorni con pre-asilo di M-1 sono coperti solo se in quella retta
la quota pre-asilo era maggiore di zero (valore addebitato, non il flag
attuale in `costi_bambini`), e lo stesso vale per il post-asilo
E se la retta di M-1 non è stata inviata (o non esiste) vale
l'abbonamento attuale della voce (`costi_bambini`)
E pre e post sono valutati separatamente: l'abbonamento di una voce non
copre l'altra
E la copertura riguarda il numero dei gettoni (se M-1 era coperto, numero
e importo sono 0); l'abbonamento del mese M non cambia il numero, azzera
solo l'importo (RET-13)
E è la stessa regola di GET-11 ([13](13%20-%20segna-presenza.md)): la
schermata presenze e la retta non possono mai dire cose diverse

## Scenario: i giorni di chiusura e i fine settimana non generano gettoni
**ID RET-03**
Dato che nel mese M-1 il bambino ha una presenza con pre-asilo in un
giorno che è weekend o giorno di chiusura registrato (specs/53)
Quando vedo i gettoni del mese M
Allora quel giorno non viene contato

## Scenario: il cambio d'anno e i mesi senza presenze
**ID RET-04**
Dato che il mese M è gennaio
Quando vedo i gettoni
Allora si contano i giorni di dicembre dell'anno precedente
E per settembre (mese precedente agosto, senza apertura) i gettoni sono
0,00 € e 0

## Scenario: il totale della retta include i gettoni
**ID RET-05**
Dato che un bambino ha gettoni pre-asilo 21,00 € e gettoni post-asilo
16,00 € nella sua riga
Quando guardo il totale (e, per la riga appena modificata a mano,
quello comunicato all'invio)
Allora il totale è la somma di tutte le voci già previste più 37,00 €
E il totale usa gli importi effettivi dei gettoni: una voce con
abbonamento nel mese (RET-13) vi entra con 0,00 €, non con numero × prezzo
E se ho modificato a mano un importo prima dell'invio, il totale
comunicato usa il valore che ho scritto

## Scenario: i gettoni inviati restano quelli comunicati
**ID RET-06**
Dato che una retta è già stata inviata (anche prima di questo rilascio)
Quando in seguito cambiano presenze, abbonamento o prezzo del gettone
Allora la sua riga, il suo totale e il suo log non cambiano
E le rette inviate prima del rilascio mostrano 0,00 € e 0 gettoni nelle
nuove voci, con il totale di sempre

## Scenario: una retta non ancora inviata mostra i gettoni subito
**ID RET-07**
Dato che una retta del mese corrente non è ancora stata inviata
Quando registro o tolgo un pre/post-asilo del mese precedente e ricarico
"Rette"
Allora i gettoni della sua riga riflettono i dati di quel momento

## Scenario: una retta annullata e rifatta usa le regole e i dati di oggi
**ID RET-08**
Dato che annullo l'invio di una retta (dopo, per esempio, un cambio di
abbonamento o di prezzo del gettone)
Quando la riga torna "da inviare"
Allora i gettoni sono ricalcolati con la copertura e il prezzo di quel
momento (non quelli del vecchio invio)

## Scenario: il modello email contiene le righe dei gettoni dopo la migration
**ID RET-09**
Dato che il modello email salvato (`impostazioni_email_retta`) e quello
predefinito non contengono i segnaposto dei gettoni
Quando viene applicata la migration di questa funzione
Allora in entrambi compaiono due righe: «Gettoni pre-asilo (mese
precedente): € {{gettoni_pre_asilo}}» e la riga analoga per il
post-asilo, subito dopo la riga del conguaglio pasti
E se la riga del conguaglio manca, vanno subito prima della riga del
totale
E il resto del testo non cambia

## Scenario: la migration del modello email non duplica le righe
**ID RET-10**
Dato che il modello ha già i segnaposto dei gettoni (migration rieseguita
o righe scritte a mano)
Quando la migration viene applicata di nuovo
Allora non aggiunge né duplica nulla: ogni riga si aggiunge solo se il
suo segnaposto non c'è già

## Scenario: i gettoni sono usabili come segnaposto nella mail
**ID RET-11**
Dato che il modello contiene `{{gettoni_pre_asilo}}`,
`{{numero_gettoni_pre_asilo}}`, `{{gettoni_post_asilo}}` e
`{{numero_gettoni_post_asilo}}`
Quando apro l'anteprima o invio la comunicazione
Allora gli importi sono in euro con la virgola (es. "21,00") e i numeri
sono interi (es. "3"), quelli del form al momento dell'invio
E gli stessi segnaposto sono elencati nella pagina "Modello email"

## Scenario: i gettoni sono visibili nelle comunicazioni inviate
**ID RET-12**
Dato che una retta è stata inviata, oppure sto rivedendo un mese passato
Quando guardo la riga di quel bambino
Allora vedo gettoni pre e post (importo e numero) come registrati

## Scenario: con l'abbonamento del mese corrente i gettoni di quella voce valgono 0
**ID RET-13**
Dato che un bambino ha, nel mese precedente M-1, 14 giorni con pre-asilo
non coperti e il gettone pre-asilo è 7,00 (specs/55)
E la voce pre-asilo ha l'abbonamento nel mese M della retta
Quando apro "Rette" sul mese M
Allora i gettoni pre-asilo mostrano 0,00 € e 14 gettoni: il numero
resta quello di RET-01, solo l'importo è azzerato
E l'importo 0,00 € entra nel totale (RET-05)
E pre e post sono indipendenti: l'abbonamento del pre non azzera il post
e viceversa
E senza abbonamento della voce nel mese M l'importo è come in RET-01
(numero × prezzo)
E se M-1 era coperto (RET-02) numero e importo sono 0 e 0,00 €
E l'importo resta modificabile a mano prima dell'invio, anche se
proposto a 0,00 €
E la retta inviata registra 0,00 € con il numero, e non cambia più
(RET-06, anche se poi cambia l'abbonamento)
E se la retta è annullata e rifatta, l'importo è ricalcolato con
l'abbonamento di quel momento (RET-08)
E nell'email `{{gettoni_pre_asilo}}` dà «0,00» e
`{{numero_gettoni_pre_asilo}}` dà «14» (lo stesso per il post)

## Scenario: accesso negato a chi non è admin
Dato che sono autenticato come maestra, assistente o genitore
Quando provo ad aprire `/admin/rette` (o `/admin/rette/template`)
Allora vengo reindirizzato alla dashboard

## Regole
- Il "mese corrente" è il mese del giorno in cui l'admin apre la
  pagina (fuso Europe/Rome, coerente con `lib/date.ts`): non dipende da
  nessuna configurazione separata (non esiste un "anno scolastico
  corrente" da impostare per questo requisito).
- Navigazione tra mesi con `?mese=YYYY-MM` (frecce "←"/"→", risolto/
  clampato da `lib/comunicazioneRetta.ts:meseRettaRichiesto`, stesso
  pattern di `?settimana=` in "Ore di lavoro" — specs/18,
  `lib/oreLavoro.ts:settimanaOreLavoroRichiesta`): mai un mese futuro.
  Solo il mese corrente mostra la tabella interattiva (campi da
  compilare, "Invia comunicazioni", "Annulla invio"); un mese passato è
  una vista di sola revisione, coerente con "comunicare un mese diverso
  da quello corrente" fuori scope più sotto — mostra solo i bambini con
  una comunicazione già registrata per quel mese, nessun bambino "da
  inviare".
- Nella vista del mese corrente, i bambini mostrati sono tutti i
  bambini attivi (`bambini.attiva`), indipendentemente dalla sezione —
  ma raggruppati per sezione nella presentazione (vedi sopra): una
  tabella per sezione (ordine alfabetico, come l'elenco sezioni), una
  in più per "Senza sezione" se serve. Puro raggruppamento visivo — non
  cambia chi è ammesso all'invio, né come vengono calcolati o
  registrati gli importi (specs/55, "senza sezione" non è collegato ai
  costi). Nella vista di un mese passato lo stesso raggruppamento vale
  sulle sole comunicazioni già inviate quel mese, in base alla sezione
  ATTUALE del bambino (non quella che aveva al momento dell'invio, che
  non viene registrata).
- La pagina "Rette" non ha il limite di larghezza massima delle altre
  pagine admin (`max-w-[1800px]` invece di `max-w-6xl` su
  `app/admin/rette/page.tsx`): la tabella ha molte colonne strette, uno
  spazio più ampio evita lo scroll orizzontale interno su schermi
  larghi (l'admin la usa solo da desktop).
- I giorni di apertura del mese corrente sono calcolati come i giorni
  del mese che non sono weekend e non ricadono in un giorno di chiusura
  registrato (`lib/comunicazioneRetta.ts`, `giorniAperturaMese` — stessa
  regola di `lib/calendarioScolastico.ts`, `isGiornoChiuso`): un unico
  numero, uguale per tutti i bambini (l'asilo ha lo stesso calendario di
  apertura per tutti). Con la stessa funzione sono calcolati i pasti
  potenziali del mese precedente (conguaglio pasti).
- I pasti effettivi del mese precedente sono le righe di `pasti` del
  bambino in quel mese con `mangiato = 'si'`; la presenza (assente/
  malato/presente) non entra nel calcolo. Il conguaglio non è mai un
  addebito: se i pasti effettivi superassero i potenziali (es. un pasto
  segnato in un giorno non considerato di apertura) vale zero.
- Pre-asilo e post-asilo contano il loro prezzo pieno se richiesti
  (specs/55), 0 se non richiesti: non dipendono dai giorni di apertura
  né dalle presenze effettive.
- Gettoni (issue #400, parte di #401): `comunicazioni_retta` ha quattro
  colonne nuove, `gettoni_pre_asilo` e `gettoni_post_asilo` (importo,
  `numeric(8,2) not null default 0`, non negativo) e
  `numero_gettoni_pre_asilo` e `numero_gettoni_post_asilo` (intero non
  negativo, default 0): le righe esistenti restano a 0, nessuna tabella
  o GRANT nuovi. Calcolo puro in `lib/` (test unit con cambio d'anno,
  chiusure, voci miste): giorni del mese M-1 con `pre_asilo` (o
  `post_asilo`) vero, senza weekend né chiusure, non coperti × gettone
  della voce. Copertura come GET-11: retta di M-1 inviata → coperto se la
  quota addebitata (pre o post) è > 0, altrimenti flag attuale. Issue
  #413 (RET-13): se la voce ha l'abbonamento nel mese M della retta
  l'importo è 0 e il numero resta quello calcolato; la copertura di M-1
  azzera numero e importo; nessuna migration. Se il
  bambino non ha riga in `costi_bambini` non è comunicabile e i gettoni
  sono 0. Importo modificabile a mano come il conguaglio (non negativo);
  il numero è di sola lettura, non cambia con l'importo scritto.
- Colonne dei costi: i gettoni pre e post-asilo (importo e, sotto,
  numero) vengono subito dopo il post-asilo e prima dei costi extra.
- Migration del modello email (RET-09, RET-10): idempotente, applicata
  alla riga salvata e al modello predefinito (anche la costante in
  codice); il testo finale delle righe lo scrive Matteo. In produzione la
  migration si applica solo a mano (prima `--dry-run`).
- Il totale di una riga è: retta mensile + costo pasti (proiettato) +
  conguaglio pasti (negativo o zero) + marca da bollo + costo pre-asilo
  + costo post-asilo + gettoni pre-asilo + gettoni post-asilo + costi extra + credito/debito (specs/58,
  negativo se credito, positivo se debito). Può risultare negativo
  (credito verso la famiglia) se conguaglio e/o credito superano gli
  altri importi: non viene forzato a zero.
- Se dal giorno 3 del mese manca la comunicazione a uno o più bambini a
  cui si può inviare (attivi, con email di promemoria, quindi quelli con
  "Da inviare" in tabella), l'admin riceve un allarme (pagina Allarmi,
  campanella, email una volta al mese) che rimanda a questa tabella:
  vedi [07 - allarmi.md](07%20-%20allarmi.md). Inviare o annullare una
  comunicazione spegne o riaccende l'allarme.
- Un bambino senza una riga in `costi_bambini`, o con `email_promemoria`
  vuota, è mostrato in tabella con un avviso e un link alla sua scheda
  per completare i dati (specs/55); non riceve nessuna comunicazione
  finché non viene completata.
- L'email mostrata sotto il nome (`costi_bambini.email_promemoria`,
  tra parentesi, carattere più piccolo — non più una colonna a parte,
  per non sprecare spazio orizzontale) è quella configurata sulla
  scheda del bambino (specs/55): puramente informativa, non modificabile
  da qui (per cambiarla si va sulla scheda del bambino) — serve a
  controllare a colpo d'occhio a chi arriverà ciascuna comunicazione
  prima di premere "Invia comunicazioni".
- Ordine delle colonne dei costi: retta, marca da bollo, costo pasti
  (intestazione "Pasti mese corrente", per distinguerlo a colpo
  d'occhio dal conguaglio del mese precedente subito dopo), conguaglio
  pasti, pre-asilo, post-asilo, costi extra, nota, credito/debito,
  totale, stato — retta, marca da bollo e costo pasti consecutive in
  testa (tutte e tre testo, non modificabili), per tenere vicine le
  voci non modificabili invece di sparpagliarle tra quelle compilabili.
  Le intestazioni di colonna vanno a capo su più righe quando il testo
  non ci sta in larghezza (nessun taglio con ellissi): a fianco di
  colonne strette come "Totale"/"Stato" tiene bilanciata anche
  un'intestazione lunga come "Conguaglio pasti mese precedente", invece
  di farle allargare la colonna a dismisura per stare su una riga sola.
- Ogni importo in euro della tabella mostra il simbolo "€" accanto al
  valore (per i campi ancora compilabili — conguaglio pasti, pre-asilo,
  post-asilo, costi extra — fuori dal campo, mai dentro il valore
  digitato): retta, marca da bollo, costo pasti, credito/debito e
  totale lo mostrano allo stesso modo, da testo semplice — un dettaglio
  solo visivo, il valore numerico e ciò che viene comunicato non
  cambiano.
- Conguaglio pasti, pre-asilo e post-asilo di un bambino da comunicare
  (oltre ai già modificabili costi extra/nota) sono campi compilabili,
  precompilati con il valore calcolato automaticamente ma
  sovrascrivibili per applicare una correzione ad-hoc che non deriva da
  nessun calcolo (es. uno sconto una tantum, la correzione di un
  errore) — coerente con specs/01 - ux.md, non serve toccare i
  parametri permanenti del bambino (specs/55) per un aggiustamento
  valido solo questo mese. Conguaglio pasti resta l'unica voce che può
  essere negativa (è per natura un credito, mai un addebito); le altre
  restano vincolate a un numero non negativo, come ovunque nell'app.
- Retta, marca da bollo, costo pasti e credito/debito (specs/58)
  restano invece testo, non modificabili da questa tabella: la retta si
  cambia solo sulla scheda del bambino (specs/55, ha senso solo come
  cambio permanente, non un aggiustamento di un mese); la marca da
  bollo non è modificabile da nessuna parte, essendo un importo fisso
  per legge; il costo pasti è la proiezione automatica (giorni di
  apertura del mese corrente × prezzo buono pasto, vedi sopra), non
  pensata per una correzione ad-hoc da qui — un pasto in più/meno da
  conteggiare passa da "Costi extra"; il credito/debito si corregge
  dalla scheda del bambino (specs/58).
- Le modifiche a conguaglio pasti/pre-asilo/post-asilo non hanno un
  salvataggio separato per riga: restano solo nel form finché non si
  preme "Invia comunicazioni". A quel punto il server usa esattamente i
  valori presenti nel form in quel momento per queste tre voci (non li
  ricalcola dai dati vivi di presenze), mentre retta, marca da bollo e
  costo pasti restano sempre quelli calcolati/letti dal server in quel
  momento (mai dal form, che non li contiene: retta e marca da bollo da
  `costi_bambini`, il costo pasti dagli stessi giorni di apertura e
  prezzo buono pasto mostrati in pagina) — la persistenza avviene
  quindi come parte dell'invio stesso, non prima: se non si preme
  "Invia comunicazioni" le modifiche non lasciano traccia (specs/05 -
  feedback.md, coerente con "l'effetto è la conferma" per il resto
  dell'app).
- Il totale mostrato in tabella per un bambino da comunicare resta una
  stima calcolata al caricamento della pagina (come già per i costi
  extra): non si aggiorna dal vivo mentre si modificano gli altri
  campi. Il totale realmente comunicato (somma di tutti i valori nel
  form al momento dell'invio) è quello visibile dopo l'invio, nella
  riga "Inviata".
- "Invia comunicazioni" chiede conferma con un popup nativo del browser
  (`window.confirm`, `components/PulsanteInvio.tsx`, prop
  `confermaMessaggio`) prima di inviare — è un invio massivo (potenziale
  a tutti i bambini "da inviare" del mese), non reversibile con un
  semplice "annulla" una volta partito (le email sono già uscite; resta
  possibile solo "Annulla invio" sulla singola riga dopo, vedi sopra).
  Annullare il popup non invia nulla e non modifica la tabella.
- "Invia comunicazione" (singolare, su una riga) usa invece un popup
  proprio con l'anteprima strutturata della mail
  (`components/InvioSingoloRetta.tsx`), non un `window.confirm`: il
  contenuto da far controllare (in particolare il corpo) è
  potenzialmente lungo e va letto per bene, un popup nativo a una riga
  di testo non basterebbe. L'anteprima è calcolata lato client dai
  valori attuali dei campi della riga (stesse funzioni pure di
  `lib/comunicazioneRetta.ts` usate anche lato server, nessun round-trip
  necessario) — sempre coerente con quanto verrà davvero inviato, perché
  "Conferma invio" sottopone lo stesso form con `formAction` diretto
  (bind del solo `bambinoId`, come "Annulla invio"), non un'azione
  separata che potrebbe rileggere valori diversi.
- Ogni comunicazione (massiva o singola) viene inviata al genitore con
  in copia conoscenza (CC) l'indirizzo dell'asilo
  (`lib/email.ts`, `destinatarioNotifiche()` — stesso indirizzo usato
  dal cron del report notturno, specs/52, e dagli allarmi, specs/07:
  `info@asilosartorio.it` di default, sovrascrivibile con la variabile
  d'ambiente `REPORT_EMAIL_DESTINATARIO`), così l'asilo ha sempre una
  copia di ogni comunicazione inviata ai genitori. La CC non è
  visibile né configurabile dall'admin in pagina: è un comportamento
  fisso, non un'ulteriore voce del template. Lo stesso indirizzo è
  impostato come `Reply-To` (campo `reply_to` dell'API Resend, costruito
  da `lib/email.ts:costruisciPayloadEmail`): senza, ogni risposta
  tornerebbe al mittente tecnico e un "Rispondi a tutti" dell'asilo
  metterebbe il mittente tra i destinatari insieme ai genitori
  (issue #245).
- L'invio scrive un log in `comunicazioni_retta` (un solo record per
  bambino e mese, `supabase/migrations/0036_comunicazione_retta.sql`,
  stesso pattern di `pasti_comunicati` per la comunicazione pasti a
  Rojac, vedi
  [16 - comunicazione-pasti-rojac.md](16%20-%20comunicazione-pasti-rojac.md)):
  registra gli importi effettivamente comunicati (non ricalcolati in
  seguito, anche se il bambino cambia costi dopo l'invio), l'email
  destinataria, e chi/quando ha inviato. Immutabile nel senso che non si
  aggiorna mai una riga esistente: per correggerla (vedi "Annulla
  invio" sotto) la si elimina e se ne crea una nuova al prossimo invio,
  non la si modifica sul posto (`supabase/migrations/0038_annulla_comunicazione_retta.sql`,
  unica policy di delete, solo admin).
- Un bambino con un log già presente per il mese corrente è escluso da
  un nuovo invio con lo stesso click "Invia comunicazioni" (per evitare
  doppi invii accidentali); la tabella mostra per lui gli importi già
  comunicati invece dei campi da compilare, più un pulsante "Annulla
  invio" per liberarlo di nuovo.
- "Annulla invio" elimina la riga di `comunicazioni_retta` per quel
  bambino e quel mese, senza inviare nessuna nuova email: è solo la
  cancellazione del log che blocca il reinvio, l'ammissibilità del
  bambino (costi ed email configurati, ancora attivo) è verificata di
  nuovo al momento dell'invio successivo, come per qualunque altro
  bambino "da inviare". Se quella comunicazione includeva un
  credito/debito applicato (specs/58), l'annullo lo libera di nuovo
  ("da conteggiare"), disponibile per il prossimo invio dello stesso
  mese o modificabile/eliminabile dalla scheda del bambino.
- "Annulla invio" resta disponibile solo finché il bonifico di quella
  comunicazione è ancora "da verificare" (specs/59): una volta marcato
  (corretto o con importo diverso), annullare l'invio cancellerebbe
  anche la registrazione di un pagamento reale già avvenuto, quindi il
  pulsante sparisce.
- Il template della mail (`impostazioni_email_retta`, riga singola —
  `supabase/migrations/0036_comunicazione_retta.sql`) ha un oggetto e un
  corpo in testo semplice, entrambi con placeholder nella forma
  `{{nome_placeholder}}`, sostituiti prima dell'invio
  (`lib/comunicazioneRetta.ts`, `sostituisciPlaceholder`). Un
  placeholder scritto in modo errato o sconosciuto resta invariato nel
  testo finale (nessun errore bloccante). Gli "a capo" nel corpo
  diventano interruzioni di riga nell'email inviata (che è HTML).
- Placeholder disponibili: `{{nome}}`, `{{cognome}}`, `{{mese}}` (es.
  "settembre 2026"), `{{retta_mensile}}`, `{{costo_pasti}}`,
  `{{conguaglio_pasti}}`, `{{marca_da_bollo}}`, `{{costo_pre_asilo}}`,
  `{{costo_post_asilo}}`, `{{gettoni_pre_asilo}}`,
  `{{numero_gettoni_pre_asilo}}`, `{{gettoni_post_asilo}}`,
  `{{numero_gettoni_post_asilo}}`, `{{costi_extra}}`, `{{note_costi_extra}}`,
  `{{credito_debito}}`, `{{nota_credito_debito}}` (specs/58),
  `{{totale}}` — tutti gli importi già formattati in euro con la
  virgola (es. "250,00"; i `{{numero_gettoni_*}}` sono interi);
  `{{note_costi_extra}}` e
  `{{nota_credito_debito}}` sono invece testo libero (il contenuto del
  rispettivo campo nota, stringa vuota se non compilato). Un modello
  salvato prima dell'introduzione di un nuovo placeholder (es.
  `{{marca_da_bollo}}`, `{{note_costi_extra}}`, `{{credito_debito}}`)
  resta valido così com'è: il nuovo placeholder va aggiunto a mano
  dall'admin in "Modello email" se lo si vuole vedere nel testo
  dell'email (il totale lo include comunque, a prescindere dal
  template).
- Solo un profilo con ruolo `admin` può accedere a `/admin/rette`, alla
  pagina "Modello email" e inviare comunicazioni (`requireAdmin`, stesso
  pattern di [55 - costi-bambino.md](55%20-%20costi-bambino.md)).
- Fuori scope in questa fase: modificare gli importi di una
  comunicazione già inviata mantenendola (l'unico modo per correggerla
  è annullarla e reinviarla, vedi sopra), inviare o annullare una
  comunicazione per un mese diverso da quello corrente (navigare a un
  mese passato per *rivederlo* è invece in scope, vedi sopra), allegati
  (es. PDF) alla comunicazione, una vista d'archivio con filtri/ricerca
  sulle comunicazioni passate (solo la navigazione mese per mese), una
  traccia di chi/quando ha annullato una comunicazione (un mese passato
  mostra solo le comunicazioni tuttora presenti, non quelle annullate),
  più email/genitori diversi per lo stesso bambino. Backlog: issue
  [#94](https://github.com/matteopelucco/girasole/issues/94). La
  registrazione/verifica dei bonifici ricevuti è invece già coperta da
  [59 - verifica-bonifico-retta.md](59%20-%20verifica-bonifico-retta.md).
