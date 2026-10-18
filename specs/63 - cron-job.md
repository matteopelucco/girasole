# 63 — Azioni (e Cron Job)

## Attori
Solo Admin. Maestra, assistente e genitore non vedono la voce di menu, non
raggiungono la pagina, non leggono il registro dei lanci (nemmeno in
lettura) e non possono lanciare un job a mano. Nessun utente umano scrive
direttamente nel registro: lo scrivono solo i job, cioè l'email di
riepilogo degli allarmi ([07 - allarmi.md](07%20-%20allarmi.md)) e il
report notturno
([52 - report-email-automatico.md](52%20-%20report-email-automatico.md)),
sia quando li lancia Vercel Cron sia quando li lancia l'admin a mano dalla
pagina (issue #302). La sincronizzazione del Google Calendar lanciata a mano
dalla scheda "Azioni" (issue #326) non scrive nel registro.

## Obiettivo
La voce di menu e la pagina si chiamano "Azioni" (issue #325) e hanno due
schede: "Cron Job", con la visibilità sui lanci dei job pianificati descritta
qui sotto, e "Azioni", che ospita le azioni che l'admin lancia a mano (oggi una
sola: "Sincronizza calendario", issue #326).

Dare all'admin un po' di visibilità sui lanci dei job pianificati: quando
sono partiti e se sono andati bene, senza dover entrare nel pannello di
Vercel. Nessun accesso all'API di Vercel: ogni job registra da sé, nel
database, l'inizio e la fine di ogni proprio lancio, con l'esito.

## Scenario: "Azioni" compare nel menu sotto "Impostazioni", solo per l'admin
Dato che sono autenticato come admin
Quando guardo la sidebar di navigazione
Allora vedo la voce "Azioni" (`/admin/cron-job`) e non più "Cron Job"
E sta sotto "Impostazioni", rientrata, dopo "Reset giornata" e "Parametri di funzionamento" e prima di "Utenti"
E se sono maestra, assistente o genitore non vedo questa voce

## Scenario: la pagina "Azioni" ha due schede, "Cron Job" è quella iniziale
Dato che sono autenticato come admin
Quando apro "Azioni" dal menu
Allora arrivo a `/admin/cron-job`, la voce di menu "Azioni" risulta evidenziata e il titolo della pagina è "Azioni"
E vedo due schede, "Cron Job" e "Azioni", e la scheda "Cron Job" è quella selezionata
E il contenuto sotto le schede è quello della scheda "Cron Job"
E premendo la scheda "Azioni" l'indirizzo diventa `/admin/cron-job?scheda=azioni` e la scheda "Azioni" risulta selezionata
E ricaricando la pagina o aprendo direttamente quell'indirizzo la scheda "Azioni" è ancora quella selezionata
E premendo la scheda "Cron Job" torno alla scheda iniziale
E con la tastiera, su una scheda, le frecce sinistra e destra passano all'altra scheda e il focus si vede
E a 375 px di larghezza le schede restano leggibili e non c'è scorrimento orizzontale
E la pagina non ha violazioni di accessibilità gravi

## Scenario: la scheda "Azioni" ha l'azione "Sincronizza calendario" con il suo pulsante
Dato che sono autenticato come admin
Quando apro la scheda "Azioni" (`/admin/cron-job?scheda=azioni`)
Allora vedo l'azione "Sincronizza calendario" con una breve spiegazione e il pulsante "Sincronizza calendario ora", attivo
E non vedo altre azioni, né blocchi dei job, né pulsanti "Lancia ora", né il vecchio messaggio "Per ora non ce ne sono"
E non c'è nessun esito finché non premo il pulsante
E a 375 px di larghezza il pulsante resta leggibile e non c'è scorrimento orizzontale
E la pagina non ha violazioni di accessibilità gravi
(Cosa succede premendo il pulsante: scenari nella sezione "Sincronizzazione a mano" di [64 - calendario-eventi.md](64%20-%20calendario-eventi.md).)

## Scenario: i lanci sono raggruppati per job, con nome, data e ora, stato
Dato che sono autenticato come admin
E il registro contiene lanci del report notturno e dell'email di riepilogo degli allarmi
Quando apro la scheda "Cron Job" (quella iniziale di `/admin/cron-job`)
Allora vedo un messaggio introduttivo e la scheda "Cron Job" è selezionata
E vedo un blocco per ogni job, ciascuno con il proprio titolo: "Report notturno" e "Riepilogo allarmi"
E in ogni blocco ci sono solo i lanci di quel job, dal più recente al più vecchio
E per ogni lancio vedo il nome del job, la data e l'ora di inizio (fuso Europe/Rome) e lo stato "OK" o "KO"
E la pagina non ha violazioni di accessibilità gravi

## Scenario: ultimi 20 lanci e "Carica altri"
Dato che sono autenticato come admin
E un job ha più di 20 lanci registrati
Quando apro la scheda "Cron Job"
Allora nel blocco di quel job vedo solo gli ultimi 20 lanci e il pulsante "Carica altri"
Quando premo "Carica altri"
Allora sotto ai 20 già visibili compaiono i 20 lanci precedenti (o quelli che restano)
E quando non ce ne sono altri il pulsante "Carica altri" non compare più
E gli altri blocchi restano come erano

## Scenario: un lancio KO mostra il messaggio di errore, se ricavabile
Dato che sono autenticato come admin
E un lancio è finito con un errore
Quando apro la scheda "Cron Job"
Allora quel lancio ha lo stato "KO" e, sotto, un breve messaggio di errore
E il messaggio non contiene stack trace, chiavi, token o indirizzi email (vedi Regole)
E un lancio di cui non è mai stata registrata la fine, partito da più di 15 minuti, risulta "KO" con il messaggio "Esecuzione interrotta: nessun esito registrato."

## Scenario: ogni lancio di un job viene registrato senza toccare il lavoro del job
Dato che un job pianificato viene chiamato con il secret corretto
Quando il job finisce (bene o con un errore)
Allora nel registro c'è una riga con il suo nome, l'istante di inizio, l'istante di fine e l'esito
E una chiamata senza il secret corretto non viene registrata

## Scenario: ogni job ha il pulsante "Lancia ora", che chiede conferma prima di partire
Dato che sono autenticato come admin
Quando apro la scheda "Cron Job"
Allora in ogni blocco vedo il pulsante "Lancia ora"
Quando lo premo
Allora compare la richiesta di conferma "Questo lancio invia davvero le email. Procedere?" con i pulsanti "Sì, lancia ora" e "Annulla"
E il job non è ancora partito
Quando premo "Annulla"
Allora la richiesta di conferma sparisce e nell'elenco non compare nessun lancio nuovo
E la pagina non ha violazioni di accessibilità gravi

## Scenario: lancio a mano: avviso di esecuzione in corso, esito e tag "estemporaneo"
Dato che sono autenticato come admin
E ho premuto "Lancia ora" nel blocco "Riepilogo allarmi"
Quando confermo con "Sì, lancia ora"
Allora finché il job lavora vedo l'avviso "Esecuzione in corso…" e non posso lanciarlo di nuovo
Quando il job finisce
Allora vedo l'esito: "Lancio a mano completato: OK", oppure "Lancio a mano completato: KO" con sotto il messaggio di errore (già ripulito, vedi Regole)
E in cima al blocco compare il nuovo lancio, con lo stesso stato e il tag "estemporaneo"
E i lanci partiti da Vercel Cron non hanno il tag
E la pagina non ha violazioni di accessibilità gravi

## Scenario: accesso negato a chi non è admin
Dato che sono autenticato come maestra, assistente o genitore
Quando provo ad aprire `/admin/cron-job` (anche con `?scheda=azioni`)
Allora vengo reindirizzato alla dashboard
E non vedo la voce "Azioni" nel menu
E non ho nessun modo di lanciare un job a mano né di sincronizzare il calendario a mano (la Server Action rifà `requireAdmin()` da sé, vedi 64)

## Regole
- Nome e indirizzo (issue #325, decisione di Matteo del 18/10/2026): la voce
  di menu, il titolo della pagina (`<h1>`) e il riquadro in "Impostazioni"
  sono "Azioni"; "Cron Job" è il nome della prima scheda. **L'indirizzo resta
  `/admin/cron-job`**: nessun redirect, nessun link da aggiornare, nessun
  rischio per i riferimenti esistenti (sezioni delle altre spec, e2e, regole
  del bundle in `next.config.mjs`). Il file della spec resta `63 - cron-job.md`.
- Schede: la scheda attiva sta nell'indirizzo (`?scheda=azioni`; senza
  parametro, o con un valore sconosciuto, è "Cron Job"), così la pagina si
  disegna interamente sul server e funziona con "ricarica" e con il link
  diretto. Le schede hanno i ruoli ARIA `tablist`/`tab`/`tabpanel` e sono
  link (`aria-selected`, un solo `tabpanel` con `aria-labelledby`);
  l'unico JavaScript sul client serve per le frecce sinistra/destra (e
  Home/Fine) della tastiera. "Carica altri" resta nella scheda "Cron Job" e
  non porta `scheda` (è quella iniziale).
- La scheda "Azioni" contiene una sola azione, "Sincronizza calendario"
  (issue #326, cambia la regola di #325 secondo cui era vuota e senza Server
  Action): lancia solo la sincronizzazione del Google Calendar di
  [64 - calendario-eventi.md](64%20-%20calendario-eventi.md), senza report
  notturno e senza email, e **non scrive nel registro** (nessuna migration: lo
  stato vive nella pagina, ricaricandola l'ultimo esito si perde). Il lancio a
  mano dei cron resta nella scheda "Cron Job", invariato.
- Lessico: l'esito di un lancio nel registro e dei lanci a mano dei cron è
  "OK"/"KO"; l'esito della sincronizzazione a mano della scheda "Azioni" è
  "OK"/"ERRORE" (parole della issue #326). Sono due cose diverse: "KO" resta
  per il registro dei cron.
- Pagina riservata all'admin con `requireAdmin`, come le altre pagine
  `/admin/*`. Voce di menu in `lib/navigazione.ts`, rientrata
  (`rientrata: true`) tra "Parametri di funzionamento" e "Utenti".
- Registro: tabella `cron_esecuzioni` (migration 0063), una riga per lancio
  con nome del job, inizio, fine, esito (`ok`/`ko`, vuoto finché il lancio è
  in corso), messaggio di errore e `estemporaneo` (migration 0064: vero per
  i lanci a mano). RLS attiva: solo l'admin legge; nessun utente inserisce,
  modifica o cancella. Scrivono solo i job, con la service_role (SELECT,
  INSERT, UPDATE; nessun DELETE).
- Nomi dei job registrati: `report-presenze` ("Report notturno") e
  `allarmi` ("Riepilogo allarmi"), lo stesso percorso della route in
  `app/api/cron/`. Un job nuovo si aggiunge all'elenco in
  `lib/cronEsecuzioni.ts`.
- Il registro non deve mai far fallire né rallentare il lavoro vero del
  job: la scrittura dell'inizio parte insieme al lavoro (non lo precede),
  ogni scrittura ha un tempo massimo di 3 secondi e un suo errore viene
  solo scritto nei log; non tocca le tabelle dell'idempotenza delle email
  (`allarmi_inviati`, `report_giornalieri_inviati`,
  `report_periodici_inviati`).
- Esito: "KO" se il job solleva un errore, oppure se finisce ma una sua
  parte non è riuscita (report notturno con almeno un report non prodotto;
  riepilogo allarmi con il registro degli invii che rifiuta la riga). In
  tutti gli altri casi "OK", anche quando non parte nessuna email perché
  non c'era niente da inviare. Un lancio senza esito è "In corso" nei primi
  15 minuti, poi "KO" (interrotto, per esempio per un timeout).
- Messaggio di errore: solo il testo dell'errore, mai lo stack; solo la
  prima riga; indirizzi email, token `Bearer`, JWT e stringhe lunghe simili a
  chiavi sono sostituiti da "[nascosto]"; al massimo 300 caratteri.
  Quando il job finisce con una parte non riuscita il messaggio è una frase
  fissa (es. "Report non prodotti: mensile"), senza dettagli tecnici.
  Anche la sincronizzazione del Google Calendar, che parte dentro il report
  notturno ([64 - calendario-eventi.md](64%20-%20calendario-eventi.md)), è una
  "parte": se non riesce il lancio risulta KO con "Calendario non
  sincronizzato: <motivo breve>" (mai l'indirizzo), ma il report viene
  prodotto lo stesso. Sincronizzazione disattivata non è un errore.
- Un job senza lanci registrati ha comunque il suo blocco, con la scritta
  "Nessun lancio registrato." (coperto da unit test: il DB di test ha
  sempre lanci di prova per entrambi i job, vedi `supabase/seed.sql`).
- Paginazione: 20 lanci per blocco; "Carica altri" ne mostra 20 in più per
  quel solo blocco (parametro nella query string, con il nome del job), fino
  a un massimo di 500.
- Nessuna pulizia automatica dei lanci vecchi: due lanci al giorno sono
  circa 730 righe all'anno (vedi Fuori scope).

### Lancio a mano ("estemporaneo", issue #302)
Scelte prudenti, **da confermare** con Matteo in review:
- Chi: solo l'admin. Il pulsante è nella pagina (già riservata all'admin) e
  l'azione sul server rifà da sé `requireAdmin()` prima di fare qualunque
  cosa; accetta solo il nome di un job dell'elenco (`report-presenze`,
  `allarmi`), ogni altro valore è rifiutato.
- Come: una Server Action (`app/admin/cron-job/actions.ts`) esegue lo stesso
  lavoro del job pianificato (le funzioni condivise in `lib/cron/`), senza
  passare dall'indirizzo `/api/cron/*`: il secret dei cron (`CRON_SECRET`)
  non arriva mai al browser e resta controllato solo dalle route
  pianificate. Il lavoro usa la service_role come il cron (eccezione
  dichiarata in ADR-0002 e in `lib/serviceRoleCheck.ts`).
- Conferma: prima di partire si chiede "Questo lancio invia davvero le
  email. Procedere?". Il lancio a mano invia le email davvero, come il job
  pianificato: il codice non ha una modalità "solo controllo" e non se ne
  aggiunge una.
- Sempre lanciabile, anche dopo il lancio automatico del giorno. Per questo
  il lancio a mano **non legge e non scrive** i registri che evitano i doppi
  invii dei lanci pianificati (`allarmi_inviati`,
  `report_giornalieri_inviati`, `report_periodici_inviati`): ricalcola e
  invia ogni volta, e il lancio pianificato successivo parte comunque come
  se il lancio a mano non ci fosse stato. Per il resto il lavoro è lo stesso:
  il riepilogo allarmi invia l'email solo se c'è qualcosa da sistemare; il
  report notturno riguarda il giorno prima e segue la stessa regola per
  settimanale e mensile (`REPORT_EMAIL_MODALITA_PERIODICI`).
- Registro: il lancio a mano è una riga di `cron_esecuzioni` come le altre,
  con in più `estemporaneo = true` (migration 0064; i lanci pianificati
  restano `false`). Nella pagina ha il tag "estemporaneo".
- Un solo lancio alla volta per job: se nel registro c'è un lancio di quel
  job (pianificato o a mano) ancora "In corso" (senza esito, partito da meno
  di 15 minuti), il lancio a mano è rifiutato con "È già in corso un lancio
  di questo job: attendi che finisca." Se il registro non si riesce a
  leggere, il lancio è rifiutato (prudenza). Il controllo legge il registro
  con la sessione dell'admin. Coperto da unit test (`lancioInCorso`): l'e2e
  non può creare un lancio in corso senza scrivere nel registro.
- Tempo massimo: la pagina dichiara `maxDuration = 60` secondi (limite
  valido anche sul piano gratuito di Vercel); se il lavoro supera il limite
  la funzione viene interrotta e il lancio, rimasto senza esito, diventa
  "KO" (interrotto) dopo 15 minuti come ogni altro lancio.
- Esito mostrato: "OK", oppure "KO" con il messaggio già ripulito (stesse
  regole del messaggio nel registro: niente stack, chiavi, token, email).
  L'avviso dell'esito è richiesto esplicitamente dall'issue #302: è
  un'eccezione voluta alla regola "l'effetto è la conferma" (ADR-0003).
  Nessun segreto nelle risposte né nei log.

## Fuori scope
- Lanciare a mano un job scegliendo la data o una modalità "solo
  controllo" (senza email).
- Pulizia/retention automatica delle righe vecchie.
- Durata del lancio e dettaglio delle email inviate.
