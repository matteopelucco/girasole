---
description: Controllo OWASP (Top 10 per web app con database) sul diff della branch corrente contro main, prima di aprire la PR; sola lettura, esito OK / DA CORREGGERE
argument-hint: "[base]   es. main (default)"
---

Sei il **controllo di sicurezza OWASP** di girasole: l'`implementer` lo esegue
sul proprio lavoro **prima di aprire la PR**, `rls-guardian` lo usa come
checklist nella review di sicurezza, e si può lanciare a mano. Il repo è
**pubblico** e la sicurezza reale sta nelle policy RLS di Supabase, non nella
segretezza del codice.

Argomenti: `$ARGUMENTS` (opzionale: branch base; default `main`).

## Regole dure
- **Sola lettura**: nessun commit, nessuna modifica ai file, nessun `git
  checkout`/`stash`, nessuna scrittura su GitHub, nessun accesso a Supabase
  né alla produzione. Il report resta in chat (o nel corpo della PR a cura
  di chi ti invoca).
- Analizza **solo il diff** della branch corrente contro la base, non il
  repo intero. Un problema preesistente fuori dal diff non è un rilievo di
  questa PR (puoi citarlo come nota, senza farlo pesare sull'esito).
- Non leggere `docs/tasks-archivio.md` né `docs/programma-attivita.md`.
- Non stampare mai valori di secret trovati: cita file e riga e basta.

## 1. Raccogli il diff
- Base: `git fetch origin <base> --quiet` (se fallisce, usa la base locale e
  dillo), poi `git diff origin/<base>...HEAD --name-only` e
  `git diff origin/<base>...HEAD` (tre punti: solo i commit della branch).
- Includi anche le modifiche non ancora committate: `git status --short` e
  `git diff HEAD`, e i file nuovi non tracciati (`git ls-files --others
  --exclude-standard`, che `git diff` non mostra: leggili per intero). Se il
  diff è vuoto, scrivi "nessuna modifica da
  controllare" ed esci con `OK`.
- Leggi `CLAUDE.md` (sezioni Convenzioni e "Repo pubblico"). Apri il file
  `specs/` pertinente **solo** se il diff tocca ruoli, visibilità o policy
  (`specs/03 - utenti-e-ruoli.md` per i confini admin / maestra / genitore).
  Se il diff è solo documentazione o tooling senza codice né SQL, molte
  categorie sono "non applicabili": dillo in una riga, non inventare rilievi.

## 2. Checklist (una riga di esito per categoria)
Per ogni categoria rispondi alla domanda sul diff: `ok`, `n/a` (con motivo in
poche parole) o un rilievo con `file:riga`.

1. **A01 · Controllo degli accessi e RLS** — Ogni nuova query, Server Action o
   route rispetta i confini di ruolo (admin / maestra / genitore) di `specs/`?
   La Server Action verifica il ruolo lato server (`requireUser`,
   `requireProfilo`, `requireAdmin`, `requireStaff` di `lib/auth.ts`) invece di
   fidarsi di ciò che arriva dal client (id, ruolo, `sezione_id`)? Una nuova
   tabella ha RLS abilitato con policy per ogni operazione (`USING` e `WITH
   CHECK`), e la prima UPDATE/DELETE su una tabella ha policy e `GRANT`
   corrispondenti? Nessun `USING (true)` involontario, nessun dato di
   altri bambini/sezioni nelle risposte? (Migration, policy o auth toccati:
   serve comunque `rls-guardian`.)
2. **A03 · Iniezione (SQL, XSS)** — Nessuna query composta concatenando input
   (si usano il query builder di supabase-js / RPC con parametri)? Niente SQL
   dinamico in `EXECUTE` o in funzioni `SECURITY DEFINER` senza `search_path`
   fissato? Nessun `dangerouslySetInnerHTML` con input utente? I valori
   interpolati in HTML di email/report passano da `escapeHtml`
   (`lib/htmlEscape.ts`)? Input di form validato/normalizzato lato server?
3. **A07 · Autenticazione e sessioni** — Nessun flusso di login, recupero
   password, cookie o `middleware.ts` indebolito o aggirato? Le route
   pubbliche nuove sono davvero da esporre? Gli endpoint cron usano
   `autorizzaCron` (`lib/auth.ts`)? Le password rispettano `lib/password.ts`?
4. **A02/A05 · Secret e `service_role`** — Nessuna chiave, token, password o
   URL con credenziali nel codice, nei commenti, nei test, nei workflow o
   nelle fixture? `createAdminClient` / `SUPABASE_SERVICE_ROLE_KEY` compaiono
   solo nei file ammessi da ADR-0002 (`scripts/service-role-check.mts`, che
   gira già in `npm run lint`)? Nessun segreto con prefisso `NEXT_PUBLIC_`,
   nessuna `service_role` in codice client (`'use client'`)? Nessun dato reale
   di bambini o genitori, nemmeno come fixture?
5. **A05 · Configurazione errata ed esposizione di errori** — Gli errori
   restituiti al client sono messaggi generici in italiano, senza stack trace,
   query, id interni o dati di minori? Nuove variabili d'ambiente senza default
   insicuri? Header, CORS, `next.config`, `supabase/config.toml` e workflow
   (`permissions`, secret passati a step non fidati) non allentati? Una nuova
   migration usa l'intestazione standard di `docs/sviluppo-dettagli.md` e non
   cita il SQL Editor né l'applicazione automatica in produzione?
6. **A06 · Componenti vulnerabili** — Il diff aggiunge o aggiorna dipendenze
   (`package.json`, `package-lock.json`, `uses:` nei workflow)? Se sì: era
   autorizzato (nessuna nuova dipendenza senza chiederlo) e `npm audit
   --omit=dev` non segnala vulnerabilità **high/critical nuove** rispetto a
   prima? Lancia `npm audit --omit=dev` solo se il diff tocca le dipendenze;
   altrimenti `n/a`. Un fallimento di rete di `npm audit` non è un esito `OK`:
   riportalo come "non verificato".
7. **A09 · Logging e monitoraggio** — I `console.*`/log nuovi non contengono
   dati personali di minori o genitori, email, token o payload completi? Le
   operazioni sensibili (cancellazione utenti, reset, cambi di ruolo) lasciano
   la traccia prevista dalle spec invece di fallire in silenzio?

## 3. Esito (sempre presente, ultima riga del report)
Riporta in italiano, breve:

```
Esito OWASP: OK
```
oppure
```
Esito OWASP: DA CORREGGERE
- path/file.ts:riga — problema (categoria) → correzione minima
```

- `DA CORREGGERE` se c'è almeno un rilievo concreto, cioè un rischio
  verificabile nel diff: un punto sospetto ma non dimostrabile va nel
  report come "da chiarire", e conta come `DA CORREGGERE` solo se riguarda
  RLS, secret o auth.
- `OK` solo se nessuna categoria ha un rilievo. Le categorie `n/a` e le
  parti **non verificate** (es. `npm audit` offline, RLS non testata contro il
  DB) vanno elencate sotto la riga dell'esito in "Non verificato"; se la parte
  non verificata è l'unica difesa di un rischio reale, l'esito non è `OK`.
- Dopo `DA CORREGGERE` chi ha invocato il controllo **corregge e lo
  rilancia** finché l'esito è `OK`; questo comando non corregge nulla da solo.
