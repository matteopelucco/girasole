# Analisi del contesto agentico e dei consumi di token (issue #103)

Analisi **in sola lettura**: nessuna modifica a `.claude/`, `.githooks/`,
`CLAUDE.md` o al codice. Le modifiche concrete diventeranno issue separate
dopo le decisioni di Matteo (sezione finale).

Convenzione: ogni numero è marcato **[misurato]** (osservato da comandi o da
una run reale), **[stimato]** (calcolato, es. token ≈ caratteri / 4, che per
testo italiano e codice è approssimato, scarto plausibile ±30 %) o
**[ipotesi]** (da verificare). L'usage dell'app non è accessibile da questa
analisi: nessun consumo oltre ai dati già forniti dalla run reale.

## 1. Inventario del contesto

Dimensioni **[misurato]** in caratteri, token **[stimato]** = caratteri / 4.

| Risorsa | Caratteri | Token | Quando entra in contesto |
|---|---:|---:|---|
| `CLAUDE.md` | 4.249 | ~1,1k | **sempre**, a ogni sessione (orchestratore e sub-agenti) |
| `.claude/agents/triage.md` (haiku) | 2.811 | ~0,7k | solo se l'agente viene invocato |
| `.claude/agents/implementer.md` (sonnet) | 2.345 | ~0,6k | idem |
| `.claude/agents/reviewer.md` (sonnet) | 2.119 | ~0,5k | idem (in CI e in `/task-review`) |
| `.claude/agents/rls-guardian.md` (opus) | 2.068 | ~0,5k | idem, solo PR su RLS/auth/migration |
| `.claude/commands/run-tasks.md` | 15.196 | **~3,8k** | a ogni invocazione di `/run-tasks`, poi resta nel contesto per tutta la sessione |
| `.claude/commands/task-review.md` | 5.417 | ~1,4k | a ogni `/task-review` |
| `.claude/commands/next-task.md` | 1.260 | ~0,3k | a ogni `/next-task` |
| `docs/sviluppo-dettagli.md` | 35.565 | ~8,9k | **a richiesta** (CLAUDE.md dice di leggere la sezione pertinente); 11 sezioni, nessuna lettura parziale garantita |
| `specs/*.md` (28 file, somma) | 284.534 | ~71k | a richiesta, un file per task: tipico 5-15 KB (~1-4k token), massimo `18 - report-ore-lavoro` 36 KB (~9k) |
| `docs/tasks-archivio.md` | 237.195 | ~59k | mai, per regola testuale (ripetuta in 4 punti) |
| `docs/programma-attivita.md` | 35.687 | ~8,9k | mai, per regola testuale |
| `docs/flusso-remoto.md`, `docs/adr/*` | 10.850 + 22.542 | ~2,7k + ~5,6k | a richiesta |
| `.githooks/pre-push` | 3.089 | ~0,8k | **non entra in contesto**: viene eseguito, entra solo l'output |

Osservazioni:
- Il "contesto fisso" è piccolo: `CLAUDE.md` + un agente ≈ 1,6-1,8k token
  **[stimato]**. Il lavoro di snellimento di A32 ha già fatto il grosso.
- `run-tasks.md` è l'unico file grande caricato **sempre** e per intero
  dall'orchestratore; è un terzo del peso di tutto `.claude/`. Ma ~3,8k token
  **[stimato]** sono pochi rispetto al contesto dell'orchestratore: il costo
  vero è che resta in contesto (e viene riletto ad ogni turno) per l'intera
  sessione multi-task **[ipotesi]**: l'impatto sul limite dipende da come
  l'app conteggia le letture da cache, non misurabile qui.
- Le uniche difese contro la lettura di `tasks-archivio.md` (59k token
  **[stimato]**, il rischio singolo più grosso) sono frasi in prosa. Non c'è
  `permissions.deny` né `.claudeignore`; `.claude/settings.local.json` ha solo
  `allow` ed è locale.
- Il lavoro di contesto dei sub-agenti non pesa sull'orchestratore (finestra
  separata) ma pesa sul **limite di piano**: è la voce principale (sez. 2).

## 2. Dove si spendono i token

Dati **[misurati]** da una run reale `/run-tasks`:

| Voce | Misura |
|---|---|
| implementer, task piccolo di tooling (#102) | ~36k token, 17 tool call |
| implementer, task e2e (#228) | ~115k token, 46 tool call |
| orchestratore | ~2-8 punti % della finestra 5 h per task, ~1 punto % del limite settimanale per task |

Rapporto: ~2,2-2,5k token per tool call nei due task **[stimato]**. Una parte
rilevante è quindi la **somma dei risultati dei tool** riletti a ogni turno,
non le istruzioni statiche (che sono ~0,6k + `CLAUDE.md`).

Ripartizione per operazione, con le misure fatte per questa analisi
(**[misurato]** su GitHub il 2026-10-04):

| Operazione | Cosa pesa | Stato |
|---|---|---|
| Lettura board (`/run-tasks` Fase 2) | `gh project item-list 2 --limit 200 --format json` restituisce **633.014 caratteri (~158k token [stimato])** per 200 item, di cui 181 `Done`; l'output è pieno dei `body` delle issue. Filtrato con `--jq` sui soli campi utili (numero, titolo, status, label) pesa **~4 KB (~1k token)**: 150 volte meno | il comando non prescrive filtri: se l'orchestratore ingerisce l'output grezzo, è la singola voce più cara **[ipotesi]**: l'app può troncare l'output del tool o il modello può filtrarlo da sé, non verificabile da qui |
| Lettura board: **difetto** | `--limit 200` ma la board ha 217 item **[misurato]**: i 4 `Todo` in posizione ≥ 200 (#221, #229, #230, #232) **non sono mai visti** dall'orchestratore | bug, non solo costo |
| Lettura issue/commenti | le 9 issue `Todo` misurate pesano 0,8-2,5 KB (~0,2-0,6k token) con `gh issue view --comments` | basso: non vale ottimizzare |
| Triage (haiku) | contesto ~1,8k token fissi + `CLAUDE.md`/spec; già economico | basso |
| Implementer | 36k-115k token a task: esplorazione, spec (fino a ~9k), output dei check | **voce principale** insieme alla board |
| Check locali | `tsc`/`lint`/`vitest` in verde stampano poche righe; `next build` stampa la tabella delle route (decine di righe); `playwright` con reporter `list` stampa una riga per test (242 test nel repo **[misurato]**) | **[ipotesi]**: output lunghi solo sui fallimenti; il reporter locale non è `line`/`dot` |
| Review (reviewer / rls-guardian) | in CI max 20 turni (Sonnet), riepilogo token già nel job summary (#119); `rls-guardian` è Opus ma solo su richiesta | già presidiato; costo Opus raro per costruzione |
| Attesa CI | un solo `gh pr checks --watch` in background, nessun polling | già ottimo |
| Ciclo di fix su CI rossa | max 2 giri, `--log-failed` ultime righe | già limitato |
| Report finale, pre-flight, ricalcolo budget | una chiamata `get_usage` dopo ogni task | basso/medio, accumulato su più task |

## 3. Raccomandazioni

Ogni voce: cosa/dove · risparmio · rischio · sforzo. Tutte da trasformare in
issue separate solo dopo la decisione di Matteo.

**R1. Filtrare la lettura della board (`run-tasks.md` Fase 2) e correggere il `--limit`.**
Prescrivere `gh project item-list 2 --owner matteopelucco --limit 500 --format json --jq '[.items|to_entries[]|select(.value.status=="Todo" and .value.content.type=="Issue")|{pos:.key, n:.value.content.number, t:.value.title, l:.value.labels}]'`
(la posizione si calcola prima del filtro, come richiede la regola
sull'ordine). *Risparmio*: **alto** se oggi entra l'output grezzo (633 KB →
~4 KB **[misurato]**), nullo altrimenti **[ipotesi]**; in ogni caso corregge il
difetto dei 4 item invisibili. *Rischio*: bassissimo (stessi dati, meno
rumore). *Sforzo*: basso, una riga.

**R2. Script deterministico per la selezione (`scripts/seleziona-task.mts` + chiamata da `run-tasks.md`).**
Il filtro di Fase 2 (scarto per status/label/PR collegata/dipendenze, bug
`posizione − 5`, ordinamento stabile) è pura logica: oggi è prosa ragionata
dal modello a ogni ciclo (Fase 2 ~ 0,9k token di istruzioni). Uno script
(testabile con vitest in `lib/`, secondo l'ADR 0004) stampa la tabella del
`--dry-run`. *Risparmio*: **medio** (meno ragionamento e meno istruzioni,
risultato riproducibile). *Rischio*: basso; il codice va tenuto allineato con
la regola scritta, e "Dipende da #X" richiede di interpretare testo libero
(resta al modello). *Sforzo*: medio. Dipende da R1.

**R3. Spezzare `run-tasks.md` in nucleo + dettagli a richiesta.**
Nucleo (Fasi 0-1-2, regole dure, ~6 KB) sempre letto; 3.2 scomposizione, 3.5
rebase/CI e Fase 4 report in `docs/` o in un secondo file letto solo quando
scattano (rebase, CI rossa, scomposizione). *Risparmio*: **medio-basso**
(~2k token **[stimato]** per invocazione, moltiplicati per i turni
dell'orchestratore se le letture da cache pesano **[ipotesi]**). *Rischio*:
**medio**: le regole dure e le soglie di sicurezza devono restare nel nucleo,
altrimenti l'orchestratore le salta se non carica il dettaglio. *Sforzo*:
medio. Conviene solo dopo R1/R2, che riducono il testo da sé.

**R4. Calcolo del budget in uno script o in poche righe fisse.**
La Fase 1 (formule `n_budget`, stime prudenti, ricalcolo dopo ogni task) può
diventare una tabella di soglie + una formula in una riga; il ragionamento
resta, ma più corto. *Risparmio*: **basso-medio**. *Rischio*: basso, a patto
di non toccare i valori delle soglie (80 % / 85 % / 60 %). *Sforzo*: basso.

**R5. Output dei check troncato e reporter compatto.**
Nell'implementer (e in `run-tasks.md` 3.3) chiedere
`npx playwright test --reporter=line` (o `dot`) e `... 2>&1 | tail -40` per
tsc/lint/build, con rilettura completa solo se c'è un errore. *Risparmio*:
**medio**, dove l'output è lungo **[ipotesi]**: va misurato su un task e2e
(es. #228). *Rischio*: **medio-basso**: un `tail` può tagliare la riga che
spiega l'errore; meglio `grep -E "error|✘|failed" ` più coda, non solo coda.
*Sforzo*: basso.

**R6. Deny esplicito per i file da non leggere (`.claude/settings.json`, versionato).**
`permissions.deny` su `Read(docs/tasks-archivio.md)` e
`Read(docs/programma-attivita.md)`.
Sostituisce 4 frasi in prosa con una regola che non si dimentica.
*Risparmio*: **basso in media** (finora la regola testuale sembra
rispettata **[ipotesi]**), ma elimina il caso peggiore (~59k token). *Rischio*:
basso; le sessioni che hanno davvero bisogno dell'archivio devono togliere la
regola a mano. *Sforzo*: basso. Richiede però di toccare `.claude/`, quindi
decisione umana.

**R7. Rebase banale e bump di versione con uno script.**
Oggi 3.5 descrive a parole il rebase con conflitto sul solo campo `version`.
Uno `scripts/rebase-pr.sh` che fa fetch, rebase, in caso di conflitto solo
su `package*.json` tiene `main` e rifà `npm version patch --no-git-tag-version`,
poi `push --force-with-lease`. *Risparmio*: **basso-medio** per ciclo in
cui capita (frequente: bump di versione identico in due PR). *Rischio*:
**medio**: operazioni distruttive su branch; vanno limitate alla branch della
PR e abortire a ogni altro conflitto. *Sforzo*: medio.

**R8. Indice delle sezioni di `sviluppo-dettagli.md` in `CLAUDE.md`.**
Il file (~8,9k token) si legge intero se l'agente non sa quale sezione serve.
Una riga per sezione con numero di riga (o spezzarlo in file per tema)
permette `Read` con `offset/limit`. *Risparmio*: **basso-medio**, solo nei
task che lo toccano. *Rischio*: basso, ma `CLAUDE.md` è sempre in contesto e
non va fatto crescere; meglio spezzare il file che indicizzarlo. *Sforzo*:
medio.

**R9. Modello per agente.** Oggi: triage `haiku`, implementer e reviewer
`sonnet`, rls-guardian `opus` (solo richiesta). Potenziale: implementer
`haiku` per i task `tier:haiku` (copy, fix di 1-2 righe), scegliendo il
modello per issue invece che per agente. *Risparmio*: **medio** su pochi
task, **basso** sul totale (la maggioranza è `tier:sonnet`). *Rischio*:
**medio**: un modello debole sbaglia più spesso, e un giro di fix costa più
del risparmio. *Sforzo*: basso, ma richiede di toccare agente/command.

### Tabella riassuntiva (ordinata per risparmio / rischio)

| # | Raccomandazione | Dove | Risparmio | Rischio | Sforzo |
|---|---|---|---|---|---|
| R1 | `--jq` mirato e `--limit` corretto sulla board | `run-tasks.md` Fase 2 | alto (se oggi grezzo) | molto basso | basso |
| R6 | `permissions.deny` per archivio e programma | `.claude/settings.json` | basso (evita il caso peggiore) | basso | basso |
| R5 | `--reporter=line` e output check filtrato | implementer, `run-tasks.md` 3.3 | medio | medio-basso | basso |
| R4 | Budget: formula fissa e soglie in tabella | `run-tasks.md` Fase 1 | basso-medio | basso | basso |
| R2 | Script di selezione/ordinamento dei task | `scripts/`, `run-tasks.md` | medio | basso | medio |
| R8 | Spezzare/indicizzare `sviluppo-dettagli.md` | `docs/`, `CLAUDE.md` | basso-medio | basso | medio |
| R7 | Script per rebase con conflitto sul solo `version` | `scripts/`, `run-tasks.md` 3.5 | basso-medio | medio | medio |
| R3 | `run-tasks.md` in nucleo + dettagli a richiesta | `.claude/commands/` | medio-basso | medio | medio |
| R9 | Modello per issue (haiku sui `tier:haiku`) | agenti/command | basso sul totale | medio | basso |

### Cosa NON conviene toccare

- **RLS, auth, migrazioni**: l'escalation a `rls-guardian` (Opus) e la regola
  "qualsiasi PR che arriva alla 3.4 diventa `human-in-the-loop`". Il costo
  Opus è raro per costruzione; un errore espone dati di minori su repo
  pubblico.
- **Soglie di budget** (80 / 85 / 60 %), regola "mai `--admin`", "mai merge di
  `human-in-the-loop`", "un task alla volta" (DB di test condiviso).
- **Review `reviewer` in CI** e CI completa: già limitate da `--max-turns` e
  job summary dei token (#119); abbassare i turni ha già prodotto job rossi
  (storia in `claude-board.yml`).
- **Hook `pre-push`**: gira fuori contesto, il suo costo in token è solo
  l'output; non è un candidato.
- **Triage su Haiku**: è già il modello più economico.
- **Lettura di issue e commenti**: 0,2-0,6k token per issue **[misurato]**, non
  vale lo sforzo né il rischio di perdere informazioni.

## 4. Decisioni che servono a Matteo

Nell'issue non ci sono risposte alle domande di triage: il **target di
risparmio non è definito**. Tre obiettivi tra cui scegliere:

1. **Correttezza e potatura a costo zero**: fare solo R1, R4, R6 (una riga o
   due ciascuna, rischio minimo) e fermarsi. Misura: punti % della finestra
   5 h per task con `get_usage` prima/dopo, su 3 task simili (ripetuti,
   perché la granularità è 1 % e altre sessioni consumano in parallelo).
2. **Dimezzare il costo dell'orchestratore**: R1-R4 (con R3 opzionale; meno istruzioni e
   meno ragionamento). Obiettivo: orchestratore da 2-8 a ~1-4 punti % per
   task. Misura: stessa di (1), registrando punti % consumati dalla sola
   sessione orchestratrice e confrontando con la baseline misurata qui.
3. **Ridurre il costo dell'implementer del ~30 %** (da ~36k/115k a ~25k/80k
   token per task piccolo/e2e): R5, R8 e disciplina di esplorazione. Misura:
   token totali e numero di tool call del sub-agente (riportati
   dall'app a fine task) su due task di riferimento (tipo #102 e #228).

Domande puntuali:
- Qual è il vero collo di bottiglia: finestra 5 h, limite settimanale, o la
  quota mensile? Cambia l'obiettivo (le raccomandazioni R1-R4 riducono
  soprattutto la 5 h per ciclo).
- Si può chiedere all'orchestratore di annotare, a fine task, il delta
  `get_usage` per fase (selezione, implementer, CI) per avere una baseline
  migliore del dato aggregato?
- Si autorizza a toccare `.claude/` (R1, R3, R4, R6) e a introdurre un
  `.claude/settings.json` versionato? Per ora `.claude/` è escluso da questa
  analisi e dalla PR.
- Priorità tra correttezza (i 4 item oltre `--limit 200` oggi non vengono mai
  visti) e risparmio: R1 risolve entrambi e si può anticipare come fix
  separato.

Limiti dell'analisi: nessun accesso all'usage dell'app, nessun conteggio di
token reale (stime a caratteri), non verificato se l'orchestratore filtra la
board da sé né quale reporter Playwright usi l'implementer in pratica; il
contenuto di `/owasp-check` (issue #102) non è ancora su `main` e non è
misurato, ma una volta mergiato aggiungerà un file letto dall'implementer a
ogni task.
