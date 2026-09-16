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
Quando apro "Rette" dal menu
Allora vedo il nome del mese corrente in intestazione, e una riga per
ciascun bambino attivo con: nome e cognome (con l'email a cui verrà
inviata la comunicazione subito sotto, tra parentesi), retta mensile e
marca da bollo (testo, in quest'ordine), costo pasti proiettato,
eventuale conguaglio pasti del mese precedente, costo pre-asilo e costo
post-asilo (questi ultimi tre modificabili), un campo "Costi extra" (con
una nota facoltativa) da compilare, un eventuale credito/debito "da
conteggiare" questo mese (specs/58, con la sua nota, anch'esso
modificabile), e il totale calcolato

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
Quando modifico il valore di costo pasti, conguaglio pasti, pre-asilo o
post-asilo — non solo i già modificabili costi extra/nota — rispetto a
quello proposto, e premo "Invia comunicazioni"
Allora l'email inviata e il log della comunicazione registrano il
valore che ho scritto io, non quello ricalcolato automaticamente —
utile per una correzione o uno sconto una tantum che non deriva da
nessun calcolo

## Scenario: retta e marca da bollo non sono modificabili dalla tabella
Dato che sono sulla tabella di revisione del mese corrente, su un
bambino non ancora comunicato
Quando guardo le colonne "Retta" e "Marca da bollo"
Allora le vedo come testo, non come campi compilabili: per cambiare il
prezzo della retta si va sulla scheda del bambino (specs/55); la marca
da bollo non è modificabile da nessuna parte, è un importo fisso per
legge

## Scenario: il costo pasti del mese corrente è proiettato sui giorni di apertura
Dato che il mese corrente ha un certo numero di giorni feriali di
apertura (weekend e giorni di chiusura registrati esclusi, vedi
[53 - calendario-scolastico.md](53%20-%20calendario-scolastico.md))
Quando guardo la colonna "Costo pasti" di un bambino in tabella
Allora l'importo mostrato è (giorni di apertura del mese corrente) ×
(prezzo del suo buono pasto) — una stima, dato che il mese corrente non
è ancora trascorso

## Scenario: il conguaglio pasti riflette le assenze del mese precedente
Dato che nel mese precedente il bambino risulta assente o malato in
alcuni giorni (presenze già registrate e concluse)
Quando guardo la colonna "Conguaglio pasti mese precedente" di quel
bambino
Allora l'importo mostrato è negativo, pari a (giorni di assenza/
malattia del mese precedente) × (prezzo del suo buono pasto) — un
rimborso per i pasti stimati ma non consumati

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
  apertura per tutti).
- Pre-asilo e post-asilo contano il loro prezzo pieno se richiesti
  (specs/55), 0 se non richiesti: non dipendono dai giorni di apertura
  né dalle presenze effettive.
- Il totale di una riga è: retta mensile + costo pasti (proiettato) +
  conguaglio pasti (negativo o zero) + marca da bollo + costo pre-asilo
  + costo post-asilo + costi extra + credito/debito (specs/58,
  negativo se credito, positivo se debito). Può risultare negativo
  (credito verso la famiglia) se conguaglio e/o credito superano gli
  altri importi: non viene forzato a zero.
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
- Ordine delle colonne dei costi: retta, marca da bollo, costo pasti,
  conguaglio pasti, pre-asilo, post-asilo, costi extra, nota, totale,
  stato — marca da bollo subito dopo retta (entrambe testo, non
  modificabili) invece che dopo conguaglio pasti, per tenere vicine le
  due voci non modificabili.
- Costo pasti, conguaglio pasti, pre-asilo e post-asilo di un bambino
  da comunicare (oltre ai già modificabili costi extra/nota) sono campi
  compilabili, precompilati con il valore calcolato automaticamente ma
  sovrascrivibili per applicare una correzione ad-hoc che non deriva da
  nessun calcolo (es. uno sconto una tantum, la correzione di un
  errore) — coerente con specs/01 - ux.md, non serve toccare i
  parametri permanenti del bambino (specs/55) per un aggiustamento
  valido solo questo mese. Conguaglio pasti resta l'unica voce che può
  essere negativa (è per natura un credito, mai un addebito); le altre
  restano vincolate a un numero non negativo, come ovunque nell'app.
- Retta e marca da bollo restano invece testo, non modificabili da
  questa tabella: la retta si cambia solo sulla scheda del bambino
  (specs/55, ha senso solo come cambio permanente, non un aggiustamento
  di un mese); la marca da bollo non è modificabile da nessuna parte,
  essendo un importo fisso per legge.
- Le modifiche a costo pasti/conguaglio pasti/pre-asilo/post-asilo non
  hanno un salvataggio separato per riga: restano solo nel form finché
  non si preme "Invia comunicazioni". A quel punto il server usa
  esattamente i valori presenti nel form in quel momento per queste
  quattro voci (non li ricalcola dai dati vivi di presenze), mentre
  retta e marca da bollo restano sempre quelli letti da
  `costi_bambini` in quel momento (mai dal form, che non li contiene) —
  la persistenza avviene quindi come parte dell'invio stesso, non
  prima: se non si preme "Invia comunicazioni" le modifiche non
  lasciano traccia (specs/05 - feedback.md, coerente con "l'effetto è
  la conferma" per il resto dell'app).
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
  fisso, non un'ulteriore voce del template.
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
  `{{costo_post_asilo}}`, `{{costi_extra}}`, `{{note_costi_extra}}`,
  `{{credito_debito}}`, `{{nota_credito_debito}}` (specs/58),
  `{{totale}}` — tutti gli importi già formattati in euro con la
  virgola (es. "250,00"); `{{note_costi_extra}}` e
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
  più email/genitori diversi per lo stesso bambino, registrazione dei
  bonifici ricevuti (resta in [00 - overview.md](00%20-%20overview.md),
  backlog Fase 2).
