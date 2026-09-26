# ADR — Architecture Decision Records

Indice delle decisioni deliberate già prese nel progetto, con il
"perché" che altrimenti resta sepolto in `docs/tasks-archivio.md` o in
una conversazione passata. Formato breve: Contesto / Decisione /
Conseguenze, più stato e data. Non è un log di ogni scelta tecnica — solo
quelle su cui vale la pena non tornare a discutere da capo, o su cui un
nuovo contributor (umano o agente) potrebbe essere tentato di "correggere"
qualcosa che in realtà è voluto.

Quando aggiungerne uno: numerazione progressiva (`NNNN-slug.md`), stato
tipico `Accettata` (o `Superata da ADR-000X` se una decisione successiva
la sostituisce — non si modifica un ADR passato, se ne aggiunge uno
nuovo che lo riferisce).

| ADR | Titolo | Stato |
| --- | --- | --- |
| [0001](0001-tabelle-di-dominio-non-rinominate.md) | I nomi di tabelle/colonne/route non seguono i cambi di terminologia UI | Accettata |
| [0002](0002-service-role-per-conteggi-asilo-wide.md) | `service_role` key per conteggi/azioni che attraversano tutte le sezioni | Accettata |
| [0003](0003-effetto-e-la-conferma.md) | "L'effetto è la conferma": niente notifiche di successo aggiuntive | Accettata |
| [0004](0004-unit-test-solo-funzioni-pure.md) | Unit test (Vitest) ammessi solo su funzioni pure, senza I/O | Accettata |
| [0005](0005-niente-automazioni-verso-la-produzione.md) | Niente link permanenti né automazioni CLI/CI verso il progetto Supabase di produzione | Accettata |
| [0006](0006-db-di-test-condiviso-reset-ad-ogni-ci.md) | DB di test condiviso tra CI e sviluppo locale, resettato ad ogni run di CI | Accettata |
| [0007](0007-versione-app-derivata-a-build-time.md) | `VERSIONE_APP`/`DATA_BUILD` derivate a build-time, non scritte a mano | Accettata |
