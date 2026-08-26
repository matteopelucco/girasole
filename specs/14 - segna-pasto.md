# 14 — Segna pasto

## Attori
Maestra (sui bambini delle sue sezioni), Admin (su tutti i bambini).
**L'assistente non è un attore di questo requisito**: non ha alcun
accesso al registro pasti, né in lettura né in scrittura (vedi
[03 - utenti-e-ruoli.md](03%20-%20utenti-e-ruoli.md)).

## Obiettivo
Registrare in pochi tap se un bambino ha mangiato a pranzo, con particolare
attenzione a rendere visibili le eventuali allergie/intolleranze prima di
segnare il pasto, seguendo il flusso calendario → Pasti → classe →
bambini descritto in
[12 - dashboard-maestre.md](12%20-%20dashboard-maestre.md).

## Scenario: da Pasti si arriva alla classe e poi ai bambini
Dato che ho aperto "Pasti" dalla dashboard per una data
Quando seleziono una classe
Allora vedo l'elenco dei bambini di quella classe con lo stato pasto di
quella data, se già segnato

## Scenario: riepilogo pasti della classe
Dato che ho aperto l'elenco bambini di una classe, per una data
Allora vedo in cima un riepilogo "Pasti: X/Y", dove X è il numero di
bambini segnati "sì" per quella data e Y il numero di bambini della
classe che non risultano "assente" né "malattia" quel giorno (i soli per
cui ha senso segnare il pasto)

## Scenario: le allergie sono visibili prima di segnare il pasto
Dato che un bambino ha `note_allergie` compilato (es. "Allergia alle
arachidi")
Quando guardo la riga di quel bambino nell'elenco
Allora vedo un'etichetta ben visibile con il testo dell'allergia, accanto
al nome del bambino, indipendentemente dallo stato del pasto

## Scenario: segnare che un bambino ha mangiato
Quando premo "Sì" sulla riga pasto di un bambino
Allora lo stato pasto di oggi per quel bambino diventa "sì"

## Scenario: salvare una nota senza cambiare lo stato
Dato che un bambino ha già uno stato pasto segnato per oggi
Quando scrivo o modifico la nota e premo "Salva nota"
Allora la nota viene salvata restando associata allo stato già segnato
E la nota resta visibile anche dopo aver ricaricato la pagina

## Scenario: segnare che un bambino non ha mangiato
Quando premo "No" sulla riga pasto di un bambino
Allora lo stato pasto di oggi per quel bambino diventa "no"

## Scenario: un bambino assente non è selezionabile per il pasto
Dato che un bambino è segnato "assente" per la data in questione
Quando apro l'elenco Pasti della sua classe per quella data
Allora al posto dei pulsanti Sì/No vedo l'etichetta "Assente"
E non posso selezionare alcuno stato pasto per quel bambino, nemmeno
come admin

## Scenario: un bambino malato non è selezionabile per il pasto
Dato che un bambino è segnato "malattia" per la data in questione
Quando apro l'elenco Pasti della sua classe per quella data
Allora al posto dei pulsanti Sì/No vedo l'etichetta "🤒 Malattia"
E non posso selezionare alcuno stato pasto per quel bambino, nemmeno
come admin

## Scenario: la maestra non può modificare il pasto di una data diversa da oggi
Dato che sono autenticata come maestra e ho aperto Pasti per una data
diversa da oggi (passata o futura)
Quando guardo l'elenco bambini di una mia classe
Allora vedo lo stato eventualmente già registrato ma senza pulsanti per
modificarlo: è in sola lettura

## Scenario: l'assistente non vede la sezione Pasti
Dato che sono autenticata come assistente
Quando apro la dashboard, oppure provo ad aprire direttamente `/dashboard/pasti`
Allora non vedo il pulsante/scheda "Pasti" in dashboard, e aprendo
l'indirizzo direttamente vengo reindirizzata alla dashboard senza vedere
alcun dato pasto

## Regole
- Stati validi: `si`, `no`. (Lo stato `parziale` è stato rimosso dopo
  un test con un'insegnante: nella pratica un pasto è mangiato o no, un
  eventuale dettaglio va nella nota libera — vedi
  `supabase/migrations/0012_pasto_senza_parziale.sql` per la migration
  dei dati storici già segnati "parziale".)
- Un solo record di pasto per bambino per giorno (upsert su
  `bambino_id, data`).
- La nota è testo libero, opzionale.
- Il pulsante "Salva nota" è disponibile solo se per il bambino esiste
  già uno stato pasto segnato per la data in questione (stesso motivo di
  [13 - segna-presenza.md](13%20-%20segna-presenza.md): il record
  richiede sempre uno stato).
- Un bambino con presenza "assente" oppure "malattia" per la data in
  questione non può avere un pasto segnato per quella data: vincolo
  imposto anche a livello di database (trigger, vedi
  `supabase/migrations/0012_pasto_senza_parziale.sql`, esteso a
  "malattia" da `supabase/migrations/0017_pasto_blocca_anche_malattia.sql`),
  non solo in UI. Riguardava inizialmente solo "assente" ("un bambino
  malato può comunque aver mangiato, es. a casa poi rientrato"), ma è
  stato esteso su richiesta esplicita: in pratica un bambino segnato
  malato non viene servito a pranzo, quindi il pasto non è selezionabile
  per lui quanto per un assente.
- Scrittura consentita solo alla maestra della sezione del bambino o
  all'admin (vedi RLS su `pasti` in
  `supabase/migrations/0001_init.sql`) — **l'assistente è esclusa
  esplicitamente**, sia dalla RLS sia dalla UI (vedi
  [03 - utenti-e-ruoli.md](03%20-%20utenti-e-ruoli.md)).
- La data usata è "oggi" nel fuso orario Europe/Rome (non UTC), vedi
  `lib/date.ts`.
- Il ruolo "maestra" può scrivere solo sulla data odierna, l'admin su
  qualunque data — stessa regola e stesso meccanismo (RLS) di
  [13 - segna-presenza.md](13%20-%20segna-presenza.md).
- Presenza e pasto sono indipendenti: si può segnare il pasto anche senza
  aver ancora segnato la presenza (utile se la maestra segna prima il
  pranzo e la presenza a fine giornata) — a meno che la presenza non sia
  già "assente" (vedi sopra).
- Se il bambino risulta "malattia" per la data visualizzata, l'etichetta
  malattia appare anche in questo elenco, accanto al nome (vedi
  [13 - segna-presenza.md](13%20-%20segna-presenza.md)).
- L'elenco bambini di una classe mostra solo i bambini attivi, stessa
  regola di [13 - segna-presenza.md](13%20-%20segna-presenza.md) e
  [50 - amministrazione_base.md](50%20-%20amministrazione_base.md).
