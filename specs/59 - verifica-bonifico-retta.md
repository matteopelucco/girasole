# 59 — Verifica del bonifico di una retta

## Attori
Admin.

## Obiettivo
Dopo aver inviato la comunicazione retta di un bambino (specs/56), la
famiglia esegue il bonifico corrispondente. Questo requisito copre la
verifica rapida, da parte dell'admin, che il bonifico ricevuto sul
conto corrente corrisponda all'importo comunicato: se sì, si marca
come corretto; se l'importo ricevuto è diverso, si registra l'importo
realmente ricevuto e una nota, e la differenza viene automaticamente
aggiunta come credito o debito (specs/58) sulla retta di un mese scelto
dall'admin (di norma la prossima). Si basa su
[56 - comunicazione-retta-mensile.md](56%20-%20comunicazione-retta-mensile.md)
e [58 - crediti-debiti-bambino.md](58%20-%20crediti-debiti-bambino.md).

## Scenario: una comunicazione appena inviata è in attesa di verifica
Dato che ho appena inviato (o sto rivedendo) una comunicazione retta
Quando guardo la sua riga in "Rette"
Allora vedo, sotto "Inviata il...", lo stato del bonifico "Bonifico da
verificare" con due azioni: "Bonifico corretto" e "Importo diverso"

## Scenario: marcare un bonifico come corretto
Dato che sono su una comunicazione con bonifico da verificare
Quando premo "Bonifico corretto" e confermo
Allora lo stato diventa "Bonifico ricevuto (importo corretto)", con
data e chi ha verificato, e nessun credito/debito viene generato

## Scenario: marcare un bonifico con importo diverso da quello atteso
Dato che sono su una comunicazione con bonifico da verificare, il cui
totale comunicato è un certo importo
Quando premo "Importo diverso", scrivo l'importo realmente ricevuto,
una nota obbligatoria che ne spiega il motivo, scelgo il mese su cui
conteggiare la differenza (precompilato con il mese successivo a
quello della comunicazione, modificabile) e confermo
Allora lo stato diventa "Bonifico ricevuto (importo diverso)", con
l'importo ricevuto, l'importo atteso, la nota, data e chi ha
verificato
E viene creato un nuovo credito/debito (specs/58) su quel bambino, con
quella nota, per il mese scelto, pari alla differenza tra atteso e
ricevuto: se ha pagato meno del dovuto, un debito (verrà addebitato
sulla prossima retta); se ha pagato più del dovuto, un credito (verrà
scalato dalla prossima retta)

## Scenario: la nota è obbligatoria per un importo diverso
Dato che sto marcando un bonifico con importo diverso da quello atteso
Quando provo a confermare senza aver scritto una nota
Allora vedo un errore e non viene registrato nulla

## Scenario: un bonifico già verificato non è più modificabile
Dato che il bonifico di una comunicazione è già stato marcato (corretto
o con importo diverso)
Quando guardo la sua riga
Allora vedo solo lo stato registrato, senza più le azioni "Bonifico
corretto"/"Importo diverso" — per correggere un errore di
verifica bisogna prima annullare l'invio della comunicazione (specs/56;
se era stato generato un credito/debito, resta comunque sulla scheda
del bambino, vedi Regole)

## Scenario: verificare il bonifico anche su un mese passato
Dato che sto rivedendo un mese passato in "Rette" (specs/56, sola
lettura per invio/annullo)
Quando guardo una comunicazione con bonifico ancora da verificare
Allora trovo comunque "Bonifico corretto"/"Importo diverso" attivi —
verificare un bonifico non è "inviare" né "annullare" una
comunicazione, resta possibile su qualunque mese passato, perché il
bonifico spesso arriva settimane dopo l'invio

## Regole
- `comunicazioni_retta` (specs/56) guadagna le colonne di verifica
  bonifico
  (`supabase/migrations/0043_bonifico_comunicazione_retta.sql`):
  `bonifico_stato text not null default 'in_attesa'` (`in_attesa` /
  `corretto` / `importo_errato`), `bonifico_importo_ricevuto
  numeric(10,2)`, `bonifico_nota text`, `bonifico_verificato_da uuid`,
  `bonifico_verificato_da_nome text`, `bonifico_verificato_il
  timestamptz`. Ogni comunicazione nasce `in_attesa`; solo un admin può
  farla transitare a `corretto` o `importo_errato` (mai il contrario,
  stessa immutabilità di `comunicazioni_retta`, specs/56).
- "Bonifico corretto": imposta `bonifico_stato = 'corretto'`,
  `bonifico_importo_ricevuto` = `comunicazioni_retta.totale`,
  `bonifico_nota = null`, verificato da/il. Nessuna riga in
  `crediti_debiti_bambini` (specs/58) viene creata.
- "Importo diverso": richiede `bonifico_importo_ricevuto` (numero) e
  `bonifico_nota` (obbligatoria); calcola `differenza = totale
  comunicato − importo ricevuto` (positiva se ha pagato meno, negativa
  se ha pagato più) e crea un credito/debito (specs/58) con
  `bambino_id`, `mese_competenza` = mese scelto dall'admin (min: il
  mese corrente), `importo = differenza` (coerente con la convenzione
  di specs/58: positivo = debito, negativo = credito), `nota =
  bonifico_nota`, `origine = 'bonifico'`. Se `differenza` è zero
  (importo ricevuto uguale al totale nonostante l'admin abbia scelto
  "Importo diverso" invece di "Bonifico corretto"), non viene creato
  nessun credito/debito: si registra comunque lo stato
  `importo_errato` con la nota scritta, per tracciare il motivo per cui
  l'admin ha comunque voluto lasciare una nota invece di marcarlo
  "corretto".
- Mese proposto di default per il credito/debito: il mese successivo a
  quello della comunicazione (`lib/date.ts`, `meseSuccessivo`) — un
  suggerimento modificabile (specs/58, stesso pattern di "prossima
  retta utile"), non un vincolo: l'admin può scegliere qualunque mese
  dal corrente in poi. Se in quel mese il bambino ha già un
  credito/debito "da conteggiare" (indice unico di specs/58), il
  salvataggio fallisce con un errore che invita l'admin a scegliere un
  altro mese o a intervenire prima su quello esistente.
- Annullare l'invio di una comunicazione (specs/56, "Annulla invio")
  elimina la riga di `comunicazioni_retta`, quindi anche il suo stato
  di verifica bonifico (le colonne vivono sulla stessa riga): non c'è
  più nulla da "riportare in attesa" per quella specifica riga. Un
  eventuale credito/debito generato da "Importo diverso" resta invece
  intatto (vive come riga indipendente in `crediti_debiti_bambini`, con
  il proprio mese di competenza, spesso diverso da quello annullato):
  fuori scope in questa fase collegarlo automaticamente all'annullo
  della comunicazione originale — è una situazione limite da correggere
  a mano (modificare o eliminare quel credito/debito dalla scheda del
  bambino, se ancora "da conteggiare").
- Solo un profilo `admin` può leggere/scrivere lo stato di verifica
  bonifico — stessa `requireAdmin` di specs/56, nessuna nuova policy
  RLS necessaria (le colonne vivono su `comunicazioni_retta`, già
  protetta).
- Nessun collegamento con un vero servizio bancario: la verifica resta
  manuale, l'admin guarda l'estratto conto reale e marca di conseguenza
  — coerente con l'obiettivo generale del progetto (fuori scope
  qualunque integrazione con l'home banking).
- Fuori scope in questa fase: promemoria/allarmi per bonifici non
  ancora verificati dopo N giorni (specs/07 resta sui casi già
  previsti), rendicontazione/esportazione dei bonifici verificati,
  gestione di bonifici parziali multipli per la stessa comunicazione
  (un solo bonifico per comunicazione, un solo importo ricevuto).
