# 05 — Feedback sulle azioni

## Attori
Ogni utente autenticato che esegue un'azione che scrive sul database
(admin, maestra).

## Obiettivo
Dare a chi esegue un'azione (creare, modificare, eliminare un dato) il
senso che l'azione è stata avviata, è in corso, è terminata e con quale
esito — senza essere invasivi quando va tutto bene, ma chiari quando
qualcosa va storto.

## Scenario: avvio ed esecuzione di un'azione
Dato che sto compilando un form che scrive sul database (es. creare una
sezione)
Quando premo il pulsante di invio
Allora il pulsante si disabilita immediatamente ed entra in uno stato
visivo di attesa (started/running), impedendo doppi invii accidentali
finché il server non ha risposto

## Scenario: azione completata con successo
Quando l'azione termina con successo
Allora il pulsante torna allo stato normale
E vedo l'effetto dell'azione (es. il nuovo elemento in lista, un badge
aggiornato, una riga rimossa), senza notifiche aggiuntive invasive

## Scenario: azione fallita per un motivo previsto (validazione)
Quando invio un form con dati non validi o incompleti per quel campo
Allora vedo, vicino al form, un messaggio chiaro sul perché l'azione non
è stata eseguita
E posso correggere e reinviare senza aver perso i dati già inseriti

## Scenario: azione fallita per un errore del server
Quando l'azione termina con un errore lato server (vincolo di
integrità violato, permessi insufficienti, problema di rete, timeout)
Allora vedo un messaggio chiaro che l'azione non è andata a buon fine
E vedo un dettaglio tecnico dell'errore (il messaggio restituito dal
database o da Supabase), utile per un troubleshooting rapido da parte
di una persona o di un'IA
E il pulsante torna disponibile per un nuovo tentativo

## Scenario: errore non gestito puntualmente dalla pagina
Dato che un'azione fallisce per un motivo che la pagina non intercetta
esplicitamente
Quando l'errore viene comunque sollevato dal server
Allora vedo una schermata di errore chiara con il messaggio tecnico e
un modo per riprovare o tornare alla dashboard, invece di una pagina
bianca o un errore non gestito

## Regole
- Il feedback "avviato/in corso" si applica in modo uniforme a ogni
  pulsante che invia un'azione (`components/PulsanteInvio.tsx`, basato
  su `useFormStatus`): si disabilita e mostra un'attesa non appena il
  form viene inviato. Nessuna azione da ripetere pagina per pagina.
- Il feedback di errore ("ko") privilegia un messaggio inline vicino al
  form, con il dettaglio tecnico (`components/FormConEsito.tsx`, basato
  su `useFormState`): si applica a ogni form con un'unica azione
  (creazione/modifica/eliminazione di sezioni, anni scolastici, bambini,
  utenti, assegnazioni, promemoria).
- Per i pochi punti dove un form ha più azioni diverse su pulsanti
  diversi (i pulsanti presente/assente/malattia e sì/no in dashboard,
  che condividono lo stesso form) l'errore viene sollevato
  dall'azione e intercettato da un error boundary
  (`app/error.tsx`, convenzione Next.js) con lo stesso messaggio
  tecnico — rete di sicurezza applicata anche a qualunque altro errore
  non gestito puntualmente altrove.
- Il dettaglio tecnico mostrato è il messaggio d'errore restituito dal
  database/Supabase — mai un dato sensibile come una password.
- **Eccezioni deliberate**, per non contraddire altri requisiti già
  approvati:
  - Login ([11 - login.md](11%20-%20login.md)) e richiesta di recupero
    password ([02 - password-recovery.md](02%20-%20password-recovery.md))
    NON mostrano un dettaglio tecnico sull'errore, e la richiesta di
    recupero password non mostra mai un esito "ko" agli occhi
    dell'utente: spiegare perché un login o una richiesta di recupero
    sono falliti aiuterebbe un attaccante a fare enumeration, vietata
    da quei requisiti. Lo stato "avviato/in corso" si applica comunque.
  - Il completamento del reset password (dopo aver cliccato il link
    ricevuto via email) non è soggetto a questa eccezione — a
    quel punto l'utente ha già dimostrato di controllare l'account — e
    mostra il dettaglio tecnico sugli errori generici.
- Il successo non genera notifiche aggiuntive oltre all'effetto visibile
  dell'azione: è già la conferma richiesta dallo scenario "done", ed
  evita di essere invasivi (vedi Note di implementazione).

## Note di implementazione
- Niente barra di avanzamento globale in un footer (una delle opzioni
  suggerite nella bozza del requisito): il requisito stesso chiede di
  privilegiare il cambio di stato dei pulsanti, più semplice da
  implementare in modo affidabile e già sufficiente per "started" e
  "running" su un'app di queste dimensioni.
- `useFormStatus` e `useFormState` sono API di `react-dom` già incluse
  in Next.js 14 (App Router) per le server action — nessuna nuova
  dipendenza.
