# 19 — Monte ore

## Attori
Personale abilitato al report ore (vede il proprio saldo, in sola
lettura, e — prima di confermare una settimana — un'anteprima
dell'effetto che la conferma avrà sul saldo). Admin (vede il saldo di
chiunque, può precaricarlo o correggerlo manualmente, elimina un
movimento manuale sbagliato, e — solo per le settimane confermate
prima dell'introduzione del calcolo "a netto pieno" sotto — decide
come trattare un eventuale straordinario residuo storico).

## Obiettivo
Estende [18 - report-ore-lavoro.md](18%20-%20report-ore-lavoro.md) e
[54 - profili-orari.md](54%20-%20profili-orari.md): un contatore di ore
per persona ("monte ore"), aggiornato automaticamente ogni volta che una
settimana di ore di lavoro viene confermata, pari al netto pieno fra le
ore dovute (dal profilo orario) e le ore erogate quella settimana
(ordinarie + straordinarie): se si è lavorato meno del dovuto il monte
ore **aumenta** (cresce il debito verso la struttura); se si è lavorato
di più — ordinario e/o straordinario, senza distinzione — il monte ore
**scala** automaticamente (il debito si riduce, o diventa un margine se
va sotto zero). Prima di confermare, il diretto interessato vede
un'anteprima di questo effetto.

L'admin può anche registrare un movimento manuale ("precarico"), ad
esempio per riportare un saldo pregresso da prima dell'uso dell'app, o
per una correzione una tantum — sempre motivato da una nota obbligatoria,
ed eliminabile in seguito se inserito per errore.

**Nota storica**: fino a una versione precedente di questo requisito, lo
straordinario erogato copriva prima un'eventuale carenza della stessa
settimana, e solo l'eccedenza scoperta ("carenza residua") faceva
aumentare il monte ore; lo straordinario che restava dopo quella
copertura ("straordinario residuo") non scalava automaticamente,
restava in attesa di una decisione esplicita dell'admin (pagamento
mensile, fuori da questa app, oppure scalo manuale dal monte ore). Il
calcolo "a netto pieno" descritto sopra sostituisce questo meccanismo:
non c'è più nulla da decidere, ogni eccedenza (ordinaria o straordinaria)
scala automaticamente. Le settimane confermate PRIMA di questo cambio,
con uno straordinario residuo ancora senza decisione, restano gestibili
come prima (vedi in fondo, "Settimane confermate prima del calcolo a
netto pieno") — nessuna nuova settimana confermata da questo punto in
poi può più generarne uno.

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
E viene registrato un movimento automatico di monte ore per quella
settimana, con variazione pari a (ore dovute − ore ordinarie erogate −
ore straordinarie erogate): positiva se ho lavorato meno del dovuto (il
monte ore aumenta), negativa se ho lavorato di più — ordinario e
straordinario insieme (il monte ore scala) — zero se le ore erogate
coincidono esattamente col dovuto. Sempre un solo movimento per
settimana, anche a variazione zero, per lasciare traccia che la
settimana è stata considerata

## Scenario: vedere in anteprima l'effetto sul monte ore prima di confermare
Dato che sto compilando una settimana di ore di lavoro, non ancora
confermata
Quando guardo la tabellina di riepilogo sotto i giorni ("Ore dovute",
"Ore ordinarie erogate", "Ore straordinarie erogate")
Allora vedo anche una riga aggiuntiva che anticipa l'effetto sul monte
ore a settimana confermata (es. "4,5h in meno sul monte ore", "3h in
più sul monte ore", o "nessuna variazione del monte ore"), calcolata
con la stessa formula del movimento automatico
E questa anteprima si aggiorna ogni volta che salvo una modifica ai
giorni della settimana (non serve confermare per vederla)
E una volta che la settimana è confermata, l'anteprima non compare più:
il movimento reale è già nello storico del monte ore

## Scenario: senza profilo orario assegnato ogni ora erogata scala il monte ore
Dato che l'utente che conferma la settimana non ha un profilo orario
assegnato
Quando la settimana viene confermata
Allora le ore dovute di quella settimana sono zero (non c'è un previsto
con cui confrontare le ore erogate): la variazione è quindi sempre
negativa o zero, pari a meno il totale delle ore (ordinarie e
straordinarie) erogate quella settimana

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

## Scenario: l'admin elimina un movimento manuale inserito per errore
Dato che sono sulle ore di un dipendente (`/dashboard/ore-lavoro?utente=<id>`)
come admin, e lo storico mostra un movimento manuale (`precarico`) —
es. ore o nota sbagliate
Quando premo "Elimina" sulla sua riga e confermo
Allora il movimento sparisce dallo storico
E il saldo mostrato si aggiorna di conseguenza (non lo conta più nella
somma)

## Scenario: i movimenti automatici non sono eliminabili
Dato che sono sulle ore di un dipendente come admin, e lo storico
include movimenti automatici (`settimanale` o, per una settimana
storica, `straordinario_residuo`)
Quando guardo le loro righe
Allora non trovo nessun pulsante "Elimina": restano immutabili, legati
alla conferma di una settimana o a una decisione già presa — per
correggerli resta solo la via generale, un movimento `precarico`
motivato che compensa l'errore (vedi Regole)

## Scenario: il monte ore può risultare negativo
Dato che il monte ore di una persona è a zero o vicino a zero
Quando una settimana viene confermata con ore erogate (ordinarie e/o
straordinarie) superiori al dovuto, oppure l'admin registra un
precarico che lo riduce
Allora il saldo può scendere sotto zero, senza alcun blocco: rappresenta
un margine di ore già restituite in anticipo

## Settimane confermate prima del calcolo a netto pieno
Gli scenari seguenti riguardano solo le settimane che erano già state
confermate quando è stato introdotto il calcolo "a netto pieno" (vedi
Obiettivo) e che, con la formula precedente, avevano generato uno
straordinario residuo ancora senza una decisione: restano gestibili
esattamente come prima, finché non vengono chiuse. Nessuna nuova
settimana confermata da questo punto in poi può più trovarsi in questa
situazione.

### Scenario: lo straordinario residuo storico richiede una decisione dell'admin
Dato che una settimana, confermata prima del calcolo a netto pieno, ha
uno straordinario residuo maggiore di zero (non ancora deciso)
Quando il diretto interessato apre "Ore di lavoro" su quella settimana
Allora vede un avviso che indica le ore di straordinario residuo e che
sono in attesa di una decisione dell'admin, senza alcun modo di
deciderlo lui stesso
E quando l'admin apre la stessa settimana (dalla propria vista o da
`/dashboard/ore-lavoro?utente=<id>`) vede lo stesso avviso, con due
pulsanti per decidere: "Metti a pagamento mensile" e "Scala dal monte
ore"

### Scenario: l'admin mette lo straordinario residuo storico a pagamento mensile
Dato che l'admin è su una di queste settimane storiche, con straordinario
residuo non ancora deciso
Quando preme "Metti a pagamento mensile"
Allora la decisione viene registrata (con data/ora e chi l'ha presa)
E il monte ore di quella persona NON cambia (lo straordinario è
considerato pagato fuori da quest'app, in busta paga)
E l'avviso in sola lettura per il diretto interessato mostra da quel
momento la decisione presa, non più i pulsanti

### Scenario: l'admin scala lo straordinario residuo storico dal monte ore
Dato che l'admin è su una di queste settimane storiche, con straordinario
residuo non ancora deciso
Quando preme "Scala dal monte ore"
Allora la decisione viene registrata (con data/ora e chi l'ha presa)
E viene registrato un secondo movimento di monte ore per quella
settimana, negativo, pari allo straordinario residuo (il monte ore
scala, si riduce il debito)
E l'avviso in sola lettura per il diretto interessato mostra da quel
momento la decisione presa, non più i pulsanti

## Regole
- Tabella `monte_ore_movimenti`: ogni riga è un movimento, di tre tipi
  esclusivi — `settimanale` (generato automaticamente alla conferma di
  una settimana, un solo movimento per settimana per persona, può
  essere positivo, negativo o zero), `straordinario_residuo` (solo
  storico, non più generato da nuove conferme — vedi "Settimane
  confermate prima del calcolo a netto pieno"; quando esiste, ha sempre
  variazione <= 0, al massimo uno per settimana per persona) o
  `precarico` (inserito manualmente dall'admin, nota sempre
  obbligatoria e non vuota, eliminabile se ancora sbagliato).
- Il saldo attuale di una persona è la somma di tutte le sue
  `variazione` in `monte_ore_movimenti`: nessun campo separato da tenere
  sincronizzato a mano (stesso principio già in uso per "conferma" =
  esistenza della riga, vedi [18]).
- Convenzione di segno di `variazione`: **positiva** = il monte ore
  aumenta (cresce il debito verso la struttura); **negativa** = il monte
  ore scala (si riduce il debito, o va in margine sotto zero). Un
  movimento `settimanale` è "ore dovute − ore ordinarie erogate − ore
  straordinarie erogate" della settimana, senza altro vincolo di segno
  (`lib/monteOre.ts`, `controlloSettimanaOreLavoro`); un eventuale
  movimento storico `straordinario_residuo` resta sempre <= 0.
- I dati del controllo di ciascuna settimana confermata (ore dovute,
  ore ordinarie/straordinarie erogate, e — solo per lo storico —
  l'eventuale straordinario residuo con la decisione dell'admin) sono
  colonne di `ore_lavoro_settimane` (non una tabella separata: sono un
  attributo 1:1 della conferma stessa), calcolate una volta sola al
  momento della conferma — un cambio di profilo orario successivo, o
  una correzione delle ore di un giorno dopo la conferma (ammessa solo
  all'admin, specs/18), non ricalcola questi valori automaticamente:
  serve una nuova conferma o una correzione manuale. Da quando il
  calcolo è "a netto pieno", ogni nuova conferma scrive sempre
  `straordinario_residuo = 0` e `decisione_straordinari = null`: le
  colonne restano nello schema solo per leggere lo storico precedente.
- `ore_lavoro_settimane.decisione_straordinari` è `null` finché
  l'admin non decide (nessuna decisione richiesta se lo straordinario
  residuo della settimana è zero — sempre il caso per una settimana
  confermata dopo il calcolo a netto pieno), altrimenti
  `pagamento_mensile` o `monte_ore` — insieme a quando e chi l'ha presa.
  Una volta presa, la decisione non è più modificabile da questa
  interfaccia (stesso principio "immutabile" dei movimenti sotto: un
  errore si corregge con un `precarico` motivato, non riaprendo la
  decisione).
- I movimenti automatici (`settimanale`, `straordinario_residuo`) sono
  immutabili una volta registrati (nessun update/delete su questi due
  tipi): una correzione si registra come nuovo movimento (`precarico`)
  motivato dalla nota, non modificando lo storico. Un movimento
  manuale (`precarico`) può invece essere eliminato dall'admin (vedi
  scenario sopra) se inserito per errore — evita di dover registrare un
  contro-movimento di compensazione solo per rimediare a un refuso
  (importo o nota sbagliati). Nessun tipo di movimento è mai
  modificabile sul posto (niente update, in nessun caso): solo
  l'inserimento di un `precarico` e, per quello stesso tipo, la sua
  eliminazione.
- Se, per un errore tecnico, il movimento di monte ore non può essere
  registrato subito dopo che la conferma della settimana è comunque
  andata a buon fine, l'azione segnala l'anomalia esplicitamente
  (la settimana resta confermata, ma serve una correzione manuale
  dell'admin) invece di fallire silenziosamente o duplicare il
  movimento a un tentativo successivo.
- L'anteprima dell'effetto sul monte ore (prima della conferma) usa la
  stessa funzione pura del movimento reale
  (`lib/monteOre.ts`, `controlloSettimanaOreLavoro` +
  `descrizioneEffettoMonteOre`): nessun calcolo duplicato, quindi per
  costruzione l'anteprima e il movimento effettivamente registrato alla
  conferma coincidono sempre (a parità di dati).
- Il saldo è visibile al diretto interessato (sola lettura) e all'admin;
  nessun altro ruolo vi accede (RLS in
  `supabase/migrations/0031_monte_ore.sql`).
- Solo l'admin può eliminare un movimento, e solo di tipo `precarico`
  (policy di delete,
  `supabase/migrations/0044_elimina_movimento_precarico.sql` — un
  `settimanale`/`straordinario_residuo` resta rifiutato dalla RLS anche
  se qualcuno tentasse la richiesta a mano).
- Le colonne del controllo settimanale e della decisione sull'eventuale
  straordinario residuo (`ore_lavoro_settimane`) sono leggibili dagli
  stessi ruoli che leggono già la riga di conferma (diretto interessato
  o admin); solo l'admin può scriverle, con una policy di update in
  `supabase/migrations/0032_straordinario_residuo.sql` (finora
  `ore_lavoro_settimane` non aveva alcuna policy di update: una
  conferma si registrava e basta, non si modificava più).
- Il vincolo che imponeva `variazione >= 0` per un movimento
  `settimanale` è stato rimosso
  (`supabase/migrations/0045_movimento_settimanale_netto_pieno.sql`):
  necessario per il calcolo a netto pieno, che può scalare il monte ore
  direttamente dal movimento automatico.
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
