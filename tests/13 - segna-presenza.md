# Test — 13 Segna presenza

Requisito: [specs/13 - segna-presenza.md](../specs/13%20-%20segna-presenza.md)
Test automatizzati: [e2e/13-segna-presenza.spec.ts](../e2e/13-segna-presenza.spec.ts)

## TC-13-01 — Segnare un bambino presente
Precondizioni: maestra con sezione assegnata, bambino nella sezione,
nessuna presenza già segnata oggi per lui.
Passi: da `/dashboard`, premi "Presente" sulla riga del bambino.
Risultato atteso: il pulsante "Presente" diventa evidenziato (sfondo
pieno); in DB, `presenze` ha una riga con `bambino_id`, `data` = oggi
(fuso Europe/Rome), `stato = 'presente'`, `inserita_da` = id della
maestra.
Tipo: manuale.
Esito: Bloccato — richiede sessione maestra.

## TC-13-02 — Segnare un'assenza con nota
Passi: premi "Assente", scrivi una nota (es. "influenza, rientra
lunedì") nel campo nota della riga presenza, la nota si salva al submit
del pulsante (stesso form).
Risultato atteso: stato = 'assente', `note` = testo inserito.
Tipo: manuale.
Esito: Bloccato — richiede sessione maestra.

## TC-13-03 — Correggere uno stato già segnato (upsert, non duplica)
Precondizioni: bambino già segnato "presente" oggi (da TC-13-01).
Passi: premi "Malattia" sullo stesso bambino, stesso giorno.
Risultato atteso: lo stato per oggi diventa 'malattia'; resta un solo
record in `presenze` per quel `bambino_id`+`data` (vincolo
`unique(bambino_id, data)` in `0001_init.sql`, upsert con
`onConflict: 'bambino_id,data'` in `segnaPresenza`), non due righe.
Tipo: manuale.
Esito: Bloccato — richiede sessione maestra.

## TC-13-04 — Stato non valido rifiutato
Precondizioni: nessuna (verifica di uno schema/tipo, non di UI — la UI
offre solo i tre bottoni validi, quindi questo caso protegge da
manomissione diretta della request).
Passi: analisi statica del vincolo `check (stato in ('presente',
'assente', 'malattia'))` in `presenze` (0001_init.sql) e del tipo
`'presente' | 'assente' | 'malattia'` nella action `segnaPresenza`
(app/dashboard/actions.ts).
Risultato atteso: un valore diverso da questi tre viene rifiutato dal
DB (constraint) anche se qualcuno bypassasse il tipo TypeScript
chiamando l'endpoint direttamente.
Tipo: revisione codice.
Esito: Pass — confermato: vincolo CHECK presente in migration, e la
action accetta solo il literal type dei tre valori (nessun path che
passi una stringa arbitraria dell'utente come `stato`, dato che i tre
bottoni della UI hanno lo stato hardcoded tramite `.bind`).

## TC-13-05 — Scrittura negata a chi non è staff della sezione
Precondizioni: maestra B senza assegnazione sulla sezione del bambino
(o utente con ruolo `genitore`).
Passi: tentativo (via API diretta con la sessione di B, dato che la UI
non espone il bambino a B) di scrivere in `presenze` per un bambino non
suo.
Risultato atteso: negato dalla RLS (`presenze_insert_staff` /
`presenze_update_staff` in 0001_init.sql, che richiede
`maestre_sezioni.maestra_id = auth.uid()` sulla sezione del bambino, o
ruolo admin).
Tipo: manuale/API (richiede due sessioni di test e una chiamata diretta
all'API REST di Supabase, non solo la UI).
Esito: Bloccato — richiede sessioni di test multiple.

## TC-13-06 — Ora usata è quella di Europe/Rome, non UTC
Precondizioni: nessuna.
Passi: analisi di `lib/date.ts` (`oggi()`), usato sia per la query di
lettura sia per l'upsert.
Risultato atteso: usa `Intl.DateTimeFormat('sv-SE', { timeZone:
'Europe/Rome' })`, non `new Date().toISOString()` (che sarebbe UTC e
sbaglierebbe la data intorno alla mezzanotte per un fuso +1/+2).
Tipo: revisione codice.
Esito: Pass — confermato in `lib/date.ts`; usato coerentemente in
`app/dashboard/page.tsx` e `app/dashboard/actions.ts`.
