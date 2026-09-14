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
[55 - costi-bambino.md](55%20-%20costi-bambino.md).

## Scenario: vedere la tabella di revisione della comunicazione del mese corrente
Dato che sono autenticato come admin
Quando apro "Rette" dal menu
Allora vedo il nome del mese corrente in intestazione, e una riga per
ciascun bambino attivo con: retta mensile, costo pasti proiettato,
eventuale conguaglio pasti del mese precedente, marca da bollo, costo
pre-asilo, costo post-asilo, un campo "Costi extra" (con una nota
facoltativa) da compilare, e il totale calcolato

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
Quando guardo la colonna "Conguaglio pasti" di quel bambino
Allora l'importo mostrato è negativo, pari a (giorni di assenza/
malattia del mese precedente) × (prezzo del suo buono pasto) — un
rimborso per i pasti stimati ma non consumati

## Scenario: inserire un costo extra del mese e vederlo nel totale
Quando scrivo un importo nel campo "Costi extra" di un bambino (ed
eventualmente una nota che lo descrive)
Allora il totale calcolato per quella riga lo include

## Scenario: inviare le comunicazioni con un click
Dato che ho controllato i dati in tabella per il mese corrente
Quando premo "Invia comunicazioni"
Allora per ogni bambino con un'email di promemoria configurata
(specs/55) e non ancora comunicato questo mese, viene inviata un'email
con gli importi (usando il template configurato) e viene registrato un
log della comunicazione (bambino, mese, ciascun importo, email
destinatario, chi e quando)
E i bambini senza email di promemoria configurata non ricevono nulla e
restano segnalati in tabella come tali

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
  bambini attivi (`bambini.attiva`), indipendentemente dalla sezione.
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
  + costo post-asilo + costi extra. Può risultare negativo (credito
  verso la famiglia) se il conguaglio supera gli altri importi: non
  viene forzato a zero.
- Un bambino senza una riga in `costi_bambini`, o con `email_promemoria`
  vuota, è mostrato in tabella con un avviso e un link alla sua scheda
  per completare i dati (specs/55); non riceve nessuna comunicazione
  finché non viene completata.
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
  bambino "da inviare".
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
  `{{costo_post_asilo}}`, `{{costi_extra}}`, `{{totale}}` — tutti gli
  importi già formattati in euro con la virgola (es. "250,00"). Un
  modello salvato prima dell'introduzione di `{{marca_da_bollo}}` resta
  valido così com'è: il nuovo placeholder va aggiunto a mano dall'admin
  in "Modello email" se lo si vuole vedere nel testo dell'email (il
  totale lo include comunque, a prescindere dal template).
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
