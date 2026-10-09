# 07 — Allarmi

## Attori
Maestra, assistente, admin (ciascuno vede il proprio allarme personale).
L'admin vede in più, nella pagina Allarmi, le righe read-only degli
allarmi di tutto il personale. Nessun utente umano avvia i controlli: un job pianificato
(Vercel Cron) valuta anche la situazione a livello di intero asilo e
invia le email, come in
[52 - report-email-automatico.md](52%20-%20report-email-automatico.md).
Destinatario delle email: una casella email dello staff (di default
`info@asilosartorio.it`, stessa variabile d'ambiente
`REPORT_EMAIL_DESTINATARIO` di specs/52), non un utente dell'app.

## Obiettivo
Segnalare tempestivamente, a chi può ancora agire, due situazioni
anomale che altrimenti passerebbero inosservate finché qualcuno non se
ne accorge da solo: presenze/pasti dimenticati durante la giornata, e
una settimana di ore di lavoro non confermata dal personale. Ogni
allarme ha due canali, sempre entrambi: la pagina "Allarmi"
(`/dashboard/allarmi`), raggiungibile dalla campanella in alto a destra
che ne mostra il numero (finché la situazione resta anomala), e un'email
inviata una sola volta per occorrenza. Gli allarmi compaiono **solo**
nella pagina Allarmi e nella campanella: la dashboard non ne mostra
(niente banner, niente riepilogo del personale).

## Scenario: presenze o pasti non ancora segnati dopo le 10:00 — allarme personale
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
Quando apro la pagina "Allarmi"
Allora vedo un allarme "presenze e pasti di oggi" che elenca cosa manca, con un link per
ciascuna mia sezione che ha ancora presenze da segnare (mi porta a
"Presenze e pasti" per oggi, `/dashboard/giornata?data=<oggi>`, dove i
bambini di tutte le mie sezioni sono raggruppati per sezione) e, se
manca anche la comunicazione pasti, un link alla stessa schermata
posizionato sul box di comunicazione a Rojac
(`/dashboard/giornata?data=<oggi>#comunicazione-rojac`)
E questo allarme riguarda solo le mie sezioni: una maestra di un'altra
sezione, senza anomalie nelle proprie, non lo vede

## Scenario: nessun allarme personale presenze/pasti se tutto è a posto, non è ancora l'orario, o il giorno è chiuso
Quando apro la pagina "Allarmi" prima delle 10:00, oppure dopo le 10:00 ma con
le presenze di tutti i bambini delle mie sezioni già segnate e (per
maestra/admin) i pasti già comunicati, oppure in un giorno di chiusura
scolastica, oppure non ho ancora nessuna sezione assegnata
Allora non vedo l'allarme presenze/pasti (e la campanella non lo conta)

## Scenario: presenze/pasti non completati entro le 10:00 — email
Dato che, per il giorno appena valutato, presenze e/o pasti non
risultano completati in almeno una sezione dell'asilo dopo le 10:00
Quando il job pianificato gira
Allora viene inviata una email all'indirizzo configurato, che elenca
cosa manca a livello di intero asilo (stesso riepilogo aggregato già in
uso per l'email, indipendente dalla sezione)
E se il job gira di nuovo lo stesso giorno, l'email non viene inviata
una seconda volta (idempotenza per giorno)

## Scenario: settimana di ore di lavoro non confermata entro venerdì sera — allarme personale
Dato che sono abilitata al report ore (vedi
[17 - ore-di-lavoro.md](17%20-%20ore-di-lavoro.md))
E sono le 18:00 di venerdì (fuso Europe/Rome) o più tardi nella
settimana corrente, e quella settimana non risulta ancora confermata
(vedi [18 - report-ore-lavoro.md](18%20-%20report-ore-lavoro.md))
Quando apro la pagina "Allarmi"
Allora vedo un allarme personale che mi avvisa della dimenticanza, con
l'intervallo di date della settimana e un link che apre direttamente
quella settimana in "Ore di lavoro" per confermarla
E questo allarme lo vedo solo io, non gli altri membri dello staff: è una
mia dimenticanza, non un problema dell'intero asilo

Esempio: sono le 19:30 di venerdì e non ho ancora confermato le ore
della settimana corrente (quella che include oggi, non ancora finita) →
vedo l'allarme riferito a questa settimana.

## Scenario: settimana di ore di lavoro non confermata prima di venerdì sera — allarme personale sulla settimana precedente
Dato che sono abilitata al report ore
E siamo tra lunedì e venerdì prima delle 18:00 (fuso Europe/Rome), e la
settimana precedente (lunedì-domenica appena conclusa) non risulta
ancora confermata
Quando apro la pagina "Allarmi"
Allora vedo lo stesso allarme personale, riferito però alla settimana
precedente

## Scenario: nessun allarme "ore" se la settimana di riferimento è già confermata o non sono abilitata
Quando apro la pagina "Allarmi" e la settimana di riferimento (vedi Regole)
risulta già confermata, oppure il mio profilo non è abilitato al report
ore
Allora non vedo l'allarme "settimana non confermata" (e la campanella non lo conta)

## Scenario: settimana di ore di lavoro non confermata — email
Dato che, per un utente abilitato al report ore, la settimana di
riferimento (vedi Regole) non risulta confermata
Quando il job pianificato gira
Allora viene inviata una email all'indirizzo configurato, che indica
quale utente e quale settimana
E questo vale indipendentemente per ciascun utente abilitato: se più
persone non hanno confermato, ciascuna genera una propria email
E se il job gira di nuovo per la stessa settimana e lo stesso utente,
l'email non viene inviata una seconda volta (idempotenza per
utente+settimana) — anche se nel frattempo quell'utente ha confermato
un'altra settimana

## Scenario: l'admin vede gli allarmi di tutto il personale
Dato che sono autenticato come admin
E almeno un membro del personale (maestra o assistente) ha, in questo
momento, un allarme attivo — presenze/pasti non completati nelle sue
sezioni dopo le 10:00, e/o la sua settimana di riferimento delle ore non
confermata dopo la relativa soglia
Quando apro la pagina "Allarmi"
Allora vedo, oltre ai miei eventuali allarmi personali, una sezione "Situazione del personale" con
una riga per ciascun membro del personale in allarme: nome, cognome e
cosa gli manca (sezioni con presenze da segnare, pasti non comunicati,
e/o settimana ore non confermata con l'intervallo di date)
E queste righe non contengono link né azioni: è solo informativo, non
posso correggere la situazione al posto loro (vedi Regole)
E ciascuna riga conta come un allarme nel numero della campanella

## Scenario: nessun riepilogo per l'admin se nessuno è in allarme
Quando apro la pagina "Allarmi" come admin e nessun membro del personale ha
allarmi attivi in questo momento
Allora non vedo la sezione "Situazione del personale"
E la campanella non conta nessun collega

## Scenario: la dashboard non mostra più allarmi né riepilogo del personale
Dato che sono autenticata come maestra, assistente o admin
E ho almeno un allarme attivo (anche, se sono admin, un collega in allarme)
Quando apro la dashboard
Allora non vedo nessun banner di allarme (presenze/pasti, settimana ore) né
il riepilogo della situazione del personale
E gli stessi allarmi restano nella pagina "Allarmi" e contati nella
campanella, senza perdere nessuna informazione

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
destinazione di cui sopra (Presenze e pasti di oggi, il box di
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

## Regole
- Ogni maestra/assistente vede il proprio allarme presenze/pasti
  calcolato solo sulle proprie sezioni assegnate (stessa visibilità RLS
  già usata per "Presenze e pasti", nessun permesso nuovo necessario);
  l'admin lo vede calcolato su tutte le sezioni attive, essendo la sua
  "sezione" l'intero asilo (stessa visibilità già in uso altrove per
  l'admin). A differenza di una prima versione di questo requisito, l'allarme
  personale non richiede più la service_role key: ognuno legge
  solo ciò che la propria sessione può già vedere via RLS.
- "Presenze non complete" = esiste almeno un bambino attivo, in una
  sezione visibile all'utente, senza alcuna riga in `presenze` per oggi
  — non conta se il bambino risulta assente/malato (quello è comunque
  "segnato"), solo l'assenza totale di un dato. L'allarme elenca le
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
  (specs/03, specs/14) e non vede questa parte dell'allarme né la conta
  tra i suoi allarmi nel riepilogo dell'admin.
- Se l'utente non ha nessuna sezione assegnata, il controllo presenze
  non scatta (nulla da segnare) — resta comunque valido, per lui,
  l'eventuale allarme "settimana ore".
- L'allarme "settimana ore non confermata" usa la sessione normale
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
  - L'allarme (e l'email) riguardano sempre e solo questa singola
    settimana più recente, non un arretrato di più settimane mai
    confermate (fuori scope, vedi sotto) — stessa scelta già presente
    nella versione precedente di questo requisito.
- Le righe del personale dell'admin ("vede gli allarmi di ogni dipendente") copre
  maestre e assistenti (gli utenti che possono avere sezioni assegnate o
  essere abilitati al report ore); è calcolato con la sessione normale
  dell'admin, che ha già visibilità RLS su tutte le sezioni/bambini/
  presenze/pasti/settimane ore di chiunque, nessuna service_role key
  necessaria. È **read-only**: nessun link, nessuna azione per
  "correggere" al posto del dipendente — l'admin può comunque, come
  sempre, aprire di persona "Presenze e pasti"/Ore di lavoro e intervenire
  con il proprio account, ma non da queste righe.
- Il ruolo **Segretaria** non esiste ancora nel sistema (vedi
  [03 - utenti-e-ruoli.md](03%20-%20utenti-e-ruoli.md)): per ora solo
  l'admin vede il riepilogo di tutto il personale (vedi Fuori scope).
- L'allarme email "presenze/pasti" resta un riepilogo aggregato
  sull'intero asilo (non una email per sezione o per maestra), calcolato
  lato server con la service_role key (`lib/supabase/admin.ts`), stesso
  motivo già documentato per il report notturno (specs/52) — il job non
  ha una sessione utente da cui ereditare la RLS (uno dei pochi usi
  ammessi della service_role, con il resto dei cron e la gestione utenti:
  `npm run check:service-role`, ADR-0002). Soglia oraria 10:00
  (Europe/Rome), stessa soglia dell'allarme personale.
- Idempotenza delle email tracciata in un'unica tabella
  `allarmi_inviati` (`tipo`, `chiave`, `inviato_at`): `chiave` è la data
  per l'allarme presenze/pasti, `{utente_id}_{settimana_inizio}` per
  l'allarme ore di lavoro — stesso principio "esistenza della riga =
  già inviato" già in uso per i report notturni (specs/52) e la
  conferma di una settimana ore (specs/18), qui condiviso in una sola
  tabella con un discriminatore invece di una tabella per tipo, non
  essendoci altri campi da conservare oltre alla chiave. I valori del
  discriminatore `tipo` restano quelli già in uso in produzione
  (`presenze_pasti_mezzogiorno`, `settimana_ore_non_confermata`): sono
  identificatori interni, non testo mostrato all'utente, quindi non è
  stato necessario rinominarli né fare una migration solo per questo.
- Il job è protetto dallo stesso meccanismo già in uso per gli altri
  cron (header `Authorization: Bearer $CRON_SECRET`).
- Un errore nell'invio non deve marcare l'occorrenza come "inviata": un
  tentativo successivo deve poter ritentare (stesso principio di
  specs/52).

- Composizione dell'elenco della campanella e della pagina "Allarmi":
  è una sola, calcolata sul server riusando le funzioni di
  `lib/allarmi.ts` (le stesse del cron), così numero ed elenco coincidono per
  costruzione. Conta un allarme per ciascuna di queste voci: "presenze e
  pasti di oggi" (una sola voce, con dentro le sezioni da segnare e/o i
  pasti da comunicare), "settimana ore non confermata" e, solo per
  l'admin, una voce per ogni membro del personale in allarme. Il calcolo
  usa la sessione normale dell'utente (RLS): nessun permesso nuovo,
  nessuna service_role key. Non entrano per ora le incoerenze
  presenze/pasti ([06 - controllo-consistenza.md](06%20-%20controllo-consistenza.md)),
  né le email (che non cambiano).
- Per non rallentare le altre pagine il numero della campanella è
  calcolato in streaming (la pagina non aspetta), non si calcola prima
  delle 10:00 o in un giorno di chiusura ciò che dipende da quella soglia,
  e per il genitore non si calcola nulla.

## Note di implementazione
- Route `app/api/cron/allarmi/route.ts` (Vercel Cron), un solo cron che
  valuta entrambi gli allarmi una volta al giorno, dopo le 10:00
  Europe/Rome — non due cron separati, per restare comodamente dentro
  il limite di Vercel Hobby (2 cron job per progetto, già a 1 con
  `report-presenze`; vedi `CLAUDE.md`).
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
