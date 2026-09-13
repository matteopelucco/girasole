# 55 — Parametri di retta

## Attori
Admin.

## Obiettivo
Dare all'admin uno strumento per impostare, per ciascun bambino, i
parametri economici della sua retta: il prezzo della retta mensile, il
prezzo del buono pasto e l'indirizzo email a cui inviare ogni mese il
promemoria degli importi. È il primo passo di Fase 2 (vedi
[00 - overview.md](00%20-%20overview.md)): questo requisito copre solo
la configurazione dei parametri, non ancora il calcolo dell'importo
dovuto in un mese, l'invio effettivo del promemoria né la gestione dei
pagamenti (vedi Regole).

## Scenario: impostare per la prima volta i parametri di retta di un bambino
Dato che sono autenticato come admin e apro la scheda di dettaglio di un
bambino che non ha ancora parametri di retta impostati
Quando nella sezione "Retta" trovo i campi prezzo mensile, prezzo buono
pasto ed email promemoria vuoti, li compilo e confermo
Allora i parametri sono salvati e restano visibili riaprendo la scheda

## Scenario: modificare i parametri di retta già impostati
Dato che un bambino ha già dei parametri di retta salvati
Quando riapro la sua scheda, trovo il form pre-caricato con i valori
attuali, modifico uno o più campi e confermo
Allora i nuovi valori sono salvati e restano visibili riaprendo la
scheda

## Scenario: l'email di promemoria è facoltativa
Quando imposto solo il prezzo mensile e il prezzo del buono pasto,
lasciando vuoto il campo email, e confermo
Allora i due prezzi sono salvati senza errore, e il campo email resta
vuoto riaprendo la scheda

## Scenario: un'email di promemoria in un formato non valido viene rifiutata
Quando compilo il campo email con un testo che non è un indirizzo email
valido (es. "non-una-email") e confermo
Allora vedo un messaggio di errore e nessuno dei valori del form viene
salvato

## Regole
- I parametri sono per bambino, in una tabella dedicata
  (`rette_bambini`, chiave primaria `bambino_id`, `on delete cascade` —
  supabase/migrations/0035_rette_bambini.sql), non colonne aggiuntive su
  `bambini`: sono dati economici, che restano fuori dalla visibilità di
  maestre/assistenti previste su `bambini` (vedi
  [03 - utenti-e-ruoli.md](03%20-%20utenti-e-ruoli.md)).
- Solo un profilo con ruolo `admin` può leggere o modificare i
  parametri di retta di un bambino (RLS in
  `supabase/migrations/0035_rette_bambini.sql`, stesso pattern "solo
  admin, ogni operazione" già usato per `profili_orari`, vedi
  [54 - profili-orari.md](54%20-%20profili-orari.md)). La pagina che
  ospita il pannello (`/admin/bambini/[id]`) è già protetta da
  `requireAdmin` (vedi [50 - amministrazione_base.md](50%20-%20amministrazione_base.md)).
- Prezzo mensile e prezzo buono pasto sono numeri non negativi, fino a
  due decimali (euro); un valore vuoto, non numerico o negativo viene
  trattato come 0 — coerente con "nessun importo previsto", non un
  errore da segnalare (stesso pattern già usato per le ore in
  [54 - profili-orari.md](54%20-%20profili-orari.md)).
- L'email di promemoria è facoltativa. Se compilata, deve rispettare un
  formato email valido (`lib/retta.ts`, `emailValida`); altrimenti il
  salvataggio viene rifiutato con un messaggio d'errore e nessun campo
  del form (nemmeno i prezzi) viene scritto — evita di salvare prezzi
  aggiornati insieme a un'email sbagliata che poi nessuno nota.
- Il salvataggio è un upsert su `bambino_id`: la prima conferma crea la
  riga dei parametri per quel bambino, le successive la aggiornano. Non
  esiste un'azione separata di eliminazione dei parametri di retta in
  questa fase — reimpostare i prezzi a 0 e svuotare l'email è
  sufficiente per "azzerare" un bambino che non paga più la retta.
- Fuori scope in questa fase: calcolo automatico dell'importo dovuto in
  un mese specifico, invio effettivo del promemoria via email,
  storicizzazione dei cambi di prezzo nel tempo (un cambiamento vale da
  subito, non da un mese futuro), stato di pagamento/saldo e portale
  genitori (vedi [00 - overview.md](00%20-%20overview.md) e
  `TASKS.md`, backlog "Rette mensili e stato pagamento").
