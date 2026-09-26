# ADR-0005 — Niente link permanenti né automazioni CLI/CI verso il progetto Supabase di produzione

- Stato: Accettata
- Data: 2026-09-23 (A20, init/link Supabase CLI), confermata il
  2026-09-24 (A22/A23, `db push` come unico canale di migration)

## Contesto
L'applicazione delle migration è passata dal SQL Editor della dashboard
Supabase a `supabase db push`/`supabase db reset` via CLI (A22/A23). Il
Supabase CLI supporta un `supabase link` che rende il ref di progetto
implicito per i comandi successivi — comodo, ma pericoloso se il ref
linkato fosse quello di produzione: un comando lanciato per errore (o da
un agente) senza specificare esplicitamente il progetto finirebbe lì.

## Decisione
- Il link CLI (`supabase link`) resta solo sul progetto di **test**; mai
  un link permanente verso il ref di produzione.
- In locale, ogni comando verso il progetto di test usa
  `--project-ref <ref-test>` esplicito e incrementale, mai un link
  implicito su cui contare a occhi chiusi.
- In produzione, l'applicazione di una migration resta **manuale e
  deliberata, solo Matteo**, con `--project-ref <ref-produzione>`
  esplicito sul singolo comando dopo il merge — mai un'automazione
  CI/agente verso la produzione.
- La CI resetta solo il DB di test (`SUPABASE_TEST_PROJECT_REF`, una
  repository variable, non un secret di produzione).

## Conseguenze
- Positive: nessun comando può raggiungere la produzione "per
  disattenzione" (niente stato di link ambiguo); il rischio di un reset
  o di una migration accidentale in produzione è strutturalmente basso,
  non solo una questione di attenzione.
- Negative: ogni rilascio in produzione richiede un passo manuale
  esplicito di Matteo (non automatizzabile in CI/CD per definizione di
  questa decisione) — un costo accettato in cambio della sicurezza.
- Un agente (incluso Claude Code) non deve mai proporre di automatizzare
  questo passo o di creare un link permanente verso il ref di
  produzione, nemmeno per velocizzare un rilascio.
