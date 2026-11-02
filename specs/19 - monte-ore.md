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
personale, vedi [18]). Anche la "conferma del mese" è un gesto
dell'admin (un pulsante), mai automatico.

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

## Conferma del mese e mese di competenza
Ogni movimento ha due date distinte: il **giorno reale di registrazione**
(`created_at`, non cambia mai) e il **mese di competenza**, cioè il mese a
cui le ore appartengono nel "Calcolo mese per mese". Per i movimenti
esistenti al rilascio il mese di competenza è il mese della loro data di
registrazione (fuso orario dell'app), quindi nessun saldo cambia. L'admin
può confermare con un pulsante la differenza ore di un mese **già chiuso**
(non quello in corso): nasce un movimento di tipo "conferma mese" con
competenza quel mese, anche se registrato in un mese successivo.

Definizioni usate negli scenari:
- **Mese chiuso**: un mese precedente a quello corrente.
- **Differenza del mese**: quella già mostrata nella riga (erogate −
  previste, sui giorni lavorativi, arrotondata a 2 decimali).
- **Parte non confermata** = differenza del mese − somma delle `variazione`
  di **tutti** i movimenti (di qualunque tipo) con competenza quel mese,
  arrotondata a 2 decimali. Il segno è quello del monte ore: positiva = ore
  a credito ancora da riconoscere, negativa = ore da recuperare ancora da
  riconoscere. Il pulsante compare solo se è diversa da zero (a 0,00 no).

### Scenario: MOR-01 — l'admin vede "Conferma" su un mese chiuso con differenza
Dato che sono admin sulle ore di un dipendente e il mese di ottobre è
chiuso, con differenza +14,5h e nessun movimento con competenza ottobre
Quando guardo la riga di ottobre del "Calcolo mese per mese"
Allora la riga mostra il pulsante "Conferma" (con l'indicazione "+14,5h a
credito") e la colonna movimenti dice 0h

### Scenario: MOR-02 — la conferma crea un movimento nel mese giusto
Dato la riga di ottobre di MOR-01, aperta a novembre
Quando premo "Conferma"
Allora viene registrato un movimento di tipo "conferma mese" di +14,5h, con
competenza ottobre, data reale di oggi e nota automatica non vuota
("Conferma differenza ore di ottobre 2026")
E la colonna movimenti di ottobre mostra +14,5h, il saldo a fine ottobre e
quelli dei mesi successivi crescono di 14,5h e il saldo attuale cresce di
14,5h
E il pulsante sparisce dalla riga
E nello storico il movimento mostra la data reale e "(competenza ottobre
2026)"

### Scenario: MOR-03 — conferma di una differenza negativa
Dato un mese chiuso con differenza −6h e nessun movimento di competenza
Quando premo "Conferma"
Allora viene registrato un movimento di −6h (ore da recuperare) con
competenza quel mese, e la riga e i saldi si aggiornano come in MOR-02
E la nota e l'etichetta dicono "da recuperare", non solo il segno

### Scenario: MOR-04 — dove il pulsante non compare
Dato che apro la scheda ore di un dipendente
Allora non vedo "Conferma" quando: sono personale non admin (vedo la
tabella in sola lettura); il mese è quello in corso o futuro; la parte non
confermata è zero (differenza zero, oppure già coperta dai movimenti di
quel mese)
E anche l'azione di conferma, invocata a mano da un non admin o su un mese
non chiuso, viene rifiutata senza registrare nulla

### Scenario: MOR-05 — la conferma si gestisce come ogni movimento
Dato un movimento "conferma mese" nello storico, come admin
Quando premo "Modifica" e cambio ore, verso, nota o mese di competenza,
oppure premo "Elimina" e confermo
Allora il movimento riporta i nuovi valori mantenendo la data reale, o
sparisce, e la tabella e i saldi si ricalcolano
E se l'ho eliminato, il pulsante "Conferma" riappare sulla riga di quel
mese (con la parte non confermata che ne risulta)
E se il nuovo mese di competenza ha già una conferma della stessa persona,
vedo un messaggio d'errore e nulla viene modificato

### Scenario: MOR-06 — doppio click o due admin insieme: una sola conferma
Dato la riga di MOR-01 mostrata a due admin, o premuta due volte di seguito
Quando le richieste di conferma arrivano quasi insieme
Allora esiste una sola conferma per quella persona e quel mese, con
variazione pari alla parte non confermata calcolata una volta sola
E la richiesta in più non dà errore tecnico: mostra "Mese già confermato" e
la riga si aggiorna senza pulsante
E il valore da registrare lo calcola sempre il server al momento della
richiesta, non quello mostrato nel browser

### Scenario: MOR-07 — la differenza cambia dopo la conferma
Dato un mese confermato per +14,5h e poi corretto (per esempio ore
aggiunte) in modo che la differenza diventi +16,5h
Quando apro la scheda come admin
Allora la riga mostra "+2h non confermate" con il pulsante "Conferma la
differenza residua" (e il saldo di quel mese non nasconde la differenza)
E premendolo, la variazione dell'unica conferma di quel mese diventa
+16,5h (si somma la parte non confermata: resta una sola conferma per
persona e mese) e il pulsante sparisce
E se la differenza scende (per esempio a +12h) la riga mostra "−2,5h non
confermate" con lo stesso pulsante, che porta la conferma a +12h

### Scenario: MOR-08 — spostare un movimento esistente al mese giusto
Dato un movimento manuale di +14,5h registrato il 02/11, con competenza
novembre (mese della registrazione), e ottobre con differenza +14,5h
Quando premo "Modifica", scelgo come mese di competenza ottobre 2026 e
confermo
Allora il movimento conta in ottobre (colonna movimenti e saldi di fine
mese ricalcolati), la data reale resta 02/11 e lo storico mostra
"(competenza ottobre 2026)"
E la riga di ottobre non propone "Conferma" (parte non confermata zero)
E il saldo attuale non cambia
E non si può scegliere un mese di competenza successivo al mese corrente

### Scenario: MOR-09 — i movimenti esistenti non cambiano al rilascio
Dato i movimenti registrati prima di questa funzione
Allora il loro mese di competenza risulta quello della data di
registrazione, il "Calcolo mese per mese" è identico a prima e il saldo
attuale di ogni persona è invariato
E nuovi movimenti manuali hanno nel modulo il campo "Mese di competenza",
preimpostato al mese corrente e modificabile fino al mese corrente

### Scenario: MOR-10 — report ed email restano coerenti
Dato che esistono movimenti "conferma mese"
Allora il saldo attuale nell'email e nel PDF (vedi
[52 - report-email-automatico.md](52%20-%20report-email-automatico.md))
include anche questi movimenti, con la stessa convenzione di segno, e non
distingue il mese di competenza

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
- Tabella `monte_ore_movimenti`: ogni riga è un movimento, di quattro tipi —
  `precarico` (inserito a mano dall'admin, nota sempre obbligatoria e non
  vuota), `conferma_mese` (creato dal pulsante "Conferma" di un mese
  chiuso, vedi sopra; nota automatica non vuota, senza `settimana_inizio`),
  `settimanale` e `straordinario_residuo` (solo storico, non più
  generati da nessuna azione). Da ora si registrano solo `precarico` e
  `conferma_mese`.
- Nuova colonna `mese_competenza` (primo giorno del mese; vuota per i
  movimenti esistenti, che valgono il mese di `created_at` nel fuso orario
  dell'app). Un indice unico (`utente_id`, `mese_competenza`) sui soli
  `conferma_mese` impedisce due conferme per persona e mese anche con
  richieste simultanee; la conferma ha sempre il mese di competenza valorizzato.
- Arrotondamenti: `variazione` è a 2 decimali (mezze ore e centesimi di
  ora esatti, es. 14,5); differenza del mese, parte non confermata e saldi
  sono arrotondati a 2 decimali con lo stesso criterio di `lib/monteOre.ts`,
  e il segno non si perde (niente "−0": zero è "0h in pari").
- Il pulsante "Conferma" è per l'admin su mesi chiusi con parte non
  confermata ≠ 0; la parte da registrare la ricalcola il server a ogni
  richiesta; se esiste già una conferma di quel mese, la parte si somma
  alla sua variazione (una sola conferma per persona e mese).
- RLS: insert/update/delete su `monte_ore_movimenti` restano solo admin
  (nessuna nuova policy per altri ruoli); la migration che aggiunge colonna
  e tipo mantiene i GRANT esistenti (`select` a `authenticated` e
  `service_role`, `insert/update/delete` a `authenticated`) senza ampliarli.
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
  attribuiti al loro **mese di competenza**, con fallback al mese della
  data di registrazione quando non è valorizzato. Il calcolo non è un dato
  salvato, si ricalcola a ogni apertura; il saldo a fine mese è la somma
  progressiva per competenza e il saldo attuale resta la somma di tutte le
  `variazione`, indipendente dalla competenza.
- L'admin può inserire, modificare (ore, verso, nota) ed eliminare
  qualunque movimento, di ogni tipo, anche storico: la gestione è
  manuale. La modifica (ore, verso, nota, mese di competenza) mantiene
  `created_at`. Il controllo applicativo
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
