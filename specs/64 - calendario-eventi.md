# 64 — Calendario eventi (sincronizzazione del Google Calendar)

Sotto-issue **a** e **b** di [#318](https://github.com/matteopelucco/girasole/issues/318):
la sincronizzazione degli eventi nel database
([#319](https://github.com/matteopelucco/girasole/issues/319)) e la pagina
"Calendario" che li mostra
([#320](https://github.com/matteopelucco/girasole/issues/320), scenari in fondo).
Il riquadro "Prossimi eventi" in dashboard (sotto-issue **c**,
[#321](https://github.com/matteopelucco/girasole/issues/321), scenari in fondo)
riusa la stessa vista degli eventi della pagina.

Collegata a [53 - calendario-scolastico.md](53%20-%20calendario-scolastico.md)
(giorni di chiusura: restano un'altra cosa, non si duplicano con gli eventi),
[62 - parametri-di-funzionamento.md](62%20-%20parametri-di-funzionamento.md)
(dove l'admin inserisce l'indirizzo) e
[63 - cron-job.md](63%20-%20cron-job.md) (dove si legge l'esito).

## Attori
- **Admin**: inserisce, sostituisce o svuota l'indirizzo iCal segreto del Google
  Calendar dell'asilo, in "Parametri di funzionamento". Solo lui lo legge e lo
  scrive.
- **Cron notturno** (Vercel Cron, lo stesso del report notturno,
  [52 - report-email-automatico.md](52%20-%20report-email-automatico.md)): legge il
  calendario e salva gli eventi. Nessun utente umano scrive gli eventi.
- **Admin, maestra, assistente**: leggono gli eventi nella pagina "Calendario"
  (`/dashboard/calendario`). **Genitore**: nessun accesso (decisione di Matteo,
  #318: quando lo avranno si deciderà la privacy degli eventi).

## Obiettivo
Chi aggiunge un evento nel Google Calendar dell'asilo lo ritrova in Girasole senza
doverlo reinserire. Lettura a senso unico (Google → Girasole) tramite l'indirizzo
iCal segreto del calendario: niente account Google da collegare, niente OAuth,
nessun costo. Una volta per notte.

## Scenario: la sezione "Calendario Google" compare in "Parametri di funzionamento" con la sincronizzazione disattivata
Dato che sono autenticato come admin
E non è stato salvato nessun indirizzo iCal
Quando apro `/admin/parametri-funzionamento`
Allora vedo la sezione "Calendario Google" con una breve descrizione
E vedo lo stato "Sincronizzazione disattivata"
E vedo il campo "Indirizzo iCal del calendario" vuoto e il pulsante "Salva indirizzo"
E non vedo il pulsante "Mostra indirizzo"
E la pagina non ha violazioni di accessibilità gravi

## Scenario: salvare un indirizzo valido attiva la sincronizzazione e lo nasconde
Dato che sono autenticato come admin sulla pagina "Parametri di funzionamento"
Quando scrivo un indirizzo iCal valido nel campo e premo "Salva indirizzo"
Allora lo stato diventa "Sincronizzazione attiva"
E sotto al pulsante compare "Ultimo salvataggio: {data} alle {ora}"
E al posto dell'indirizzo vedo un segnaposto fisso (che non lascia capire la lunghezza)
E l'indirizzo non compare da nessuna parte nella pagina, nemmeno nel campo di inserimento
E la pagina non ha violazioni di accessibilità gravi

## Scenario: un indirizzo non valido è rifiutato senza mostrarlo
Dato che sono autenticato come admin sulla pagina "Parametri di funzionamento"
Quando provo a salvare un indirizzo che non inizia con `https://`, oppure il cui host non è di Google, oppure che non finisce con `.ics`
Allora vedo un messaggio d'errore che dice che l'indirizzo non è un indirizzo iCal di Google Calendar valido
E il messaggio non riporta l'indirizzo digitato
E nulla viene salvato: lo stato di prima resta com'era

## Scenario: con la password sbagliata l'indirizzo resta nascosto
Dato che l'indirizzo è salvato e sono admin sulla pagina "Parametri di funzionamento"
Quando clicco "Mostra indirizzo" e inserisco una password sbagliata
Allora vedo il messaggio d'errore generico "Password non corretta."
E l'indirizzo resta nascosto

## Scenario: con la propria password l'indirizzo compare in chiaro, ricaricando torna nascosto
Dato che l'indirizzo è salvato e sono admin sulla pagina "Parametri di funzionamento"
Quando clicco "Mostra indirizzo" e inserisco la mia password
Allora l'indirizzo compare in chiaro e il pulsante diventa "Nascondi indirizzo"
E resto collegato come prima (la verifica non cambia la mia sessione)
Quando clicco "Nascondi indirizzo" oppure ricarico la pagina
Allora l'indirizzo è di nuovo nascosto e per rivederlo devo reinserire la password

## Scenario: svuotare il campo disattiva la sincronizzazione
Dato che l'indirizzo è salvato e sono admin sulla pagina "Parametri di funzionamento"
Quando svuoto il campo e premo "Salva indirizzo"
Allora lo stato diventa "Sincronizzazione disattivata"
E non vedo più il segnaposto né il pulsante "Mostra indirizzo"
E la notte successiva il cron non contatta Google
E gli eventi già salvati restano nel database com'erano

## Scenario: accesso negato a chi non è admin
Dato che sono autenticato come maestra, assistente o genitore
Quando provo ad aprire `/admin/parametri-funzionamento`
Allora vengo reindirizzato alla dashboard
E quindi non vedo la sezione "Calendario Google" né l'indirizzo

## Scenario: il cron senza indirizzo non sincronizza e non disturba il report notturno
Dato che nessun indirizzo iCal è salvato
Quando il cron notturno parte
Allora il report notturno viene prodotto come sempre
E la risposta del cron dice che la sincronizzazione del calendario è disattivata
E il lancio nel registro "Cron Job" non risulta KO per questo motivo

## Scenario: il cron legge il feed e salva gli eventi nella finestra di tempo
Dato che è salvato l'indirizzo di un calendario
E il feed contiene un evento singolo, uno di tutto il giorno e uno ripetuto ogni settimana
Quando il cron notturno parte
Allora gli eventi compresi tra circa 30 giorni fa e 12 mesi avanti sono salvati nel database, le occorrenze del ripetuto una per una
E la risposta del cron riporta quanti eventi sono stati inseriti, aggiornati e rimossi, senza titoli né indirizzo
E il report notturno viene prodotto come sempre

## Scenario: rilanciare il cron dà lo stesso risultato
Dato che il cron ha già sincronizzato un feed
E il feed non è cambiato
Quando il cron parte una seconda volta
Allora gli eventi nel database sono gli stessi di prima
E nessun evento risulta inserito, aggiornato o rimosso

## Scenario: un evento cancellato, annullato o spostato in Google si riflette alla sincronizzazione successiva
Dato che il cron ha già sincronizzato un feed
Quando in Google un evento viene cancellato o annullato, e un altro viene spostato di orario
E il cron parte di nuovo
Allora l'evento cancellato o annullato sparisce dal database
E quello spostato si aggiorna (stesso evento, nuovo orario), non si duplica

## Scenario: se Google non risponde o il feed non è valido, gli eventi restano e l'errore è leggibile all'admin
Dato che il cron ha già sincronizzato degli eventi
E il servizio non risponde, risponde con un errore, o restituisce un feed non valido
Quando il cron notturno parte
Allora gli ultimi eventi salvati restano nel database
E il report notturno viene prodotto come sempre e il cron risponde con successo
E la risposta del cron dice che la sincronizzazione del calendario non è riuscita, senza dettagli
E in "Cron Job" il lancio risulta "KO" con un messaggio leggibile ("Calendario non sincronizzato: …")
E né il messaggio né le risposte contengono l'indirizzo iCal

## Scenario: una regola di ripetizione ostile nel feed non blocca il report notturno
Dato che è salvato l'indirizzo di un calendario
E il feed contiene, oltre a eventi normali, una ripetizione che con ical.js non termina (es. un giorno del mese "numerato" ogni giorno, come `FREQ=DAILY;BYDAY=1MO`)
Quando il cron notturno parte
Allora il cron risponde con successo in pochi secondi
E il report notturno viene prodotto come sempre
E gli eventi normali del feed sono salvati; la serie ostile è saltata

## Pagina "Calendario" (`/dashboard/calendario`, issue #320)

Pagina in sola lettura per admin, maestra e assistente, con voce di menu
"Calendario" subito sotto "Dashboard". `/admin/calendario` ("Calendario
scolastico", spec 53) resta la pagina dove l'admin modifica i giorni di
chiusura e non cambia. In alto i **giorni di chiusura** (tabella
`giorni_chiusura`), in basso la sezione **"A calendario"** con gli eventi di
Google (tabella `calendario_eventi`): due sezioni distinte, con due query
distinte, mai fuse in un'unica lista (vedi "Regole della pagina").

## Scenario: la voce "Calendario" è nel menu di admin, maestra e assistente
Dato che sono autenticato come admin, maestra o assistente
Quando guardo il menu laterale
Allora vedo la voce "Calendario" subito dopo "Dashboard"
E cliccandola apro `/dashboard/calendario`, dove la voce risulta evidenziata
E la voce non è nel menu del genitore

## Scenario: il genitore non accede alla pagina
Dato che sono autenticato come genitore
Quando provo ad aprire `/dashboard/calendario`
Allora vengo reindirizzato alla dashboard
E non vedo né giorni di chiusura né eventi

## Scenario: i giorni di chiusura in corso e futuri sono in alto, in sola lettura
Dato che l'admin ha inserito un giorno di chiusura che comincia nel futuro
Quando apro la pagina "Calendario" come maestra
Allora in cima vedo la sezione "Giorni di chiusura" con il giorno futuro, con le date e la nota
E un giorno di chiusura in corso oggi porta l'etichetta "In corso"
E i giorni di chiusura già conclusi non compaiono
E non c'è nessun pulsante o modulo per modificarli
E nella sezione leggo che sabato e domenica sono chiusi sempre

## Scenario: l'admin trova il rimando per gestire i giorni di chiusura
Dato che sono autenticato come admin
Quando apro la pagina "Calendario"
Allora nella sezione "Giorni di chiusura" vedo il link "Gestisci i giorni di chiusura" verso `/admin/calendario`
E maestra e assistente non vedono quel link

## Scenario: senza giorni di chiusura in programma lo stato vuoto è gentile
Dato che non ci sono giorni di chiusura in corso o futuri
Quando apro la pagina "Calendario"
Allora la sezione "Giorni di chiusura" dice "Nessun giorno di chiusura in programma."

## Scenario: gli eventi sono raggruppati per mese e per giorno, con la data in evidenza
Dato che il calendario ha eventi futuri in giorni diversi
Quando apro la pagina "Calendario"
Allora sotto "A calendario" vedo gli eventi in ordine di data, con un'intestazione per ogni mese
E ogni giorno ha il suo blocco con il giorno della settimana abbreviato e il numero del giorno ben visibili
E gli eventi dello stesso giorno stanno nello stesso blocco

## Scenario: un evento con orario mostra ora di inizio e di fine in fuso Europe/Rome
Dato che il calendario ha un evento dalle 10:00 alle 11:00 (ora di Roma) con luogo
Quando apro la pagina "Calendario"
Allora l'evento mostra "10:00 – 11:00" (ora di Roma, anche con l'ora legale) e il luogo

## Scenario: luogo e descrizione compaiono solo se presenti
Dato che il calendario ha un evento con luogo e descrizione e uno senza
Quando apro la pagina "Calendario"
Allora il primo evento mostra luogo e descrizione, con gli a capo della descrizione conservati
E il secondo non mostra né luogo né descrizione, nemmeno come riga vuota

## Scenario: un evento di tutto il giorno si distingue da uno con orario
Dato che il calendario ha un evento di tutto il giorno
Quando apro la pagina "Calendario"
Allora l'evento mostra l'etichetta "Tutto il giorno" al posto dell'orario

## Scenario: un evento su più giorni è chiaro
Dato che il calendario ha un evento di tutto il giorno che dura più giorni
Quando apro la pagina "Calendario"
Allora l'evento compare una sola volta, nel giorno in cui comincia
E mostra l'intervallo dei giorni (es. "10 ott – 12 ott")
E se è già cominciato compare sotto il giorno di oggi con l'etichetta "In corso"

## Scenario: gli eventi passati sono separati e attenuati
Dato che il calendario ha un evento già concluso (fino a 30 giorni fa) e uno futuro
Quando apro la pagina "Calendario"
Allora l'evento futuro è sotto "A calendario" nella parte "Prossimi"
E quello concluso è in una parte "Passati" sotto la prima, in ordine dal più recente, con aspetto attenuato

## Scenario: titolo, descrizione e luogo sono sempre testo semplice
Dato che il feed contiene un titolo con del codice HTML e una descrizione con un indirizzo web (anche `javascript:`)
Quando apro la pagina "Calendario"
Allora vedo il codice HTML come testo, senza che venga eseguito o interpretato
E l'indirizzo web è testo: non diventa un link cliccabile
E nella sezione degli eventi non c'è nessun link

## Scenario: un evento "chiuso" di Google resta un evento
Dato che il Google Calendar ha un evento intitolato "Chiuso" in un giorno feriale
Quando apro la pagina "Calendario"
Allora l'evento compare sotto "A calendario"
E non compare nella sezione "Giorni di chiusura"
E aprendo "Presenze e pasti" per quel giorno non c'è alcun avviso di chiusura

## Scenario: l'admin senza indirizzo vede come collegare il calendario
Dato che sono autenticato come admin e nessun indirizzo iCal è salvato
Quando apro la pagina "Calendario"
Allora sotto "A calendario" leggo che il Google Calendar non è ancora collegato
E vedo il link "Parametri di funzionamento" verso `/admin/parametri-funzionamento`

## Scenario: l'admin con indirizzo ma senza eventi legge che non ce ne sono
Dato che sono autenticato come admin e l'indirizzo è salvato, ma il calendario non ha eventi
Quando apro la pagina "Calendario"
Allora sotto "A calendario" leggo che non ci sono eventi e che l'aggiornamento avviene ogni notte
E non vedo il link ai Parametri di funzionamento

## Scenario: maestra e assistente senza eventi leggono un messaggio neutro
Dato che sono autenticata come maestra o assistente e il calendario non ha eventi
Quando apro la pagina "Calendario"
Allora sotto "A calendario" leggo "Non ci sono eventi a calendario."
E non vedo né link all'amministrazione né accenni all'indirizzo o alla configurazione

## Scenario: la pagina non rivela l'indirizzo iCal
Dato che l'indirizzo iCal è salvato
Quando apro la pagina "Calendario" come admin, maestra o assistente
Allora l'indirizzo non compare da nessuna parte nella pagina

## Scenario: la pagina è usabile da telefono e accessibile
Dato che apro la pagina "Calendario" su uno schermo largo 375 px
Quando la pagina è caricata
Allora non c'è scorrimento orizzontale
E la pagina non ha violazioni di accessibilità gravi

## Regole
- **Indirizzo = segreto.** Chi lo ha legge il calendario. Sta nel database, in
  una tabella a riga singola (`impostazioni_calendario`, migration 0065), mai nel
  repo, nei log, nei messaggi d'errore, nelle risposte del cron, nei test, nelle
  fixture, nei commenti o nelle PR. Le fixture dei test usano un feed finto
  servito in locale dal test stesso, mai il calendario reale.
- **Validazione dell'indirizzo** (`lib/calendarioIcal.ts`, `validaIndirizzoIcal`),
  all'inserimento e di nuovo prima di ogni lettura del feed: solo `https://`,
  nessuna credenziale né porta nell'indirizzo, host `calendar.google.com`
  (o `www.google.com`, il vecchio formato), percorso che termina con `.ics`. Un campo
  vuoto non è un errore: significa sincronizzazione disattivata. Il messaggio
  d'errore non riporta mai ciò che l'admin ha digitato.
- **Solo per i test e2e**: se è impostata la variabile `CALENDARIO_ICAL_PROVA_ORIGINE`
  (origine `http://127.0.0.1:<porta>`), è accettato anche un indirizzo che
  inizia con quell'origine. La variabile non è mai impostata in produzione e
  viene ignorata se `VERCEL_ENV` è `production`. La imposta
  `playwright.config.ts` per il server avviato dai test: se in locale si
  riusa un server già avviato, va riavviato.
- **Permessi (RLS).** Tabella `impostazioni_calendario` (riga singola, come
  `impostazioni_email_rojac`): solo l'admin legge e modifica (SELECT e UPDATE;
  la riga esiste già, niente INSERT/DELETE per i ruoli API); il cron la legge
  con la service_role. Tabella `calendario_eventi`: SELECT per admin, maestra
  e assistente (non il genitore, non anon); nessun utente scrive; la scrittura
  avviene solo tramite la funzione `sostituisci_eventi_calendario(jsonb)`,
  eseguibile solo dalla service_role.
- **Sostituzione atomica e idempotente.** La funzione fa in una sola transazione:
  inserisce o aggiorna gli eventi del feed (chiave `id_esterno`) e rimuove quelli
  che nel feed non ci sono più. Un errore a metà annulla tutto: restano gli eventi
  di prima. Rilanciarla con lo stesso feed non cambia nulla.
- **Eventi** (`lib/calendarioIcal.ts`, funzione pura da testo del feed a elenco
  di eventi, libreria `ical.js`, unica dipendenza aggiunta): finestra da 30
  giorni prima di oggi a 12 mesi dopo; eventi singoli, di tutto il giorno e con
  orario (fuso Europe/Rome, anche nel passaggio all'ora legale), ripetuti
  (RRULE, con date escluse EXDATE, espansi in una riga per occorrenza),
  occorrenze spostate o modificate (RECURRENCE-ID) e annullati
  (`STATUS:CANCELLED`, che non vengono salvati). `id_esterno` è l'UID
  dell'evento, più l'occorrenza originale per i ripetuti: così uno spostamento
  aggiorna la stessa riga. Per gli eventi di tutto il giorno `inizio` e `fine`
  sono la mezzanotte (Europe/Rome) del primo giorno e del giorno dopo l'ultimo
  (fine esclusa), con `tutto_il_giorno = true`. Titolo, descrizione e luogo sono
  testo semplice, accorciati a lunghezze massime: chi li mostra li tratta come
  testo (mai come HTML).
  **Limiti di sicurezza dell'analisi** (il feed lo può modificare chiunque abbia
  accesso al Google Calendar, e non deve poter bloccare il report notturno):
  si espandono solo le ripetizioni giornaliere, settimanali, mensili e annuali
  (ogni secondo, minuto o ora sono saltate); INTERVAL oltre 1000 è saltato; per
  le giornaliere e settimanali sono saltate le regole con BYMONTHDAY, BYYEARDAY,
  BYWEEKNO, BYSETPOS e con BYDAY numerato ("1MO", "-1FR": solo giorni semplici),
  e con INTERVAL maggiore di 1 anche quelle con BYMONTH (per le giornaliere anche
  con BYDAY); le annuali con BYSETPOS sono saltate; una serie con più RRULE è
  saltata se anche una sola è esclusa. Un evento o una serie illeggibile o
  saltata non fa fallire il feed: gli altri eventi restano. Gli eventi si
  estraggono dal testo in tempo lineare (nessuna espressione regolare).
  Tetti: 20.000 passi per serie, 50.000 per tutto il feed, 5.000 eventi, 20.000
  eventi nel feed e 4 secondi di analisi (controllati prima di ogni serie).
  **Analisi interrotta dai limiti = errore, non elenco parziale**: gli eventi
  salvati restano e nel registro "Cron Job" compare "Calendario non
  sincronizzato: feed troppo complesso, analisi interrotta dai limiti" (così le
  serie non esaminate non spariscono in silenzio). Le occorrenze si calcolano
  dall'inizio della serie (ical.js non permette di partire dalla finestra senza
  falsare COUNT e INTERVAL): una serie iniziata da decine di anni può superare il
  tetto prima di arrivare alla finestra e fa risultare l'analisi interrotta.
- **Analisi in un worker terminabile.** I tetti non bastano: con alcune regole
  (valide o malformate) ical.js resta bloccato dentro una sola chiamata, che
  nessun conteggio interrompe, e l'analisi gira nello stesso processo del report.
  Per questo l'analisi (`lib/calendarioIcalMotore.mjs`, JavaScript puro) gira in
  un `worker_threads` (`lib/calendarioIcalWorker.mjs`, avviato da
  `lib/calendarioIcalIsolato.ts`) con tempo massimo di 8 secondi; allo scadere il
  worker è terminato (`terminate()`), il feed è considerato non analizzabile
  ("analisi del feed troppo lenta"), gli eventi salvati restano e il report esce
  comunque. Scelta tra le due strade proposte (route interna separata o worker):
  il worker, perché una route interna eseguirebbe comunque il ciclo infinito nello
  stesso processo (su Vercel con più richieste in una stessa istanza, e in
  `next start`, lo bloccherebbe per tutti) e richiederebbe una chiamata HTTP del
  server a sé stesso; il worker è un modulo di Node, senza dipendenze. Il file del
  worker è caricato da disco a runtime (non passa dal bundle): `next.config.mjs`
  lo include, con il motore e ical.js, nel pacchetto delle due funzioni che lo
  usano (`outputFileTracingIncludes`). Se il worker non parte è un errore
  ("errore imprevisto"), mai un ripiego nello stesso processo.
- **Dentro il cron notturno già esistente** (`report-presenze`): nessuna nuova
  voce in `vercel.json`. Il passo di sincronizzazione parte insieme al report e
  non ne ritarda né ne cambia l'esito: ogni suo errore è preso e trasformato in
  un esito, mai in un'eccezione. Valgono anche per il "Lancia ora" del report
  notturno (specs/63).
- **Rete.** Un solo tentativo, tempo massimo 8 secondi (rete e lettura), risposta al
  massimo 5 MB, niente redirect (un redirect è un errore), niente cache. Un
  guasto di rete o un tempo scaduto è "servizio non raggiungibile"; una risposta
  diversa da 2xx o troppo grande è "risposta non valida". L'indirizzo non
  finisce mai nel messaggio di un errore.
- **Esito nel registro** (specs/63): se la sincronizzazione non riesce, il lancio
  del report notturno risulta KO con il messaggio fisso "Calendario non
  sincronizzato: <motivo breve>" (motivo scelto da un elenco: "indirizzo non
  valido", "servizio non raggiungibile", "risposta non valida", "feed non
  valido", "analisi del feed troppo lenta", "feed troppo complesso, analisi
  interrotta dai limiti", "impostazione non leggibile", "salvataggio degli eventi non
  riuscito", "errore imprevisto"). Se anche una parte del
  report non è riuscita, i due messaggi si uniscono. Sincronizzazione
  disattivata non è un errore.
- **Fuori scope**: accesso dei genitori, pulsante "Aggiorna ora", pulizia dell'archivio storico.

## Regole della pagina "Calendario"
- **Percorso**: `/dashboard/calendario`, distinto da `/admin/calendario` (che resta,
  invariata, la pagina dove l'admin modifica le chiusure). Accesso a chi è staff
  (`requireStaff`): il genitore è reindirizzato alla dashboard.
- **Regola di separazione** ([#320](https://github.com/matteopelucco/girasole/issues/320)):
  giorni di chiusura (spec 53) e eventi di Google sono cose distinte, anche nel
  codice: due sezioni, due query, mai una lista unica. Gli eventi di Google non
  creano né modificano giorni di chiusura e non bloccano presenze, pasti o ore di
  lavoro; la chiusura vera la dichiara solo l'admin in `/admin/calendario`.
- **Letture**: solo dal database, con la sessione di chi guarda (RLS); la pagina
  non chiama mai Google. Non legge né mostra `impostazioni_calendario.ical_url`:
  per sapere se il calendario è collegato (solo per l'admin) chiede soltanto se
  la riga ha un indirizzo, senza leggerlo.
- **Chiusure mostrate**: quelle con data di fine da oggi in poi, dalla più vicina.
- **Eventi mostrati**: quelli salvati dal cron (da circa 30 giorni fa a 12 mesi
  avanti). Giorni, mesi e orari sono quelli di Europe/Rome. Un evento è "passato"
  se il suo ultimo giorno è prima di oggi. Un evento su più giorni compare una
  sola volta, nel giorno d'inizio (o sotto oggi, con "In corso", se è già
  cominciato). Per gli eventi di tutto il giorno la fine è esclusa (mezzanotte del
  giorno dopo l'ultimo): l'ultimo giorno mostrato è quello prima.
- **Solo testo**: titolo, descrizione e luogo arrivano da un feed non fidato e
  sono resi da React come testo (mai HTML, mai link costruiti dal feed).
- **Grafica**: prima per il telefono; mesi come intestazioni, data in evidenza,
  passato attenuato (con contrasto sufficiente), caricamento con sagome della
  stessa altezza dei contenuti (nessun salto di pagina).
- Logica pura (raggruppamento e orari) in `lib/calendarioEventiVista.ts`, con
  test unitari co-locati.

## Riquadro "Prossimi eventi" nella dashboard (issue #321)

Nella dashboard ([12 - dashboard-maestre.md](12%20-%20dashboard-maestre.md)),
sotto le card delle attività e sopra gli avvisi, un riquadro "Prossimi eventi"
mostra i 3 eventi di Google più vicini, con un link alla pagina "Calendario".
Lo vedono admin, maestra e assistente (il genitore non ha ancora la dashboard
staff). I **giorni di chiusura non compaiono** nel riquadro: sono un'altra
cosa, con un'altra query (vedi "Regole del riquadro").

## Scenario: il riquadro mostra i 3 prossimi eventi, con data, orario e titolo
Dato che il calendario ha almeno 4 eventi futuri o in corso
Quando apro la dashboard
Allora vedo il riquadro "Prossimi eventi" con esattamente 3 eventi, i più vicini, in ordine di data
E ogni evento mostra il giorno (giorno della settimana, numero e mese), l'orario in fuso Europe/Rome oppure "Tutto il giorno", e il titolo
E gli eventi successivi al terzo non compaiono
E gli eventi già conclusi non compaiono

## Scenario: con meno di 3 eventi il riquadro mostra solo quelli che ci sono
Dato che il calendario ha solo 2 eventi futuri
Quando apro la dashboard
Allora il riquadro "Prossimi eventi" mostra quei 2 eventi
E non mostra segnaposto vuoti né messaggi d'errore

## Scenario: senza eventi futuri il riquadro dà un messaggio gentile e neutro
Dato che il calendario non ha eventi futuri o in corso (anche perché l'indirizzo iCal non è salvato)
Quando apro la dashboard come admin, maestra o assistente
Allora il riquadro "Prossimi eventi" dice "Non ci sono eventi in programma." (lo stesso testo per tutti)
E non vedo errori né accenni all'indirizzo, alla configurazione o ai Parametri di funzionamento
E il resto della dashboard compare come sempre

## Scenario: un evento già cominciato e non ancora finito conta
Dato che il calendario ha un evento di tutto il giorno cominciato ieri e che finisce dopodomani
Quando apro la dashboard
Allora il riquadro "Prossimi eventi" mostra quell'evento per primo, con l'etichetta "In corso"
E conta tra i 3 mostrati

## Scenario: il riquadro mostra sempre testo semplice
Dato che il feed contiene un evento con codice HTML nel titolo
Quando apro la dashboard
Allora il riquadro mostra il codice HTML come testo, senza che venga eseguito o interpretato
E negli eventi del riquadro non c'è nessun link, immagine o elemento costruito dal feed

## Scenario: il riquadro rimanda alla pagina Calendario
Dato che sono sulla dashboard
Quando guardo il riquadro "Prossimi eventi"
Allora vedo il link "Vedi tutto" verso `/dashboard/calendario`, anche quando non ci sono eventi
E cliccandolo apro la pagina "Calendario"

## Scenario: il riquadro è visibile a ogni ruolo con accesso alla dashboard
Dato che sono autenticato come admin, maestra o assistente
Quando apro la dashboard
Allora vedo il riquadro "Prossimi eventi" con gli stessi eventi, qualunque sia il mio ruolo
E il genitore, che non ha ancora la dashboard staff, non vede il riquadro né gli eventi

## Scenario: il riquadro è usabile da telefono e accessibile
Dato che apro la dashboard su uno schermo largo 375 px
Quando la pagina è caricata
Allora il riquadro "Prossimi eventi" è visibile e non c'è scorrimento orizzontale
E la pagina non ha violazioni di accessibilità gravi

## Regole del riquadro
- **Una sola query leggera**, a sé, sulla sola tabella `calendario_eventi`: gli
  eventi con `fine` da adesso in poi, in ordine di inizio, al massimo 3. Non
  tocca `giorni_chiusura` (regola di separazione di #318/#320/#321: due
  tabelle, due query, mai fuse; gli eventi non creano né bloccano chiusure).
  Niente Google, niente `impostazioni_calendario`: il riquadro non sa se il
  calendario è collegato né legge l'indirizzo, e per questo il messaggio vuoto è
  uguale per tutti.
- **Stessa definizione della pagina "Calendario"**: orari, "Tutto il giorno",
  etichetta "In corso" e giorno mostrato vengono da `costruisciVistaEventi`
  (`lib/calendarioEventiVista.ts`, funzione `prossimiEventiDashboard`). Un
  evento su più giorni già cominciato è mostrato sotto oggi, "In corso".
  Differenza voluta: il riquadro filtra sull'istante (un evento con orario già
  finito stamattina non c'è più), la pagina sul giorno (resta tra i "Prossimi"
  fino a fine giornata).
- **Guasti isolati**: se la lettura fallisce (o la tabella non è raggiungibile)
  il riquadro mostra il messaggio neutro e il resto della dashboard compare lo
  stesso; l'errore va solo nel log del server, senza dettagli per l'utente.
  Il riquadro si carica a parte (Suspense, con sagome della stessa altezza):
  non rallenta il resto della dashboard.
- **Indipendente dalle sezioni**: il riquadro non dipende dalle sezioni
  assegnate (compare anche a chi non ne ha), perché gli eventi sono per tutto
  l'asilo.
- **Solo testo**: come nella pagina, titolo e orario sono testo reso da React;
  mai HTML, mai link costruiti dal feed. L'unico link del riquadro è "Vedi
  tutto", fisso.
