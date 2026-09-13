# 56 — Rette

## Attori
Admin.

## Obiettivo
Nuova voce di menu principale "Rette": punto di partenza per la
gestione economica delle rette (comunicazioni mensili, invii e
registrazione dei bonifici ricevuti). Questo requisito copre solo il
primo passo — una tabella riepilogativa dei pagamenti retta mese per
mese per l'anno scolastico corrente, e la scheda di dettaglio per
singolo bambino con lo stesso prospetto. Preparare/inviare la
comunicazione mensile e registrare un nuovo pagamento sono previsti nei
prossimi incrementi (vedi Fuori scope) — secondo passo di Fase 2, dopo
[55 - parametri-retta.md](55%20-%20parametri-retta.md).

## Scenario: impostare l'anno scolastico corrente
Dato che su `/admin` esiste un anno scolastico con l'anno di inizio
impostato
Quando premo "Imposta come corrente" per quell'anno scolastico
Allora quell'anno scolastico diventa quello corrente, e l'eventuale
anno scolastico precedentemente corrente smette di esserlo

## Scenario: vedere la tabella rette dell'anno scolastico corrente
Dato che un anno scolastico è impostato come corrente e ha sezioni con
bambini attivi assegnati
Quando apro "Rette" dal menu
Allora vedo una riga per ciascun bambino attivo delle sezioni di
quell'anno scolastico, con il suo nome, la sua sezione, un importo per
ciascuno dei 10 mesi (Settembre-Giugno) e un totale a fine riga
E l'importo di un mese non ancora registrato è mostrato come 0, non
come un errore

## Scenario: aprire il dettaglio rette di un bambino
Dato che sono sulla tabella rette
Quando clicco sul nome di un bambino
Allora vedo la sua scheda di dettaglio rette, con lo stesso prospetto
mese per mese (Settembre-Giugno) e il totale, solo per quel bambino

## Scenario: nessun anno scolastico corrente impostato
Dato che nessun anno scolastico è impostato come corrente
Quando apro "Rette"
Allora vedo un messaggio che invita a impostare un anno scolastico
corrente da `/admin`, invece di una tabella vuota o di un errore

## Scenario: accesso negato a chi non è admin
Dato che sono autenticato come maestra, assistente o genitore
Quando provo ad aprire `/admin/rette` (o la scheda di dettaglio rette di
un bambino)
Allora vengo reindirizzato alla dashboard

## Regole
- Un anno scolastico ha, oltre al nome libero (vedi
  [04 - data-types.md](04%20-%20data-types.md)), un "anno di inizio"
  (`anni_scolastici.anno_inizio`, l'anno solare in cui inizia — es.
  2025 per l'anno scolastico "2025/2026"): serve a calcolare le date
  reali dei 10 mesi Settembre-Giugno mostrati in tabella. Un anno
  scolastico senza anno di inizio non può essere impostato come
  corrente.
- Un solo anno scolastico alla volta può essere "corrente"
  (`anni_scolastici.corrente`, vincolo di unicità a livello di database
  — `supabase/migrations/0036_rette_pagamenti.sql`): impostarne uno
  come corrente toglie automaticamente il flag dall'eventuale
  precedente.
- I mesi mostrati sono sempre gli stessi 10, fissi: Settembre, Ottobre,
  Novembre, Dicembre, Gennaio, Febbraio, Marzo, Aprile, Maggio, Giugno
  — l'asilo è chiuso in Luglio/Agosto. Non dipendono da un range di
  date personalizzabile per anno scolastico.
- I bambini mostrati sono i bambini attivi (`bambini.attiva`) assegnati
  a una sezione dell'anno scolastico corrente
  (`sezioni.anno_scolastico_id`); un bambino senza sezione, o con una
  sezione di un anno scolastico diverso, non compare — stesso filtro
  già usato per Presenze/Pasto (vedi
  [50 - amministrazione_base.md](50%20-%20amministrazione_base.md)).
- L'importo pagato/registrato per un bambino in un mese è letto dalla
  nuova tabella `pagamenti_retta` (un solo importo per bambino e mese
  di competenza — `supabase/migrations/0036_rette_pagamenti.sql`), dato
  economico visibile solo all'admin (RLS, stesso pattern "solo admin"
  di `rette_bambini`, vedi
  [55 - parametri-retta.md](55%20-%20parametri-retta.md)). Questo
  requisito copre solo la lettura: la registrazione di un pagamento non
  ha ancora un'interfaccia (vedi Fuori scope).
- Il totale di fine riga è la somma dei soli importi effettivamente
  registrati nei 10 mesi mostrati (i mesi non registrati contano come
  0).
- Solo un profilo con ruolo `admin` può accedere a `/admin/rette` e
  alle sue schede di dettaglio (`requireAdmin`, stesso pattern di
  [55 - parametri-retta.md](55%20-%20parametri-retta.md)).
- Fuori scope in questa fase: registrare un nuovo pagamento/bonifico
  (form di inserimento/modifica in `pagamenti_retta`, con eventuali
  note), preparare e inviare la comunicazione mensile della retta da
  pagare dalla scheda di dettaglio bambino, storicizzazione di più anni
  scolastici nella stessa vista (la tabella mostra solo l'anno
  corrente).
