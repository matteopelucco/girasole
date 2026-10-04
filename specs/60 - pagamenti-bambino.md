# 60 — Pagamenti bambino

## Attori
Admin.

## Obiettivo
L'admin vuole vedere, per un singolo bambino, quanto è stato chiesto alla
famiglia mese per mese lungo un anno scolastico (da settembre a giugno), con
l'importo scomposto nelle voci che lo compongono. È una vista di sola
lettura sugli importi effettivamente comunicati con la mail delle rette
([56 - comunicazione-retta-mensile.md](56%20-%20comunicazione-retta-mensile.md)):
l'importo richiesto di un mese è esattamente quello registrato al momento
dell'invio della comunicazione, comprensivo dell'eventuale credito/debito
([58 - crediti-debiti-bambino.md](58%20-%20crediti-debiti-bambino.md)). La
verifica del bonifico resta in "Rette"
([59 - verifica-bonifico-retta.md](59%20-%20verifica-bonifico-retta.md)).

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
costi extra e credito/debito, ciascuna in euro con la virgola (es.
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
importo che la famiglia ha ricevuto nella mail)

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

## Scenario: la pagina è di sola lettura
Dato che sono sulla pagina "Pagamenti bambino" con un bambino scelto
Quando guardo la pagina
Allora non trovo nessun campo da compilare per gli importi né pulsanti di
invio, annullamento o verifica bonifico: solo il selettore del bambino e
le frecce degli anni scolastici

## Scenario: accesso negato a chi non è admin
Dato che sono autenticato come maestra, assistente o genitore
Quando guardo il menu
Allora non vedo né "Pagamenti" né "Pagamenti bambino"
E se provo ad aprire `/admin/pagamenti-bambino` vengo reindirizzato alla
dashboard

## Regole
- Pagina `/admin/pagamenti-bambino`, Server Component: legge con la sessione
  dell'admin (RLS admin-only su `bambini` e `comunicazioni_retta`), mai con
  chiavi di servizio. Nessuna scrittura. Solo un profilo `admin` può
  accedervi (`requireAdmin`, come le altre pagine admin).
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
  e non viene mai ricalcolato: coincide per costruzione con quanto
  inviato nella mail, anche se in seguito il bambino cambia costi. Le voci
  sono quelle della comunicazione (specs/56): retta mensile, marca da
  bollo, costo pasti, conguaglio pasti, pre-asilo, post-asilo, costi extra
  (con nota), credito/debito (con nota, specs/58). Il totale di una
  comunicazione è quello registrato (`totale`).
- Sono visibili anche i bambini non più attivi (lo storico dei pagamenti
  resta consultabile).
- "Rette" resta raggiungibile da `/admin/rette` e da "Pagamenti › Rette";
  "Pagamenti" non ha una pagina propria, è solo l'intestazione del gruppo
  (`lib/navigazione.ts`).
- Fuori scope: stimare l'importo di un mese non ancora comunicato (compreso
  il mese corrente, per cui l'anteprima resta in "Rette"), mostrare lo
  stato del bonifico, esportazioni, vista aggregata di tutti i bambini.
