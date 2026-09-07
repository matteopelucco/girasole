# 19 — Monte ore

## Attori
Personale abilitato al report ore (vede il proprio saldo, in sola
lettura, e viene informato se restano ore straordinarie in attesa di
decisione). Admin (vede il saldo di chiunque, può precaricarlo o
correggerlo manualmente, e decide come trattare lo straordinario
residuo di ciascuna settimana confermata).

## Obiettivo
Estende [18 - report-ore-lavoro.md](18%20-%20report-ore-lavoro.md) e
[54 - profili-orari.md](54%20-%20profili-orari.md): un contatore di ore
per persona ("monte ore"), aggiornato automaticamente ogni volta che una
settimana di ore di lavoro viene confermata, che riflette lo scostamento
fra ore realmente lavorate e ore previste dal profilo orario assegnato.
Le ore straordinarie erogate coprono per prima cosa un'eventuale
carenza della stessa settimana; quelle che restano dopo questa
copertura non vengono scalate automaticamente dal monte ore, ma restano
in attesa di una decisione esplicita dell'admin (pagamento mensile,
fuori da questa app, oppure scalo dal monte ore).

**Attenzione alla direzione**: il monte ore rappresenta le ore che il
dipendente deve ancora "restituire" alla struttura — non è un accumulo
di straordinari a credito del dipendente (la "banca ore" nel senso
classico sarebbe l'opposto). Nello specifico:
- quando in una settimana l'ordinario erogato non basta a coprire le ore
  dovute dal profilo orario, la carenza viene prima coperta, se
  possibile, dallo straordinario erogato nella stessa settimana; quanto
  di carenza resta scoperto fa **aumentare** il monte ore (cresce il
  debito da recuperare in futuro);
- lo straordinario che resta dopo aver coperto un'eventuale carenza
  ("straordinario residuo") NON scala automaticamente il monte ore: resta
  in attesa che l'admin decida come trattarlo (vedi sotto) — solo se
  l'admin sceglie di scalarlo dal monte ore, il monte ore **scala**
  (diminuisce) di quella quantità.

L'admin può anche registrare un movimento manuale ("precarico"), ad
esempio per riportare un saldo pregresso da prima dell'uso dell'app, o
per una correzione una tantum — sempre motivato da una nota obbligatoria.

## Scenario: il calcolo avviene automaticamente alla conferma di una settimana
Dato che confermo (o l'admin conferma per me) una settimana di ore di
lavoro (vedi [18 - report-ore-lavoro.md](18%20-%20report-ore-lavoro.md))
Quando la conferma va a buon fine
Allora la settimana registra, per i soli giorni in stato "lavorativo"
(i giorni "malattia"/"assenza" sono esclusi, non contribuiscono a
nessuno dei valori seguenti):
- **ore dovute** = somma delle ore previste dal profilo orario per quei
  giorni (0 se non ho un profilo orario assegnato)
- **ore ordinarie erogate** e **ore straordinarie erogate** = quanto
  effettivamente registrato per quei giorni
- **carenza** = ore dovute meno ore ordinarie erogate, solo se positiva
  (altrimenti zero)
- la carenza viene coperta dalle ore straordinarie erogate fino a
  concorrenza: **carenza residua** = carenza meno la parte coperta dallo
  straordinario (mai negativa)
- **straordinario residuo** = ore straordinarie erogate meno la parte
  usata per coprire la carenza (mai negativo): è la quota di
  straordinario che, quella settimana, non è servita a colmare nessuna
  carenza
E viene registrato un movimento automatico di monte ore per quella
settimana, con variazione pari alla carenza residua (sempre maggiore o
uguale a zero: il monte ore può quindi solo aumentare o restare
invariato per questo movimento, mai scalare) — se non c'è alcuna
carenza residua il movimento viene comunque registrato, con variazione
zero, per lasciare traccia che la settimana è stata considerata
E se lo straordinario residuo è maggiore di zero, la settimana resta in
attesa della decisione dell'admin (vedi sotto): il monte ore NON scala
automaticamente per quella quota

## Scenario: senza profilo orario assegnato non si accumula carenza
Dato che l'utente che conferma la settimana non ha un profilo orario
assegnato
Quando la settimana viene confermata
Allora le ore dovute di quella settimana sono zero e quindi anche la
carenza è zero (non c'è un previsto con cui confrontare le ore erogate):
tutto lo straordinario eventualmente registrato risulta "residuo" e
segue lo stesso scenario "lo straordinario residuo richiede una
decisione dell'admin" descritto sotto

## Scenario: lo straordinario residuo richiede una decisione dell'admin
Dato che una settimana è stata confermata con uno straordinario residuo
maggiore di zero (non ancora deciso)
Quando il diretto interessato apre "Ore di lavoro" su quella settimana
Allora vede un avviso che indica le ore di straordinario residuo e che
sono in attesa di una decisione dell'admin, senza alcun modo di
deciderlo lui stesso
E quando l'admin apre la stessa settimana (dalla propria vista o da
`/dashboard/ore-lavoro?utente=<id>`) vede lo stesso avviso, con due
pulsanti per decidere: "Metti a pagamento mensile" e "Scala dal monte
ore"

## Scenario: l'admin mette lo straordinario residuo a pagamento mensile
Dato che l'admin è sulla settimana confermata di un dipendente con
straordinario residuo non ancora deciso
Quando preme "Metti a pagamento mensile"
Allora la decisione viene registrata (con data/ora e chi l'ha presa)
E il monte ore di quella persona NON cambia (lo straordinario è
considerato pagato fuori da quest'app, in busta paga)
E l'avviso in sola lettura per il diretto interessato mostra da quel
momento la decisione presa, non più i pulsanti

## Scenario: l'admin scala lo straordinario residuo dal monte ore
Dato che l'admin è sulla settimana confermata di un dipendente con
straordinario residuo non ancora deciso
Quando preme "Scala dal monte ore"
Allora la decisione viene registrata (con data/ora e chi l'ha presa)
E viene registrato un secondo movimento di monte ore per quella
settimana, negativo, pari allo straordinario residuo (il monte ore
scala, si riduce il debito)
E l'avviso in sola lettura per il diretto interessato mostra da quel
momento la decisione presa, non più i pulsanti

## Scenario: senza straordinario residuo nessuna decisione è richiesta
Dato che una settimana viene confermata con uno straordinario residuo
pari a zero (nessuno straordinario erogato, o interamente assorbito
dalla carenza della stessa settimana)
Quando il diretto interessato o l'admin aprono quella settimana
Allora non vedono alcun avviso né alcun pulsante di decisione: non c'è
nulla da decidere

## Scenario: il personale vede il proprio monte ore
Dato che sono personale abilitato al report ore
Quando apro "Ore di lavoro"
Allora vedo il mio saldo attuale di monte ore, in sola lettura, accanto
al totale della settimana mostrata
E non vedo alcun modo per modificarlo: solo l'admin può farlo

## Scenario: l'admin vede il monte ore di ciascuna persona
Dato che sono autenticato come admin
Quando apro l'elenco del personale abilitato al report ore
(`/admin/ore-lavoro`)
Allora vedo, per ciascuna persona, il saldo attuale di monte ore accanto
al nome

## Scenario: l'admin registra un movimento manuale di monte ore
Dato che sono sulle ore di un dipendente (`/dashboard/ore-lavoro?utente=<id>`)
Quando scelgo se aumentare o ridurre il monte ore, indico un numero di
ore e una nota, e confermo
Allora viene registrato un movimento manuale con quella variazione e
quella nota
E il saldo mostrato si aggiorna di conseguenza
E vedo lo storico dei movimenti più recenti di quella persona (manuali e
automatici), dal più recente

## Scenario: un movimento manuale senza nota viene rifiutato
Dato che sono sulle ore di un dipendente, come admin
Quando tento di registrare un movimento manuale senza indicare una nota
Allora vedo un messaggio d'errore che la richiede
E nessun movimento viene registrato

## Scenario: il monte ore può risultare negativo
Dato che il monte ore di una persona è a zero o vicino a zero
Quando l'admin sceglie di scalare dal monte ore altro straordinario
residuo (o registra un precarico che lo riduce)
Allora il saldo può scendere sotto zero, senza alcun blocco: rappresenta
un margine di ore già restituite in anticipo

## Regole
- Tabella `monte_ore_movimenti`: ogni riga è un movimento, di tre tipi
  esclusivi — `settimanale` (generato automaticamente alla conferma di
  una settimana, sempre con variazione >= 0, un solo movimento per
  settimana per persona), `straordinario_residuo` (generato quando
  l'admin decide di scalare dal monte ore lo straordinario residuo di
  una settimana, sempre con variazione <= 0, al massimo uno per
  settimana per persona) o `precarico` (inserito manualmente dall'admin,
  nota sempre obbligatoria e non vuota).
- Il saldo attuale di una persona è la somma di tutte le sue
  `variazione` in `monte_ore_movimenti`: nessun campo separato da tenere
  sincronizzato a mano (stesso principio già in uso per "conferma" =
  esistenza della riga, vedi [18]).
- Convenzione di segno di `variazione`: **positiva** = il monte ore
  aumenta (cresce il debito verso la struttura); **negativa** = il monte
  ore scala (si riduce il debito). Un movimento `settimanale` è sempre
  >= 0 (rappresenta solo la carenza residua, mai una compensazione
  automatica dello straordinario); un movimento `straordinario_residuo`
  è sempre <= 0 (rappresenta la decisione esplicita dell'admin di
  scalare quello straordinario dal monte ore).
- I dati del controllo di ciascuna settimana confermata (ore dovute,
  ore ordinarie/straordinarie erogate, carenza residua, straordinario
  residuo, e l'eventuale decisione dell'admin su quest'ultimo) sono
  colonne di `ore_lavoro_settimane` (non una tabella separata: sono un
  attributo 1:1 della conferma stessa), calcolate una volta sola al
  momento della conferma — un cambio di profilo orario successivo, o
  una correzione delle ore di un giorno dopo la conferma (ammessa solo
  all'admin, specs/18), non ricalcola questi valori automaticamente:
  serve una nuova conferma o una correzione manuale.
- `ore_lavoro_settimane.decisione_straordinari` è `null` finché
  l'admin non decide (nessuna decisione richiesta se lo straordinario
  residuo della settimana è zero), altrimenti `pagamento_mensile` o
  `monte_ore` — insieme a quando e chi l'ha presa. Una volta presa, la
  decisione non è più modificabile da questa interfaccia (stesso
  principio "immutabile" dei movimenti sotto: un errore si corregge con
  un `precarico` motivato, non riaprendo la decisione).
- I movimenti sono immutabili una volta registrati (nessun update/
  delete): una correzione si registra come nuovo movimento (`precarico`)
  motivato dalla nota, non modificando lo storico.
- Se, per un errore tecnico, il movimento di monte ore non può essere
  registrato subito dopo che la conferma della settimana è comunque
  andata a buon fine, l'azione segnala l'anomalia esplicitamente
  (la settimana resta confermata, ma serve una correzione manuale
  dell'admin) invece di fallire silenziosamente o duplicare il
  movimento a un tentativo successivo.
- Il saldo è visibile al diretto interessato (sola lettura) e all'admin;
  nessun altro ruolo vi accede (RLS in
  `supabase/migrations/0031_monte_ore.sql`).
- Le colonne del controllo settimanale e della decisione sull'eventuale
  straordinario residuo (`ore_lavoro_settimane`) sono leggibili dagli
  stessi ruoli che leggono già la riga di conferma (diretto interessato
  o admin); solo l'admin può scriverle, con una nuova policy di update
  in `supabase/migrations/0032_straordinario_residuo.sql` (finora
  `ore_lavoro_settimane` non aveva alcuna policy di update: una
  conferma si registrava e basta, non si modificava più).
- Il riepilogo ore della settimana corrente nel corpo dell'email
  giornaliera e il PDF mensile delle ore del personale, entrambi con il
  saldo di monte ore, sono descritti in
  [52 - report-email-automatico.md](52%20-%20report-email-automatico.md).

## Fuori scope in questa fase
- Tracciare il pagamento mensile dello straordinario messo "a pagamento
  mensile" (importo, busta paga, avvenuto pagamento): questa app
  registra solo la decisione dell'admin, non il processo di pagamento
  che resta fuori dall'app.
- Notifiche o soglie di allarme legate al valore del monte ore (es. un
  avviso quando supera una certa soglia).
- Compensazione automatica del monte ore con permessi/ferie: resta un
  contatore informativo, non collegato a un sistema di richiesta
  permessi.
- Un pannello di storico/export dedicato oltre a quanto già mostrato
  nella pagina "Ore di lavoro" e nel PDF mensile.
