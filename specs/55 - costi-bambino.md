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
Dato che sono autenticato come admin e apro la scheda di dettaglio di un
bambino che non ha ancora costi impostati
Quando nella sezione "Costi" trovo i campi (prezzo retta mensile vuoto/a
zero, prezzo buono pasto precompilato a 6€, prezzo marca da bollo
precompilato a 2€, pre-asilo/post-asilo non richiesti con i rispettivi
prezzi precompilati a 70€, email promemoria vuota), li compilo e
confermo
Allora i costi sono salvati e restano visibili riaprendo la scheda

## Scenario: buono pasto, marca da bollo e pre/post-asilo hanno un valore predefinito
Dato che apro la scheda di un bambino che non ha ancora costi impostati
Quando guardo i campi "Prezzo buono pasto (€)", "Prezzo marca da bollo
(€)", "Prezzo pre-asilo (€)" e "Prezzo post-asilo (€)" nella sezione
"Costi"
Allora li trovo già precompilati (6€, 2€, 70€ e 70€: gli importi
correnti tipici di questi servizi), ciascuno modificabile come
qualunque altro prezzo se in futuro dovesse cambiare

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
  prezzo pre-asilo e prezzo post-asilo sono numeri non negativi, fino a
  due decimali (euro); un valore vuoto, non numerico o negativo viene
  trattato come 0 — coerente con "nessun importo previsto", non un
  errore da segnalare (stesso pattern già usato per le ore in
  [54 - profili-orari.md](54%20-%20profili-orari.md)).
- Il prezzo della marca da bollo è una voce di costo fissa mensile come
  la retta e il buono pasto (non un servizio opzionale come pre/post-
  asilo, sempre inclusa nel totale): a differenza degli altri prezzi,
  di default vale 2€ invece di 0, sia per un bambino appena creato sia
  per uno che ha già dei costi salvati da prima dell'introduzione di
  questo campo (`supabase/migrations/0037_marca_da_bollo.sql`).
- Buono pasto (6€), pre-asilo e post-asilo (70€ ciascuno) hanno anche
  loro un valore predefinito diverso da 0 (`supabase/migrations/0039_default_buono_pasto_pre_post_asilo.sql`),
  ma — a differenza della marca da bollo — **solo per un bambino senza
  ancora nessuna riga in `costi_bambini`**: un bambino che ha già dei
  costi salvati (anche a 0) non viene toccato retroattivamente, perché
  questi tre prezzi sono già in uso con importi reali scelti dall'admin
  per bambini veri, e non c'è modo di distinguere "mai configurato" da
  "configurato deliberatamente a zero".
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
- Il salvataggio è un upsert su `bambino_id`: la prima conferma crea la
  riga dei costi per quel bambino, le successive la aggiornano.
- Fuori scope in questa fase: tracciare i giorni effettivi di
  pre-asilo/post-asilo (tracciati altrove come presenza giornaliera,
  vedi [13 - segna-presenza.md](13%20-%20segna-presenza.md), ma non
  collegati al costo mensile fisso di questo requisito),
  storicizzazione dei cambi di prezzo nel tempo (un cambiamento vale da
  subito, non da un mese futuro).
