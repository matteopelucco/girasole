# 13 — Segna presenza

## Attori
Maestra (sui bambini delle sue sezioni), Admin (su tutti i bambini).

## Obiettivo
Registrare in pochi tap lo stato di presenza giornaliero di ogni bambino,
con una nota libera opzionale, seguendo il flusso calendario → Presenze →
classe → bambini descritto in
[12 - dashboard-maestre.md](12%20-%20dashboard-maestre.md).

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

## Scenario: la maestra non può modificare una data diversa da oggi
Dato che sono autenticata come maestra e ho aperto Presenze per una data
diversa da oggi (passata o futura)
Quando guardo l'elenco bambini di una mia classe
Allora vedo lo stato eventualmente già registrato ma senza pulsanti per
modificarlo: è in sola lettura

## Scenario: l'admin può modificare qualunque data
Dato che sono autenticato come admin e ho aperto Presenze per una data
diversa da oggi
Quando guardo l'elenco bambini di una classe
Allora i pulsanti Presente/Assente/Malattia restano attivi e posso
modificare lo stato di quella data

## Scenario: riepilogo giornaliero via email a mezzanotte
Dato che una giornata è appena terminata nel fuso Europe/Rome
Quando il job pianificato gira (Vercel Cron)
Allora viene inviata una mail a info@asilosartorio.it con la scheda delle
presenze/assenze/malattie di quel giorno, raggruppata per classe attiva
E se il job viene rieseguito per la stessa data non viene inviata una
seconda mail (idempotenza)

## Regole
- Stati validi: `presente`, `assente`, `malattia`.
- Un solo record di presenza per bambino per giorno (upsert su
  `bambino_id, data`).
- La nota è testo libero, opzionale.
- Il pulsante "Salva nota" è disponibile solo se per il bambino esiste
  già uno stato segnato per la data in questione: un record di presenza
  richiede sempre uno stato (colonna non nulla), quindi non è possibile
  salvare una nota "orfana" prima di aver segnato almeno una volta
  Presente/Assente/Malattia.
- Scrittura consentita solo allo staff: la maestra della sezione del
  bambino, o l'admin (vedi RLS su `presenze` in
  `supabase/migrations/0001_init.sql`).
- La data usata come "oggi" è quella nel fuso orario Europe/Rome (non
  UTC), vedi `lib/date.ts`.
- Il ruolo "maestra" può scrivere (inserire/modificare) solo sulla data
  odierna: vincolo imposto anche a livello di RLS, non solo in UI (vedi
  `supabase/migrations/0009_scrittura_solo_oggi_maestra.sql`); può
  comunque consultare in sola lettura le altre date.
- Il ruolo "admin" può scrivere su qualunque data, passata o futura.
- L'elenco bambini di una classe mostra solo i bambini attivi
  (`bambini.attiva = true`): un bambino disattivato dall'admin non
  compare più qui, pur restando collegate le sue presenze passate (vedi
  [50 - amministrazione_base.md](50%20-%20amministrazione_base.md)).
- Alla mezzanotte (fuso Europe/Rome) un job pianificato (Vercel Cron, vedi
  `app/api/cron/report-presenze/route.ts`) invia una mail a
  info@asilosartorio.it con la scheda del giorno appena concluso, per
  ogni classe attiva. L'invio è idempotente per data (tabella
  `report_giornalieri_inviati`).
