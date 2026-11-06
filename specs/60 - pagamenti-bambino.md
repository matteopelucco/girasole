# 60 — Pagamenti bambino

## Attori
Admin.

## Obiettivo
L'admin vuole vedere, per un singolo bambino, quanto è stato chiesto alla
famiglia mese per mese lungo un anno scolastico (da settembre a giugno), con
l'importo scomposto nelle voci che lo compongono. Gli importi sono quelli
comunicati con la mail delle rette
([56 - comunicazione-retta-mensile.md](56%20-%20comunicazione-retta-mensile.md)),
comprensivi dell'eventuale credito/debito
([58 - crediti-debiti-bambino.md](58%20-%20crediti-debiti-bambino.md)), salvo
correzione esplicita: se un invio contiene un errore, l'admin corregge le voci
del mese con "Modifica importi", lasciando traccia del valore precedente e del
motivo (issue #421). Gli importi si modificano solo da "Modifica importi". In
più, per ogni mese comunicato, l'admin verifica il bonifico
([59 - verifica-bonifico-retta.md](59%20-%20verifica-bonifico-retta.md)) e può
scrivere una nota privata (PAG-16..PAG-22): "Rette" mostra solo lo stato del
bonifico, con un link "Verifica" che porta alla riga giusta di questa pagina.

## Scenario: il menu raggruppa "Rette" e "Pagamenti bambino" sotto "Pagamenti"
Dato che sono autenticato come admin
Quando guardo il menu laterale
Allora vedo la voce "Pagamenti" (un'intestazione di gruppo, non una pagina)
con sotto, nell'ordine, "Rette" e "Pagamenti bambino"
E "Rette" non compare più come voce di primo livello
E aprendo "Rette" dal menu vedo la tabella di revisione delle rette
(specs/56), con la voce "Rette" evidenziata

## Scenario: aprire la pagina senza aver scelto un bambino
Dato che sono autenticato come admin
Quando apro "Pagamenti bambino" dal menu
Allora vedo un selettore "Bambino" con l'elenco dei bambini e un pulsante
"Mostra"
E vedo un invito a scegliere un bambino, senza nessuna tabella dei mesi

## Scenario: vedere i mesi dell'anno scolastico di un bambino
Dato che sono sulla pagina "Pagamenti bambino"
Quando scelgo un bambino e premo "Mostra"
Allora vedo il suo nome e l'anno scolastico mostrato (es. "2026/2027")
E vedo una riga per ciascun mese da settembre a giugno, in
quest'ordine, con il mese e l'anno scritti per esteso (es. "settembre
2026")

## Scenario: un mese comunicato mostra le voci che compongono l'importo richiesto
Dato che per il bambino scelto è stata inviata la comunicazione retta di un
mese di quell'anno scolastico
Quando guardo la riga di quel mese
Allora vedo, una per colonna, le voci della comunicazione: retta mensile,
marca da bollo, costo pasti, conguaglio pasti, pre-asilo, post-asilo,
gettoni pre-asilo e gettoni post-asilo (PAG-01), costi extra e
credito/debito, ciascuna in euro con la virgola (es.
"250,00 €")
E vedo le note di costi extra e credito/debito, se presenti, sotto il
rispettivo importo
E vedo la data/ora di invio della comunicazione

## Scenario: il totale di ogni mese è ben visibile ed è quello della mail
Dato che per il bambino scelto è stata inviata la comunicazione di un mese
Quando guardo la riga di quel mese
Allora il totale è in una colonna "Totale" dedicata, in grassetto e con un
carattere più grande delle altre voci
E coincide con il totale registrato nella comunicazione (lo stesso
importo che la famiglia ha ricevuto nella mail, se il mese non è stato
modificato: PAG-07)

## Scenario: i gettoni sono nel dettaglio e nel totale del mese
**ID PAG-01**
Dato che la comunicazione di un mese ha gettoni pre-asilo 21,00 € (3
gettoni) e gettoni post-asilo 16,00 € (2 gettoni)
Quando guardo la riga di quel mese
Allora vedo due colonne con gli importi (21,00 € e 16,00 €), con il
numero di gettoni sotto
E il "Totale" della riga e il "Totale richiesto" dell'anno li includono,
perché sono quelli registrati nella comunicazione
E per i mesi inviati prima dei gettoni vedo 0,00 € e il totale di sempre

## Scenario: un mese senza comunicazione non mostra importi
Dato che per un mese dell'anno scolastico non è stata inviata nessuna
comunicazione retta per il bambino scelto
Quando guardo la riga di quel mese
Allora vedo "Non ancora comunicata" al posto delle voci e del totale
(nessun importo calcolato o stimato)

## Scenario: vedere il totale complessivo dell'anno scolastico
Dato che per il bambino scelto sono state inviate una o più comunicazioni
nell'anno scolastico mostrato
Quando guardo il fondo della tabella
Allora vedo il "Totale richiesto" dell'anno, somma dei totali dei mesi
comunicati, ben visibile

## Scenario: navigare all'anno scolastico precedente e successivo
Dato che ho scelto un bambino
Quando premo "←" accanto all'anno scolastico
Allora vedo lo stesso bambino sull'anno scolastico precedente, con i suoi
mesi da settembre a giugno
E premendo "→" torno a quello successivo (l'anno scolastico di riferimento è
l'ultimo raggiungibile: non si naviga oltre)

## Scenario: la pagina si modifica solo da «Modifica importi»
Dato che sono sulla pagina "Pagamenti bambino" con un bambino scelto
Quando guardo la pagina, a finestra chiusa
Allora non trovo nessun campo da compilare per gli importi né pulsanti di
invio o annullamento della comunicazione: i soli controlli sono il selettore
del bambino, le frecce degli anni scolastici e, per ogni mese comunicato, il
pulsante "Modifica importi", quelli del bonifico (specs/59) e la nota con
"Salva" (PAG-16..PAG-22)

## Scenario: il pulsante compare solo sui mesi comunicati
**ID PAG-02**
Dato che ho scelto un bambino con settembre comunicato e ottobre non ancora
comunicato
Quando guardo la tabella
Allora sulla riga di settembre, nella colonna "Inviata", vedo il pulsante
"Modifica importi"
E sulla riga di ottobre non lo vedo
E lo vedo anche sui mesi degli anni scolastici passati e sui bambini non più
attivi

## Scenario: la finestra propone tutte le voci con i valori attuali
**ID PAG-03**
Dato che sono sulla riga di un mese comunicato, con bonifico da verificare
Quando premo "Modifica importi"
Allora si apre una finestra con il nome del bambino e il mese nel titolo
E vedo un campo con l'importo attuale per retta mensile, marca da bollo,
pasti, conguaglio pasti, pre-asilo, post-asilo, gettoni pre-asilo, gettoni
post-asilo, costi extra e credito/debito
E vedo le note di costi extra e credito/debito, modificabili
E il numero dei gettoni è scritto sotto il rispettivo importo, come testo
non modificabile
E vedo il campo obbligatorio "Motivo della modifica", vuoto
E vedo l'avviso che la modifica non invia nessuna mail alla famiglia

## Scenario: il totale si aggiorna mentre scrivo
**ID PAG-04**
Dato che la finestra è aperta su un mese con totale 410,00 €
Quando porto i pasti da 108,00 € a 100,00 €
Allora il totale nella finestra diventa 402,00 € senza salvare
E il totale non è un campo: è sempre la somma delle voci
E un conguaglio o un credito negativi riducono il totale

## Scenario: salvare la modifica aggiorna il mese senza inviare mail
**ID PAG-05**
Dato che ho cambiato una o più voci e scritto il motivo
Quando premo "Salva"
Allora la finestra si chiude e la riga mostra le voci nuove
E il totale della riga è ricalcolato dal server come somma delle voci
E il "Totale richiesto" dell'anno è aggiornato
E la data "Inviata il" non cambia
E nessuna mail parte verso la famiglia

## Scenario: dati non validi non salvano nulla
**ID PAG-06**
Dato che la finestra è aperta
Quando provo a salvare senza motivo, oppure con un importo non numerico, con
più di due decimali o troppo grande, oppure con una voce negativa diversa da
conguaglio pasti e credito/debito, oppure senza aver cambiato nessun valore
Allora vedo un messaggio che spiega cosa correggere e la finestra resta aperta
con i dati scritti
E gli importi registrati non cambiano e nello storico non compare nulla

## Scenario: un mese modificato mostra che è stato corretto
**ID PAG-07**
Dato che il mese di settembre è stato modificato da 410,00 € a 402,00 €
Quando guardo la sua riga
Allora sotto "Inviata il …" leggo "Modificata il … da …"
E leggo "Totale della mail: 410,00 €"
E la colonna "Totale" mostra 402,00 €
E con più modifiche vedo la data dell'ultima e il totale della mail originale

## Scenario: lo storico delle modifiche resta consultabile
**ID PAG-08**
Dato che un mese è stato modificato due volte
Quando apro "Storico modifiche" sulla sua riga
Allora vedo le due modifiche, dalla più recente, ciascuna con data, chi l'ha
fatta, motivo e le sole voci cambiate con valore prima e dopo, compreso il
totale
E lo storico non si può modificare né cancellare dall'app
E un mese mai modificato non mostra "Storico modifiche"

## Scenario: con il bonifico verificato non si modifica
**ID PAG-09**
Dato che il bonifico di un mese è "corretto" o "importo diverso" (specs/59)
Quando guardo la sua riga
Allora il pulsante "Modifica importi" è disattivato e vedo la spiegazione:
prima va annullata la verifica del bonifico
E se la richiesta arriva comunque al server (per esempio perché la verifica è
stata fatta in un'altra scheda del browser), viene rifiutata e non cambia nulla
E dopo "Annulla verifica" il pulsante torna attivo

## Scenario: togliere o aggiungere pre/post-asilo avvisa delle conseguenze
**ID PAG-10**
Dato che la finestra è aperta su un mese con pre-asilo 70,00 €
Quando porto il pre-asilo a 0,00 €
Allora prima di salvare vedo l'avviso che i giorni di quel mese non risultano
più coperti dall'abbonamento: cambiano la schermata presenze e i gettoni della
retta successiva, se non è ancora stata inviata
E lo stesso avviso compare passando da 0,00 € a un importo, e per il
post-asilo
E l'avviso non compare se l'importo cambia restando maggiore di zero
E una retta successiva già inviata non cambia

## Scenario: gli altri mesi non vengono ricalcolati
**ID PAG-11**
Dato che ho corretto i pasti di settembre
Quando guardo ottobre, già inviato
Allora i suoi importi e il suo conguaglio pasti sono quelli di prima
E se la correzione deve riflettersi altrove, la faccio io su quel mese

## Scenario: il credito/debito cambia solo nella retta
**ID PAG-12**
Dato che un mese ha un credito/debito già conteggiato di 185,00 € (specs/58)
Quando lo porto a 150,00 € da "Modifica importi"
Allora cambia l'importo della retta di quel mese
E sulla scheda del bambino la sua riga resta "conteggiato" con 185,00 €
E il motivo della modifica nello storico spiega la differenza

## Scenario: anche «Rette» mostra gli importi corretti
**ID PAG-13**
Dato che ho modificato un mese da 410,00 € a 402,00 €
Quando apro quel mese in "Rette" (specs/56)
Allora vedo le voci e il totale corretti
E "Importo atteso" del bonifico (specs/59) è 402,00 €

## Scenario: annullare l'invio di una retta modificata
**ID PAG-14**
Dato che una retta del mese corrente è stata modificata e il suo bonifico è da
verificare
Quando premo "Annulla invio" in "Rette" (specs/56)
Allora la retta e il suo storico spariscono
E il credito/debito torna "da conteggiare" con il suo importo della scheda,
non con quello corretto
E il nuovo invio ricalcola tutti gli importi

## Scenario: la finestra è usabile da tastiera e su telefono
**ID PAG-15**
Dato che ho aperto la finestra con "Modifica importi"
Quando premo Esc o "Annulla"
Allora la finestra si chiude senza salvare e il focus torna sul pulsante
E mentre è aperta il focus resta al suo interno
E su uno schermo stretto tutte le voci si leggono e si compilano senza scorrere
in orizzontale, con il pulsante "Salva" raggiungibile

## Scenario: un mese comunicato ha la colonna "Bonifico" con le azioni di verifica
**ID PAG-16**
Dato che per il bambino scelto è stata inviata la comunicazione di un mese
Quando guardo la riga di quel mese
Allora nella colonna "Bonifico" vedo "Bonifico da verificare" con i
pulsanti "Bonifico corretto" e "Importo diverso", che si comportano come in
specs/59 (stessi messaggi, stessa finestra, stessa accessibilità)
E dopo la verifica vedo lo stato registrato e il pulsante "Annulla verifica"
E un mese senza comunicazione non ha né stato né pulsanti del bonifico

## Scenario: un mese passato è sempre verificabile
**ID PAG-17**
Dato che scelgo un anno scolastico passato con una comunicazione il cui
bonifico è ancora da verificare
Quando guardo la riga di quel mese
Allora trovo "Bonifico corretto" e "Importo diverso" attivi, come per
qualunque altro mese

## Scenario: il link "Verifica" di "Rette" porta alla riga del mese
**ID PAG-18**
Dato che in "Rette" vedo la riga di un bambino con la comunicazione di un mese
Quando premo il link "Verifica"
Allora si apre "Pagamenti bambino" su quel bambino e sull'anno scolastico di
quel mese
E la riga di quel mese è quella indicata dall'indirizzo (`#mese-AAAA-MM`)

## Scenario: scrivere e salvare una nota per riga
**ID PAG-19**
Dato che per il bambino scelto è stata inviata la comunicazione di un mese
Quando scrivo un testo nel campo "Nota" di quella riga e premo "Salva"
Allora vedo una conferma visibile ("Nota salvata")
E ricaricando la pagina la nota è ancora lì
E un mese senza comunicazione non ha il campo nota

## Scenario: modificare e svuotare la nota
**ID PAG-20**
Dato che una riga ha già una nota salvata
Quando cambio il testo e premo "Salva"
Allora vale l'ultimo testo, senza storico delle modifiche
E se svuoto il campo e premo "Salva" la nota viene cancellata e dopo il
ricaricamento il campo è vuoto

## Scenario: la nota ha un limite di 500 caratteri
**ID PAG-21**
Dato che sto scrivendo la nota di una riga
Quando il testo supera i 500 caratteri
Allora il campo mostra il conteggio e non permette di scriverne oltre
E se un testo troppo lungo arriva comunque al server, "Salva" risponde con
un errore chiaro e la nota già salvata non cambia

## Scenario: la nota resta com'è con "Annulla verifica" e "Importo diverso"
**ID PAG-22**
Dato che una riga ha una nota salvata
Quando verifico il bonifico con "Importo diverso" (con la sua nota del
bonifico, specs/59) e poi premo "Annulla verifica"
Allora la nota della riga è identica a prima, e non è mai stata mescolata
con la nota del bonifico

## Scenario: accesso negato a chi non è admin
Dato che sono autenticato come maestra, assistente o genitore
Quando guardo il menu
Allora non vedo né "Pagamenti" né "Pagamenti bambino"
E se provo ad aprire `/admin/pagamenti-bambino` vengo reindirizzato alla
dashboard
E se invio comunque una modifica degli importi o provo a leggere lo storico,
vengo respinto e non cambia nulla (controllo sul server e sul DB)

## Regole
- Pagina `/admin/pagamenti-bambino`, Server Component: legge con la sessione
  dell'admin (RLS admin-only su `bambini` e `comunicazioni_retta`), mai con
  chiavi di servizio. Scritture: "Modifica importi", la verifica del
  bonifico (specs/59) e la nota per riga (azioni di
  `app/admin/pagamenti-bambino/actions.ts`, ognuna con `requireAdmin` sul server). Solo un profilo
  `admin` può accedervi (`requireAdmin`, come le altre pagine admin).
- Ogni riga di mese ha l'ancora `id="mese-AAAA-MM"`: il link "Verifica" di
  "Rette" apre `/admin/pagamenti-bambino?bambino=<id>&anno=<anno di inizio>#mese-AAAA-MM`.
- Nota per riga: colonna `nota_pagamento` di `comunicazioni_retta`
  (`supabase/migrations/0073_nota_pagamento_comunicazioni_retta.sql`), testo,
  vuota di default, massimo 500 caratteri (CHECK nel database e controllo
  nell'azione `salvaNotaPagamento`, `lib/pagamentiBambino.ts`). Si scrive
  solo su un mese già comunicato, con "Salva" per riga e conferma visibile.
  Una nota svuotata cancella il testo (diventa vuota), nessuno storico:
  vale l'ultimo testo. È separata da `bonifico_nota` (specs/59), che
  l'azione non tocca mai. È privata: la legge e la scrive solo l'admin (RLS
  già admin-only su `comunicazioni_retta`, nessuna policy o GRANT nuovi) e non
  compare mai nell'email ai genitori né nel PDF della retta. "Annulla
  invio" (specs/56) cancella la riga e quindi anche la nota.
- Bambino e anno scolastico sono nella query string (`?bambino=<id>&anno=
  <anno di inizio>`, es. `anno=2026` per il 2026/2027): la pagina è
  condivisibile e funziona senza JavaScript (il selettore è un normale
  form GET). Un `bambino` non valido o inesistente equivale a nessun
  bambino scelto; un `anno` mancante o non valido equivale all'anno
  scolastico di riferimento.
- L'anno scolastico di riferimento è quello che contiene il mese corrente
  (fuso Europe/Rome): da settembre a dicembre è l'anno che inizia quel
  settembre, da gennaio ad agosto è quello iniziato il settembre
  precedente (a luglio e agosto resta quindi l'anno appena concluso).
  Non si può navigare oltre l'anno di riferimento; indietro sì (il
  limite è l'anno 2000, per scartare valori assurdi). Non dipende dagli
  "anni scolastici" anagrafici di specs/04, che sono solo un'etichetta
  per raggruppare le sezioni.
- I mesi mostrati sono sempre dieci: settembre → giugno (luglio e agosto
  non hanno retta).
- L'importo richiesto di un mese è letto da `comunicazioni_retta` (stesso
  log da cui la tabella "Rette" mostra le comunicazioni passate, specs/56)
  e non viene mai ricalcolato dai costi del bambino: coincide con quanto
  inviato nella mail, anche se in seguito il bambino cambia costi, finché
  l'admin non lo corregge con "Modifica importi". Le voci
  sono quelle della comunicazione (specs/56): retta mensile, marca da
  bollo, costo pasti, conguaglio pasti, pre-asilo, post-asilo, gettoni
  pre-asilo e post-asilo (importo e numero, #400), costi extra
  (con nota), credito/debito (con nota, specs/58). Il totale di una
  comunicazione è quello registrato (`totale`).
- Sono visibili anche i bambini non più attivi (lo storico dei pagamenti
  resta consultabile).
- "Modifica importi" (issue #421) cambia sul posto la riga di
  `comunicazioni_retta`: voci, note di costi extra e credito/debito e totale.
  Non cambia mai `inviata_il`, `inviata_da`, `email_destinatario`, il
  numero dei gettoni e le colonne del bonifico. Il totale è sempre la somma
  delle dieci voci (la stessa di `calcolaRiepilogoRetta`), ricalcolata dal
  server: quello mostrato mentre si scrive è solo un'anteprima.
- Voci: non negative, salvo conguaglio pasti e credito/debito; due decimali;
  entro i limiti delle colonne (`numeric(8, 2)` per i gettoni). Il totale può
  risultare negativo (un credito grande). Motivo obbligatorio, non vuoto dopo
  aver tolto gli spazi.
- Nuova tabella `modifiche_comunicazioni_retta`, solo in aggiunta: riferimento
  alla comunicazione (`on delete cascade`, così "Annulla invio" cancella anche
  lo storico), valori prima e dopo, motivo, chi e quando (con il nome scritto
  per esteso, come `inviata_da_nome`). RLS: solo l'admin legge; nessuna policy
  né privilegio di update o delete. `GRANT` minimi nella stessa migration.
- Modifica e riga di storico si scrivono nella stessa transazione, con una
  funzione del DB riservata all'admin, che rifiuta anche la modifica se
  `bonifico_stato` non è `in_attesa`: il controllo vale nel momento della
  scrittura, non solo quando si è aperta la pagina. Niente blocco per due
  modifiche contemporanee: vince l'ultima e lo storico le mostra entrambe.
- Il totale della mail è il totale "prima" della modifica più vecchia.
- Il pulsante e lo storico stanno nella colonna "Inviata", per non aggiungere
  una colonna a una tabella che già scorre in orizzontale. La finestra usa
  `components/ui/finestra.tsx`, come "Importo diverso" (specs/59).
- Il testo introduttivo della pagina non dice più "sola lettura".
- "Rette" resta raggiungibile da `/admin/rette` e da "Pagamenti › Rette";
  "Pagamenti" non ha una pagina propria, è solo l'intestazione del gruppo
  (`lib/navigazione.ts`).
- Fuori scope: stimare l'importo di un mese non ancora comunicato (compreso
  il mese corrente, per cui l'anteprima resta in "Rette"), esportazioni, vista aggregata di tutti i bambini, mail
  di rettifica alla famiglia, modificare il numero dei gettoni, creare da qui
  la retta di un mese non comunicato, ricalcolare a catena gli altri mesi.
  note su mesi non comunicati, storico delle modifiche della nota.
