# 13 — Segna presenza

## Attori
Maestra e assistente (sui bambini delle loro sezioni), Admin (su tutti i
bambini). L'assistente ha lo stesso comportamento della maestra descritto
in questo file (vedi la matrice permessi in
[03 - utenti-e-ruoli.md](03%20-%20utenti-e-ruoli.md)).

## Obiettivo
Registrare in pochi tap lo stato di presenza giornaliero di ogni bambino
— compresa un'eventuale presenza a pre-asilo e/o post-asilo — con una
nota libera opzionale, seguendo il flusso calendario → Presenze → classe
→ bambini descritto in
[12 - dashboard-maestre.md](12%20-%20dashboard-maestre.md).

## Presenza ordinaria, pre-asilo e post-asilo
Oltre alla presenza in orario ordinario (9:00-16:00), un bambino può
essere presente anche al pre-asilo (7:30-9:00) e/o al post-asilo
(16:00-17:30): i due orari estesi non sono stati alternativi allo stato
di presenza, ma due indicatori aggiuntivi che si applicano solo quando lo
stato del giorno è "presente". Gli stati possibili per un bambino in un
giorno sono quindi:
- **Presente** in orario ordinario (nessun pre/post-asilo).
- **Presente**, con **pre-asilo** attivo — implica presente anche in
  orario ordinario (un bambino non "salta" l'orario ordinario se entra
  prima).
- **Presente**, con **post-asilo** attivo — implica presente anche in
  orario ordinario, per lo stesso motivo.
- Presente con pre-asilo **e** post-asilo attivi insieme (un bambino può
  entrare presto e uscire tardi lo stesso giorno).
- **Assente**.
- **Malattia** (con nota opzionale).

I pulsanti per ogni bambino sono disposti su tre righe: la prima con
Presente, Pre-asilo, Post-asilo (gli stati/indicatori dell'orario
"disteso", dal più corto al più lungo); la seconda con Assente e
Malattia (le eccezioni alla presenza); la terza con il campo nota (un
`<textarea>` alto due righe, non un campo a riga singola — per una nota
un po' più lunga il testo resta leggibile senza scorrimento laterale) e
il pulsante "Salva nota".

## Scenario: riepilogo presenze della classe
Dato che ho aperto l'elenco bambini di una classe, per una data
Allora vedo in cima, in una card con titolo "Presenze giornaliere -
Sezione {nome classe}", un riepilogo "Presenti: X/Y", dove X è il numero
di bambini segnati "presente" per quella data e Y il totale dei bambini
attivi della classe
E accanto vedo altri due riepiloghi, "Pre-asilo: P" e "Post-asilo: Q",
dove P e Q sono rispettivamente il numero di bambini con pre-asilo e con
post-asilo attivi per quella data

## Scenario: segnare un bambino presente
Dato che ho aperto "Presenze" per la data odierna e selezionato una mia
classe, e vedo l'elenco dei suoi bambini
Quando premo il pulsante "Presente" su un bambino
Allora lo stato di presenza di oggi per quel bambino diventa "presente"
E il pulsante "Presente" resta evidenziato come stato corrente

## Scenario: segnare un'assenza con nota
Quando premo "Assente" e scrivo una nota (es. "influenza, rientra lunedì")
Allora lo stato diventa "assente" con quella nota salvata
E la nota resta salvata anche dopo aver ricaricato la pagina

## Scenario: salvare una nota senza cambiare lo stato
Dato che un bambino ha già uno stato di presenza segnato per oggi
Quando scrivo o modifico la nota (es. "entra alle 9:03") e premo "Salva nota"
Allora la nota viene salvata restando associata allo stato già segnato
E la nota resta visibile anche dopo aver ricaricato la pagina

## Scenario: correggere uno stato già segnato in malattia
Dato che un bambino è già segnato "presente" per oggi
Quando premo "Malattia" e scrivo una nota
Allora lo stato per oggi viene sovrascritto in "malattia" con quella nota
E resta un solo record di presenza per quel bambino per quella data
E lo stato "malattia" appare anche come etichetta (tag) accanto al nome
del bambino negli elenchi bambini, sia in Presenze sia in Pasti, per
quella data
E se il bambino aveva pre-asilo e/o post-asilo attivi, vengono
disattivati (non ha senso un pre/post-asilo su un bambino malato o
assente per quel giorno)

## Scenario: segnare un bambino presente al pre-asilo
Dato che ho aperto "Presenze" per la data odierna e selezionato una mia
classe
Quando premo il pulsante "Pre-asilo" su un bambino
Allora lo stato di presenza di oggi per quel bambino diventa (o resta)
"presente"
E l'indicatore "pre-asilo" per quel bambino diventa attivo, evidenziato
sul pulsante
E se il bambino era segnato "assente" o "malattia", quello stato viene
sostituito da "presente" con pre-asilo attivo

## Scenario: segnare un bambino presente al post-asilo
Quando premo il pulsante "Post-asilo" su un bambino
Allora lo stato di presenza di oggi per quel bambino diventa (o resta)
"presente"
E l'indicatore "post-asilo" per quel bambino diventa attivo, evidenziato
sul pulsante
E se il bambino era segnato "assente" o "malattia", quello stato viene
sostituito da "presente" con post-asilo attivo

## Scenario: pre-asilo e post-asilo sono indipendenti e cumulabili
Dato che un bambino è già segnato presente con pre-asilo attivo
Quando premo anche "Post-asilo" per lo stesso bambino nello stesso giorno
Allora il bambino risulta presente con pre-asilo E post-asilo entrambi
attivi

## Scenario: disattivare il pre-asilo o il post-asilo ripremendo il pulsante
Dato che un bambino ha il pre-asilo (o il post-asilo) attivo per oggi
Quando ripremo lo stesso pulsante "Pre-asilo" (o "Post-asilo")
Allora l'indicatore si disattiva
E il bambino resta comunque "presente" in orario ordinario (l'eventuale
altro indicatore, se attivo, non viene toccato)

## Scenario: segnare Assente o Presente resetta pre-asilo e post-asilo
Dato che un bambino ha pre-asilo e/o post-asilo attivi per oggi
Quando premo "Assente", oppure premo "Presente" (senza passare da
Pre-asilo/Post-asilo)
Allora lo stato diventa quello premuto ed entrambi gli indicatori
pre-asilo e post-asilo vengono disattivati

## Scenario: la maestra o l'assistente non può modificare una data diversa da oggi
Dato che sono autenticata come maestra o assistente e ho aperto Presenze
per una data diversa da oggi (passata o futura)
Quando guardo l'elenco bambini di una mia classe
Allora vedo lo stato eventualmente già registrato (incluso pre/post-asilo)
ma senza pulsanti per modificarlo: è in sola lettura

## Scenario: l'admin può modificare qualunque data
Dato che sono autenticato come admin e ho aperto Presenze per una data
diversa da oggi
Quando guardo l'elenco bambini di una classe
Allora i pulsanti Presente/Assente/Malattia/Pre-asilo/Post-asilo restano
attivi e posso modificare lo stato di quella data

## Regole
- Stati validi: `presente`, `assente`, `malattia`.
- Un bambino "presente" ha inoltre due indicatori booleani indipendenti,
  `pre_asilo` e `post_asilo` (entrambi falsi di default): validi solo
  quando lo stato è `presente` (vincolo anche a livello di database — un
  bambino assente o malato non può avere `pre_asilo`/`post_asilo` veri).
  Vedi "Presenza ordinaria, pre-asilo e post-asilo" sopra.
- Il riepilogo "Presenti: X/Y" conta X come i bambini con stato
  `presente` per la data visualizzata (incluso chi ha pre-asilo e/o
  post-asilo attivi, essendo comunque presenti in orario ordinario); Y è
  il totale dei bambini attivi della classe (indipendentemente dal loro
  stato o dall'assenza di uno stato). "Pre-asilo: P" conta i bambini con
  `pre_asilo = true`; "Post-asilo: Q" conta i bambini con
  `post_asilo = true`, entrambi per la stessa data.
- Un solo record di presenza per bambino per giorno (upsert su
  `bambino_id, data`).
- La nota è testo libero, opzionale, unica per il giorno (non separata
  tra ordinaria/pre-asilo/post-asilo).
- Il pulsante "Salva nota" è disponibile solo se per il bambino esiste
  già uno stato segnato per la data in questione: un record di presenza
  richiede sempre uno stato (colonna non nulla), quindi non è possibile
  salvare una nota "orfana" prima di aver segnato almeno una volta
  Presente/Assente/Malattia/Pre-asilo/Post-asilo.
- Scrittura consentita solo allo staff: la maestra o l'assistente della
  sezione del bambino, o l'admin (vedi RLS su `presenze` in
  `supabase/migrations/0001_init.sql`); l'assistente ha lo stesso
  perimetro di scrittura della maestra su questa tabella (vedi
  [03 - utenti-e-ruoli.md](03%20-%20utenti-e-ruoli.md)).
- La data usata come "oggi" è quella nel fuso orario Europe/Rome (non
  UTC), vedi `lib/date.ts`.
- I ruoli "maestra" e "assistente" possono scrivere (inserire/modificare)
  solo sulla data odierna: vincolo imposto anche a livello di RLS, non
  solo in UI (vedi
  `supabase/migrations/0009_scrittura_solo_oggi_maestra.sql`); possono
  comunque consultare in sola lettura le altre date.
- Il ruolo "admin" può scrivere su qualunque data, passata o futura.
- L'elenco bambini di una classe mostra solo i bambini attivi
  (`bambini.attiva = true`): un bambino disattivato dall'admin non
  compare più qui, pur restando collegate le sue presenze passate (vedi
  [50 - amministrazione_base.md](50%20-%20amministrazione_base.md)).
- L'invio automatico via email della scheda giornaliera (e dei report
  settimanale/mensile) è descritto in
  [52 - report-email-automatico.md](52%20-%20report-email-automatico.md),
  non più in questo file: da requisito ha smesso di riguardare solo le
  presenze del giorno.
