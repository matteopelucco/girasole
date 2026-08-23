# 11 — Login

## Attori
Admin, maestra. (Genitore: fuori scope in questa fase, vedi
[00 - overview.md](00%20-%20overview.md).)

## Obiettivo
Accedere all'app con email e password.

## Schermata di login
- Pagina `/login`, contenuto centrato verticalmente e orizzontalmente in
  una card bianca su sfondo neutro (coerente con
  [00 - overview.md](00%20-%20overview.md) — priorità a interfaccia
  semplice e leggibile da smartphone).
- In alto, il logo Girasole (`public/girasole.svg`), seguito dal titolo
  "Girasole" e dal sottotitolo "Registro elettronico — Asilo Sartorio".
  Il logo è grande, non un'iconcina: almeno l'80% della larghezza dello
  schermo su smartphone (misurato: ~87% su un viewport di 375px), restando
  comunque dentro i margini della card di login — non un'immagine a piena
  larghezza che sconfina fuori dal box. Altezza proporzionale (rapporto
  1:1).
- Campo **Email** (tipo email, obbligatorio).
- Campo **Password** (tipo password, obbligatorio), con un pulsante
  "occhio" per mostrare/nascondere il testo in chiaro — utile per
  controllare quanto digitato, soprattutto da smartphone.
- Pulsante **Accedi** che invia il form.
- In caso di credenziali errate, un messaggio d'errore "Credenziali non
  valide. Riprova." appare sopra il pulsante, senza svuotare il campo
  email.

## Scenario: accesso con credenziali valide
Dato che ho un account email/password già creato su Supabase Auth
Quando inserisco email e password corretti nella pagina di login
Allora vengo reindirizzato alla dashboard

## Scenario: credenziali errate
Quando inserisco email o password errati
Allora resto sulla pagina di login e vedo il messaggio "Credenziali non
valide. Riprova."

## Scenario: accesso a una pagina protetta senza essere autenticato
Dato che non ho effettuato il login
Quando provo ad aprire `/dashboard`, `/admin` o `/admin/maestre`
Allora vengo reindirizzato a `/login`

## Scenario: mostrare/nascondere la password durante la digitazione
Quando premo l'icona "occhio" accanto al campo Password
Allora il testo digitato diventa visibile in chiaro
E premendo di nuovo torna nascosto

## Scenario: logout
Dato che sono autenticata
Quando premo "Esci" nell'intestazione
Allora la sessione viene chiusa e torno alla pagina di login

## Regole
- Autenticazione via Supabase Auth (email/password), nessun altro
  provider in questa fase.
- Non esiste una pagina di auto-registrazione: i nuovi account li crea
  un admin direttamente dall'app, in `/admin/maestre` (email, password,
  nome, cognome, telefono, ruolo) — vedi
  [03 - utenti-e-ruoli.md](03%20-%20utenti-e-ruoli.md). Il profilo
  (trigger `handle_new_user`, vedi `supabase/migrations/0001_init.sql` e
  `0005_utenti_gestiti_da_app.sql`) riceve subito il ruolo scelto
  dall'admin in fase di creazione, senza passare da una promozione
  successiva.
- Il primissimo admin del sistema va promosso a mano via SQL Editor
  (bootstrap): non può farlo un altro admin perché non ne esiste ancora
  uno.
