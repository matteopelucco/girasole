# 55 — Costi bambino

## Attori
Admin.

## Obiettivo
Dare all'admin, nella scheda di dettaglio di ogni bambino, una sezione
"Costi" con i parametri economici usati per calcolare e comunicare la
retta mensile alla famiglia: il prezzo della retta, il prezzo del buono
pasto, il prezzo della marca da bollo, l'eventuale abbonamento a
pre-asilo/post-asilo con il relativo prezzo mensile, e l'indirizzo email
a cui inviare il promemoria. È la base dati usata dalla comunicazione
mensile (vedi
[56 - comunicazione-retta-mensile.md](56%20-%20comunicazione-retta-mensile.md)).

## Scenario: impostare per la prima volta i costi di un bambino
**ID COS-01**
Dato che sono autenticato come admin e apro la scheda di dettaglio di un
bambino che non ha ancora una riga di costi (es. creato senza sezione)
Quando nella sezione "Costi" trovo i campi precompilati come proposta
(vedi COS-02), li controllo, li correggo se serve e confermo
Allora i costi sono salvati (nasce la riga in `costi_bambini`) e restano
visibili riaprendo la scheda
E fino alla conferma nulla è stato scritto nel database

## Scenario: i prezzi proposti vengono da "Prezzi", non da valori fissi
**ID COS-02**
Dato che un bambino non ha ancora una riga di costi
E che in "Parametri di funzionamento > Prezzi" (specs/62) i valori sono:
retta Materna 160, retta Primavera 200, buono pasto 6, marca da bollo 2,
abbonamento pre-asilo 70, abbonamento post-asilo 70
Quando apro la sua scheda, sezione "Costi"
Allora "Prezzo buono pasto (€)" è 6,00, "Prezzo marca da bollo (€)" è 2,00,
"Prezzo pre-asilo (€)" è 70,00 e "Prezzo post-asilo (€)" è 70,00
E "Pre-asilo richiesto" e "Post-asilo richiesto" non sono spuntati
E "Prezzo retta mensile (€)" è 160,00 se la sua sezione è di tipo
Materna, 200,00 se è di tipo Primavera, vuoto se non ha sezione o se la
sua sezione non ha tipo
E se cambio un valore in "Prezzi" e riapro la scheda, la proposta mostra il
valore nuovo (è solo una proposta: non è ancora salvata)
E i "gettoni" di "Prezzi" non compaiono in questa scheda (non fanno parte
dei costi del bambino)

## Scenario: un bambino con costi già salvati non cambia mai
**ID COS-03**
Dato che un bambino ha una riga in `costi_bambini` (creata alla
creazione del bambino o salvata a mano)
Quando l'admin modifica un qualsiasi valore in "Prezzi", oppure cambia il
tipo della sua sezione, oppure lo sposta in un'altra sezione
Allora i suoi costi (tutti e 5 i prezzi, i due flag, l'email) restano
identici, al centesimo
E le rette già calcolate e le comunicazioni già inviate (specs/56) non
cambiano

## Scenario: la retta proposta segue il tipo attuale della sezione finché non si salva
**ID COS-04**
Dato che un bambino non ha una riga di costi (creato senza sezione, o in
una sezione senza tipo)
Quando gli viene assegnata una sezione di tipo Primavera e apro la scheda
Allora "Prezzo retta mensile (€)" propone 200,00 (la retta Primavera)
E se la sezione è poi di tipo Materna, la scheda propone 160,00
E l'assegnazione della sezione non scrive nulla in `costi_bambini`: i
costi si fissano solo alla conferma del form (COS-01)

## Scenario: valori decimali con virgola nella scheda costi
**ID COS-05**
Dato che sono nella sezione "Costi" di un bambino
Quando scrivo "160,50" in un prezzo e confermo
Allora il prezzo salvato è 160,50 (la virgola italiana vale come
separatore decimale, come il punto)
E scrivendo "abc", "-5", "160,555" o "1e2" in un prezzo vedo un messaggio
di errore sul campo e nessun valore del form viene salvato (non diventa 0)
E lasciando un prezzo vuoto, vale 0 (nessun importo previsto)

## Scenario: avviso quando la retta mensile è vuota
**ID COS-06**
Dato che sono admin nella sezione "Costi" di un bambino
Quando il campo "Prezzo retta mensile (€)" è vuoto (tipico: il bambino non
ha riga di costi e la sua sezione non ha tipo o non c'è sezione, vedi
COS-02/COS-04)
Allora accanto al campo vedo l'avviso (non un errore, non in rosso di
errore) "Retta non impostata: se salvi senza compilarla vale 0 €."
E posso comunque confermare il form: il salvataggio non è bloccato e la
retta vuota vale 0 (COS-05 resta valido)
E l'avviso sparisce subito, appena scrivo qualcosa nel campo (senza
attendere il salvataggio), e ricompare se lo svuoto di nuovo
E l'avviso non compare se la retta è valorizzata: proposta dal tipo della
sezione (160,00 / 200,00), già salvata, o "0" scritto apposta (0 è un
valore, non un campo vuoto)
E se il valore scritto non è valido (es. "abc") vale solo l'errore di
COS-05 sul campo, non l'avviso
E l'avviso non compare per gli altri prezzi (buono pasto, marca da bollo,
pre-asilo, post-asilo): sono sempre proposti da "Prezzi" e, per
pre/post-asilo, 0 è il valore normale quando il servizio non c'è; l'avviso
serve solo per la retta, l'unico prezzo che può restare vuoto per
mancanza di una proposta. Se l'admin svuota apposta un altro prezzo, vale
0 senza avviso

## Scenario: modificare i costi già impostati
Dato che un bambino ha già dei costi salvati
Quando riapro la sua scheda, trovo il form pre-caricato con i valori
attuali, modifico uno o più campi e confermo
Allora i nuovi valori sono salvati e restano visibili riaprendo la
scheda

## Scenario: richiedere il servizio pre-asilo o post-asilo
Quando spunto "Pre-asilo richiesto" (o "Post-asilo richiesto") e imposto
il relativo prezzo mensile, e confermo
Allora il servizio risulta richiesto con quel prezzo, usato ogni mese
nella comunicazione della retta (vedi
[56 - comunicazione-retta-mensile.md](56%20-%20comunicazione-retta-mensile.md))
finché non lo tolgo

## Scenario: l'email di promemoria è facoltativa
Quando imposto solo i prezzi, lasciando vuoto il campo email, e
confermo
Allora i prezzi sono salvati senza errore, e il campo email resta vuoto
riaprendo la scheda (il bambino comparirà comunque nella tabella di
revisione mensile, ma senza email non gli verrà inviata alcuna
comunicazione)

## Scenario: un'email di promemoria in un formato non valido viene rifiutata
Quando compilo il campo email con un testo che non è un indirizzo email
valido (es. "non-una-email") e confermo
Allora vedo un messaggio di errore e nessuno dei valori del form viene
salvato

## Scenario: più indirizzi email di promemoria, separati da ";"
Quando compilo il campo email con più indirizzi validi separati da
`;` (es. "genitore1@esempio.it; genitore2@esempio.it") e confermo
Allora è salvato senza errore, resta visibile così com'è riaprendo la
scheda, e la comunicazione retta (specs/56) verrà inviata a entrambi
gli indirizzi

## Scenario: uno solo dei più indirizzi non è valido
Quando compilo il campo email con più indirizzi separati da `;`, di cui
almeno uno non è un formato email valido (es.
"genitore1@esempio.it; non-una-email")
Allora vedo un messaggio di errore e nessuno dei valori del form viene
salvato — stessa regola "tutto o niente" di un singolo indirizzo non
valido

## Regole
- I costi sono per bambino, in una tabella dedicata (`costi_bambini`,
  chiave primaria `bambino_id`, `on delete cascade` —
  `supabase/migrations/0035_costi_bambini.sql`), non colonne aggiuntive
  su `bambini`: sono dati economici, che restano fuori dalla visibilità
  di maestre/assistenti previste su `bambini` (vedi
  [03 - utenti-e-ruoli.md](03%20-%20utenti-e-ruoli.md)).
- Solo un profilo con ruolo `admin` può leggere o modificare i costi di
  un bambino (RLS in `supabase/migrations/0035_costi_bambini.sql`). La
  pagina che ospita il pannello (`/admin/bambini/[id]`) è già protetta
  da `requireAdmin` (vedi
  [50 - amministrazione_base.md](50%20-%20amministrazione_base.md)).
- Prezzo retta mensile, prezzo buono pasto, prezzo marca da bollo,
  prezzo pre-asilo e prezzo post-asilo sono numeri non negativi, con al
  massimo due decimali (euro), da 0 a 9999,99. Il separatore decimale può
  essere la virgola o il punto; niente separatore delle migliaia (es.
  "1.234,50" è rifiutato), niente simbolo "€", niente notazione
  scientifica. Un prezzo **vuoto** vale 0 ("nessun importo previsto",
  stesso pattern delle ore in
  [54 - profili-orari.md](54%20-%20profili-orari.md)); un valore non
  numerico, negativo, con più di due decimali o sopra 9999,99 viene
  **rifiutato con un messaggio** e nulla viene salvato: non diventa mai 0
  in silenzio e non viene mai arrotondato in silenzio. (Regola più
  severa di quella precedente, che trasformava in 0 anche i valori non
  numerici: decisione di Matteo, issue #396.)
- **Nessun valore predefinito fisso** nel database: le colonne di prezzo
  di `costi_bambini` non hanno più i default 6/2/70/70 (rimossi dalla
  migration della issue #396, che sostituisce i default di
  `0037_marca_da_bollo.sql` e `0039_default_buono_pasto_pre_post_asilo.sql`).
  Ogni inserimento scrive tutti i prezzi in modo esplicito. Le righe già
  esistenti non vengono modificate.
- **Da dove nascono i prezzi di un bambino** (specs/62 sezione "Prezzi"):
  i valori di "Prezzi" sono usati **solo** in due momenti, mai nei
  calcoli: (a) alla creazione di un bambino in una sezione con tipo
  Materna o Primavera, che scrive la riga di costi (specs/50); (b) come
  proposta precompilata nella scheda di un bambino che non ha ancora la
  riga (COS-02). Regola di copia alla creazione: retta mensile = retta del
  tipo della sezione; buono pasto = buono pasto; marca da bollo = marca da
  bollo; prezzo pre-asilo = abbonamento pre-asilo; prezzo post-asilo =
  abbonamento post-asilo; entrambi i flag "richiesto" = falso; email =
  vuota. I gettoni non si copiano. Le rette e le comunicazioni leggono
  solo `costi_bambini`, mai "Prezzi".
- La marca da bollo resta una voce fissa mensile come la retta e il buono
  pasto (non un servizio opzionale come pre/post-asilo, sempre inclusa
  nel totale).
- Pre-asilo e post-asilo sono due coppie indipendenti flag+prezzo
  (`pre_asilo_richiesto`/`prezzo_pre_asilo`,
  `post_asilo_richiesto`/`prezzo_post_asilo`): se il flag non è
  spuntato, il relativo prezzo non viene mai usato nella comunicazione
  (conta come 0), anche se un prezzo è stato scritto nel campo — permette
  di "spegnere" il servizio senza perdere il prezzo configurato per
  quando servirà di nuovo.
- L'email di promemoria è facoltativa. Se compilata, deve rispettare un
  formato email valido (`lib/costiBambino.ts`, `emailValida`);
  altrimenti il salvataggio viene rifiutato con un messaggio d'errore e
  nessun campo del form (nemmeno i prezzi) viene scritto — evita di
  salvare prezzi aggiornati insieme a un'email sbagliata che poi
  nessuno nota.
- Il campo può contenere più di un indirizzo, separati da `;` (spazi
  intorno ignorati — `lib/costiBambino.ts`, `emailListaValida`/
  `emailsDaCampo`): valido solo se OGNI indirizzo, una volta separato e
  ripulito degli spazi, è un formato email valido, e ne resta almeno
  uno dopo aver scartato le parti vuote (es. un `;` finale). Il valore
  è salvato as-is (la stringa così com'è scritta, non riformattata) in
  `costi_bambini.email_promemoria` (resta una singola colonna `text`,
  nessuna nuova tabella): alla comunicazione retta (specs/56), la mail
  viene inviata a tutti gli indirizzi elencati (destinatari multipli
  dello stesso invio, non un'email separata per indirizzo).
- Il salvataggio è un upsert su `bambino_id`: la prima conferma crea la
  riga dei costi per quel bambino, le successive la aggiornano.
- Fuori scope in questa fase: tracciare i giorni effettivi di
  pre-asilo/post-asilo (tracciati altrove come presenza giornaliera,
  vedi [13 - segna-presenza.md](13%20-%20segna-presenza.md), ma non
  collegati al costo mensile fisso di questo requisito),
  storicizzazione dei cambi di prezzo nel tempo (un cambiamento vale da
  subito, non da un mese futuro). Backlog: issue
  [#93](https://github.com/matteopelucco/girasole/issues/93).
