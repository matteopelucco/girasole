# ADR-0006 — DB di test condiviso tra CI e sviluppo locale, resettato ad ogni run di CI

- Stato: Accettata
- Data: 2026-09-24 (A22/A23)

## Contesto
La suite e2e (Playwright) scrive dati veri (presenze, pasti, promemoria,
sezioni, bambini, ruoli) contro un progetto Supabase di test,
`girasole_dev`. Per partire da uno stato noto ad ogni run, la CI esegue
`supabase db reset --project-ref <ref-test>` prima della suite e2e:
riapplica tutte le migration da zero e poi `supabase/seed.sql`. Questo
stesso progetto `girasole_dev` è anche quello usato da Matteo in
sviluppo locale (`.env.local`), non un progetto isolato dedicato alla
CI — creare un secondo progetto Supabase di test avrebbe un costo/
complessità aggiuntivi (secret duplicati, deriva tra i due schemi) non
ritenuti necessari per un'app di queste dimensioni.

## Decisione
Il DB di test resta unico e condiviso tra CI e sviluppo locale. Matteo
accetta esplicitamente che ogni run di CI su una PR cancelli e ricrei
anche i suoi eventuali dati inseriti a mano in locale (incluso
`auth.users`, ricreato da `scripts/crea-utenti-e2e.mjs` con le
credenziali `E2E_<RUOLO>_EMAIL/PASSWORD`). Nessun progetto isolato per
la CI.

## Conseguenze
- Positive: un solo progetto Supabase di test da mantenere/pagare/
  configurare; schema e seed sempre allineati tra locale e CI (nessuna
  deriva tra due copie).
- Negative: un run di CI su una PR altrui può cancellare dati di test
  che Matteo aveva inserito a mano in locale in quel momento — accettato
  come compromesso deliberato, non una regressione da segnalare.
- Se in futuro più persone sviluppano in parallelo, questa decisione
  andrebbe rivista (rischio di reset che si sovrappongono a sessioni di
  lavoro locale altrui) — non è il caso oggi con un solo sviluppatore.
