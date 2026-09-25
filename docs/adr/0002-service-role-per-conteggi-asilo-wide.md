# ADR-0002 — `service_role` key per conteggi/azioni che attraversano tutte le sezioni

- Stato: Accettata
- Data: 2026-08-22 (creazione utenti), estesa il 2026-08-26 (conteggio
  pasti Rojac)

## Contesto
La RLS filtra per sezione: una maestra vede via `authenticated` solo le
proprie sezioni. Alcune funzionalità richiedono invece un dato
sull'intero asilo, non filtrabile per ruolo dell'utente che le invoca:
- la creazione/eliminazione di un utente in `auth.users` (solo l'API
  admin di Supabase può farlo, `lib/supabase/admin.ts`,
  specs/03 - utenti-e-ruoli.md);
- il conteggio dei pasti "sì" su tutti i bambini attivi dell'asilo per
  la comunicazione a Rojac (`lib/pastiRojac.ts`,
  `contaPastiSiOggiTuttoAsilo`), che deve coprire tutte le sezioni anche
  quando l'azione è avviata da una singola maestra;
- il cron notturno che compone il report aggregato (nessuna sessione
  utente attiva da cui ereditare i permessi).

## Decisione
Usare `createAdminClient()` (client Supabase con la `service_role key`,
che bypassa la RLS) solo lato server, dentro `'use server'`, per queste
azioni asilo-wide specifiche — mai per servire dati filtrati per ruolo
che la RLS già gestisce correttamente. L'autorizzazione a invocare
quell'azione (es. solo un ruolo che può inviare la comunicazione pasti)
resta responsabilità del codice applicativo che precede la chiamata, non
della RLS.

## Conseguenze
- Positive: evita di dover esprimere in RLS un'eccezione ad hoc
  ("questo ruolo vede tutte le sezioni solo per questo conteggio"), che
  indebolirebbe la policy per tutti gli altri usi.
- Negative: ogni nuovo uso di `createAdminClient()` sposta il confine di
  sicurezza dal database al codice applicativo — un bug nel controllo a
  monte (es. dimenticare di verificare il ruolo prima di chiamarlo)
  bypassa la RLS senza che il database se ne accorga. Per questo la
  service_role key non deve mai raggiungere il client (vedi
  `.env.example`, CLAUDE.md "Repo pubblico: sicurezza") e ogni nuovo uso
  va giustificato esplicitamente in un commento nel codice, come già
  fatto in `lib/supabase/admin.ts` e `lib/pastiRojac.ts`.
- La motivazione puntuale di ciascun uso resta nel commento accanto al
  `createAdminClient()` corrispondente, non duplicata qui.
