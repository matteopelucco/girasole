# Test — 12 Dashboard maestra

Requisito: [specs/12 - dashboard-maestre.md](../specs/12%20-%20dashboard-maestre.md)
Test automatizzati: [e2e/12-dashboard-maestre.spec.ts](../e2e/12-dashboard-maestre.spec.ts)

Tutti i casi sotto (tranne dove indicato) richiedono sessioni autenticate
reali per i tre ruoli (admin, maestra, genitore) che l'agente non
possiede: vedi la richiesta di credenziali di test nella conversazione.
Segnati come "Bloccato" finché non sono disponibili; da eseguire non
appena si hanno account di test funzionanti.

## TC-12-01 — La maestra vede i bambini delle proprie sezioni con stato di oggi
Precondizioni: maestra con almeno una sezione assegnata e bambini nella
sezione.
Passi: login come maestra, apri `/dashboard`.
Risultato atteso: elenco bambini delle sue sezioni, ciascuno con lo stato
presenza/pasto di oggi se già segnato, altrimenti nessuno stato
evidenziato.
Tipo: manuale.
Esito: Bloccato — richiede sessione maestra.

## TC-12-02 — Maestra senza sezioni assegnate
Precondizioni: account con ruolo `maestra` ma nessuna riga in
`maestre_sezioni`.
Passi: login come quella maestra, apri `/dashboard`.
Risultato atteso: messaggio che invita a chiedere all'admin una sezione;
nessun elenco bambini.
Tipo: manuale.
Esito: Bloccato — richiede sessione maestra senza sezioni.

## TC-12-03 — L'admin apre la dashboard
Precondizioni: account admin.
Passi: login come admin, apri `/dashboard`.
Risultato atteso: rimando a `/admin` e `/admin/maestre` invece
dell'elenco bambini di una sezione; sezione promemoria presente e
funzionante, con possibilità di scegliere qualunque sezione/bambino come
destinatario.
Tipo: manuale.
Esito: Bloccato — richiede sessione admin (l'agente non ha la password
dell'account admin dell'utente).

## TC-12-04 — Un genitore apre la dashboard
Precondizioni: account con ruolo `genitore` (default per i nuovi utenti).
Passi: login come quell'utente, apri `/dashboard`.
Risultato atteso: messaggio "Il portale genitori è in arrivo in una fase
successiva.", nessun dato di bambini.
Tipo: manuale.
Esito: Bloccato — richiede sessione genitore.

## TC-12-05 — Un profilo senza ruolo riconosciuto vede lo stesso placeholder del genitore
Precondizioni: riga `profili` con `ruolo` non tra `admin`/`maestra`
(caso limite, es. valore legacy o mancante — vedi il bug reale
riscontrato con l'account admin prima della migration 0002).
Risultato atteso: stesso comportamento di TC-12-04 (nessun errore, nessun
crash), non una pagina bianca o un 500.
Tipo: revisione codice.
Esito: Pass — confermato in `app/dashboard/page.tsx`: il branch
`ruolo !== 'admin' && ruolo !== 'maestra'` copre esplicitamente sia
`'genitore'` sia `null`/`undefined`, mostrando lo stesso placeholder.

## TC-12-06 — Isolamento tra sezioni: una maestra non vede bambini di sezioni altrui
Precondizioni: due maestre, ciascuna con una sezione diversa e bambini
diversi.
Passi: login come maestra A, apri `/dashboard`.
Risultato atteso: solo i bambini della sezione di A, mai quelli della
sezione di B — enforced sia lato query (`.in('sezione_id', ...)`) sia
lato RLS (`bambini_select_maestra` in `0001_init.sql`, che richiede
comunque una riga in `maestre_sezioni`, ora leggibile grazie alla policy
aggiunta in `0002_admin_e_maestre.sql`).
Tipo: manuale (comportamento a doppio livello, query + RLS: il solo
codice non basta a garantire che la RLS sia davvero attiva sul progetto
Supabase collegato).
Esito: Bloccato — richiede due sessioni maestra di test.

## TC-12-07 — La cache non serve dati stantii tra richieste diverse
Precondizioni: nessuna (regressione del bug di caching già risolto).
Passi: login come admin dopo aver corretto il ruolo nel DB (vedi
cronologia), ricaricare `/dashboard` senza riavviare il server.
Risultato atteso: il ruolo mostrato riflette lo stato reale del DB alla
richiesta corrente, non una risposta cache di una richiesta precedente.
Tipo: revisione codice (regressione già diagnosticata e corretta con
`export const dynamic = 'force-dynamic'` su `/`, `/dashboard`, `/admin`,
`/admin/maestre`).
Esito: Pass — verificato che tutte e quattro le pagine dichiarano
`export const dynamic = 'force-dynamic'` (grep sul codice sorgente).
Verifica funzionale end-to-end con account reale confermata dall'utente
in una sessione precedente (ruolo admin visualizzato correttamente dopo
il fix).
