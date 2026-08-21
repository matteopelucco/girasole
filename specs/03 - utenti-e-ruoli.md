# 03 — Utenti e ruoli

## Attori
Admin.

## Obiettivo
Il sistema è multi-utente e gestisce gli account **direttamente dall'app**,
senza dipendere dal dashboard di Supabase o da un flusso di
auto-registrazione: è l'admin a creare, modificare ed eliminare gli
utenti da `/admin/maestre`.

## Dati di un utente
- **email** — funge anche da username, univoca.
- **password** — almeno 8 caratteri, con una lettera minuscola, una
  maiuscola, un numero e un carattere speciale (vedi
  `lib/password.ts`, `REGOLA_PASSWORD`).
- **nome**
- **cognome**
- **numero di telefono**

## Ruoli
Un utente ha uno e un solo ruolo, tra:
- **admin** — tutti i privilegi di una maestra, più la gestione di tutti
  gli utenti e dei loro ruoli.
- **maestra** *(corrisponde a "insegnante" nel linguaggio corrente)* —
  gestione (crud) della propria sezione, dei bambini, delle presenze,
  dei pasti e dei promemoria (vedi
  [12 - dashboard-maestre.md](12%20-%20dashboard-maestre.md),
  [13 - segna-presenza.md](13%20-%20segna-presenza.md),
  [14 - segna-pasto.md](14%20-%20segna-pasto.md),
  [15 - memo.md](15%20-%20memo.md)). La gestione diretta degli account
  genitore da parte della maestra è backlog (vedi Fuori scope sotto).
- **genitore** — accesso in sola lettura ai dati del proprio figlio e
  alle comunicazioni di maestre/admin.

## Scenario: admin crea un nuovo utente
Dato che sono autenticato come admin
Quando su `/admin/maestre` compilo nome, cognome, email, telefono,
password e scelgo un ruolo (admin, maestra o genitore), e confermo
Allora l'utente viene creato e compare subito nell'elenco con i dati e il
ruolo scelti
E può accedere subito a `/login` con quell'email e quella password

## Scenario: creazione con password troppo debole
Quando su `/admin/maestre` provo a creare un utente con una password che
non rispetta i requisiti di complessità
Allora vedo un messaggio d'errore che spiega la regola e l'utente non
viene creato

## Scenario: creazione con email già in uso
Quando su `/admin/maestre` provo a creare un utente con un'email già
usata da un altro account
Allora vedo un messaggio d'errore e l'utente non viene creato

## Scenario: creazione con campi obbligatori mancanti
Quando su `/admin/maestre` invio il form di creazione senza compilare
nome, cognome, email o telefono
Allora vedo un messaggio d'errore e l'utente non viene creato

## Scenario: admin modifica i dati di un utente
Dato che un utente esiste già
Quando su `/admin/maestre` modifico nome, cognome, telefono e/o ruolo di
quell'utente e confermo
Allora i nuovi dati sono salvati e visibili nell'elenco

## Scenario: admin elimina un utente
Quando su `/admin/maestre` premo "Elimina utente" su un account
Allora l'account non compare più nell'elenco e non può più accedere
all'app

## Scenario: l'admin non può eliminare il proprio account
Quando su `/admin/maestre` provo a eliminare il mio stesso account
Allora vedo un messaggio d'errore e il mio account resta attivo

## Scenario: accesso negato a chi non è admin
Dato che sono autenticato come maestra o genitore
Quando provo ad aprire `/admin/maestre`
Allora vengo reindirizzato alla dashboard

## Regole
- Un utente ha sempre e solo uno dei tre ruoli (`admin`, `maestra`,
  `genitore`): non è un insieme di permessi combinabili, è una colonna
  singola (`profili.ruolo`).
- La creazione/eliminazione di un account avviene lato server con la
  service_role key di Supabase (`lib/supabase/admin.ts`), mai esposta al
  browser — vedi `supabase/migrations/0005_utenti_gestiti_da_app.sql` per
  lo schema e `CLAUDE.md` per le regole di sicurezza sulla service_role
  key.
- Il primissimo admin del sistema va comunque promosso a mano via SQL
  Editor (bootstrap): per creare un utente dall'app serve già essere
  autenticati come admin, quindi non può esistere un flusso interamente
  self-service per il primo account (vedi
  [11 - login.md](11%20-%20login.md)).

## Fuori scope in questa fase
- La maestra non ha (ancora) un proprio pannello per creare/modificare/
  eliminare account genitore: quella gestione resta riservata all'admin.
- Rette/pagamenti e portale genitori restano fuori scope come da
  [00 - overview.md](00%20-%20overview.md).

Nota: indirizzo di residenza e note dell'utente (facoltativi, vedi
[04 - data-types.md](04%20-%20data-types.md)) sono nello schema `profili`
e gestibili da `/admin/maestre` dalla creazione dell'utente in poi.
