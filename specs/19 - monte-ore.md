# 19 — Monte ore

## Attori
Personale abilitato al report ore (vede il proprio saldo e il calcolo
mese per mese, in sola lettura). Admin (vede il saldo e il calcolo di
chiunque e **gestisce il monte ore a mano**: inserisce, modifica ed
elimina i movimenti).

## Obiettivo
Estende [18 - report-ore-lavoro.md](18%20-%20report-ore-lavoro.md) e
[54 - profili-orari.md](54%20-%20profili-orari.md): un contatore di ore
per persona ("monte ore") la cui **gestione è completamente manuale**.
Il saldo è la somma dei movimenti registrati dall'admin: **nessun
calcolo automatico lo modifica**, nemmeno alla conferma di una settimana
(che serve solo a bloccare la modifica autonoma delle ore da parte del
personale, vedi [18]).

**Convenzione del segno (unica, in tutta l'app e nei PDF).** Il saldo e i
movimenti sono sempre espressi in ore **con il segno esplicito**:
- **positivo (+)** = ore che il dipendente **ha già erogato** in più, cioè
  ore **a credito**;
- **negativo (−)** = ore che il dipendente **deve ancora erogare**, cioè
  ore **da recuperare**;
- **zero** = **in pari**.

È lo stesso significato della "Differenza ore" di [18] (erogate − previste:
+5h = 5 ore fatte in più). Sono ore di lavoro, non importi: nulla a che
vedere con il credito/debito economico delle rette ([58]). Le etichette
dicono sempre il significato, non solo il segno: "+3h a credito (ore già
erogate in più)", "−3h da recuperare (ore ancora da erogare)", "0h in pari"
(`descrizioneSaldoMonteOre`, `lib/monteOre.ts`).

Accanto al saldo, la scheda ore di ogni persona mostra sempre il
**calcolo completo, mese per mese**: ore previste dal profilo orario,
differenza (ore fatte in più o in meno rispetto al previsto) e
movimenti manuali del mese, con il saldo progressivo. Il calcolo è
informativo: serve all'admin per decidere i movimenti, non li genera.

**Nota storica**: fino a una versione precedente di questo requisito il
monte ore era aggiornato in automatico alla conferma di ogni settimana
(prima con lo straordinario residuo in attesa di decisione dell'admin,
poi "a netto pieno"). I movimenti già registrati (`settimanale` e
`straordinario_residuo`) restano nello storico e continuano a contare
nel saldo, ma ora l'admin può modificarli o eliminarli come gli altri.

## Scenario: la conferma della settimana non tocca il monte ore
Dato che confermo (o l'admin conferma per me) una settimana di ore di
lavoro (vedi [18 - report-ore-lavoro.md](18%20-%20report-ore-lavoro.md))
Quando la conferma va a buon fine
Allora la settimana risulta confermata e non più modificabile dal
personale
E nessun movimento di monte ore viene registrato: il saldo resta
identico a prima della conferma
E non compare alcuna anteprima dell'effetto sul monte ore

## Scenario: il personale vede il proprio monte ore
Dato che sono personale abilitato al report ore
Quando apro "Ore di lavoro"
Allora vedo il mio saldo attuale di monte ore, in sola lettura, e il
calcolo mese per mese
E non vedo alcun modo per modificarlo: solo l'admin può farlo

## Scenario: la scheda ore mostra il calcolo completo mese per mese
Dato che apro "Ore di lavoro" (la mia, o quella di un dipendente come
admin)
Allora vedo una tabella "Calcolo mese per mese" con, per ogni mese dal
primo con ore o movimenti fino a quello corrente: ore previste,
differenza ore (con segno, sui soli giorni lavorativi già trascorsi),
movimenti manuali del mese (somma delle variazioni) e saldo di monte ore
a fine mese
E i giorni Chiusura, Ferie, malattia e assenza non entrano nel calcolo
E il calcolo è sempre quello completo: non dipende dalla settimana
mostrata

## Scenario: l'admin vede il monte ore di ciascuna persona
Dato che sono autenticato come admin
Quando apro l'elenco del personale abilitato al report ore
(`/admin/ore-lavoro`)
Allora vedo, per ciascuna persona, il saldo attuale di monte ore accanto
al nome

## Scenario: l'admin registra un movimento manuale di monte ore
Dato che sono sulle ore di un dipendente (`/dashboard/ore-lavoro?utente=<id>`)
Quando scelgo il verso — "Il dipendente ha erogato ore in più (+)" oppure
"Il dipendente deve ancora erogare ore (−)" — indico un numero di ore e una
nota, e confermo
Allora viene registrato un movimento manuale con quella variazione (con
segno) e quella nota
E il saldo mostrato si aggiorna di conseguenza
E vedo lo storico dei movimenti di quella persona, dal più recente

## Scenario: un movimento manuale senza nota viene rifiutato
Dato che sono sulle ore di un dipendente, come admin
Quando tento di registrare un movimento manuale senza indicare una nota
Allora vedo un messaggio d'errore che la richiede
E nessun movimento viene registrato

## Scenario: l'admin modifica un movimento di monte ore
Dato che sono sulle ore di un dipendente come admin, e lo storico
mostra un movimento (manuale, o storico automatico)
Quando premo "Modifica" sulla sua riga, cambio le ore, il verso
(+ a credito / − da recuperare) o la nota, e confermo
Allora il movimento riporta i nuovi valori, mantenendo la data di
registrazione
E il saldo mostrato si aggiorna di conseguenza
E una nota vuota viene rifiutata con un messaggio, senza modificare nulla

## Scenario: l'admin elimina un movimento di monte ore
Dato che sono sulle ore di un dipendente come admin, e lo storico
mostra un movimento
Quando premo "Elimina" sulla sua riga e confermo
Allora il movimento sparisce dallo storico
E il saldo mostrato si aggiorna di conseguenza (non lo conta più nella
somma)

## Scenario: solo l'admin gestisce i movimenti
Dato che sono personale non admin
Allora nella mia scheda non trovo nessun modo di inserire, modificare o
eliminare un movimento di monte ore
E la RLS rifiuta comunque qualunque scrittura su `monte_ore_movimenti`
che non venga da un admin

## Scenario: il monte ore può risultare negativo
Dato che l'admin registra movimenti che portano il saldo sotto zero
Allora il saldo può scendere sotto zero, senza alcun blocco: rappresenta
ore che il dipendente deve ancora erogare ("da recuperare")

## Scenario: il saldo del monte ore nei report
Dato che il cron invia il riepilogo settimanale (email giornaliera) o che
l'admin scarica il PDF mensile delle ore (del personale o di un
dipendente)
Allora per ogni dipendente riportano il saldo attuale del monte ore, con
la convenzione del segno di questa pagina e la sua legenda (vedi
[52 - report-email-automatico.md](52%20-%20report-email-automatico.md)):
movimenti e calcolo mese per mese restano nella pagina "Ore di lavoro"

## Settimane storiche con straordinario residuo
Solo per le settimane confermate prima del calcolo "a netto pieno", con
uno straordinario residuo ancora senza decisione (nessuna nuova conferma
può più generarne): restano gestibili come prima.

### Scenario: lo straordinario residuo storico richiede una decisione dell'admin
Dato che una settimana, confermata prima del calcolo a netto pieno, ha
uno straordinario residuo maggiore di zero (non ancora deciso)
Quando il diretto interessato apre "Ore di lavoro" su quella settimana
Allora vede un avviso che indica le ore di straordinario residuo e che
sono in attesa di una decisione dell'admin, senza alcun modo di
deciderlo lui stesso
E quando l'admin apre la stessa settimana (dalla propria vista o da
`/dashboard/ore-lavoro?utente=<id>`) vede lo stesso avviso, con due
pulsanti per decidere: "Metti a pagamento mensile" e "Aggiungi al monte
ore"

### Scenario: l'admin mette lo straordinario residuo storico a pagamento mensile
Dato che l'admin è su una di queste settimane storiche, con straordinario
residuo non ancora deciso
Quando preme "Metti a pagamento mensile"
Allora la decisione viene registrata (con data/ora e chi l'ha presa)
E il monte ore di quella persona NON cambia (lo straordinario è
considerato pagato fuori da quest'app, in busta paga)
E l'avviso in sola lettura per il diretto interessato mostra da quel
momento la decisione presa, non più i pulsanti

### Scenario: l'admin aggiunge lo straordinario residuo storico al monte ore
Dato che l'admin è su una di queste settimane storiche, con straordinario
residuo non ancora deciso
Quando preme "Aggiungi al monte ore (a credito)"
Allora la decisione viene registrata (con data/ora e chi l'ha presa)
E viene registrato un movimento di monte ore per quella settimana,
positivo, pari allo straordinario residuo (ore già erogate, a credito)
E l'avviso in sola lettura per il diretto interessato mostra da quel
momento la decisione presa, non più i pulsanti

## Regole
- Tabella `monte_ore_movimenti`: ogni riga è un movimento, di tre tipi —
  `precarico` (inserito a mano dall'admin, **il solo tipo che si
  registra da ora**, nota sempre obbligatoria e non vuota),
  `settimanale` e `straordinario_residuo` (solo storico, non più
  generati da nessuna azione).
- Il saldo attuale di una persona è la somma di tutte le sue
  `variazione`: nessun campo separato da tenere sincronizzato a mano.
- Convenzione di segno di `variazione`: **positiva** = ore a credito (già
  erogate in più); **negativa** = ore da recuperare (ancora da erogare),
  come descritto in Obiettivo. Ha lo stesso segno della differenza ore del
  calcolo mensile (ore fatte in più = differenza positiva), che l'admin può
  riflettere con un movimento positivo. Nessuna migration: i movimenti
  inseriti a mano dall'admin seguono già questa convenzione; quelli storici
  generati dal vecchio calcolo automatico (segno opposto) sono stati rimossi a
  mano, e comunque ora l'admin può correggerli o eliminarli dalla scheda.
- Il calcolo mese per mese (`lib/monteOre.ts`,
  `calcoloMensileMonteOre`) usa le stesse funzioni pure della vista
  mensile di [18] (`lib/oreLavoroMese.ts`): per ogni mese, previste e
  differenza dei giorni lavorativi già trascorsi; i movimenti sono
  attribuiti al mese della loro data di registrazione. Nessuna nuova
  colonna: non è un dato salvato, si ricalcola a ogni apertura.
- L'admin può inserire, modificare (ore, verso, nota) ed eliminare
  qualunque movimento, di ogni tipo, anche storico: la gestione è
  manuale. La modifica mantiene `created_at`. Il controllo applicativo
  è nelle server action; la RLS
  (`supabase/migrations/0055_monte_ore_manuale.sql`) è la difesa
  primaria: insert, update e delete solo per l'admin (nessun utente non
  admin può più inserire movimenti, nemmeno `settimanale` su di sé).
- Il saldo è visibile al diretto interessato (sola lettura) e all'admin;
  nessun altro ruolo vi accede (RLS in
  `supabase/migrations/0031_monte_ore.sql`).
- I dati del controllo di ciascuna settimana confermata (ore dovute, ore
  ordinarie/straordinarie erogate, e — solo per lo storico —
  l'eventuale straordinario residuo con la decisione dell'admin) sono
  colonne di `ore_lavoro_settimane`, calcolate una sola volta alla
  conferma; ogni nuova conferma scrive `straordinario_residuo = 0`.
- Il riepilogo ore della settimana corrente nel corpo dell'email
  giornaliera e il PDF mensile delle ore del personale, entrambi con il
  saldo del monte ore, sono descritti in
  [52 - report-email-automatico.md](52%20-%20report-email-automatico.md).

## Fuori scope in questa fase
- Tracciare il pagamento mensile dello straordinario (importo, busta
  paga, avvenuto pagamento): fuori dall'app.
- Notifiche o soglie di allarme legate al valore del monte ore.
- Compensazione automatica del monte ore con permessi/ferie.
- Un pannello di storico/export dedicato oltre a quanto già mostrato
  nella pagina "Ore di lavoro" e nei PDF.

  Le voci sopra sono backlog: issue
  [#91](https://github.com/matteopelucco/girasole/issues/91).
