# 62 — Parametri di funzionamento

## Attori
Solo Admin. Maestra, assistente e genitore non vedono la voce di menu né
raggiungono la pagina.

## Obiettivo
Dare all'admin una sezione, sotto "Impostazioni", dove consultare e
(in seguito) modificare alcune variabili di funzionamento oggi legate
all'ambiente di esecuzione, che servono spesso o devono almeno essere
visibili all'amministratore. La pagina ha un titolo, una breve descrizione
e, sotto, le sezioni una dopo l'altra. La prima è "Variabili d'ambiente"
(issue #287): l'elenco, in sola lettura, delle variabili d'ambiente scelte
in una lista nel codice, con i valori nascosti finché l'admin non
reinserisce la propria password. La seconda è "Calendario Google" (issue
#319): l'indirizzo iCal segreto del calendario dell'asilo, l'unico parametro
oggi salvato nel database, descritto in
[64 - calendario-eventi.md](64%20-%20calendario-eventi.md).

## Scenario: "Parametri di funzionamento" compare nel menu sotto "Impostazioni", solo per l'admin
Dato che sono autenticato come admin
Quando guardo la sidebar di navigazione
Allora vedo la voce "Parametri di funzionamento" (`/admin/parametri-funzionamento`)
E sta sotto "Impostazioni", rientrata come "Utenti", dopo "Reset giornata" e prima di "Cron Job" e "Utenti"
E se sono maestra, assistente o genitore non vedo questa voce

## Scenario: la pagina si apre e mostra titolo e breve descrizione
Dato che sono autenticato come admin
Quando apro "Parametri di funzionamento" dal menu
Allora arrivo a `/admin/parametri-funzionamento`
E vedo il titolo "Parametri di funzionamento" e una breve descrizione della sezione
E la voce di menu "Parametri di funzionamento" risulta evidenziata
E la pagina non ha violazioni di accessibilità gravi

## Scenario: la sezione "Parametri delle funzionalità" dice che è in costruzione
Dato che sono autenticato come admin
Quando apro `/admin/parametri-funzionamento`
Allora vedo la sezione "Parametri delle funzionalità" con una breve descrizione
E la sezione dice che la funzionalità è in corso di costruzione e che le prossime storie porteranno qui i parametri oggi nel codice
E non vedo alcuna tabella né campi modificabili (per ora nessun parametro è configurato)
E la pagina non ha violazioni di accessibilità gravi

## Scenario: accesso negato a chi non è admin
Dato che sono autenticato come maestra, assistente o genitore
Quando provo ad aprire `/admin/parametri-funzionamento`
Allora vengo reindirizzato alla dashboard
E quindi non vedo nemmeno la sezione "Variabili d'ambiente"

## Scenario: la sezione "Variabili d'ambiente" elenca i parametri con i valori nascosti
Dato che sono autenticato come admin
E che nell'ambiente è configurata almeno una variabile della lista dei parametri visibili
Quando apro `/admin/parametri-funzionamento`
Allora vedo la sezione "Variabili d'ambiente" con una breve descrizione
E una tabella con i nomi delle variabili presenti, in ordine alfabetico
E al posto di ogni valore un segnaposto fisso (uguale per tutti, che non lascia capire la lunghezza)
E i valori veri non compaiono da nessuna parte nella risposta della pagina (né nell'HTML né nei dati inviati al browser)
E la risposta della pagina non può essere salvata in cache (`Cache-Control: no-store`)
E vedo il pulsante "Mostra valori"
E la pagina non ha violazioni di accessibilità gravi

## Scenario: con la password sbagliata i valori restano nascosti
Dato che sono autenticato come admin sulla pagina "Parametri di funzionamento"
Quando clicco "Mostra valori" e inserisco una password sbagliata
Allora vedo un messaggio d'errore generico ("Password non corretta.")
E i valori restano nascosti

## Scenario: con la propria password i valori compaiono in chiaro
Dato che sono autenticato come admin sulla pagina "Parametri di funzionamento"
Quando clicco "Mostra valori" e inserisco la mia password
Allora i valori compaiono in chiaro nella tabella, uno per ogni variabile elencata
E il pulsante diventa "Nascondi valori"
E resto collegato come prima (la verifica non cambia la mia sessione)

## Scenario: ricaricando la pagina i valori tornano nascosti
Dato che ho verificato la password e vedo i valori in chiaro
Quando ricarico la pagina
Allora i valori sono di nuovo nascosti
E per rivederli devo reinserire la password

## Scenario: ricliccando il pulsante i valori si nascondono di nuovo
Dato che ho verificato la password e vedo i valori in chiaro
Quando clicco "Nascondi valori"
Allora i valori tornano nascosti e spariscono dalla pagina
E il pulsante torna "Mostra valori"

## Sezione "Calendario Google"
Gli scenari (campo per l'indirizzo iCal, salvataggio con validazione, valore
nascosto finché l'admin non reinserisce la password, svuotare = sincronizzazione
disattivata) sono in [64 - calendario-eventi.md](64%20-%20calendario-eventi.md),
con un test per scenario in `e2e/64-calendario-eventi.spec.ts`. Sta sotto
"Variabili d'ambiente" e sopra "Parametri delle funzionalità". Il pulsante
"Mostra indirizzo" usa lo stesso meccanismo della verifica della password
delle variabili d'ambiente (password dell'admin ricontrollata sul server, limite
dei tentativi, sblocco solo nello stato della pagina).

## Regole
- La sezione "Parametri delle funzionalità" (componente
  `components/ParametriFunzionalita.tsx`) in futuro elencherà i parametri in
  tabella (nome + valore in un campo modificabile); l'admin non può aggiungerne
  di nuovi, perché servono alle funzionalità dell'app. Per ora non ne esiste
  nessuno: nessuna tabella DB, solo il messaggio "in costruzione".
- Pagina riservata all'admin con `requireAdmin`, come le altre pagine
  `/admin/*`. La sezione "Variabili d'ambiente" non legge né scrive il
  database; la sezione "Calendario Google" sì (tabella
  `impostazioni_calendario`, migration 0065, RLS: solo l'admin).
- La voce di menu è in `lib/navigazione.ts`, rientrata (`rientrata: true`)
  tra "Impostazioni" e "Utenti" (elenco in `lib/impostazioniAvanzate.ts`,
  che alimenta anche i riquadri della pagina Impostazioni, specs/57).
- La pagina è pensata per ospitare più sezioni, una sotto l'altra, ciascuna
  con un proprio titolo: aggiungerne una è aggiungere un blocco sotto
  l'intestazione.

### Variabili d'ambiente
- **Lista dei parametri visibili** (`lib/parametriVisibili.ts`): solo i nomi
  elencati lì vengono letti e mostrati; tutte le altre variabili d'ambiente
  non vengono mai lette da questa pagina né inviate al browser. Per rendere
  visibile una variabile si aggiunge il suo nome alla lista. I segreti
  critici (`SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `RESEND_API_KEY`,
  `TURNSTILE_SECRET_KEY`) sono volutamente esclusi: abilitarli è una
  decisione di Matteo.
- Una variabile della lista che non è configurata nell'ambiente non compare.
  Se nessuna variabile della lista è configurata, al posto della tabella
  compare un messaggio di cortesia ("Nessuna variabile d'ambiente da
  mostrare.") e nessun pulsante.
- **Valori mai nella pagina iniziale**: il server invia al browser solo i
  nomi; il segnaposto è fisso. I valori arrivano solo come risposta della
  Server Action di verifica, dopo che la password è stata controllata.
- **Verifica della password lato server**: la Server Action ricontrolla che
  l'utente sia admin (`requireAdmin`), prende l'email dalla sessione (mai dal
  browser) e verifica la password con un client Supabase usa-e-getta, senza
  cookie né sessione salvata, così la sessione corrente dell'admin non
  cambia. La sessione di verifica viene subito chiusa (`signOut` con
  `scope: 'local'`, che chiude solo quella). Password errata o errore di
  Supabase: sempre lo stesso messaggio generico.
- **Limite tentativi** (`lib/limiteTentativi.ts`): dopo 5 tentativi falliti
  di seguito lo stesso utente è bloccato per 15 minuti ("Troppi tentativi.
  Riprova tra N minuti."); una verifica riuscita azzera il conteggio. Il
  conteggio vive nella memoria del server: su Vercel ogni istanza ha il suo
  e si azzera a un riavvio, quindi è un freno, non una barriera assoluta
  (resta anche la protezione anti-brute-force di Supabase Auth).
- Lo sblocco vive solo nello stato della pagina nel browser: niente cookie,
  `localStorage` o parametri nell'URL. Ricaricando o lasciando la pagina la
  verifica va ripetuta; nascondendo i valori vengono cancellati dallo stato.
- Nessun valore né password finisce nei log, in console o negli URL.
