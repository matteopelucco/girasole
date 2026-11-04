# 13 — Segna presenza

## Attori
Maestra e assistente (sui bambini delle loro sezioni), Admin (su tutti i
bambini). L'assistente ha lo stesso comportamento della maestra descritto
in questo file (vedi la matrice permessi in
[03 - utenti-e-ruoli.md](03%20-%20utenti-e-ruoli.md)).

## Obiettivo
Registrare in pochi tap lo stato di presenza giornaliero di ogni bambino
— compresa un'eventuale presenza a pre-asilo e/o post-asilo — con una
nota libera opzionale, dalle sezioni "Presenza" e "Nota" della card di ogni
bambino nella schermata unica "Presenze e pasti" (bambini raggruppati
per classe nella stessa schermata, senza un click intermedio per
scegliere la classe) descritta in
[10 - presenze-e-pasti.md](10%20-%20presenze-e-pasti.md) e
[12 - dashboard-maestre.md](12%20-%20dashboard-maestre.md).

## Presenza ordinaria, pre-asilo e post-asilo
Oltre alla presenza in orario ordinario (9:00-16:00), un bambino può
essere presente anche al pre-asilo (7:30-9:00) e/o al post-asilo
(16:00-17:30): i due orari estesi non sono stati alternativi allo stato
di presenza, ma due indicatori aggiuntivi che si applicano solo quando lo
stato del giorno è "presente". Gli stati possibili per un bambino in un
giorno sono quindi:
- **Presente** in orario ordinario (nessun pre/post-asilo).
- **Presente**, con **pre-asilo** attivo — implica presente anche in
  orario ordinario (un bambino non "salta" l'orario ordinario se entra
  prima).
- **Presente**, con **post-asilo** attivo — implica presente anche in
  orario ordinario, per lo stesso motivo.
- Presente con pre-asilo **e** post-asilo attivi insieme (un bambino può
  entrare presto e uscire tardi lo stesso giorno).
- **Assente**.
- **Malattia** (con nota opzionale).

I pulsanti per ogni bambino, nella sezione "Presenza" della sua card,
sono pulsanti grandi, nell'ordine Presente, Assente, Malattia (prima gli
stati esclusivi, sulla stessa riga), un separatore orizzontale sottile,
poi Pre-asilo e Post-asilo (gli indicatori dell'orario, affiancati);
lo stato selezionato è pieno, colorato e con un segno ✓ (vedi
[10 - presenze-e-pasti.md](10%20-%20presenze-e-pasti.md)). La nota è
nella sezione "Nota" in fondo alla card, sotto la sezione "Pasto" (issue
#110): campo "Nota (opzionale)" (un `<textarea>` alto due righe, non un
campo a riga singola — per una nota un po' più lunga il testo resta
leggibile senza scorrimento laterale) e il pulsante "Salva nota", largo
quanto la card.

## Scenario: riepilogo presenze della classe
Dato che sono su "Presenze e pasti" per una data
Allora vedo, sopra l'elenco bambini di ciascuna classe, un'intestazione
(non una card, vedi [10 - presenze-e-pasti.md](10%20-%20presenze-e-pasti.md))
con titolo "Sezione {nome classe}" e un riassunto testuale con
"Presenti: X/Y", dove X è il numero di bambini segnati "presente" per
quella data e Y il totale dei bambini attivi della classe
E di seguito altri due conteggi, "Pre-asilo: P" e "Post-asilo: Q",
dove P e Q sono rispettivamente il numero di bambini con pre-asilo e con
post-asilo attivi per quella data
E, per maestra e admin, nello stesso riassunto anche il conteggio pasti della
sezione (vedi [14 - segna-pasto.md](14%20-%20segna-pasto.md))

## Scenario: segnare un bambino presente
Dato che ho aperto "Presenze e pasti" per la data odierna e vedo l'elenco dei
bambini delle mie classi
Quando premo il pulsante "Presente" su un bambino
Allora lo stato di presenza di oggi per quel bambino diventa "presente"
E il pulsante "Presente" resta evidenziato come stato corrente

## Scenario: segnare un'assenza con nota
Quando premo "Assente" e scrivo una nota (es. "influenza, rientra lunedì")
Allora lo stato diventa "assente" con quella nota salvata
E la nota resta salvata anche dopo aver ricaricato la pagina

## Scenario: salvare una nota senza cambiare lo stato
Dato che un bambino ha già uno stato di presenza segnato per oggi
Quando scrivo o modifico la nota (es. "entra alle 9:03") e premo "Salva nota"
Allora la nota viene salvata restando associata allo stato già segnato
E la nota resta visibile anche dopo aver ricaricato la pagina

## Scenario: correggere uno stato già segnato in malattia
Dato che un bambino è già segnato "presente" per oggi
Quando premo "Malattia" e scrivo una nota
Allora lo stato per oggi viene sovrascritto in "malattia" con quella nota
E resta un solo record di presenza per quel bambino per quella data
E lo stato "malattia" appare anche come etichetta (tag) "🤒 Malattia"
nell'intestazione della card del bambino, accanto al nome, per quella
data (e la sezione "Pasto" della stessa card mostra l'etichetta al posto
dei pulsanti Sì/No — vedi [14 - segna-pasto.md](14%20-%20segna-pasto.md))
E se il bambino aveva pre-asilo e/o post-asilo attivi, vengono
disattivati (non ha senso un pre/post-asilo su un bambino malato o
assente per quel giorno)

## Scenario: segnare Assente o Malattia con un pasto o un pre/post-asilo già segnati chiede conferma
Dato che un bambino non è ancora assente né malato e ha già, per oggi, il
pasto segnato "sì", oppure il pre-asilo o il post-asilo attivi
Quando premo "Assente" (o "Malattia") nella sezione "Presenza" della sua
card
Allora non cambia ancora nulla e compare un avviso nella sezione che
elenca cosa risulta già segnato (pasto, pre-asilo, post-asilo) e spiega
che verrà azzerato
E vedo i pulsanti "Conferma e azzera" e "Annulla"

## Scenario: confermando l'avviso, pasto e pre/post-asilo vengono azzerati
Dato che sto guardando l'avviso del bambino con un pasto "sì" e/o un
pre/post-asilo già segnati
Quando premo "Conferma e azzera"
Allora la presenza diventa "assente" (o "malattia"), con l'eventuale
nota scritta
E il pasto del bambino per quella data, se era "sì", torna a "no", e il
pre-asilo e il post-asilo sono disattivati: il bambino non conta più
nei pasti da comunicare a Rojac
E la sezione "Pasto" della card mostra l'etichetta "Assente" (o
"Malattia") al posto dei pulsanti Sì/No

## Scenario: annullare l'avviso non cambia nulla
Dato che sto guardando l'avviso del bambino con un pasto "sì" e/o un
pre/post-asilo già segnati
Quando premo "Annulla"
Allora l'avviso si chiude, la presenza, il pasto e il pre/post-asilo
restano come prima

## Scenario: Assente o Malattia senza nulla da azzerare non chiede conferma
Dato che un bambino non ha il pasto "sì" né pre/post-asilo attivi
Quando premo "Assente" (o "Malattia")
Allora lo stato cambia subito, senza avviso

## Scenario: segnare un bambino presente al pre-asilo
Dato che ho aperto "Presenze e pasti" per la data odierna
Quando premo il pulsante "Pre-asilo" su un bambino
Allora lo stato di presenza di oggi per quel bambino diventa (o resta)
"presente"
E l'indicatore "pre-asilo" per quel bambino diventa attivo, evidenziato
sul pulsante
E se il bambino era segnato "assente" o "malattia", quello stato viene
sostituito da "presente" con pre-asilo attivo

## Scenario: segnare un bambino presente al post-asilo
Quando premo il pulsante "Post-asilo" su un bambino
Allora lo stato di presenza di oggi per quel bambino diventa (o resta)
"presente"
E l'indicatore "post-asilo" per quel bambino diventa attivo, evidenziato
sul pulsante
E se il bambino era segnato "assente" o "malattia", quello stato viene
sostituito da "presente" con post-asilo attivo

## Scenario: pre-asilo e post-asilo sono indipendenti e cumulabili
Dato che un bambino è già segnato presente con pre-asilo attivo
Quando premo anche "Post-asilo" per lo stesso bambino nello stesso giorno
Allora il bambino risulta presente con pre-asilo E post-asilo entrambi
attivi

## Scenario: disattivare il pre-asilo o il post-asilo ripremendo il pulsante
Dato che un bambino ha il pre-asilo (o il post-asilo) attivo per oggi
Quando ripremo lo stesso pulsante "Pre-asilo" (o "Post-asilo")
Allora l'indicatore si disattiva
E il bambino resta comunque "presente" in orario ordinario (l'eventuale
altro indicatore, se attivo, non viene toccato)

## Scenario: segnare Assente o Presente resetta pre-asilo e post-asilo
Dato che un bambino ha pre-asilo e/o post-asilo attivi per oggi
Quando premo "Assente", oppure premo "Presente" (senza passare da
Pre-asilo/Post-asilo)
Allora lo stato diventa quello premuto ed entrambi gli indicatori
pre-asilo e post-asilo vengono disattivati

## Scenario: la maestra o l'assistente non può modificare una data diversa da oggi
Dato che sono autenticata come maestra o assistente e ho aperto
"Presenze e pasti" per una data diversa da oggi (passata o futura)
Quando guardo l'elenco bambini delle mie classi
Allora vedo lo stato eventualmente già registrato (incluso pre/post-asilo)
ma senza pulsanti per modificarlo: è in sola lettura

## Scenario: l'admin può modificare qualunque data
Dato che sono autenticato come admin e ho aperto "Presenze e pasti" per
una data diversa da oggi
Quando guardo l'elenco bambini di una classe
Allora i pulsanti Presente/Assente/Malattia/Pre-asilo/Post-asilo restano
attivi e posso modificare lo stato di quella data

## Scenario: i dati di presenza manomessi dal client non vengono usati
Dato che un bambino è segnato "presente" per oggi, senza pre-asilo né post-asilo
Quando la richiesta del pulsante "Pre-asilo" viene alterata prima di arrivare
al server (la riga di presenza attuale inviata dal browser è falsificata,
es. con post-asilo già attivo)
Allora il server rilegge la presenza dal database e non usa il valore
ricevuto dal browser: la richiesta viene rifiutata con un errore in italiano
("dati cambiati, ricarica la pagina") che non rivela dati della presenza
E nel database non viene scritto nulla: dopo aver ricaricato la pagina il
bambino resta "presente" senza pre-asilo né post-asilo

## Scenario: pre/post-asilo coperto dall'abbonamento mostra "Già pagato con l'abbonamento"
**ID GET-01**
Dato che un bambino ha l'abbonamento mensile pre-asilo attivo (specs/55)
E che sono su "Presenze e pasti" per una data in cui sono ammesse modifiche
Quando premo "Pre-asilo" sul suo nome
Allora l'indicatore pre-asilo si attiva (come da scenari precedenti)
E nella sezione "Presenza" della card compare la scritta "Già pagato con
l'abbonamento" accanto al pre-asilo
E non compare nessun gettone e nessuna animazione
E lo stesso vale per il post-asilo con l'abbonamento mensile post-asilo

## Scenario: pre/post-asilo non coperto mostra il gettone e "Da addebitare nella prossima retta"
**ID GET-02**
Dato che un bambino non ha l'abbonamento mensile pre-asilo
Quando premo "Pre-asilo" sul suo nome
Allora l'indicatore si attiva e compare un gettone con la scritta "Da
addebitare nella prossima retta"
E il gettone compie la sua animazione una sola volta e poi resta fermo
E lo stesso vale per il post-asilo senza abbonamento post-asilo

## Scenario: pre e post-asilo sono valutati separatamente
**ID GET-03**
Dato che un bambino ha solo l'abbonamento pre-asilo
Quando attivo sia "Pre-asilo" sia "Post-asilo" nello stesso giorno
Allora il pre-asilo mostra "Già pagato con l'abbonamento" senza gettone
E il post-asilo mostra il gettone e "Da addebitare nella prossima retta"
E l'abbonamento di una voce non copre mai l'altra

## Scenario: togliere il pre/post-asilo fa sparire scritta e gettone
**ID GET-04**
Dato che il pre-asilo (o il post-asilo) è attivo e mostra la scritta
Quando ripremo "Pre-asilo" (o "Post-asilo")
Allora l'indicatore si disattiva e la scritta (e l'eventuale gettone) di
quella voce spariscono
E l'altra voce, se attiva, non cambia

## Scenario: dopo il ricaricamento le scritte restano e l'animazione non riparte
**ID GET-05**
Dato che un pre/post-asilo attivo mostra "Da addebitare nella prossima
retta" (o "Già pagato con l'abbonamento")
Quando ricarico la pagina
Allora la scritta è ancora lì, calcolata dai dati e non da quanto è
successo prima nella pagina
E il gettone è già fermo: l'animazione non riparte
E non riparte nemmeno quando una voce diversa dello stesso bambino (o
un altro bambino) viene modificata e la schermata si aggiorna

## Scenario: con "riduci movimento" il gettone non si anima
**ID GET-06**
Dato che il sistema dell'utente ha attiva la preferenza
`prefers-reduced-motion: reduce`
Quando attivo un pre/post-asilo non coperto
Allora il gettone compare già fermo, senza animazione
E la scritta "Da addebitare nella prossima retta" è presente come negli
altri casi (il significato non dipende dall'animazione)

## Scenario: nella schermata presenze non compare nessun importo
**ID GET-07**
Dato che sono admin, maestra o assistente su "Presenze e pasti"
Quando guardo le card con pre/post-asilo coperti e non coperti
Allora non vedo prezzi, totali, importi del gettone né dell'abbonamento,
nemmeno nell'avviso di GET-12
E vedo solo le due scritte "Già pagato con l'abbonamento" e "Da addebitare
nella prossima retta"
E questo vale anche per l'admin: i soldi si calcolano solo nella retta
(specs/56)

## Scenario: maestra e assistente sanno solo "coperto / non coperto"
**ID GET-08**
Dato che sono autenticata come maestra o assistente (che non leggono
`costi_bambini`, specs/03 e specs/55)
Quando segno un pre/post-asilo sui bambini delle mie sezioni
Allora vedo la scritta giusta (coperto / da addebitare) per ogni voce
E la risposta del server contiene solo il sì/no per bambino e voce, mai
prezzi, flag o altri dati di `costi_bambini`
E per un bambino di un'altra sezione non ottengo nessuna risposta: il sì/no
vale solo per i bambini che posso già vedere

## Scenario: l'admin vede le stesse scritte
**ID GET-09**
Dato che sono autenticato come admin
Quando segno un pre/post-asilo su qualunque bambino e data ammessa
Allora vedo le stesse scritte e lo stesso gettone di maestra e assistente,
senza importi (GET-07)

## Scenario: il genitore non vede nulla di questo
**ID GET-10**
Dato che sono autenticato come genitore
Quando uso l'app
Allora non vedo la schermata delle presenze, né le scritte, né il gettone
(la lettura delle presenze del proprio figlio è fuori scope UI, specs/03)

## Scenario: la copertura segue il mese della presenza
**ID GET-11**
Dato che il bambino ha l'abbonamento pre-asilo e la data è nel mese M
Quando guardo una presenza pre-asilo di quel mese
Allora è "Già pagato con l'abbonamento" per tutte le date di M (mese
solare), non solo da quando l'abbonamento è stato spuntato
E se la retta del mese M è già stata inviata (specs/56), conta quello che
è stato addebitato in quella retta: la voce pre-asilo (o post-asilo) c'era
oppure no; il flag attuale in `costi_bambini` si usa solo se la retta di M
non è ancora inviata

## Scenario: avviso al salvataggio se il gettone non entrerà più in retta
**ID GET-12**
Dato che la retta del mese successivo a quello della presenza (dove
andrebbe il gettone) è già stata inviata (specs/56)
E il bambino non è coperto per quella voce
Quando salvo (attivo) un pre/post-asilo su quella data
Allora la presenza viene salvata comunque
E compare nella card un avviso senza importi: "Questo gettone non entrerà
più in retta: l'admin lo gestirà con crediti e debiti."
E l'avviso non compare se la presenza è coperta, se la retta successiva non
è ancora inviata, o se tolgo il pre/post-asilo
E l'avviso si rivede ricaricando la pagina finché la condizione dura

## Scenario: giorno di chiusura
**ID GET-13**
Dato che la data è un giorno di chiusura o un fine settimana (specs/53)
Quando apro "Presenze e pasti" per quella data
Allora non ci sono pulsanti Pre-asilo e Post-asilo (nessuna scrittura
possibile, per nessun ruolo)
E non compare nessuna scritta "Già pagato…" / "Da addebitare…" e nessun
gettone, nemmeno animato
E nessuna presenza di quel giorno può generare un gettone

## Scenario: data in sola lettura mostra le scritte senza animazione
**ID GET-14**
Dato che sono maestra o assistente su una data diversa da oggi, con un
pre/post-asilo già registrato
Quando apro la schermata
Allora vedo la scritta (coperto / da addebitare) in sola lettura
E il gettone è già fermo (nessuna animazione, perché nessuna azione è
stata appena compiuta)

## Scenario: la schermata è accessibile
**ID GET-15**
Dato che la schermata mostra scritte e gettoni
Quando eseguo il controllo di accessibilità
Allora non ci sono violazioni gravi: il gettone è decorativo (nascosto agli
screen reader) e il significato è nella scritta

## Regole
- **Gettone e copertura** (issue #399, parte di #401): per ogni
  pre/post-asilo attivo la card dice se è coperto dall'abbonamento mensile
  della stessa voce (GET-01) o da addebitare come gettone nella retta del
  mese successivo (GET-02). Pre e post sono voci separate (GET-03). Mai
  importi (GET-07). Lo stato si calcola dai dati esistenti (`costi_bambini`,
  `comunicazioni_retta`), senza colonne nuove; il gettone animato è solo
  CSS, si ferma dopo un ciclo e non si salva (GET-05, GET-06).
- Il gettone da addebitare di GET-02 diventa importo nella retta del mese
  successivo ([56](56%20-%20comunicazione-retta-mensile.md), RET-01..RET-08),
  con la stessa regola di copertura di GET-11; se la voce ha l'abbonamento
  nel mese della retta l'importo vale 0 e il numero resta (RET-13).
- Poiché maestra e assistente non leggono `costi_bambini`, il sì/no arriva
  da una funzione SQL di sola lettura (con il suo `GRANT` minimo nella
  stessa migration) che, per i bambini visibili al chiamante, restituisce
  solo coperto / non coperto per pre e post (GET-08). L'accesso va
  controllato con il `security-reviewer`.
- Scelte di dettaglio: l'avviso di GET-12 è mostrato a ogni ruolo che
  salva, senza importi, e non blocca il salvataggio; la correzione economica
  la fa l'admin con i crediti/debiti
  ([58](58%20-%20crediti-debiti-bambino.md)). Se la retta del mese della
  presenza è già inviata, vale cosa fu addebitato (GET-11).
- Le azioni di scrittura della presenza che dipendono dallo stato attuale
  (Pre-asilo, Post-asilo, Salva nota) non si fidano mai della riga di
  presenza ricevuta dal browser: la rileggono dal database con la sessione
  dell'utente (quindi sotto RLS) e usano quella per decidere cosa scrivere.
  La riga ricevuta serve solo come controllo di concorrenza ottimistica: se
  non coincide con quella letta (qualcun altro ha modificato nel
  frattempo, oppure la richiesta è stata manomessa) l'azione si ferma con
  "dati cambiati, ricarica la pagina". "Salva nota" richiede una riga
  esistente e visibile all'utente, altrimenti si ferma con un errore
  generico. Logica pura in `lib/presenza.ts`.
- Stati validi: `presente`, `assente`, `malattia`.
- Un bambino "presente" ha inoltre due indicatori booleani indipendenti,
  `pre_asilo` e `post_asilo` (entrambi falsi di default): validi solo
  quando lo stato è `presente` (vincolo anche a livello di database — un
  bambino assente o malato non può avere `pre_asilo`/`post_asilo` veri).
  Vedi "Presenza ordinaria, pre-asilo e post-asilo" sopra.
- Il riepilogo "Presenti: X/Y" conta X come i bambini con stato
  `presente` per la data visualizzata (incluso chi ha pre-asilo e/o
  post-asilo attivi, essendo comunque presenti in orario ordinario); Y è
  il totale dei bambini attivi della classe (indipendentemente dal loro
  stato o dall'assenza di uno stato). "Pre-asilo: P" conta i bambini con
  `pre_asilo = true`; "Post-asilo: Q" conta i bambini con
  `post_asilo = true`, entrambi per la stessa data.
- Un solo record di presenza per bambino per giorno (upsert su
  `bambino_id, data`).
- La nota è testo libero, opzionale, unica per il giorno (non separata
  tra ordinaria/pre-asilo/post-asilo).
- Il pulsante "Salva nota" è disponibile solo se per il bambino esiste
  già uno stato segnato per la data in questione: un record di presenza
  richiede sempre uno stato (colonna non nulla), quindi non è possibile
  salvare una nota "orfana" prima di aver segnato almeno una volta
  Presente/Assente/Malattia/Pre-asilo/Post-asilo.
- Scrittura consentita solo allo staff: la maestra o l'assistente della
  sezione del bambino, o l'admin (vedi RLS su `presenze` in
  `supabase/migrations/0001_init.sql`); l'assistente ha lo stesso
  perimetro di scrittura della maestra su questa tabella (vedi
  [03 - utenti-e-ruoli.md](03%20-%20utenti-e-ruoli.md)).
- Passare a "assente" o "malattia" un bambino con il pasto "sì" o un
  pre/post-asilo attivi (anomalia: un bambino assente non mangia e non
  fa orario esteso, e il pasto verrebbe contato nel totale comunicato a
  Rojac) chiede prima una conferma nella card (scenari sopra); alla
  conferma il pasto "sì" torna a "no" e pre/post-asilo si disattivano.
  Il pasto è azzerato dall'azione lato server, non solo dalla UI: vale
  il pasto attuale del bambino letto dal database (non quello mostrato
  nella pagina, che potrebbe essere superato) e solo se chi agisce può
  leggerlo e modificarlo — **l'assistente** non ha accesso ai pasti
  (vedi [14 - segna-pasto.md](14%20-%20segna-pasto.md)), quindi per lei
  l'avviso riguarda solo pre/post-asilo e un pasto già segnato da altri
  non viene toccato: quell'incoerenza la intercetta il controllo alla
  comunicazione a Rojac
  ([16 - comunicazione-pasti-rojac.md](16%20-%20comunicazione-pasti-rojac.md)).
  Se l'azzeramento del pasto fallisce, la presenza non viene salvata.
- Dopo la comunicazione dei pasti a Rojac, maestra e assistente non
  possono più segnare "assente" o "malattia" un bambino il cui pasto del
  giorno è "sì" (Presente, Pre-asilo, Post-asilo e nota restano
  consentiti); l'admin è esentato. Vincolo imposto anche a livello di
  database — vedi
  [16 - comunicazione-pasti-rojac.md](16%20-%20comunicazione-pasti-rojac.md).
- La data usata come "oggi" è quella nel fuso orario Europe/Rome (non
  UTC), vedi `lib/date.ts`.
- I ruoli "maestra" e "assistente" possono scrivere (inserire/modificare)
  solo sulla data odierna: vincolo imposto anche a livello di RLS, non
  solo in UI (vedi
  `supabase/migrations/0009_scrittura_solo_oggi_maestra.sql`); possono
  comunque consultare in sola lettura le altre date.
- Il ruolo "admin" può scrivere su qualunque data, passata o futura,
  **tranne** un giorno di chiusura scolastica (vedi
  [53 - calendario-scolastico.md](53%20-%20calendario-scolastico.md)):
  quel blocco non fa eccezioni di ruolo.
- L'elenco bambini mostra solo i bambini attivi (`bambini.attiva = true`):
  un bambino disattivato dall'admin non compare più qui, pur restando
  collegate le sue presenze passate (vedi
  [50 - amministrazione_base.md](50%20-%20amministrazione_base.md)).
- I bambini sono raggruppati per sezione, ordinati per cognome dentro
  ciascun gruppo (stesso pattern di raggruppamento di
  [56 - comunicazione-retta-mensile.md](56%20-%20comunicazione-retta-mensile.md)):
  una sezione senza bambini attivi non compare (niente titolo con sotto
  un elenco vuoto). Solo l'admin può vedere bambini senza sezione
  assegnata (maestra/assistente vedono solo le loro sezioni, quindi mai
  un bambino "senza sezione" per definizione): in quel caso compaiono in
  un gruppo a parte, intitolato "Senza sezione".
- L'invio automatico via email della scheda giornaliera (e dei report
  settimanale/mensile) è descritto in
  [52 - report-email-automatico.md](52%20-%20report-email-automatico.md),
  non più in questo file: da requisito ha smesso di riguardare solo le
  presenze del giorno.
