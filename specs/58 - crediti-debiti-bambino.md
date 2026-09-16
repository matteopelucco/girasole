# 58 — Crediti e debiti di un bambino

## Attori
Admin.

## Obiettivo
Un bambino può avere, per qualunque motivo (una correzione concordata
con la famiglia, un errore su una retta passata, un rimborso), un
credito o un debito economico verso l'asilo che non deriva dal calcolo
automatico della retta (specs/56). Questo requisito copre: la gestione
di questi crediti/debiti dalla scheda del bambino (aggiunta, revisione,
eliminazione finché non applicati) e la loro comparsa automatica, come
voce aggiuntiva, nella comunicazione retta del mese scelto. Si basa su
[55 - costi-bambino.md](55%20-%20costi-bambino.md) e
[56 - comunicazione-retta-mensile.md](56%20-%20comunicazione-retta-mensile.md).
È a sua volta la base di
[59 - verifica-bonifico-retta.md](59%20-%20verifica-bonifico-retta.md)
(un bonifico ricevuto con un importo diverso da quello atteso genera
automaticamente un credito/debito).

## Scenario: aggiungere un credito o un debito dalla scheda del bambino
Dato che sono sulla scheda di un bambino
Quando scelgo "Credito" o "Debito", scrivo un importo (sempre positivo,
il segno lo determina la scelta) e una nota obbligatoria che ne spiega
il motivo, scelgo il mese di competenza (precompilato con la prossima
retta utile, modificabile) e confermo
Allora il nuovo credito/debito compare nell'elenco della scheda, "da
conteggiare" sul mese scelto, con importo, nota e chi/quando l'ha
inserito

## Scenario: la nota è obbligatoria
Dato che sto aggiungendo un credito o un debito
Quando provo a confermare senza aver scritto una nota
Allora vedo un errore e il credito/debito non viene salvato

## Scenario: il mese di competenza è precompilato con la prossima retta utile
Dato che sto aggiungendo un credito o un debito dalla scheda di un
bambino
Quando guardo il campo "Mese di competenza" prima di modificarlo
Allora è già valorizzato con il mese successivo a quello corrente (la
prossima comunicazione retta non ancora inviata, nell'uso tipico) — un
suggerimento, non un vincolo: resta modificabile su qualunque mese, dal
corrente in poi

## Scenario: un credito o debito non ancora applicato può essere eliminato
Dato che sulla scheda del bambino c'è un credito/debito "da
conteggiare" (non ancora confluito in nessuna comunicazione)
Quando premo "Elimina" sulla sua riga e confermo
Allora sparisce dall'elenco e non comparirà nella comunicazione del suo
mese di competenza

## Scenario: un credito o debito già applicato non è più modificabile né eliminabile
Dato che sulla scheda del bambino c'è un credito/debito già confluito
in una comunicazione inviata (vedi sotto)
Quando guardo la sua riga
Allora non trovo alcun pulsante "Elimina": è uno storico immutabile,
coerente con `comunicazioni_retta` (specs/56); per correggerlo bisogna
prima annullare l'invio della comunicazione in cui è confluito (specs/56,
"annullare l'invio di una comunicazione"), che lo fa tornare "da
conteggiare"

## Scenario: il credito/debito compare nella tabella di revisione del mese di competenza
Dato che un bambino ha un credito/debito "da conteggiare" con mese di
competenza uguale al mese corrente
Quando apro "Rette" (specs/56)
Allora vedo, sulla riga di quel bambino, una singola colonna
"Credito/Debito" con l'importo (negativo se credito, positivo se
debito) e, sotto, in corpo più piccolo, la nota scritta sulla scheda —
testo di sola lettura, a differenza delle altre voci di quella riga
(specs/56, "modificare manualmente una voce di costo prima
dell'invio"): per correggerlo bisogna intervenire sulla scheda del
bambino (sopra), non da questa tabella
E il totale calcolato per quella riga lo include

## Scenario: un bambino senza nessun credito/debito da conteggiare questo mese
Dato che un bambino non ha nessun credito/debito "da conteggiare" con
mese di competenza uguale al mese corrente
Quando guardo la sua riga in "Rette"
Allora la colonna "Credito/Debito" mostra "0,00" e nessuna nota, di
sola lettura come quando invece un credito/debito c'è

## Scenario: inviare la comunicazione applica il credito/debito
Dato che ho controllato (ed eventualmente corretto) l'importo del
credito/debito in tabella per il mese corrente
Quando invio la comunicazione (massiva o singola, specs/56)
Allora l'importo e la nota effettivamente presenti nel form vengono
registrati nella comunicazione (`comunicazioni_retta.credito_debito` e
`.nota_credito_debito`) — non ricalcolati
E il credito/debito originale sulla scheda del bambino passa da "da
conteggiare" a "conteggiato nella retta di {{mese}}", e non è più
modificabile né eliminabile

## Scenario: annullare l'invio di una comunicazione libera di nuovo il credito/debito
Dato che una comunicazione include un credito/debito già applicato
Quando premo "Annulla invio" su quella comunicazione (specs/56)
Allora il credito/debito torna "da conteggiare" sullo stesso mese, di
nuovo modificabile/eliminabile dalla scheda del bambino, e tornerà a
proporsi nella tabella di revisione se si riapre quel mese

## Scenario: il placeholder del credito/debito nella mail
Dato che sono su "Modello email" (specs/56)
Quando guardo i placeholder disponibili
Allora trovo `{{credito_debito}}` (l'importo, formattato in euro come
gli altri) e `{{nota_credito_debito}}` (testo libero, stringa vuota se
non c'è nessun credito/debito quel mese) — stesso pattern di
`{{costi_extra}}`/`{{note_costi_extra}}`

## Regole
- Nuova tabella `crediti_debiti_bambini`
  (`supabase/migrations/0041_crediti_debiti_bambini.sql`): un record per
  ogni credito/debito inserito, con `bambino_id`, `mese_competenza`
  ("YYYY-MM", stessa convenzione di `lib/date.ts`), `importo` (segno:
  negativo = credito, cioè riduce il totale della retta, come già
  `conguaglio_pasti` in specs/56; positivo = debito, lo aumenta), `nota`
  (obbligatoria, mai vuota), `origine` (`manuale` se inserita
  dall'admin dalla scheda del bambino, `bonifico` se generata
  automaticamente da specs/59), chi e quando l'ha creata,
  `applicato_il` (null finché "da conteggiare", valorizzato quando la
  comunicazione del suo mese di competenza viene inviata). Non esiste
  un riferimento diretto alla comunicazione: uno stesso bambino non può
  avere più di un credito/debito "da conteggiare" per lo stesso mese di
  competenza (indice unico parziale su `bambino_id, mese_competenza`
  dove `applicato_il is null`) — se l'admin prova ad aggiungerne un
  secondo sullo stesso mese ancora libero, vede un errore che lo invita
  a modificare o eliminare quello già presente, oppure a scegliere un
  altro mese.
- Solo un profilo `admin` può leggere, creare, modificare (solo per
  "applicare"/"liberare", mai a mano) ed eliminare (solo se
  `applicato_il is null`) righe di `crediti_debiti_bambini` — stesse
  policy RLS di `costi_bambini` (specs/55).
- "Prossima retta utile" (valore precompilato del mese di competenza,
  sia per l'aggiunta manuale sia per specs/59): il mese successivo a
  quello corrente (`lib/date.ts`, `meseSuccessivo`) calcolato rispetto
  al riferimento del contesto — "oggi" per un'aggiunta manuale dalla
  scheda del bambino, il mese della comunicazione per una differenza
  rilevata su un bonifico (specs/59). È solo un suggerimento: il campo
  resta un mese libero (`<input type="month">`), l'admin può scegliere
  qualunque mese dal corrente in poi.
- Nella tabella "Rette" (specs/56), l'importo e la nota del
  credito/debito "da conteggiare" per quel bambino e quel mese (zero/
  vuoto se non c'è) condividono un'unica colonna "Credito/Debito"
  (importo, nota sotto in corpo più piccolo), per non allargare
  ulteriormente una tabella già densa di colonne — a differenza di
  "Costi extra"/"Nota" questa voce NON è modificabile da questa
  tabella: per correggerla bisogna intervenire sulla scheda del bambino
  (modificare/eliminare il credito/debito "da conteggiare" e
  aggiungerne uno nuovo, vedi sopra) prima di inviare la comunicazione.
  Il valore effettivamente comunicato è sempre quello letto da
  `crediti_debiti_bambini` al momento dell'invio (non arriva più dal
  form, che non lo contiene). Il totale della riga include comunque
  questa voce (retta + costo pasti + conguaglio pasti + marca da bollo
  + costo pre-asilo + costo post-asilo + costi extra + credito/debito).
- "Applicare" un credito/debito (all'invio) e "liberarlo" (all'annullo)
  sono le uniche due transizioni possibili su `applicato_il`, sempre
  effettuate dal server insieme, nella stessa azione, all'inserimento o
  all'eliminazione della riga di `comunicazioni_retta` corrispondente
  (mai un passo separato che l'admin deve ricordarsi di fare).
- `comunicazioni_retta` (specs/56) guadagna due colonne,
  `credito_debito numeric(10,2) not null default 0` e
  `nota_credito_debito text`
  (`supabase/migrations/0042_credito_debito_comunicazione_retta.sql`):
  stesso significato "importo effettivamente comunicato, immutabile"
  delle altre colonne di quella tabella.
- Placeholder mail: `{{credito_debito}}` e `{{nota_credito_debito}}`,
  aggiunti all'elenco di specs/56 — un modello salvato prima
  dell'introduzione di questi due placeholder resta valido così com'è,
  vanno aggiunti a mano in "Modello email" se si vogliono vedere nel
  testo (il totale li include comunque).
- Un credito/debito "da conteggiare" il cui mese di competenza non è
  ancora quello mostrato in "Rette" (es. inserito per il mese
  successivo) non compare in nessuna colonna finché non si arriva a
  quel mese — non c'è una vista d'insieme di "tutti i crediti/debiti in
  attesa di tutti i bambini" in questa fase (vedi Fuori scope).
- Fuori scope in questa fase: più di un credito/debito "da conteggiare"
  sullo stesso bambino e mese contemporaneamente (vedi indice unico
  sopra — bisogna modificare o eliminare quello esistente), una vista
  d'archivio/riepilogo di tutti i crediti/debiti (di tutti i bambini o
  di un bambino) indipendente dalla scheda del singolo bambino,
  notifiche al genitore quando viene inserito un credito/debito (lo
  scopre dalla prossima comunicazione retta).
