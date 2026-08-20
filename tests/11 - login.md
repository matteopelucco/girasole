# Test — 11 Login

Requisito: [specs/11 - login.md](../specs/11%20-%20login.md)

## TC-11-01 — Schermata di login: elementi presenti
Precondizioni: nessuna.
Passi:
1. Apri `/login`.
Risultato atteso: logo Girasole in alto, titolo "Girasole", sottotitolo
"Registro elettronico — Asilo Sartorio", campo Email (type=email,
required), campo Password (type=password, required), pulsante "Accedi".
Tipo: browser, eseguibile senza credenziali.
Esito: Pass — verificato via `read_page` in una sessione dedicata di
esecuzione test: logo, heading, campi email/password required, pulsante
submit tutti presenti; nessun errore console.

## TC-11-02 — Accesso con credenziali valide
Precondizioni: account attivo con email/password noti.
Passi:
1. Apri `/login`.
2. Inserisci email e password corretti, premi Accedi.
Risultato atteso: redirect a `/dashboard`.
Tipo: manuale (richiede credenziali reali di un account).
Esito: Bloccato — nessuna credenziale di test disponibile all'agente.

## TC-11-03 — Credenziali errate: messaggio ed email preservata
Precondizioni: nessuna.
Passi:
1. Apri `/login`.
2. Inserisci un'email qualsiasi (es. `prova@esempio.it`) e una password
   sbagliata, premi Accedi.
Risultato atteso: resto su `/login`, vedo "Credenziali non valide.
Riprova.", il campo email mostra ancora `prova@esempio.it` (non
svuotato), compare il link "Non ricordi la password?".
Tipo: browser, eseguibile senza credenziali valide (basta un tentativo
fallito).
Esito: Pass — bug trovato e corretto durante la scrittura di questo test:
il campo email non veniva preservato (nessun `defaultValue`, nessun dato
nel redirect). Fix in `app/login/actions.ts` (email passata in query) e
`app/login/page.tsx` (`defaultValue`). Rieseguito dopo il fix: submit con
`prova@esempio.it` + password errata → dopo ~11s (latenza reale verso
Supabase Auth) mostra "Credenziali non valide. Riprova.", il link "Non
ricordi la password?", e `document.getElementById('email').value ===
'prova@esempio.it'` (verificato via ispezione DOM). Nessun errore in
console o nei log del server.

## TC-11-04 — Accesso a pagina protetta senza login: /dashboard
Passi: apri `/dashboard` senza sessione attiva.
Risultato atteso: redirect a `/login`.
Tipo: browser, eseguibile senza credenziali.
Esito: Pass — verificato: richiesta a `/dashboard` risolve con redirect a
`/login` (nessun contenuto della dashboard mostrato).

## TC-11-05 — Accesso a pagina protetta senza login: /admin
Passi: apri `/admin` senza sessione attiva.
Risultato atteso: redirect a `/login`.
Tipo: browser, eseguibile senza credenziali.
Esito: Pass — verificato: `/admin` senza sessione redirige a `/login`,
nessun contenuto esposto.

## TC-11-06 — Accesso a pagina protetta senza login: /admin/maestre
Passi: apri `/admin/maestre` senza sessione attiva.
Risultato atteso: redirect a `/login`.
Tipo: browser, eseguibile senza credenziali.
Esito: Pass — verificato: `/admin/maestre` senza sessione redirige a
`/login`, stesso comportamento di TC-11-05.

## TC-11-07 — Logout
Precondizioni: sessione autenticata attiva.
Passi:
1. Da `/dashboard`, premi "Esci" nell'intestazione.
Risultato atteso: la sessione viene chiusa, torno a `/login`; un
successivo tentativo di aprire `/dashboard` reindirizza di nuovo a
`/login`.
Tipo: manuale (richiede una sessione autenticata reale).
Esito: Bloccato — nessuna credenziale di test disponibile all'agente.

## TC-11-08 — Nessun provider di autenticazione alternativo
Passi: ispeziona `/login` e `app/login/actions.ts`.
Risultato atteso: solo `supabase.auth.signInWithPassword`, nessun
pulsante "Accedi con Google/GitHub/…".
Tipo: revisione codice.
Esito: Pass — confermato leggendo `app/login/actions.ts` e
`app/login/page.tsx`.
