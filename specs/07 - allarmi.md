# 07 — Allarmi

## Attori
Tutto lo staff (admin, maestra, assistente) vede gli allarmi in
dashboard. Nessun utente umano avvia i controlli: un job pianificato
(Vercel Cron) li valuta e invia le email, come in
[52 - report-email-automatico.md](52%20-%20report-email-automatico.md).
Destinatario delle email: una casella email dello staff (di default
`info@asilosartorio.it`, stessa variabile d'ambiente
`REPORT_EMAIL_DESTINATARIO` di specs/52), non un utente dell'app.

## Obiettivo
Segnalare tempestivamente due situazioni anomale che altrimenti
passerebbero inosservate finché qualcuno non se ne accorge da solo:
presenze/pasti dimenticati durante la giornata, e una settimana di ore
di lavoro mai confermata dal personale. Ogni allarme ha due canali,
sempre entrambi: un banner in dashboard (finché la situazione resta
anomala) e un'email inviata una sola volta per occorrenza (giorno per
il primo allarme, utente+settimana per il secondo).

## Scenario: presenze/pasti non completati entro mezzogiorno — banner
Dato che sono autenticata come admin, maestra o assistente
E oggi è un giorno attivo (non chiuso, vedi
[53 - calendario-scolastico.md](53%20-%20calendario-scolastico.md))
E sono le 12:00 (fuso Europe/Rome) o più tardi
E almeno un bambino attivo non ha ancora una presenza segnata per oggi,
oppure i pasti di oggi non sono ancora stati comunicati a Rojac (vedi
[16 - comunicazione-pasti-rojac.md](16%20-%20comunicazione-pasti-rojac.md))
Quando apro la dashboard
Allora vedo un banner di allarme che segnala cosa manca (presenze,
pasti, o entrambi)
E lo stesso banner lo vede qualunque altro membro dello staff, non solo
chi segue quella classe: è una situazione dell'intero asilo, non di una
singola sezione

## Scenario: nessun banner se tutto è a posto o non è ancora mezzogiorno
Quando apro la dashboard prima delle 12:00, oppure dopo le 12:00 ma con
presenze di tutti i bambini attivi già segnate e pasti già comunicati,
oppure in un giorno di chiusura scolastica
Allora non vedo il banner di allarme presenze/pasti

## Scenario: presenze/pasti non completati entro mezzogiorno — email
Dato che, per il giorno appena valutato, presenze e/o pasti non
risultano completati dopo le 12:00
Quando il job pianificato gira
Allora viene inviata una email all'indirizzo configurato, che elenca
cosa manca
E se il job gira di nuovo lo stesso giorno, l'email non viene inviata
una seconda volta (idempotenza per giorno)

## Scenario: settimana di ore di lavoro non confermata — banner
Dato che sono abilitata al report ore (vedi
[17 - ore-di-lavoro.md](17%20-%20ore-di-lavoro.md))
E la settimana scorsa (lunedì-domenica) non risulta confermata (vedi
[18 - report-ore-lavoro.md](18%20-%20report-ore-lavoro.md))
Quando apro la dashboard
Allora vedo un banner personale che mi avvisa della dimenticanza, con
l'intervallo di date della settimana scorsa
E questo banner lo vedo solo io, non gli altri membri dello staff: è una
mia dimenticanza, non un problema dell'intero asilo

## Scenario: nessun banner se la settimana scorsa è già confermata o non sono abilitata
Quando apro la dashboard e la settimana scorsa risulta già confermata,
oppure il mio profilo non è abilitato al report ore
Allora non vedo il banner "settimana non confermata"

## Scenario: settimana di ore di lavoro non confermata — email
Dato che, per un utente abilitato al report ore, la settimana appena
conclusa non risulta confermata
Quando il job pianificato gira
Allora viene inviata una email all'indirizzo configurato, che indica
quale utente e quale settimana
E questo vale indipendentemente per ciascun utente abilitato: se più
persone non hanno confermato, ciascuna genera una propria email
E se il job gira di nuovo per la stessa settimana e lo stesso utente,
l'email non viene inviata una seconda volta (idempotenza per
utente+settimana) — anche se nel frattempo quell'utente ha confermato
un'altra settimana

## Regole
- Il banner "presenze/pasti" richiede una visibilità sull'intero asilo
  (tutte le sezioni, non solo quelle dell'utente che ha aperto la
  dashboard): calcolato lato server con la service_role key
  (`lib/supabase/admin.ts`), stesso motivo già documentato per il report
  notturno (specs/52) — una maestra non avrebbe altrimenti, via RLS, i
  permessi per vedere le sezioni altrui. Il banner mostra solo un
  riepilogo aggregato ("non tutte le presenze sono state segnate"), mai
  il dettaglio di bambini o classi specifiche di sezioni non proprie.
- "Presenze non complete" = esiste almeno un bambino attivo (in una
  sezione attiva) senza alcuna riga in `presenze` per oggi — non conta
  se il bambino risulta assente/malato (quello è comunque "segnato"),
  solo l'assenza totale di un dato.
- "Pasti non confermati" = non esiste ancora una riga in
  `pasti_comunicati` per oggi (specs/16): la comunicazione a Rojac è
  un'unica cosa al giorno per l'intero asilo, non per classe, stessa
  definizione già in uso.
- Se non ci sono bambini attivi (o nessuna sezione attiva), non scatta
  nessuno dei due controlli: non c'è nulla da segnare.
- Il banner "settimana ore non confermata" usa invece la sessione
  normale dell'utente (RLS): un utente legge solo la propria riga di
  `ore_lavoro_settimane`, già permesso dalla policy esistente
  (`ore_lavoro_settimane_select_own_or_admin`, specs/18) — nessun nuovo
  permesso necessario.
- "Settimana scorsa" è sempre la settimana (lunedì-domenica) immediatamente
  precedente a quella corrente, ricalcolata ogni giorno rispetto a oggi:
  il banner resta visibile per tutta la settimana corrente finché quella
  passata non viene confermata (nessuna funzione per confermarla in
  ritardo in questa fase, vedi Fuori scope).
- Idempotenza delle email tracciata in un'unica tabella
  `allarmi_inviati` (`tipo`, `chiave`, `inviato_at`): `chiave` è la data
  per l'allarme presenze/pasti, `{utente_id}_{settimana_inizio}` per
  l'allarme ore di lavoro — stesso principio "esistenza della riga =
  già inviato" già in uso per i report notturni (specs/52) e la
  conferma di una settimana ore (specs/18), qui condiviso in una sola
  tabella con un discriminatore invece di una tabella per tipo, non
  essendoci altri campi da conservare oltre alla chiave.
- Il job è protetto dallo stesso meccanismo già in uso per gli altri
  cron (header `Authorization: Bearer $CRON_SECRET`).
- Un errore nell'invio non deve marcare l'occorrenza come "inviata": un
  tentativo successivo deve poter ritentare (stesso principio di
  specs/52).

## Note di implementazione
- Nuova route `app/api/cron/allarmi/route.ts`, un solo cron Vercel che
  valuta entrambi gli allarmi una volta al giorno, dopo mezzogiorno
  Europe/Rome — non due cron separati, per restare comodamente dentro
  il limite di Vercel Hobby (2 cron job per progetto, già a 1 con
  `report-presenze`; vedi `CLAUDE.md`).
- Il destinatario riusa la stessa variabile d'ambiente
  `REPORT_EMAIL_DESTINATARIO` di specs/52 (nuovo helper condiviso
  `lib/email.ts:destinatarioNotifiche`, che sostituisce la funzione
  locale `destinatarioReport` di `app/api/cron/report-presenze/route.ts`
  per non duplicare la stessa logica in due file).

## Fuori scope in questa fase
- Una funzione per confermare in ritardo una settimana di ore passata
  (il banner personale avvisa, ma non offre ancora un modo per
  rimediare da qui: la sezione "Ore di lavoro" mostra solo la settimana
  corrente, vedi specs/18, "Fuori scope").
- Una vista per l'admin che riepiloghi chi, tra il personale, non ha
  ancora confermato le settimane passate (oggi visibile solo utente per
  utente, dal proprio banner personale, o dalle email che l'admin
  riceve).
- Altri allarmi (es. un bambino senza presenza per più giorni di fila,
  ore straordinarie anomale): non richiesti in questa fase.
