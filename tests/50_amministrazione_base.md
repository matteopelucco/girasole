# Test — 50 Amministrazione base

Requisito: [specs/50_amministrazione_base.md](../specs/50_amministrazione_base.md)

## TC-50-01 — Creare una sezione
Precondizioni: sessione admin.
Passi: da `/admin`, inserisci un nome sezione (es. "Girasoli"), conferma.
Risultato atteso: la sezione compare subito nell'elenco sezioni; poi
disponibile nei form di creazione bambino e assegnazione maestra.
Tipo: manuale.
Esito: Bloccato — richiede sessione admin.

## TC-50-02 — Creare un bambino
Passi: da `/admin`, compila nome, cognome, scegli una sezione, aggiungi
note allergie, conferma.
Risultato atteso: il bambino compare nell'elenco della sezione scelta;
le note allergie sono mostrate in evidenza accanto al nome (badge ambra).
Tipo: manuale.
Esito: Bloccato — richiede sessione admin.

## TC-50-02b — Creare un bambino senza allergie
Passi: come TC-50-02 ma senza compilare il campo note allergie.
Risultato atteso: il bambino compare comunque nell'elenco, senza badge
(campo opzionale, salvato come `null`, non stringa vuota — verificare
`noteAllergie || null` in `creaBambino`).
Tipo: manuale + revisione codice.
Esito: Pass (parziale, solo revisione codice) — confermato in
`app/admin/actions.ts` che una stringa vuota diventa `null`, non `''`,
evitando badge vuoti. Verifica visiva della UI: Bloccato, richiede
sessione admin.

## TC-50-03 — Creazione sezione/bambino richiede tutti i campi obbligatori
Passi: revisione di `creaSezione`/`creaBambino` in `app/admin/actions.ts`.
Risultato atteso: entrambe fanno `return` senza insert se `nome` (e per
bambino anche `cognome`/`sezione_id`) sono vuoti dopo `trim()` — non
fidandosi del solo `required` HTML.
Tipo: revisione codice.
Esito: Pass — confermato.

## TC-50-04 — Promuovere un utente a maestra
Precondizioni: sessione admin; un utente esistente con ruolo `genitore`
(quello di default, es. un account appena registrato/creato da
Supabase Auth Dashboard).
Passi: da `/admin/maestre`, trova l'utente, seleziona ruolo "Maestra",
premi Aggiorna.
Risultato atteso: il ruolo del profilo diventa `maestra`; l'utente,
rifacendo login, arriva alla dashboard maestra.
Tipo: manuale.
Esito: Bloccato — richiede sessione admin e un account di test da
promuovere (in questa conversazione la creazione di account maestra/
genitore di test è stata richiesta ma l'esito non è stato confermato
all'agente).

## TC-50-05 — Assegnare una maestra a una sezione
Precondizioni: utente con ruolo `maestra`, sezione esistente.
Passi: da `/admin/maestre`, scegli maestra e sezione, premi Assegna.
Risultato atteso: la maestra vede i bambini di quella sezione al
successivo login/refresh della dashboard (vedi TC-12-01).
Tipo: manuale.
Esito: Bloccato — richiede sessione admin + account maestra di test.

## TC-50-06 — Rimuovere l'assegnazione di una maestra a una sezione
Precondizioni: assegnazione esistente (da TC-50-05).
Passi: da `/admin/maestre`, premi la ✕ sulla sezione assegnata.
Risultato atteso: l'assegnazione sparisce dalla lista; la maestra non
vede più i bambini di quella sezione.
Tipo: manuale.
Esito: Bloccato — richiede sessione admin + account maestra di test.

## TC-50-07 — Solo admin può creare sezioni/bambini/assegnazioni/ruoli (RLS)
Precondizioni: sessione maestra (non admin).
Passi: tentativo diretto (via API) di insert su `sezioni`, `bambini`,
`maestre_sezioni`, o update su `profili.ruolo`.
Risultato atteso: negato dalle policy `sezioni_admin_write`,
`bambini_admin_write`, `maestre_sezioni_admin_write`,
`profili_update_admin` (tutte in `0002_admin_e_maestre.sql`, tutte
`using (ruolo_corrente() = 'admin')`).
Tipo: manuale/API.
Esito: Bloccato — richiede sessione maestra e chiamata diretta all'API.

## TC-50-08 — Le pagine admin sono negate a chi non è admin (guardia UI)
Precondizioni: sessione maestra o genitore.
Passi: prova ad aprire `/admin` o `/admin/maestre` da autenticata ma non
admin.
Risultato atteso: redirect a `/dashboard` (non a `/login`, dato che la
sessione è valida — solo il ruolo non basta). Verificare
`requireAdmin()` in `app/admin/actions.ts` e
`app/admin/maestre/actions.ts`, e il controllo `if (profilo?.ruolo !==
'admin') redirect('/dashboard')` nei due `page.tsx`.
Tipo: revisione codice (comportamento) + manuale (conferma con sessione
reale).
Esito: Pass (revisione codice) — confermato il controllo sia nelle
pagine sia nelle server action (difesa in profondità: anche chiamando
l'action direttamente, non solo aggirando la UI della pagina, il
controllo ruolo è ripetuto in ogni action tramite `requireAdmin()`).
Verifica con sessione reale: Bloccato.

## TC-50-09 — Nessun modo di creare un nuovo utente da /admin
Passi: revisione di `app/admin/page.tsx` e `app/admin/maestre/page.tsx`.
Risultato atteso: nessun form che crei righe in `auth.users` o inserisca
direttamente in `profili` con un nuovo `id`; l'unica azione su `profili`
è l'update del ruolo di un profilo già esistente.
Tipo: revisione codice.
Esito: Pass — confermato, nessuna funzionalità di creazione utenti
nell'area admin.
