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
[64 - calendario-eventi.md](64%20-%20calendario-eventi.md). La terza è
"Prezzi" (issue #396): i prezzi predefiniti dell'asilo, usati solo per
compilare i costi di un bambino nuovo (vedi sotto e
[55 - costi-bambino.md](55%20-%20costi-bambino.md)).

## Scenario: "Parametri di funzionamento" compare nel menu sotto "Impostazioni", solo per l'admin
Dato che sono autenticato come admin
Quando guardo la sidebar di navigazione
Allora vedo la voce "Parametri di funzionamento" (`/admin/parametri-funzionamento`)
E sta sotto "Impostazioni", rientrata come "Utenti", dopo "Reset giornata" e prima di "Azioni" e "Utenti"
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

## Sezione "Prezzi"
Sta sotto "Calendario Google" e sopra "Parametri delle funzionalità".
Contiene otto prezzi in euro: retta Materna, retta Primavera, buono pasto,
marca da bollo, abbonamento pre-asilo, abbonamento post-asilo, gettone
pre-asilo, gettone post-asilo. Valori iniziali: 160, 200, 6, 2, 70, 70, 7, 7.

## Scenario: l'admin vede la sezione "Prezzi" con gli otto campi
**ID PRZ-01**
Dato che sono autenticato come admin e la sezione non è mai stata modificata
Quando apro `/admin/parametri-funzionamento`
Allora vedo la sezione "Prezzi" con una breve descrizione che dice che i
valori servono solo per i bambini nuovi e non cambiano quelli esistenti
E vedo otto campi con etichetta: "Retta Materna (€)" 160,00, "Retta
Primavera (€)" 200,00, "Buono pasto (€)" 6,00, "Marca da bollo (€)" 2,00,
"Abbonamento pre-asilo (€)" 70,00, "Abbonamento post-asilo (€)" 70,00,
"Gettone pre-asilo (€)" 7,00, "Gettone post-asilo (€)" 7,00
E vedo il pulsante "Salva prezzi"
E tutti gli otto campi sono sempre valorizzati (la migration crea la riga già
compilata): non esiste uno stato "prezzo non impostato"
E la pagina non ha violazioni di accessibilità gravi

## Scenario: gli altri ruoli non vedono i prezzi
**ID PRZ-02**
Dato che sono autenticato come maestra, assistente o genitore
Quando provo ad aprire `/admin/parametri-funzionamento`
Allora vengo reindirizzato alla dashboard (come nello scenario di accesso
negato) e non vedo mai i valori di "Prezzi"

## Scenario: salvare i prezzi e ritrovarli dopo il ricaricamento
**ID PRZ-03**
Dato che sono admin sulla pagina "Parametri di funzionamento"
Quando scrivo nei campi valori validi (es. retta Materna "165,50", gettone
pre-asilo "7") e premo "Salva prezzi"
Allora vedo la conferma "Prezzi salvati"
E ricaricando la pagina i campi mostrano i valori salvati con due
decimali (165,50 e 7,00)
E la virgola e il punto sono accettati entrambi come separatore decimale

## Scenario: un valore non valido è rifiutato con un messaggio chiaro
**ID PRZ-04**
Dato che sono admin sulla pagina "Parametri di funzionamento"
Quando in un campo scrivo un valore vuoto, "abc", "-1", "6,555", "1e2",
"1.234,50" oppure "10000" e premo "Salva prezzi"
Allora vedo un messaggio di errore chiaro sul campo ("Inserisci un importo
tra 0 e 9999,99 con al massimo due decimali")
E il valore non viene trasformato in 0 né arrotondato
E ricaricando la pagina i campi mostrano i valori salvati prima
E "0" e "9999,99" sono invece valori accettati

## Scenario: il salvataggio è tutto o niente
**ID PRZ-05**
Dato che modifico tre prezzi e uno di loro non è valido
Quando premo "Salva prezzi"
Allora nessuno degli otto prezzi viene salvato (neanche i due validi)
E i campi mantengono quanto ho scritto, con l'errore sul campo sbagliato,
così posso correggerlo senza riscrivere tutto

## Scenario: cambiare un prezzo non tocca i bambini già esistenti
**ID PRZ-06**
Dato che esiste un bambino con la riga dei costi già salvata (a mano o alla
creazione)
Quando l'admin cambia uno o più valori in "Prezzi" e salva
Allora i costi di quel bambino restano identici al centesimo
E le rette e le comunicazioni già calcolate o inviate non cambiano
E lo stesso vale se l'admin cambia il tipo di una sezione (vedi COS-03 in
specs/55)

## Scenario: un bambino creato in una sezione con tipo parte con i prezzi di "Prezzi"
**ID PRZ-07**
Dato che in "Prezzi" i valori sono 160, 200, 6, 2, 70, 70 e gettoni 7, 7
E che la sezione "Girasoli" ha tipo Primavera
Quando l'admin crea un bambino nella sezione "Girasoli" (specs/50)
Allora il bambino nasce con la riga costi già salvata: retta 200,00 (la
retta del tipo della sezione), buono pasto 6,00, marca da bollo 2,00,
prezzo pre-asilo 70,00, prezzo post-asilo 70,00, gettone pre-asilo 7,00,
gettone post-asilo 7,00, pre e post asilo non richiesti, email vuota
E con una sezione di tipo Materna la retta è 160,00

## Scenario: bambino creato senza sezione, o in una sezione senza tipo
**ID PRZ-08**
Dato che l'admin crea un bambino senza sezione, oppure in una sezione che
non ha ancora un tipo
Quando la creazione termina
Allora il bambino viene creato ma non ha nessuna riga di costi
E aprendo la sua scheda i costi sono proposti come in COS-02 (retta vuota
se manca il tipo) e non sono salvati finché l'admin non conferma (COS-01)

## Scenario: due admin salvano i prezzi insieme
**ID PRZ-09**
Dato che due admin aprono "Prezzi" con gli stessi valori
Quando il primo salva una modifica e poi il secondo, che ha ancora i dati
vecchi, preme "Salva prezzi"
Allora il salvataggio del secondo è rifiutato con un messaggio ("I prezzi
sono stati modificati da un altro utente: ricarica la pagina e riprova")
E i valori salvati dal primo restano quelli validi
E il secondo, dopo aver ricaricato, vede i valori del primo

## Scenario: i prezzi si leggono e si scrivono solo da admin (a livello di database)
**ID PRZ-10**
Dato che sono autenticato come maestra, assistente o genitore, oppure non
sono autenticato
Quando provo a leggere o modificare i prezzi direttamente dall'API del
database
Allora non vedo nessun valore e nessuna modifica va a buon fine
E solo l'admin può leggerli e modificarli
E c'è una sola riga di prezzi: non se ne possono creare altre né
cancellare quella esistente

## Scenario: avviso se il gettone costa più dell'abbonamento della stessa voce
**ID PRZ-11**
Dato che sono admin sulla pagina "Parametri di funzionamento"
Quando "Gettone pre-asilo (€)" è strettamente maggiore di "Abbonamento
pre-asilo (€)" (es. 70,01 contro 70,00)
Allora il campo del gettone si colora di rosso tenue e compare una breve
scritta collegata al campo (`aria-describedby`), non solo colore
E con valori uguali o gettone minore non compare nessun avviso
E vale lo stesso per il post-asilo, in modo indipendente
E l'avviso si aggiorna mentre scrivo e non blocca "Salva prezzi"

## Regole
- Sezione "Prezzi" (issue #396): una sola riga nel database (tabella a riga
  unica), con RLS e GRANT solo per l'admin, creata già con i valori
  iniziali dalla migration. Gli otto prezzi sono obbligatori, tra 0 e
  9999,99 con al massimo due decimali; formato come in specs/55
  (virgola o punto, niente migliaia, niente "€").
- I prezzi di questa sezione si usano solo alla creazione di un bambino
  (PRZ-07) e come proposta precompilata nella scheda Costi (COS-02): non
  entrano in rette, comunicazioni o calcoli, salvo un caso: nella tabella
  "Rette" l'abbonamento di «Prezzi» è il prezzo di confronto per l'avviso
  sui gettoni quando il prezzo della scheda del bambino è 0 (RET-21,
  specs/56); solo visivo, non cambia nessun importo.
- Il salvataggio è atomico (tutto o niente) e controlla la concorrenza
  (PRZ-09): rifiuta chi salva partendo da dati non più aggiornati.
- I valori non vengono storicizzati: non resta traccia dei prezzi vecchi.
- L'allarme per prezzi mancanti e sezioni senza tipo (#397) è in
  [07 - allarmi.md](07%20-%20allarmi.md).
- I gettoni di "Prezzi" si copiano nei costi del bambino come gli altri
  prezzi (#398, COS-12 in specs/55).
- Fuori ambito: uso del gettone nelle presenze e nelle rette (#399-#400);
  storicizzazione.
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
