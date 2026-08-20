# 02 — Password recovery

## Attori
Ogni utente che prova ad accedere al sistema e che ha un account attivo

## Obiettivo
Permettere a chi ha dimenticato la password di recuperarla

## Scenario: utente esistente non ricorda la password
L'utente prova ad effettuare un login. A errore ricevuto, compare un link "non ricordi la password?"
Cliccando il link, all'utente viene chiesto di inserire nuovamente la propria e-mail di accesso. 
IMPORTANTE: 
- Un sistema di captcha previene l'uso improprio del form.
- Non è possibile inviare più di una richiesta di password recovery ad un utente in un minuto
L'utente riceve quindi una e-mail, con un link di password reset
IMPORTANTE: 
- il link è valido solo 1 ora
L'utente clicca al link ricevuto nella mail, atterra sulla pagina di re-impostazione password
Inserisce due volte una nuova password, il sistema verificha che sia sufficientemente complessa (almeno 1 numero, una lettera minuscola, una maiuscola, un carattere speciale)
A procedura completata, la password viene salvata a DB e l'utente viene invitato a loggarsi, con link di servizio al login.

## Scenario: utente non esistente chiede di recuperare la password
Quando l'utente inserisce una mail inesistente, il sistema si comporta esattamente come se avesse (ma non l'ha fatto) inviato la mail di recovery
Non deve essere possibile effettuare enumeration.

## Scenario: utente esistente cerca di effettuare la funzionalità di recupero password più volte
Il sistema blocca la funzionalità dopo un numero prefissato. 
Non è possibile inviare più di una mail di recovery alla stessa e-mail in 1 minuto (si deve aspettare 1 minuto per poterne inviare un'altra)
Non è possibile inviare più di 5 email di recovery in 5 minuti A QUALUNQUE indirizzo e-mail
IMPORTANTE: 
- check in sessione
- check per IP / fingerprint

## Scenario: un attaccante prova a fare enumeration o a recuperare password di altri
Non ci riesce. Il sistema è sufficientemente sicuro per evitare di fare enumeration o attacchi di hacking.

## Note di implementazione
- Pagine: [/recupera-password](../app/recupera-password/page.tsx) (richiesta
  email), [/reimposta-password](../app/reimposta-password/page.tsx) (nuova
  password), route tecnica `/auth/callback` (scambia il link ricevuto via
  email per una sessione, standard Supabase SSR).
- Anti-enumeration: `/recupera-password` mostra sempre lo stesso messaggio
  generico, indipendentemente dal fatto che l'email esista, sia
  rate-limitata, o l'invio sia riuscito. `supabase.auth.resetPasswordForEmail`
  di suo non rivela se l'account esiste.
- Rate limiting: implementato via `puo_richiedere_reset_password` (SQL,
  vedi `supabase/migrations/0003_password_recovery.sql`) — 1 richiesta al
  minuto per la stessa email, 5 richieste ogni 5 minuti dallo stesso IP
  (header `x-forwarded-for`, valorizzato da Vercel) a qualunque email. Il
  check "in sessione" richiesto dallo scenario non è stato implementato a
  parte: un check lato cookie di sessione sarebbe comunque aggirabile
  cancellando i cookie, mentre il check per IP è lato server e copre lo
  stesso caso d'uso in modo più robusto.
- Scadenza link (1 ora): gestita nativamente da Supabase Auth (GoTrue),
  nessun codice custom.
- Complessità password: almeno 8 caratteri, 1 minuscola, 1 maiuscola, 1
  numero, 1 carattere speciale (vedi `lib/password.ts`). La lunghezza
  minima di 8 non era specificata esplicitamente, aggiunta come requisito
  ragionevole per "sufficientemente complessa".
- **Captcha: implementato con Cloudflare Turnstile.** Widget su
  `/recupera-password` (`data-action="recupera-password"`), caricato solo
  se `NEXT_PUBLIC_TURNSTILE_SITE_KEY` è configurata (altrimenti la pagina
  funziona senza captcha, per non rompere l'ambiente locale finché non è
  configurato). Verifica server-side in `lib/turnstile.ts` via
  `siteverify`, chiamata da `richiediResetPassword` prima del rate limit:
  se `TURNSTILE_SECRET_KEY` non è configurata la verifica passa sempre
  (stesso motivo); se configurata, un token mancante/non valido/con
  `action` diverso da `recupera-password` fa fallire silenziosamente la
  richiesta (stesso messaggio generico di sempre, nessun errore dedicato
  — coerente con l'anti-enumeration). Vedi TASKS.md per la procedura di
  configurazione dei secret in locale e su Vercel.