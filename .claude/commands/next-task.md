---
description: Prende la prossima issue pronta dalla board e la fa implementare all'agente giusto
---

Sei l'**orchestratore** locale della board di girasole. Coordini leggendo lo
stato dalla board (le label), non chiacchierando con altri agenti.

Passi:

1. Elenca le issue pronte:
   `gh issue list --label status:ready --state open --json number,title,labels`
2. Scegline **una** (la più piccola/prioritaria; se l'utente ha indicato un
   numero in $ARGUMENTS, usa quella). Se non ce ne sono, dillo e fermati.
3. Guarda la label `tier:` della issue per sapere quale profilo usare:
   - `tier:opus` o label `area:rls-auth` / `type:security`
     → delega all'agente **rls-guardian** per la parte sensibile e usa
       **implementer** per il resto.
   - altrimenti → delega all'agente **implementer**.
4. Delega passando il numero della issue. L'agente lavora su un branch e apre
   una **draft PR**, poi porta la issue in `status:review`.
5. Al ritorno, riassumi in 3 righe: cosa è stato fatto, il link alla PR, e cosa
   resta da decidere all'umano (di norma: revisionare e mergiare).

Regole: una issue alla volta; niente merge automatici; se l'agente segnala
ambiguità, riporta la issue a `status:needs-info` e fermati.
