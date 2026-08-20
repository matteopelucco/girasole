# Test — 02 Password recovery

Requisito: [specs/02 - password-recovery.md](../specs/02%20-%20password-recovery.md)

Prerequisito per tutti i test di invio email: la migration
`supabase/migrations/0003_password_recovery.sql` deve essere applicata,
altrimenti `puo_richiedere_reset_password` non esiste e nessuna richiesta
viene mai concessa (fallisce "chiuso", non in modo rumoroso — vedi
TC-02-08).

## TC-02-01 — Il link "non ricordi la password?" compare dopo un errore di login
Vedi [tests/11 - login.md](11%20-%20login.md) TC-11-03 (stesso test, non
duplicato qui).
Esito: rimando a TC-11-03

## TC-02-02 — Richiesta reset per email esistente
Precondizioni: un account con email nota esiste; migration 0003 applicata.
Passi:
1. Da `/login` in errore, clic su "Non ricordi la password?" (o apri
   `/recupera-password` direttamente).
2. Inserisci l'email dell'account esistente, invia.
Risultato atteso: pagina mostra il messaggio generico "Se l'indirizzo
esiste, riceverai a breve un'email...". Entro pochi minuti arriva
un'email da Supabase con un link di reset.
Tipo: manuale (richiede una casella email reale collegata a un account).
Esito: Bloccato — nessun account/casella email di test disponibile
all'agente.

## TC-02-03 — Richiesta reset per email inesistente (anti-enumeration)
Precondizioni: nessuna.
Passi:
1. Apri `/recupera-password`.
2. Inserisci un'email sicuramente non registrata (es.
   `non-esiste-XYZ123@esempio.it`), invia.
Risultato atteso: stesso identico messaggio generico di TC-02-02, nessuna
email inviata, nessun errore visibile, nessuna differenza di tempo di
risposta percepibile.
Tipo: browser, eseguibile senza credenziali.
Esito: Pass — verificato: submit con `non-esiste-XYZ123@esempio.it`
(inesistente) → dopo il submit mostra il messaggio generico "Se
l'indirizzo esiste, riceverai a breve un'email...", nessun errore in
console né nei log del server. La chiamata RPC fallisce silenziosamente
se la migration non è applicata (nessun crash, stesso messaggio comunque
mostrato) — comportamento fail-safe confermato sia dall'esecuzione sia
dalla lettura del codice di `richiediResetPassword`.

## TC-02-04 — Rate limit: due richieste per la stessa email entro 1 minuto
Precondizioni: migration 0003 applicata.
Passi:
1. Su `/recupera-password`, invia una richiesta per `x@esempio.it`.
2. Entro 60 secondi, invia di nuovo una richiesta per `x@esempio.it`.
Risultato atteso: entrambe le volte il messaggio mostrato è identico
(generico); solo la prima genera davvero un tentativo registrato/una
email; la seconda viene silenziosamente bloccata da
`puo_richiedere_reset_password`.
Tipo: manuale/DB (serve verificare lato Supabase quante righe/email
sono realmente partite, non solo l'esito UI che è sempre uguale per
design).
Esito: Bloccato — richiede accesso al progetto Supabase (tabella
`tentativi_reset_password` o log email) per distinguere "bloccato" da
"inviato"; non verificabile dalla sola UI, che mostra sempre lo stesso
messaggio per costruzione (corretto, ma rende il test non osservabile
dall'agente).

## TC-02-05 — Rate limit: oltre 5 richieste in 5 minuti dallo stesso IP
Precondizioni: migration 0003 applicata.
Passi:
1. Dallo stesso client, invia richieste per 6 email diverse
   (`a@esempio.it` … `f@esempio.it`) entro 5 minuti.
Risultato atteso: solo le prime 5 vengono effettivamente concesse
(registrate in `tentativi_reset_password`); la sesta no. La UI mostra
sempre lo stesso messaggio generico per tutte e 6.
Tipo: manuale/DB, stesso limite di osservabilità di TC-02-04.
Esito: Bloccato — richiede accesso al DB Supabase per verificare il
conteggio reale; non distinguibile dalla sola UI.

## TC-02-06 — Reimpostare la password: link valido
Precondizioni: possesso di un link di reset reale e recente (da
TC-02-02).
Passi:
1. Apri il link ricevuto via email.
2. Inserisci due volte una nuova password valida (es. `Nuova!Pass1`).
3. Conferma.
Risultato atteso: password aggiornata; sessione di recovery chiusa
(logout forzato); redirect a `/login?reset=ok` con messaggio "Password
aggiornata. Accedi con la nuova password." e link di servizio al login;
il login con la vecchia password non funziona più, con la nuova sì.
Tipo: manuale (richiede un vero link via email).
Esito: Bloccato — nessuna casella email di test disponibile all'agente.

## TC-02-07 — Reimpostare la password: le due password non coincidono
Precondizioni: sessione di recovery attiva (da un link valido).
Passi:
1. Su `/reimposta-password`, inserisci due password diverse.
2. Conferma.
Risultato atteso: redirect a `/reimposta-password?errore=mismatch`,
messaggio "Le due password non coincidono.", password NON aggiornata.
Tipo: manuale (richiede una sessione di recovery reale — la pagina
reindirizza a `/login` senza).
Esito: Bloccato — richiede un link di reset reale per ottenere la
sessione di recovery.

## TC-02-08 — Reimpostare la password: password troppo debole
Precondizioni: sessione di recovery attiva.
Passi:
1. Su `/reimposta-password`, inserisci due volte una password che non
   rispetta la regola (es. `semplice`, senza maiuscola/numero/speciale).
2. Conferma.
Risultato atteso: redirect a `/reimposta-password?errore=debole`,
messaggio con la regola ("Almeno 8 caratteri, con una lettera minuscola,
una maiuscola, un numero e un carattere speciale."), password NON
aggiornata.
Tipo: manuale, stesso limite di TC-02-07.
Esito: Bloccato — richiede un link di reset reale.

## TC-02-09 — Accesso a /reimposta-password senza una sessione di recovery
Precondizioni: nessuna sessione attiva (o sessione normale, non di
recovery).
Passi:
1. Apri `/reimposta-password` direttamente, senza passare dal link email.
Risultato atteso: redirect a `/login?errore=link-non-valido`, messaggio
"Il link non è più valido o è scaduto. Richiedine uno nuovo.".
Tipo: browser, eseguibile senza credenziali.
Esito: Pass — verificato: navigazione diretta a `/reimposta-password`
(nessuna sessione) → redirect a `/login`, testo "Il link non è più
valido o è scaduto. Richiedine uno nuovo." visibile insieme al link "Non
ricordi la password?".

## TC-02-10 — Link di reset scaduto (oltre 1 ora)
Precondizioni: un link di reset reale, atteso più di 1 ora.
Passi:
1. Apri un link di reset vecchio di oltre un'ora.
Risultato atteso: `/auth/callback` non riesce a scambiare il codice,
redirect a `/login?errore=link-non-valido` con messaggio corrispondente.
Tipo: manuale, richiede tempo reale di attesa + link reale.
Esito: Bloccato — richiede un link di reset reale e attesa di 1 ora;
demandato a verifica manuale del proprietario.

## TC-02-11 — Captcha
Requisito: "Un sistema di captcha previene l'uso improprio del form."
Esito: Bloccato/Non applicabile — captcha non implementato, in attesa
della scelta del provider (vedi note in specs/02 e TASKS.md). Da
riattivare come test quando implementato.
