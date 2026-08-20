# Test — 15 Promemoria

Requisito: [specs/15 - memo.md](../specs/15%20-%20memo.md)

## TC-15-01 — Creare un promemoria per tutti
Precondizioni: sessione maestra o admin.
Passi: da `/dashboard`, compila titolo e testo, destinatario "Tutti",
pubblica.
Risultato atteso: il promemoria compare in cima alla lista (più recente
per primo), visibile subito dopo il submit (revalidatePath).
Tipo: manuale.
Esito: Bloccato — richiede sessione maestra o admin.

## TC-15-02 — Creare un promemoria per una sezione
Passi: destinatario "Una sezione", seleziona una sezione, pubblica.
Risultato atteso: riga `promemoria` con `destinatario_tipo = 'sezione'`,
`sezione_id` valorizzato, `bambino_id` nullo.
Tipo: manuale.
Esito: Bloccato — richiede sessione maestra o admin.

## TC-15-03 — Creare un promemoria per un singolo bambino
Passi: destinatario "Un bambino", seleziona un bambino, pubblica.
Risultato atteso: `destinatario_tipo = 'bambino'`, `bambino_id`
valorizzato, `sezione_id` nullo.
Tipo: manuale.
Esito: Bloccato — richiede sessione maestra o admin.

## TC-15-04 — Coerenza dei campi destinatario lato server
Precondizioni: nessuna.
Passi: revisione di `creaPromemoria` in `app/dashboard/actions.ts`.
Risultato atteso: anche se il form invia sia `sezione_id` sia
`bambino_id` insieme (la UI li mostra sempre entrambi, per non
richiedere JS condizionale — vedi nota UX), la action valorizza solo il
campo coerente con `destinatario_tipo` scelto e forza l'altro a `null`
(`sezione_id: destinatarioTipo === 'sezione' ? sezioneId : null`, e
analogo per bambino_id) — non fidandosi ciecamente di cosa arriva dal
client.
Tipo: revisione codice.
Esito: Pass — confermato in `app/dashboard/actions.ts`, `creaPromemoria`.

## TC-15-05 — Titolo o testo vuoti vengono rifiutati
Passi: revisione codice (la UI ha `required` sui campi, ma va verificato
anche lato server).
Risultato atteso: `creaPromemoria` fa `if (!titolo || !testo) return;`
prima dell'insert — nessun promemoria vuoto anche bypassando l'attributo
HTML `required`.
Tipo: revisione codice.
Esito: Pass — confermato in `app/dashboard/actions.ts`.

## TC-15-06 — Lista promemoria visibile in dashboard, più recenti prima
Precondizioni: almeno due promemoria esistenti.
Passi: da `/dashboard` (maestra o admin), osserva la sezione Promemoria.
Risultato atteso: ordinati per `created_at` decrescente, con titolo,
testo, tipo destinatario leggibile, e data in formato italiano.
Tipo: manuale.
Esito: Bloccato — richiede sessione maestra o admin e dati esistenti.

## TC-15-07 — Solo lo staff può creare promemoria (RLS)
Precondizioni: sessione con ruolo diverso da admin/maestra (o nessuna
sessione).
Passi: tentativo diretto di insert su `promemoria` via API Supabase.
Risultato atteso: negato dalla policy `promemoria_insert_staff`
(0001_init.sql), che richiede `ruolo_corrente() in ('admin',
'maestra')`.
Tipo: manuale/API.
Esito: Bloccato — richiede sessione di test e chiamata diretta all'API.

## TC-15-08 — Lo staff vede tutti i promemoria indipendentemente dal destinatario
Precondizioni: promemoria con destinatari diversi (tutti/sezione/
bambino) esistenti.
Passi: login come maestra qualunque, apri `/dashboard`.
Risultato atteso: vede tutti i promemoria in lista, non filtrati per la
propria sezione (coerente con la policy `promemoria_select`, che per lo
staff è `ruolo_corrente() in ('admin','maestra')` senza altre
condizioni).
Tipo: manuale.
Esito: Bloccato — richiede sessione maestra e dati con destinatari
misti.
