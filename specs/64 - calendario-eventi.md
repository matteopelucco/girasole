# 64 — Calendario eventi (sincronizzazione del Google Calendar)

Sotto-issue **a** di [#318](https://github.com/matteopelucco/girasole/issues/318)
(issue [#319](https://github.com/matteopelucco/girasole/issues/319)). La pagina
"Calendario" e il riquadro in dashboard (sotto-issue b e c) sono fuori scope: qui
si portano gli eventi nel database, nessuna interfaccia per leggerli.

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
- **Admin, maestra, assistente**: in futuro leggeranno gli eventi (sotto-issue b e
  c); la tabella è già leggibile da loro. **Genitore**: nessun accesso (decisione
  di Matteo, #318: quando lo avranno si deciderà la privacy degli eventi).

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

## Regole
- **Indirizzo = segreto.** Chi lo ha legge il calendario. Sta nel database, in
  una tabella a riga singola (`impostazioni_calendario`, migration 0065), mai nel
  repo, nei log, nei messaggi d'errore, nelle risposte del cron, nei test, nelle
  fixture, nei commenti o nelle PR. Le fixture dei test usano un feed finto
  servito in locale dal test stesso, mai il calendario reale.
- **Validazione dell'indirizzo** (`lib/calendarioIcal.ts`, `validaIndirizzoIcal`),
  all'inserimento e di nuovo prima di ogni lettura del feed: solo `https://`,
  nessuna credenziale nell'indirizzo, host `calendar.google.com` (o
  sottodominio di `google.com`), percorso che termina con `.ics`. Un campo
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
- **Dentro il cron notturno già esistente** (`report-presenze`): nessuna nuova
  voce in `vercel.json`. Il passo di sincronizzazione parte insieme al report e
  non ne ritarda né ne cambia l'esito: ogni suo errore è preso e trasformato in
  un esito, mai in un'eccezione. Valgono anche per il "Lancia ora" del report
  notturno (specs/63).
- **Rete.** Un solo tentativo, tempo massimo 8 secondi, risposta al massimo 5 MB,
  niente redirect (un redirect è un errore), niente cache. L'indirizzo non
  finisce mai nel messaggio di un errore.
- **Esito nel registro** (specs/63): se la sincronizzazione non riesce, il lancio
  del report notturno risulta KO con il messaggio fisso "Calendario non
  sincronizzato: <motivo breve>" (motivo scelto da un elenco: "indirizzo non
  valido", "servizio non raggiungibile", "risposta non valida", "feed non
  valido", "salvataggio degli eventi non riuscito"). Se anche una parte del
  report non è riuscita, i due messaggi si uniscono. Sincronizzazione
  disattivata non è un errore.
- **Fuori scope**: pagina Calendario e riquadro in dashboard
  ([#320](https://github.com/matteopelucco/girasole/issues/320),
  [#321](https://github.com/matteopelucco/girasole/issues/321)), accesso dei
  genitori, pulsante "Aggiorna ora", pulizia dell'archivio storico.
