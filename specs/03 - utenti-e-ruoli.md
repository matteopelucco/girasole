# 03 — Utenti e ruoli

## Attori
Admin.

## Obiettivo
Il sistema è multi-utente e gestisce gli account **direttamente dall'app**,
senza dipendere dal dashboard di Supabase o da un flusso di
auto-registrazione: è l'admin a creare, modificare ed eliminare gli
utenti da `/admin/maestre`.

## Dati di un utente
- **email** — funge anche da username, univoca.
- **password** — almeno 8 caratteri, con una lettera minuscola, una
  maiuscola, un numero e un carattere speciale (vedi
  `lib/password.ts`, `REGOLA_PASSWORD`). In fase di creazione va
  digitata due volte (password + conferma), con un riscontro in tempo
  reale se le due coincidono o no — evita di scoprire un errore di
  battitura solo al momento del primo login. Entrambi i campi hanno un
  pulsante "occhio" per mostrare/nascondere il testo in chiaro, ancorato
  verticalmente al proprio campo — non si sposta quando compare il
  riscontro "le password coincidono/non coincidono" sotto al campo
  conferma (bug corretto: il riscontro, comparendo, allungava la cella
  del campo password nel layout a griglia, e l'occhio — assoluto rispetto
  al proprio contenitore, non al campo — seguiva quell'allungamento).
  L'admin può anche impostare una nuova password per un utente già
  esistente (stessa regola di complessità, stessa doppia digitazione con
  riscontro in tempo reale), ad esempio quando un utente l'ha dimenticata
  e non può o non vuole usare il recupero password via email (vedi
  [02 - password-recovery.md](02%20-%20password-recovery.md)).
- **nome**
- **cognome**
- **numero di telefono**
- **abilitazione al report ore di lavoro** — checkbox, falsa di default;
  decide se l'utente vede la sezione "Ore di lavoro" in dashboard (vedi
  [17 - ore-di-lavoro.md](17%20-%20ore-di-lavoro.md))
- **profilo orario** — menu a tendina opzionale, tra i profili definiti
  dall'admin (vedi [54 - profili-orari.md](54%20-%20profili-orari.md)),
  indipendente dall'abilitazione al report ore

## Ruoli
Un utente ha uno e un solo ruolo, tra:
- **admin** — tutti i privilegi di una maestra, più la gestione di tutti
  gli utenti e dei loro ruoli.
- **maestra** *(corrisponde a "insegnante" nel linguaggio corrente)* —
  gestione (crud) della propria sezione, dei bambini, delle presenze,
  dei pasti e degli avvisi (vedi
  [12 - dashboard-maestre.md](12%20-%20dashboard-maestre.md),
  [13 - segna-presenza.md](13%20-%20segna-presenza.md),
  [14 - segna-pasto.md](14%20-%20segna-pasto.md),
  [15 - memo.md](15%20-%20memo.md)). La gestione diretta degli account
  genitore da parte della maestra è backlog (vedi Fuori scope sotto).
- **assistente** — segue i bambini durante le attività in sostegno alle
  maestre. Assegnata a una o più sezioni esattamente come una maestra
  (stessa tabella `maestre_sezioni`, vedi
  [50 - amministrazione_base.md](50%20-%20amministrazione_base.md)), con
  **gli stessi permessi di una maestra tranne sul registro pasti**, a cui
  non ha accesso né in lettura né in scrittura (vedi
  [14 - segna-pasto.md](14%20-%20segna-pasto.md)). Vale in particolare
  anche per le presenze a pre-asilo/post-asilo (vedi
  [13 - segna-presenza.md](13%20-%20segna-presenza.md)). Come la maestra,
  può scrivere solo sulla data odierna (vedi Regole in
  [13 - segna-presenza.md](13%20-%20segna-presenza.md)).
- **genitore** — accesso in sola lettura ai dati del proprio figlio e
  alle comunicazioni di maestre/admin.

## Matrice permessi per funzionalità
Riepilogo di chi può fare cosa, per evitare di ripetere la stessa regola
in ogni file — il dettaglio di ciascuna riga resta nel file linkato.

| Funzionalità | admin | maestra | assistente | genitore |
| --- | --- | --- | --- | --- |
| Sezioni/bambini/utenti ([50](50%20-%20amministrazione_base.md)) | crud | — | — | — |
| Presenze, incl. pre/post-asilo ([13](13%20-%20segna-presenza.md)) | crud, ogni data | crud, solo oggi, proprie sezioni | crud, solo oggi, proprie sezioni | lettura, solo il proprio figlio (fuori scope UI) |
| Pasti ([14](14%20-%20segna-pasto.md)) | crud, ogni data | crud, solo oggi, proprie sezioni | **nessun accesso** | lettura, solo il proprio figlio (fuori scope UI) |
| Avvisi ([15](15%20-%20memo.md)) | crud | crud | crud | lettura dei soli avvisi a lui destinati (fuori scope UI) |
| Report/anagrafica classi ([51](51%20-%20report.md)) | tutte le classi | proprie classi | proprie classi | — |

Nota: "assistente" è stato assunto con lo stesso perimetro di una maestra
su avvisi e report (nessuna indicazione contraria nel requisito che
ha introdotto il ruolo) — se in pratica dovesse restare più limitata, è
una riga sola da correggere in questa tabella.

## Scenario: admin crea un nuovo utente
Dato che sono autenticato come admin
Quando su `/admin/maestre` compilo nome, cognome, email, telefono,
password e scelgo un ruolo (admin, maestra, assistente o genitore), e
confermo
Allora l'utente viene creato e compare subito nell'elenco con i dati e il
ruolo scelti
E può accedere subito a `/login` con quell'email e quella password
E il form torna vuoto (tutti i campi ripristinati ai valori iniziali,
ruolo compreso), pronto per crearne subito un altro senza dover
cancellare a mano i dati dell'utente appena creato

## Scenario: creazione con password troppo debole
Quando su `/admin/maestre` provo a creare un utente con una password che
non rispetta i requisiti di complessità
Allora vedo un messaggio d'errore che spiega la regola e l'utente non
viene creato
E tutti gli altri campi già compilati (nome, cognome, email, telefono,
ruolo) restano nel form: non devo reinserirli, mi basta correggere la
password

## Scenario: conferma password in tempo reale
Quando su `/admin/maestre` sto compilando il form di creazione utente
Allora vedo due campi password (Password e Conferma password)
E mentre scrivo nel campo "Conferma password" vedo subito un riscontro
se coincide o no con il campo "Password", senza dover inviare il form

## Scenario: creazione con password non confermata correttamente
Quando su `/admin/maestre` invio il form con "Password" e "Conferma
password" diversi tra loro
Allora vedo un messaggio d'errore e l'utente non viene creato

## Scenario: creazione con email già in uso
Quando su `/admin/maestre` provo a creare un utente con un'email già
usata da un altro account
Allora vedo un messaggio d'errore e l'utente non viene creato

## Scenario: creazione con campi obbligatori mancanti
Quando su `/admin/maestre` invio il form di creazione senza compilare
nome, cognome, email o telefono
Allora vedo un messaggio d'errore e l'utente non viene creato

## Scenario: admin modifica i dati di un utente
Dato che un utente esiste già
Quando su `/admin/maestre` modifico nome, cognome, telefono e/o ruolo di
quell'utente e confermo
Allora i nuovi dati sono salvati e visibili nell'elenco

## Scenario: admin imposta una nuova password per un utente esistente
Dato che un utente esiste già
Quando su `/admin/maestre` trovo la sua riga, compilo i campi "Nuova
password" e "Conferma nuova password" e premo "Imposta password"
Allora la password dell'utente viene aggiornata
E l'utente può accedere subito a `/login` con la nuova password (la
vecchia password non funziona più)
E gli altri dati dell'utente (email, nome, cognome, telefono, ruolo,
...) restano invariati

## Scenario: impostazione password con conferma non coincidente
Quando su `/admin/maestre` invio "Imposta password" con "Nuova password"
e "Conferma nuova password" diversi tra loro
Allora vedo un messaggio d'errore e la password dell'utente non viene
cambiata

## Scenario: impostazione di una password troppo debole
Quando su `/admin/maestre` invio "Imposta password" con una password che
non rispetta i requisiti di complessità
Allora vedo un messaggio d'errore che spiega la regola e la password
dell'utente non viene cambiata

## Scenario: admin elimina un utente
Dato che sono su `/admin/maestre`
Quando premo l'icona a forma di cestino rossa "Elimina utente", in alto a
destra nella scheda di un account
E nella finestra di conferma spunto "Ne sono consapevole" e premo
"Procedi con la cancellazione utente"
Allora l'account non compare più nell'elenco e non può più accedere
all'app

## Scenario: la cancellazione richiede una conferma consapevole
Quando su `/admin/maestre` premo l'icona cestino "Elimina utente" di un
account
Allora si apre una finestra che avvisa che l'eliminazione è definitiva e
non si può annullare, e indica l'email dell'account
E la casella "Ne sono consapevole" non è spuntata
E il pulsante "Procedi con la cancellazione utente" è disabilitato
Quando spunto "Ne sono consapevole"
Allora il pulsante "Procedi con la cancellazione utente" si abilita
Quando tolgo di nuovo la spunta
Allora il pulsante torna disabilitato

## Scenario: annullare la cancellazione di un utente
Dato che ho aperto la finestra di conferma dell'eliminazione di un
account
Quando premo "Annulla" (oppure il tasto Esc)
Allora la finestra si chiude, l'account resta nell'elenco
E riaprendo la finestra la casella "Ne sono consapevole" è di nuovo non
spuntata

## Scenario: l'admin non può eliminare il proprio account
Quando su `/admin/maestre` provo a eliminare il mio stesso account,
confermando nella finestra di conferma
Allora vedo un messaggio d'errore e il mio account resta attivo

## Scenario: accesso negato a chi non è admin
Dato che sono autenticato come maestra, assistente o genitore
Quando provo ad aprire `/admin/maestre`
Allora vengo reindirizzato alla dashboard

## Regole
- Eliminazione di un account: l'unico comando nella scheda è l'icona
  cestino rossa in alto a destra (con etichetta accessibile "Elimina
  utente"), non un pulsante testuale in fondo alla scheda. La
  cancellazione vera parte solo dalla finestra di conferma, dopo la spunta
  esplicita di "Ne sono consapevole": un solo tap non basta mai a
  eliminare un account.
- Un utente ha sempre e solo uno dei quattro ruoli (`admin`, `maestra`,
  `assistente`, `genitore`): non è un insieme di permessi combinabili, è
  una colonna singola (`profili.ruolo`).
- La creazione/eliminazione di un account avviene lato server con la
  service_role key di Supabase (`lib/supabase/admin.ts`), mai esposta al
  browser — vedi `supabase/migrations/0005_utenti_gestiti_da_app.sql` per
  lo schema e `CLAUDE.md` per le regole di sicurezza sulla service_role
  key.
- Il form di creazione utente segue lo stesso pattern "errore ⇒ dati
  preservati" di tutte le altre form di creazione (specs/05 -
  feedback.md): un errore di validazione non svuota il form. La
  creazione riuscita non mostra un banner aggiuntivo (l'effetto — il
  nuovo utente in elenco — è già la conferma).
- Il primissimo admin del sistema va comunque promosso a mano via SQL
  Editor (bootstrap): per creare un utente dall'app serve già essere
  autenticati come admin, quindi non può esistere un flusso interamente
  self-service per il primo account (vedi
  [11 - login.md](11%20-%20login.md)).

## Fuori scope in questa fase
- La maestra non ha (ancora) un proprio pannello per creare/modificare/
  eliminare account genitore: quella gestione resta riservata all'admin.
  Backlog: issue [#85](https://github.com/matteopelucco/girasole/issues/85).
- Rette/pagamenti e portale genitori restano fuori scope come da
  [00 - overview.md](00%20-%20overview.md).

Nota: indirizzo di residenza e note dell'utente (facoltativi, vedi
[04 - data-types.md](04%20-%20data-types.md)) sono nello schema `profili`
e gestibili da `/admin/maestre` dalla creazione dell'utente in poi.
