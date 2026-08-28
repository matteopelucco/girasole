# 53 — Calendario scolastico (giorni di chiusura)

## Attori
Admin (gestisce i giorni di chiusura). Tutto lo staff (admin, maestra,
assistente) vede l'informazione in Presenze e Pasti.

## Obiettivo
Permettere all'admin di dichiarare i giorni in cui l'asilo è chiuso
(vacanze, ponti, chiusure straordinarie), e impedire che in quei giorni
— così come ogni sabato e domenica — vengano registrate presenze o pasti
(in futuro anche ore di lavoro del personale).

## Scenario: creare un giorno di chiusura
Dato che sono autenticato come admin
Quando su `/admin/calendario` inserisco una data di inizio, una data di
fine (es. dal 23 al 31 dicembre) ed eventualmente una nota (es. "Vacanze
di Natale"), e confermo
Allora il periodo compare nell'elenco dei giorni di chiusura, con
l'intervallo e la nota mostrati

## Scenario: la data di fine non può precedere quella di inizio
Quando su `/admin/calendario` inserisco una data di fine antecedente
alla data di inizio e confermo
Allora vedo un messaggio d'errore e nessun giorno di chiusura viene
creato

## Scenario: un giorno di chiusura di un solo giorno
Quando inserisco la stessa data sia come inizio sia come fine (es. un
ponte di un solo giorno)
Allora il periodo viene creato correttamente come chiusura di un solo
giorno

## Scenario: modificare un giorno di chiusura
Dato che ho aperto la scheda di dettaglio di un giorno di chiusura
esistente
Quando trovo un form con i dati pre-caricati, modifico la data di fine
e/o la nota, e confermo
Allora i nuovi dati sono salvati e restano visibili riaprendo la scheda

## Scenario: eliminare un giorno di chiusura
Dato che sono sulla scheda di dettaglio di un giorno di chiusura
Quando premo "Elimina" e confermo
Allora il periodo scompare dall'elenco dei giorni di chiusura
E da quel momento le date che ricadevano in quel periodo tornano
normalmente scrivibili (salvo che siano sabato o domenica)

## Scenario: sabato e domenica sono chiusura implicita
Dato che una data è un sabato o una domenica
Quando apro Presenze o Pasti per quella data, per una qualunque classe
Allora vedo l'informazione che l'asilo è chiuso per quel giorno
E questo vale sempre, anche se l'admin non ha creato nessun giorno di
chiusura per quella data

## Scenario: un giorno di chiusura è visibile e bloccante in Presenze
Dato che una data ricade in un giorno di chiusura registrato dall'admin
(o è sabato/domenica)
Quando apro Presenze per quella data, per una classe
Allora vedo un messaggio che segnala la chiusura (con la nota, se
presente)
E non vedo i pulsanti per segnare presente/assente/malattia/pre-asilo/
post-asilo per nessun bambino, indipendentemente dal mio ruolo (admin
incluso)

## Scenario: un giorno di chiusura è visibile e bloccante in Pasti
Dato che una data ricade in un giorno di chiusura registrato dall'admin
(o è sabato/domenica)
Quando apro Pasti per quella data, per una classe
Allora vedo un messaggio che segnala la chiusura (con la nota, se
presente)
E non vedo i pulsanti sì/no per nessun bambino, indipendentemente dal
mio ruolo (admin incluso)

## Regole
- Un giorno di chiusura ha una data di inizio, una data di fine (>=
  data di inizio, vincolo anche a livello di database) e una nota
  libera opzionale (`public.giorni_chiusura`).
- Solo un profilo con ruolo `admin` può creare, modificare o eliminare
  giorni di chiusura (RLS in
  `supabase/migrations/0022_calendario_scolastico.sql`); tutto lo staff
  (admin, maestra, assistente) può leggerli, perché Presenze e Pasti
  devono mostrare l'informazione a chiunque.
- Sabato e domenica sono chiusura implicita, calcolata dalla data
  stessa (`extract(isodow from data)`, lato database; `lib/date.ts:isWeekend`
  lato applicazione): non richiedono né permettono un record in
  `giorni_chiusura`.
- **A differenza della regola "sola data odierna" di
  [13 - segna-presenza.md](13%20-%20segna-presenza.md) e
  [14 - segna-pasto.md](14%20-%20segna-pasto.md) (che esenta l'admin),
  il blocco di scrittura su un giorno chiuso vale per QUALUNQUE ruolo,
  admin incluso**: non è un permesso di scrittura ma un vincolo di
  coerenza dei dati (un asilo chiuso non ha presenze/pasti da
  registrare, stesso principio già in vigore per "pasto di un bambino
  assente/malato", vedi
  [14 - segna-pasto.md](14%20-%20segna-pasto.md)). Imposto anche a
  livello di database con un trigger su `presenze` e uno su `pasti`
  (`supabase/migrations/0022_calendario_scolastico.sql`), non solo in
  UI.
- Il blocco riguarda l'inserimento e la modifica di presenze e pasti;
  non elimina né nasconde eventuali dati già registrati in precedenza
  su una data che diventa chiusa in un secondo momento (caso limite non
  gestito automaticamente: se serve correggere dati storici, va fatto
  eliminando prima il giorno di chiusura).
- Non è verificata la sovrapposizione tra due giorni di chiusura
  inseriti dall'admin: intervalli sovrapposti sono innocui (il giorno
  risulta comunque chiuso), quindi non è un vincolo necessario per il
  comportamento descritto sopra.
- In futuro, lo stesso vincolo si applicherà anche alla registrazione
  delle ore di lavoro del personale (fuori dallo scope di questa fase,
  che non ha ancora quella funzionalità).
