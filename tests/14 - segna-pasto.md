# Test — 14 Segna pasto

Requisito: [specs/14 - segna-pasto.md](../specs/14%20-%20segna-pasto.md)
Test automatizzati: [e2e/14-segna-pasto.spec.ts](../e2e/14-segna-pasto.spec.ts)

## TC-14-01 — Le allergie sono visibili prima di segnare il pasto
Precondizioni: bambino con `note_allergie` compilato (es. "Allergia alle
arachidi", vedi `supabase/seed.sql`).
Passi: login come maestra della sua sezione, apri `/dashboard`.
Risultato atteso: etichetta ben visibile (badge colorato) con il testo
dell'allergia accanto al nome del bambino, indipendentemente dallo stato
del pasto già segnato o meno.
Tipo: manuale.
Esito: Bloccato — richiede sessione maestra.

## TC-14-01b — L'etichetta allergie è nel markup indipendentemente dallo stato
Precondizioni: nessuna.
Passi: revisione di `app/dashboard/page.tsx`.
Risultato atteso: il badge `⚠ {bambino.note_allergie}` è renderizzato
nella stessa riga del nome, fuori dai form di presenza/pasto — non
condizionato da nessuno stato pasto/presenza, solo da
`bambino.note_allergie` non vuoto.
Tipo: revisione codice.
Esito: Pass — confermato: il blocco `{bambino.note_allergie && (...)}` è
nell'header della card del bambino, non dentro i form di presenza/pasto.

## TC-14-02 — Segnare che un bambino ha mangiato
Passi: da `/dashboard`, premi "Sì" sulla riga pasto del bambino.
Risultato atteso: pulsante "Sì" evidenziato; `pasti.mangiato = 'si'` per
`bambino_id`+oggi.
Tipo: manuale.
Esito: Bloccato — richiede sessione maestra.

## TC-14-03 — Segnare un pasto parziale con nota
Passi: premi "Parziale", scrivi una nota (es. "solo il primo").
Risultato atteso: `mangiato = 'parziale'`, `note` = testo inserito.
Tipo: manuale.
Esito: Bloccato — richiede sessione maestra.

## TC-14-04 — Segnare che un bambino non ha mangiato
Passi: premi "No".
Risultato atteso: `mangiato = 'no'`.
Tipo: manuale.
Esito: Bloccato — richiede sessione maestra.

## TC-14-05 — Presenza e pasto sono indipendenti
Precondizioni: bambino senza presenza segnata oggi.
Passi: segna solo il pasto (es. "Sì"), senza aver toccato i pulsanti
presenza.
Risultato atteso: il pasto si salva comunque; nessun blocco/validazione
che richieda prima la presenza; la riga presenza resta "non segnata".
Tipo: manuale.
Esito: Bloccato — richiede sessione maestra.

## TC-14-06 — Upsert: un solo record di pasto per bambino/giorno
Precondizioni: pasto già segnato "sì" oggi.
Passi: premi "No" sullo stesso bambino, stesso giorno.
Risultato atteso: `mangiato` diventa 'no'; resta un solo record (vincolo
`unique(bambino_id, data)` + `onConflict: 'bambino_id,data'` in
`segnaPasto`, coerente con TC-13-03 per le presenze).
Tipo: manuale.
Esito: Bloccato — richiede sessione maestra.

## TC-14-07 — Stato non valido rifiutato
Passi: analisi del vincolo `check (mangiato in ('si', 'no', 'parziale'))`
in `pasti` (0001_init.sql) e del literal type in `segnaPasto`.
Risultato atteso: solo questi tre valori sono accettabili, sia a livello
di tipo che di constraint DB.
Tipo: revisione codice.
Esito: Pass — confermato, stessa struttura verificata per le presenze in
TC-13-04.
