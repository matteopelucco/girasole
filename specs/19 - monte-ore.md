# 19 — Monte ore

## Attori
Personale abilitato al report ore (vede il proprio saldo, in sola
lettura). Admin (vede il saldo di chiunque, e può precaricarlo o
correggerlo manualmente).

## Obiettivo
Estende [18 - report-ore-lavoro.md](18%20-%20report-ore-lavoro.md) e
[54 - profili-orari.md](54%20-%20profili-orari.md): un contatore di ore
per persona ("monte ore"), aggiornato automaticamente ogni volta che una
settimana di ore di lavoro viene confermata, che riflette lo scostamento
fra ore realmente lavorate e ore previste dal profilo orario assegnato.

**Attenzione alla direzione**: il monte ore rappresenta le ore che il
dipendente deve ancora "restituire" alla struttura — non è un accumulo
di straordinari a credito del dipendente (la "banca ore" nel senso
classico sarebbe l'opposto). Nello specifico:
- quando in una settimana lo straordinario supera la carenza (ore
  lavorate in meno del previsto), il monte ore **scala** (diminuisce):
  lo straordinario "ripaga" ore dovute;
- quando in una settimana la carenza supera lo straordinario, il monte
  ore **aumenta** (cresce il debito da recuperare in futuro).

L'admin può anche registrare un movimento manuale ("precarico"), ad
esempio per riportare un saldo pregresso da prima dell'uso dell'app, o
per una correzione una tantum — sempre motivato da una nota obbligatoria.

## Scenario: il calcolo avviene automaticamente alla conferma di una settimana
Dato che confermo (o l'admin conferma per me) una settimana di ore di
lavoro (vedi [18 - report-ore-lavoro.md](18%20-%20report-ore-lavoro.md))
Quando la conferma va a buon fine
Allora viene registrato un movimento di monte ore per quella settimana,
calcolato così:
- **esubero** = somma delle ore straordinarie dei giorni in stato
  "lavorativo" della settimana
- **carenza** = somma, per ciascun giorno "lavorativo" della settimana,
  della differenza (solo se positiva) fra le ore previste dal profilo
  orario per quel giorno della settimana e le ore ordinarie
  effettivamente registrate quel giorno
- i giorni in stato "malattia" o "assenza" sono esclusi dal calcolo (non
  contribuiscono né a esubero né a carenza)
- se esubero > carenza, il monte ore scala della differenza
- se carenza > esubero, il monte ore aumenta della differenza
- se sono uguali (inclusa nessuna variazione), il movimento viene
  comunque registrato, con variazione zero, per lasciare traccia che la
  settimana è stata considerata

## Scenario: senza profilo orario assegnato non si accumula carenza
Dato che l'utente che conferma la settimana non ha un profilo orario
assegnato
Quando la settimana viene confermata
Allora la carenza di quella settimana è zero (non c'è un previsto con
cui confrontare le ore erogate): il monte ore può comunque scalare se
quella settimana risultano ore straordinarie registrate

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
Quando quella persona accumula altri straordinari in esubero rispetto
alla carenza
Allora il saldo può scendere sotto zero, senza alcun blocco: rappresenta
un margine di ore già restituite in anticipo

## Regole
- Tabella `monte_ore_movimenti`: ogni riga è un movimento, di due tipi
  esclusivi — `settimanale` (generato automaticamente alla conferma di
  una settimana, un solo movimento per settimana per persona) o
  `precarico` (inserito manualmente dall'admin, nota sempre
  obbligatoria e non vuota).
- Il saldo attuale di una persona è la somma di tutte le sue
  `variazione` in `monte_ore_movimenti`: nessun campo separato da tenere
  sincronizzato a mano (stesso principio già in uso per "conferma" =
  esistenza della riga, vedi [18]).
- Convenzione di segno di `variazione`: **positiva** = il monte ore
  aumenta (cresce il debito verso la struttura); **negativa** = il monte
  ore scala (si riduce il debito). Lo straordinario produce una
  variazione negativa, la carenza una variazione positiva.
- Il calcolo di esubero/carenza usa il profilo orario assegnato
  all'utente al momento della conferma: un cambio di profilo orario
  successivo non ricalcola le settimane già confermate.
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
- Il riepilogo ore della settimana corrente nel corpo dell'email
  giornaliera e il PDF mensile delle ore del personale, entrambi con il
  saldo di monte ore, sono descritti in
  [52 - report-email-automatico.md](52%20-%20report-email-automatico.md).

## Fuori scope in questa fase
- Notifiche o soglie di allarme legate al valore del monte ore (es. un
  avviso quando supera una certa soglia).
- Compensazione automatica del monte ore con permessi/ferie: resta un
  contatore informativo, non collegato a un sistema di richiesta
  permessi.
- Un pannello di storico/export dedicato oltre a quanto già mostrato
  nella pagina "Ore di lavoro" e nel PDF mensile.
