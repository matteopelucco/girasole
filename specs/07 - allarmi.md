# 07 — Allarmi

## Attori
Maestra, assistente, admin (ciascuno vede il proprio allarme personale).
L'admin vede in più un riepilogo read-only degli allarmi di tutto il
personale. Nessun utente umano avvia i controlli: un job pianificato
(Vercel Cron) valuta anche la situazione a livello di intero asilo e
invia le email, come in
[52 - report-email-automatico.md](52%20-%20report-email-automatico.md).
Destinatario delle email: una casella email dello staff (di default
`info@asilosartorio.it`, stessa variabile d'ambiente
`REPORT_EMAIL_DESTINATARIO` di specs/52), non un utente dell'app.
L'allarme "rette non comunicate" (vedi sotto) riguarda solo l'admin.

## Obiettivo
Segnalare tempestivamente, a chi può ancora agire, due situazioni
anomale che altrimenti passerebbero inosservate finché qualcuno non se
ne accorge da solo: presenze/pasti dimenticati durante la giornata, e
una settimana di ore di lavoro non confermata dal personale. Ogni
allarme ha due canali: un banner in dashboard (finché la situazione
resta anomala) e l'email di riepilogo dei controlli, inviata dal job una
volta al giorno se c'è almeno un controllo da sistemare. In più, la campanella in alto a destra e la pagina "Allarmi"
(`/dashboard/allarmi`) raccolgono in un punto solo gli allarmi attivi di
chi guarda; i banner in dashboard restano.

## Scenario: presenze o pasti non ancora segnati dopo le 10:00 — banner personale
Dato che sono autenticata come maestra, assistente o admin
E oggi è un giorno attivo (non chiuso, vedi
[53 - calendario-scolastico.md](53%20-%20calendario-scolastico.md))
E sono le 10:00 (fuso Europe/Rome) o più tardi
E almeno un bambino attivo di una delle mie sezioni (tutte le sezioni
attive, se sono admin) non ha ancora una presenza segnata per oggi,
oppure (per maestra e admin, non per l'assistente — vedi
[14 - segna-pasto.md](14%20-%20segna-pasto.md)) i pasti di oggi non sono
ancora stati comunicati a Rojac (vedi
[16 - comunicazione-pasti-rojac.md](16%20-%20comunicazione-pasti-rojac.md))
Quando apro la dashboard
Allora vedo un banner di allarme che elenca cosa manca, con un link per
ciascuna mia sezione che ha ancora presenze da segnare (mi porta a
"Presenze e pasti" per oggi, `/dashboard/giornata?data=<oggi>`, dove i
bambini di tutte le mie sezioni sono raggruppati per sezione) e, se
manca anche la comunicazione pasti, un link alla stessa schermata
posizionato sul box di comunicazione a Rojac
(`/dashboard/giornata?data=<oggi>#comunicazione-rojac`)
E questo banner riguarda solo le mie sezioni: una maestra di un'altra
sezione, senza anomalie nelle proprie, non lo vede

## Scenario: nessun banner personale se tutto è a posto, non è ancora l'orario, o il giorno è chiuso
Quando apro la dashboard prima delle 10:00, oppure dopo le 10:00 ma con
le presenze di tutti i bambini delle mie sezioni già segnate e (per
maestra/admin) i pasti già comunicati, oppure in un giorno di chiusura
scolastica, oppure non ho ancora nessuna sezione assegnata
Allora non vedo il banner presenze/pasti

## Scenario: email di riepilogo dei controlli — un'unica email al giorno
Dato che il job pianificato gira dopo le 10:00 (fuso Europe/Rome)
E almeno uno dei controlli ha esito "da sistemare" (vedi Regole)
Quando il job gira
Allora viene inviata una sola email di riepilogo all'indirizzo configurato
E il corpo riporta SEMPRE tutti i controlli, anche quelli a posto: per
ciascuno il nome, l'ora in cui è stato fatto, lo stato ("ok", "da
sistemare", "non applicabile oggi" o "non ancora controllato") e, se è da
sistemare, che cosa manca e l'azione da fare per risolvere
E se il job gira di nuovo lo stesso giorno, l'email non viene inviata
una seconda volta (idempotenza per giorno)
E se l'invio fallisce, l'occorrenza non resta segnata come inviata e un
tentativo successivo può ritentare

## Scenario: email di riepilogo — se tutto è a posto non parte nessuna email
Dato che il job pianificato gira e nessun controllo è "da sistemare"
Quando il job gira
Allora non viene inviata nessuna email

## Scenario: email di riepilogo — appello e pasti solo dopo le 10:00 in un giorno di apertura
Dato che il job gira prima delle 10:00 oppure in un giorno di chiusura
(vedi [53 - calendario-scolastico.md](53%20-%20calendario-scolastico.md))
Quando viene costruito il riepilogo
Allora i controlli "appello" e "pasti a Rojac" compaiono nell'email con
stato "non applicabile oggi" e il motivo (prima delle 10:00, oppure giorno
di chiusura), e non fanno scattare l'email

## Scenario: email di riepilogo — appello incompleto
Dato che dopo le 10:00 di un giorno di apertura almeno un bambino attivo
non ha alcuna presenza, assenza o malattia segnata per oggi
Quando il job gira
Allora il controllo "appello" è "da sistemare" e l'email chiede di
segnare presenze, assenze o malattie di tutti i bambini in "Presenze e
pasti"
E pre-asilo e post-asilo non contano come controllo: sono servizi
facoltativi, e se selezionati generano già una presenza (vedi
[10 - presenze-e-pasti.md](10%20-%20presenze-e-pasti.md))

## Scenario: email di riepilogo — pasti non comunicati a Rojac
Dato che dopo le 10:00 di un giorno di apertura i pasti di oggi non sono
stati comunicati a Rojac (vedi
[16 - comunicazione-pasti-rojac.md](16%20-%20comunicazione-pasti-rojac.md))
Quando il job gira
Allora il controllo "pasti a Rojac" è "da sistemare" e l'email chiede di
comunicarli (può farlo una delle due insegnanti o le assistenti)

## Scenario: email di riepilogo — rette ai genitori non inviate dal giorno 3
Dato che oggi è il giorno 3 del mese o successivo (fuso Europe/Rome)
E almeno un bambino a cui si può comunicare la retta non ha la
comunicazione del mese corrente (stessi bambini e stesse regole
dell'allarme "rette non comunicate")
Quando il job gira
Allora il controllo "rette ai genitori" è "da sistemare", l'email dice
quanti bambini mancano e quali (nome, cognome e sezione) e chiede di
inviarle dalla tabella "Rette"
E prima del giorno 3 lo stesso controllo compare come "non applicabile
oggi" (motivo: prima del giorno 3) e non fa scattare l'email

## Scenario: email di riepilogo — settimane di ore di lavoro da confermare
Dato che, per uno o più utenti abilitati al report ore, la settimana di
riferimento (vedi Regole) non risulta confermata
Quando il job gira
Allora il controllo "ore di lavoro" è "da sistemare" e l'email indica
quale utente e quale settimana, chiedendo di confermarla in "Ore di
lavoro"
E se tutti l'hanno confermata il controllo è "ok"

## Scenario: email di riepilogo — conferma settimana non richiesta per un utente
Dato che un utente abilitato al report ore ha l'opzione "Richiedi conferma
settimana" disattivata (vedi
[03 - utenti-e-ruoli.md](03%20-%20utenti-e-ruoli.md)) e non ha confermato
la settimana di riferimento
Quando il job gira
Allora quell'utente non compare tra quelli "da sistemare" nel controllo
"ore di lavoro"
E se gli altri utenti abilitati hanno confermato, il controllo è "ok"
E l'email (quando parte per altri motivi) riporta nel controllo "ore di
lavoro" una riga "Conferma settimana non richiesta per <nome cognome>:
controllo saltato", anche se il controllo è "ok", così il salto non passa
inosservato
E il solo utente saltato non fa partire l'email: la riga non è un
controllo da sistemare
E con l'opzione attiva (il valore di partenza di tutti) il controllo si
comporta come descritto sopra

## Scenario: la pagina Allarmi segnala i controlli saltati
Dato che sono autenticato come admin
E almeno un utente abilitato al report ore ha l'opzione "Richiedi
conferma settimana" disattivata
Quando apro la pagina "Allarmi"
Allora vedo, in una sezione a parte, una riga "Conferma settimana non
richiesta per <nome cognome>: controllo saltato" per ciascuno di loro
E queste righe non sono allarmi: non contano nel numero della campanella
e non appaiono tra gli allarmi attivi (la frase "Non ci sono allarmi
attivi" resta se non c'è altro)
E maestra e assistente non le vedono

## Scenario: la mia settimana non si controlla se la conferma non è richiesta — nessun banner personale
Dato che sono abilitata al report ore con l'opzione "Richiedi conferma
settimana" disattivata
E la settimana di riferimento non risulta confermata
Quando apro la dashboard
Allora non vedo il banner "settimana non confermata"
E la campanella non conta quell'allarme e la pagina "Allarmi" non lo
elenca
E nel riepilogo del personale dell'admin non compaio per la settimana
non confermata

## Scenario: con la conferma non richiesta posso comunque confermare la settimana
Dato che sono abilitata al report ore con l'opzione "Richiedi conferma
settimana" disattivata
Quando apro "Ore di lavoro" e confermo la settimana
Allora la settimana risulta confermata, come per chiunque
E il report mensile delle ore (vedi
[52 - report-email-automatico.md](52%20-%20report-email-automatico.md))
continua a segnare "da confermare" le mie settimane non confermate: l'opzione
cambia solo gli allarmi

## Scenario: email di riepilogo — la mail mensile dei pasti a Rojac
Quando il job gira
Allora l'email contiene sempre anche la voce "mail mensile dei pasti a
Rojac", con stato "ok" se per ogni mese concluso da controllare risulta
un invio nel registro (specs/61), oppure "da sistemare" con l'elenco dei
mesi senza invio e l'azione da fare (inviarla dal Report mensile)

## Scenario: email di riepilogo — una sola email per ogni mese di mail a Rojac mancante
Dato che la mail mensile a Rojac di un mese concluso non risulta inviata
Quando il job gira per la prima volta dopo l'inizio del mese successivo
Allora parte l'email di riepilogo, anche se tutti gli altri controlli
sono a posto, e il mese mancante vi compare come "da sistemare"
E il mese viene segnato come già avvisato, così nei giorni seguenti quel
mese non fa più partire l'email da solo (il controllo resta "da sistemare"
finché non c'è l'invio, ma senza posta ripetuta)
E se nello stesso giro manca un altro mese, o un altro controllo è da
sistemare, l'email parte comunque una sola volta
E se l'invio dell'email fallisce il mese non resta segnato come avvisato
e un tentativo successivo può ritentare

## Scenario: settimana di ore di lavoro non confermata entro venerdì sera — banner personale
Dato che sono abilitata al report ore (vedi
[17 - ore-di-lavoro.md](17%20-%20ore-di-lavoro.md))
E sono le 18:00 di venerdì (fuso Europe/Rome) o più tardi nella
settimana corrente, e quella settimana non risulta ancora confermata
(vedi [18 - report-ore-lavoro.md](18%20-%20report-ore-lavoro.md))
Quando apro la dashboard
Allora vedo un banner personale che mi avvisa della dimenticanza, con
l'intervallo di date della settimana e un link che apre direttamente
quella settimana in "Ore di lavoro" per confermarla
E questo banner lo vedo solo io, non gli altri membri dello staff: è una
mia dimenticanza, non un problema dell'intero asilo

Esempio: sono le 19:30 di venerdì e non ho ancora confermato le ore
della settimana corrente (quella che include oggi, non ancora finita) →
vedo il banner riferito a questa settimana.

## Scenario: settimana di ore di lavoro non confermata prima di venerdì sera — banner personale sulla settimana precedente
Dato che sono abilitata al report ore
E siamo tra lunedì e venerdì prima delle 18:00 (fuso Europe/Rome), e la
settimana precedente (lunedì-domenica appena conclusa) non risulta
ancora confermata
Quando apro la dashboard
Allora vedo lo stesso banner personale, riferito però alla settimana
precedente

## Scenario: nessun banner "ore" se la settimana di riferimento è già confermata o non sono abilitata
Quando apro la dashboard e la settimana di riferimento (vedi Regole)
risulta già confermata, oppure il mio profilo non è abilitato al report
ore
Allora non vedo il banner "settimana non confermata"

## Scenario: l'admin vede gli allarmi di tutto il personale
Dato che sono autenticato come admin
E almeno un membro del personale (maestra o assistente) ha, in questo
momento, un allarme attivo — presenze/pasti non completati nelle sue
sezioni dopo le 10:00, e/o la sua settimana di riferimento delle ore non
confermata dopo la relativa soglia
Quando apro la dashboard
Allora vedo, oltre al mio eventuale allarme personale, un riepilogo con
una riga per ciascun membro del personale in allarme: nome, cognome e
cosa gli manca (sezioni con presenze da segnare, pasti non comunicati,
e/o settimana ore non confermata con l'intervallo di date)
E questo riepilogo non contiene link né azioni: è solo informativo, non
posso correggere la situazione al posto loro (vedi Regole)

## Scenario: nessun riepilogo per l'admin se nessuno è in allarme
Quando apro la dashboard come admin e nessun membro del personale ha
allarmi attivi in questo momento
Allora non vedo il riepilogo del personale

## Scenario: la campanella mostra il numero degli allarmi attivi
Dato che sono autenticata come maestra, assistente o admin
E ho almeno un allarme attivo (presenze/pasti dopo le 10:00, settimana
ore non confermata, oppure — se sono admin — un membro del personale in
allarme)
Quando apro una qualsiasi pagina dell'app
Allora vedo in alto a destra, nella barra di navigazione, la campanella
con un pallino che contiene il numero degli allarmi attivi
E lo screen reader legge un testo come "3 allarmi" ("1 allarme" se ce n'è
uno solo)
E il numero è uguale al numero di allarmi elencati nella pagina "Allarmi"

## Scenario: la campanella senza allarmi non mostra nessun numero
Dato che sono autenticata come maestra, assistente o admin
E non ho nessun allarme attivo
Quando apro una qualsiasi pagina dell'app
Allora vedo la campanella senza alcun pallino né numero

## Scenario: il genitore non ha la campanella
Dato che sono autenticato come genitore
Quando apro una qualsiasi pagina dell'app
Allora non vedo la campanella
E nessun controllo sugli allarmi viene calcolato per me

## Scenario: la pagina Allarmi elenca cosa non va e come sistemarlo
Dato che ho almeno un allarme attivo
Quando clicco la campanella
Allora si apre la pagina "Allarmi" (`/dashboard/allarmi`)
E per ogni allarme vedo che cosa non va (per esempio "Presenze e pasti di
oggi" con le sezioni da segnare, oppure "Ore di lavoro" con l'intervallo
di date della settimana da confermare)
E ogni allarme mio ha un link per sistemarlo, che porta alla stessa
destinazione del banner in dashboard (Presenze e pasti di oggi, il box di
comunicazione a Rojac, la settimana in Ore di lavoro)

## Scenario: la pagina Allarmi senza allarmi lo dice chiaramente
Dato che non ho nessun allarme attivo
Quando apro la pagina "Allarmi"
Allora leggo che non ci sono allarmi attivi
E non vedo nessun elenco di allarmi

## Scenario: maestra e assistente vedono solo i propri allarmi
Dato che sono autenticata come maestra o assistente
Quando apro la pagina "Allarmi"
Allora vedo solo i miei allarmi: presenze/pasti delle mie sezioni (senza i
pasti se sono assistente) e la mia settimana di ore di lavoro
E non vedo il riepilogo del personale né gli allarmi di altre persone

## Scenario: l'admin vede nella pagina Allarmi anche il personale, in sola lettura
Dato che sono autenticato come admin
E almeno un membro del personale ha un allarme attivo
Quando apro la pagina "Allarmi"
Allora vedo, oltre ai miei allarmi, una riga per ciascun membro del
personale in allarme, con nome, cognome e cosa gli manca (come nel
riepilogo della dashboard)
E queste righe non contengono link né azioni
E ciascuna riga conta come un allarme nel numero della campanella

## Scenario: prima del giorno 3 del mese nessun allarme "rette non comunicate"
Dato che sono autenticato come admin
E oggi è il giorno 1 o 2 del mese (fuso Europe/Rome)
E almeno un bambino a cui si può comunicare la retta non ha ancora la
comunicazione del mese corrente
Quando apro la pagina "Allarmi"
Allora non vedo l'allarme "rette non comunicate" (e la campanella non lo
conta)
E il cron non invia nessuna email per questo allarme

## Scenario: dal giorno 3 del mese, rette non comunicate — allarme per l'admin
Dato che sono autenticato come admin
E oggi è il giorno 3 del mese o un giorno successivo (fuso Europe/Rome)
E il mese corrente non è interamente chiuso (vedi
[53 - calendario-scolastico.md](53%20-%20calendario-scolastico.md))
E almeno un bambino a cui si può comunicare la retta (attivo, con
l'email di promemoria configurata, gli stessi della tabella "Rette",
[56 - comunicazione-retta-mensile.md](56%20-%20comunicazione-retta-mensile.md))
non ha una comunicazione registrata per il mese corrente
Quando apro la pagina "Allarmi"
Allora vedo l'allarme "rette non comunicate", che dice quanti bambini
mancano e quali (nome, cognome e sezione)
E ha un link alla tabella "Rette" del mese (`/admin/rette`)
E conta 1 nel numero della campanella

## Scenario: l'allarme "rette non comunicate" sparisce quando tutte le comunicazioni sono inviate
Dato che l'allarme "rette non comunicate" è attivo
Quando tutti i bambini a cui si può comunicare la retta hanno la
comunicazione del mese corrente registrata
Allora l'allarme non compare più nella pagina "Allarmi" e la campanella
non lo conta
E se una comunicazione viene annullata (specs/56) l'allarme torna attivo
E il mese dopo riparte da zero: conta solo la comunicazione del nuovo mese

## Scenario: un bambino senza email di promemoria non fa scattare l'allarme
Dato che un bambino attivo non ha l'email di promemoria configurata
(specs/55) e quindi non può ricevere la comunicazione
Quando tutti gli altri bambini hanno la comunicazione del mese
Allora l'allarme "rette non comunicate" non è attivo: quel bambino non
viene contato né nominato (altrimenti l'allarme non si spegnerebbe mai)

## Scenario: nei mesi di chiusura totale non c'è l'allarme "rette non comunicate"
Dato che tutti i giorni feriali del mese corrente sono giorni di chiusura
(es. agosto, specs/53)
Quando apro la pagina "Allarmi" dopo il giorno 3, o gira il cron
Allora non vedo l'allarme "rette non comunicate" e non parte nessuna email

## Scenario: solo l'admin vede l'allarme "rette non comunicate"
Dato che l'allarme "rette non comunicate" sarebbe attivo
Quando apro la pagina "Allarmi" come maestra o assistente
Allora non lo vedo, la campanella non lo conta e non vedo i nomi dei
bambini a cui manca la comunicazione
E il genitore non ha la campanella (vedi sopra)

## Scenario: dal giorno 3 del mese, rette non comunicate — banner in dashboard per l'admin
Dato che sono autenticato come admin
E l'allarme "rette non comunicate" è attivo (stesse condizioni dello
scenario "dal giorno 3 del mese, rette non comunicate")
Quando apro la dashboard
Allora vedo un banner di allarme "Comunicazioni delle rette non inviate",
con quanti bambini mancano e quali (nome, cognome e sezione)
E il banner ha un link alla tabella "Rette" del mese (`/admin/rette`)
E i dati sono gli stessi della pagina "Allarmi" (una sola funzione)

## Scenario: nessun banner "rette non comunicate" in dashboard se l'allarme non è attivo
Dato che sono autenticato come admin
Quando apro la dashboard il giorno 1 o 2 del mese, in un mese interamente
chiuso, oppure quando tutti i bambini a cui si può comunicare la retta hanno
la comunicazione del mese corrente
Allora non vedo il banner "rette non comunicate"
E se una comunicazione viene annullata il banner ricompare

## Scenario: maestra e assistente non vedono il banner "rette non comunicate" in dashboard
Dato che l'allarme "rette non comunicate" sarebbe attivo
Quando apro la dashboard come maestra o assistente
Allora non vedo il banner né i nomi dei bambini a cui manca la comunicazione
E per me il calcolo di questo allarme non parte

## Scenario: mail mensile a Rojac non inviata di un mese concluso — allarme per l'admin
Dato che sono autenticato come admin
E un mese già concluso, dal mese di partenza in poi, ha pasti comunicati o
almeno un giorno di scuola aperto (vedi Regole)
E per quel mese non c'è nessuna riga nel registro degli invii a Rojac
([61 - email-pasti-rojac.md](61%20-%20email-pasti-rojac.md))
Quando apro la pagina "Allarmi"
Allora vedo l'allarme "Mail mensile a Rojac non inviata", che elenca il
mese mancante (per esempio "ottobre 2026") con un link al Report mensile
di quel mese (`/dashboard/report?tipo=mensile&periodo=<mese>`)
E se i mesi mancanti sono più di uno li vedo tutti, dal più vecchio
E l'allarme conta 1 nel numero della campanella, qualunque sia il numero
di mesi mancanti

## Scenario: l'allarme "mail mensile a Rojac non inviata" sparisce quando il mese ha un invio registrato
Dato che l'allarme è attivo per un mese
Quando l'admin invia la mail di quel mese dal Report mensile e l'invio è
registrato (basta una riga, anche se ce ne sono più di una)
Allora quel mese non compare più nell'allarme e, se era l'unico, l'allarme
sparisce dalla pagina "Allarmi" e la campanella non lo conta

## Scenario: il mese corrente e i mesi prima del mese di partenza non fanno scattare l'allarme
Dato che sono autenticato come admin
Quando apro la pagina "Allarmi"
Allora il mese corrente non compare mai nell'allarme: un mese diventa
mancante dal primo giorno del mese dopo (il mese di partenza, finché è in
corso, non scatta)
E i mesi precedenti al mese di partenza non vengono mai considerati

## Scenario: un mese senza pasti comunicati e senza giorni di scuola non fa scattare l'allarme
Dato che un mese concluso non ha nessun pasto comunicato e nessun giorno di
scuola aperto (per esempio un mese interamente chiuso, specs/53)
Quando apro la pagina "Allarmi" come admin, o gira il cron
Allora quel mese non compare nell'allarme e non fa partire nessuna email

## Scenario: solo l'admin vede l'allarme "mail mensile a Rojac non inviata"
Dato che l'allarme sarebbe attivo
Quando apro la pagina "Allarmi" come maestra o assistente
Allora non lo vedo, la campanella non lo conta e per me il calcolo non parte
E il genitore non ha la campanella (vedi sopra)

## Scenario: mail mensile a Rojac non inviata — banner in dashboard per l'admin
Dato che sono autenticato come admin
E l'allarme "mail mensile a Rojac non inviata" è attivo
Quando apro la dashboard
Allora vedo un banner di allarme "Mail mensile a Rojac non inviata" con i
mesi mancanti, ciascuno con il link al Report mensile di quel mese
E i dati sono gli stessi della pagina "Allarmi" (una sola funzione)
E se l'allarme non è attivo il banner non compare, e maestra e assistente
non lo vedono mai

## Regole
- Ogni maestra/assistente vede il proprio banner presenze/pasti
  calcolato solo sulle proprie sezioni assegnate (stessa visibilità RLS
  già usata per "Presenze e pasti", nessun permesso nuovo necessario);
  l'admin lo vede calcolato su tutte le sezioni attive, essendo la sua
  "sezione" l'intero asilo (stessa visibilità già in uso altrove per
  l'admin). A differenza di una prima versione di questo requisito, il
  banner personale non richiede più la service_role key: ognuno legge
  solo ciò che la propria sessione può già vedere via RLS.
- "Presenze non complete" = esiste almeno un bambino attivo, in una
  sezione visibile all'utente, senza alcuna riga in `presenze` per oggi
  — non conta se il bambino risulta assente/malato (quello è comunque
  "segnato"), solo l'assenza totale di un dato. Il banner elenca le
  singole sezioni interessate (non solo un riepilogo aggregato); ogni
  voce linka a `/dashboard/giornata?data=<oggi>` (la schermata unica
  "Presenze e pasti", [10 - presenze-e-pasti.md](10%20-%20presenze-e-pasti.md))
  — non esiste una pagina per singola sezione (bambini raggruppati per
  sezione nella stessa pagina). Le vecchie rotte `/dashboard/presenze` e
  `/dashboard/pasti` reindirizzano comunque lì. L'email aggregata non
  contiene link all'app.
- "Pasti non confermati" = non esiste ancora una riga in
  `pasti_comunicati` per oggi (specs/16): la comunicazione a Rojac è
  un'unica cosa al giorno per l'intero asilo, non per classe. Riguarda
  solo maestra e admin: l'assistente non ha accesso al registro pasti
  (specs/03, specs/14) e non vede questa parte del banner né la conta
  tra i suoi allarmi nel riepilogo dell'admin.
- Se l'utente non ha nessuna sezione assegnata, il controllo presenze
  non scatta (nulla da segnare) — resta comunque valido, per lui,
  l'eventuale allarme "settimana ore".
- Il banner "settimana ore non confermata" usa la sessione normale
  dell'utente (RLS): legge solo la propria riga di
  `ore_lavoro_settimane`, già permesso dalla policy esistente
  (`ore_lavoro_settimane_select_own_or_admin`, specs/18) — nessun nuovo
  permesso necessario.
- **Settimana di riferimento** per l'allarme ore: la settimana
  (lunedì-domenica) più di recente il cui termine è scaduto.
  - Da lunedì a venerdì prima delle 18:00 (Europe/Rome): il termine
    scaduto è quello della settimana precedente (quella appena
    conclusa) — la settimana di riferimento è quella.
  - Da venerdì alle 18:00 in poi, e per tutto il weekend: il termine
    della settimana corrente è considerato scaduto (anche se la
    settimana non è ancora finita) — la settimana di riferimento
    diventa la settimana corrente stessa. È una scadenza anticipata,
    non un vincolo di completezza: la settimana resta comunque
    confermabile con i giorni futuri precaricati dal profilo orario
    (specs/18), esattamente come già previsto per la conferma
    anticipata di una settimana in corso.
  - Il banner (e l'email) riguardano sempre e solo questa singola
    settimana più recente, non un arretrato di più settimane mai
    confermate (fuori scope, vedi sotto) — stessa scelta già presente
    nella versione precedente di questo requisito.
- Il riepilogo dell'admin ("vede gli allarmi di ogni dipendente") copre
  maestre e assistenti (gli utenti che possono avere sezioni assegnate o
  essere abilitati al report ore); è calcolato con la sessione normale
  dell'admin, che ha già visibilità RLS su tutte le sezioni/bambini/
  presenze/pasti/settimane ore di chiunque, nessuna service_role key
  necessaria. È **read-only**: nessun link, nessuna azione per
  "correggere" al posto del dipendente — l'admin può comunque, come
  sempre, aprire di persona "Presenze e pasti"/Ore di lavoro e intervenire
  con il proprio account, ma non da questo riepilogo.
- Il ruolo **Segretaria** non esiste ancora nel sistema (vedi
  [03 - utenti-e-ruoli.md](03%20-%20utenti-e-ruoli.md)): per ora solo
  l'admin vede il riepilogo di tutto il personale (vedi Fuori scope).
- **Email di riepilogo**: il job (un'unica email al giorno, a
  `REPORT_EMAIL_DESTINATARIO`) valuta questi controlli e li riporta
  SEMPRE tutti nel corpo, nell'ordine, ciascuno con nome, ora in cui è
  stato fatto (HH:MM, Europe/Rome), stato e, se da sistemare, che cosa
  manca e l'azione per risolvere:
  1. **Appello** (di giornata): tutti i bambini attivi hanno una riga in
     `presenze` per oggi (presente, assente o malato). Pre-asilo e
     post-asilo non contano come controllo (facoltativi).
  2. **Pasti a Rojac** (di giornata): esiste la riga in
     `pasti_comunicati` per oggi (da maestra, admin o assistente, come da
     specs/16).
  3. **Rette ai genitori** (mensile, dal giorno 3): vedi la regola
     "Rette non comunicate".
  4. **Mail mensile dei pasti a Rojac** (mensile): vedi la regola "Mail
     mensile a Rojac non inviata". Fa scattare l'email solo per i mesi
     non ancora avvisati.
  5. **Ore di lavoro**: la settimana di riferimento è confermata da ogni
     utente abilitato per cui la conferma è richiesta (una riga per utente
     da sistemare). Gli utenti con "Richiedi conferma settimana"
     disattivata (`profili.richiedi_conferma_settimana`, vedi specs/03) si
     saltano e il controllo lo dichiara con una riga "Conferma settimana
     non richiesta per <nome cognome>: controllo saltato"; stessa regola
     per il banner personale e per la pagina Allarmi.
  Gli stati sono: "ok", "da sistemare", "non applicabile oggi" (con il
  motivo: prima delle 10:00, giorno di chiusura, nessun bambino attivo,
  prima del giorno 3) e "non ancora controllato". L'email parte solo se
  almeno un controllo è "da sistemare": se è tutto a posto non si manda
  nulla (interpretazione prudente: niente posta quotidiana inutile).
  I controlli di giornata (1 e 2) si fanno solo dopo le 10:00
  (Europe/Rome) in un giorno di apertura, perché alcune anomalie sono
  correggibili solo entro la giornata. L'email non contiene link
  all'app. Il calcolo è aggregato sull'intero asilo, lato server con la
  service_role key (`lib/supabase/admin.ts`), stesso motivo del report
  notturno (specs/52): il job non ha una sessione utente da cui ereditare
  la RLS (uno dei pochi usi ammessi, `npm run check:service-role`,
  ADR-0002). Il corpo si costruisce in `lib/riepilogoAllarmi.ts` (puro,
  con test unit).
- **Rette non comunicate**: le soglie e la composizione sono in
  `lib/allarmeRette.ts`. Il giorno minimo è la costante
  `GIORNO_ALLARME_RETTE` (3, fisso: si cambia nel codice). Conta il mese
  corrente (fuso Europe/Rome). I bambini considerati sono quelli della
  tabella "Rette" del mese ([56](56%20-%20comunicazione-retta-mensile.md)):
  attivi, con `costi_bambini.email_promemoria` valorizzata; mancano se non
  hanno una riga in `comunicazioni_retta` per il mese. Un mese senza
  nessun giorno aperto (weekend e chiusure registrate esclusi,
  `lib/comunicazioneRetta.ts:giorniAperturaMese` = 0) non ha l'allarme.
  Solo l'admin: il calcolo (nomi dei bambini compresi) non parte per gli
  altri ruoli. Il cron lo calcola con la service_role key e lo riporta
  nell'email di riepilogo (controllo 3); per decisione di prodotto
  l'allarme sulle rette ai genitori e quelli sulle mail ai genitori
  scattano insieme dallo stesso giorno 3, non dal 5.
- **Mail mensile a Rojac non inviata**: logica pura in
  `lib/allarmeRojac.ts` (con unit test). Un mese "YYYY-MM" è mancante se:
  (a) è compreso tra il mese di partenza, la costante
  `MESE_PARTENZA_ROJAC` (2026-10, il mese del rilascio, fisso: si cambia
  nel codice), incluso, e il mese corrente (fuso Europe/Rome), escluso,
  cioè scatta dal primo giorno del mese successivo; (b) "conta", cioè ha
  almeno un pasto comunicato (`pasti_comunicati`) oppure almeno un giorno
  di scuola aperto (weekend e chiusure registrate esclusi,
  `lib/comunicazioneRetta.ts:giorniAperturaMese`); (c) non ha nessuna
  riga in `invii_rojac` (specs/61). Più invii dello stesso mese non fanno
  danni e il blocco del doppio invio resta fuori scope. Solo l'admin: il
  calcolo non parte per gli altri ruoli. L'allarme è una sola voce
  (`rojac-non-inviata`) con una riga per mese mancante e il link al Report
  mensile di quel mese. Se non c'è nessun mese concluso da controllare non
  si legge nulla dal database.
- Email per la mail a Rojac mancante: una riga in `allarmi_inviati` con
  `tipo` = `rojac_non_inviata` e `chiave` = il mese (`YYYY-MM`); con
  l'unicità `(tipo, chiave)` c'è al più una riga, quindi una sola email,
  per mese mancante. Il cron la registra **prima** di inviare e la
  cancella se l'invio fallisce (come per l'email giornaliera). I mesi già
  avvisati restano "da sistemare" nel riepilogo ma non fanno partire
  l'email da soli. Il lancio a mano (specs/63) non legge né scrive questo
  registro. Il cron legge `invii_rojac` con la service_role key (migration
  0066: solo SELECT, nessuna policy nuova, nessun privilegio per anon o
  authenticated).
- Il banner "mail mensile a Rojac non inviata" in dashboard (solo admin)
  prende la voce `rojac-non-inviata` dall'elenco di `caricaAllarmiCorrenti`,
  come il banner delle rette.
- Il banner "rette non comunicate" in dashboard (solo admin) non fa un
  calcolo suo: prende la voce `rette-non-comunicate` dall'elenco di
  `caricaAllarmiCorrenti` (`lib/allarmiDati.ts`), lo stesso della pagina
  "Allarmi" e della campanella (una sola lettura per richiesta). Per
  maestra e assistente quell'elenco non contiene la voce e non legge i
  dati delle rette.
- Idempotenza dell'email di riepilogo: una riga in `allarmi_inviati`
  con `chiave` = data `YYYY-MM-DD` ("esistenza della riga = già
  inviato", come per i report notturni, specs/52). Il cron registra la
  riga **prima** di inviare (l'unicità `(tipo, chiave)` fa da
  prenotazione) e la cancella se l'invio fallisce, così si può ritentare;
  se il registro rifiuta la riga per un motivo diverso dal duplicato
  l'email non parte, per non ripetersi ogni giorno. Per non richiedere
  una migration si riusa il valore già ammesso dal vincolo CHECK
  `presenze_pasti_mezzogiorno` (identificatore interno, non mostrato
  all'utente): oggi significa "riepilogo giornaliero inviato". I valori
  `settimana_ore_non_confermata` e `rette_non_comunicate` (migration
  0061) restano ammessi ma il cron non li scrive più: le righe
  esistenti sono storico innocuo. Il valore `rojac_non_inviata`
  (migration 0062) è invece scritto dal cron, una riga per mese.
- Il job è protetto dallo stesso meccanismo già in uso per gli altri
  cron (header `Authorization: Bearer $CRON_SECRET`, confrontato a tempo
  costante). Su Vercel (produzione e anteprime) senza `CRON_SECRET`
  configurato la route rifiuta **ogni** chiamata (401, messaggio
  generico); solo in locale e nella CI, senza la variabile, la route
  resta aperta (issue #300, `lib/autorizzazioneCron.ts`).

- Composizione dell'elenco della campanella e della pagina "Allarmi":
  è una sola, calcolata sul server riusando le stesse funzioni dei
  banner (`lib/allarmi.ts`), così numero ed elenco coincidono per
  costruzione. Conta un allarme per ciascuna di queste voci: "presenze e
  pasti di oggi" (una sola voce, con dentro le sezioni da segnare e/o i
  pasti da comunicare), "settimana ore non confermata" e, solo per
  l'admin, le voci "rette non comunicate" e "mail mensile a Rojac non
  inviata" (se attive) e una voce per ogni membro del personale in
  allarme. Il calcolo
  usa la sessione normale dell'utente (RLS): nessun permesso nuovo,
  nessuna service_role key. Non entrano per ora le incoerenze
  presenze/pasti ([06 - controllo-consistenza.md](06%20-%20controllo-consistenza.md)),
  né le email (che non cambiano).
- Per non rallentare le altre pagine il numero della campanella è
  calcolato in streaming (la pagina non aspetta), non si calcola prima
  delle 10:00 o in un giorno di chiusura ciò che dipende da quella soglia,
  e per il genitore non si calcola nulla.
- Ogni lancio del job dell'email di riepilogo (nome `allarmi`) è
  registrato in `cron_esecuzioni` con inizio, fine ed esito, visibile
  all'admin in "Cron Job" ([63 - cron-job.md](63%20-%20cron-job.md)). Il
  registro non tocca `allarmi_inviati` né l'idempotenza dell'email.

## Note di implementazione
- Route `app/api/cron/allarmi/route.ts` (Vercel Cron), un solo cron che
  valuta tutti i controlli una volta al giorno, dopo le 10:00
  Europe/Rome — non due cron separati, per restare comodamente dentro
  il limite di Vercel Hobby (2 cron job per progetto, già a 1 con
  `report-presenze`; vedi `CLAUDE.md`).
- Tutti i controlli confluiscono in un'unica email di riepilogo
  (`lib/riepilogoAllarmi.ts`), nessun cron nuovo.
- Il destinatario riusa la stessa variabile d'ambiente
  `REPORT_EMAIL_DESTINATARIO` di specs/52 (`lib/email.ts:destinatarioNotifiche`).

## Fuori scope in questa fase
- Il ruolo Segretaria: quando verrà introdotto, riuserà lo stesso
  riepilogo read-only già costruito per l'admin. Backlog: issue
  [#88](https://github.com/matteopelucco/girasole/issues/88).
- Una vista che riepiloghi un arretrato di più settimane mai confermate
  per uno stesso dipendente (oggi si vede solo la singola settimana di
  riferimento più recente). Backlog: issue
  [#89](https://github.com/matteopelucco/girasole/issues/89).
- Altri allarmi (es. un bambino senza presenza per più giorni di fila,
  ore straordinarie anomale): non richiesti in questa fase.
