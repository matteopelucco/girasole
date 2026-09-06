# 52 — Invio automatico notturno dei report

## Attori
Nessun utente umano: un job pianificato (Vercel Cron). Destinatario:
una casella email dello staff (di default `info@asilosartorio.it`), non
un utente dell'app.

## Obiettivo
Ogni notte, subito dopo la mezzanotte (fuso Europe/Rome), inviare via
email allo staff dell'asilo i report di presenze/pasti — giornaliero,
settimanale e mensile — relativi al giorno appena concluso, come
allegati PDF pronti per la stampa, così che l'asilo abbia sempre una
copia cartacea/archiviabile senza dover aprire l'app. La stessa mail
riporta anche, nel corpo, un riepilogo delle ore di lavoro del personale
della settimana in corso, e allega periodicamente un PDF con il
dettaglio mensile delle ore di ciascuna persona abilitata (vedi
[19 - monte-ore.md](19%20-%20monte-ore.md) e
[18 - report-ore-lavoro.md](18%20-%20report-ore-lavoro.md)).

Questo requisito estende e sostituisce lo scenario "riepilogo giornaliero
via email a mezzanotte" descritto in precedenza in
[13 - segna-presenza.md](13%20-%20segna-presenza.md): il contenuto del
report giornaliero resta lo stesso (presenze/assenze/malattie per
classe), ma ora è uno dei tre allegati, non più l'unico, e i dati sono
quelli del report tabellare di [51 - report.md](51%20-%20report.md)
(che include anche pre-asilo/post-asilo e pasti), non più una scheda a
parte.

## Scenario: invio notturno dei tre report
Dato che una giornata è appena terminata nel fuso Europe/Rome
Quando il job pianificato gira (Vercel Cron, una volta per notte)
Allora viene inviata una mail all'indirizzo configurato, con tre allegati
PDF: il report giornaliero del giorno appena concluso, il report
settimanale della settimana che contiene quel giorno (calcolato "a
tutt'oggi", fino a quel giorno incluso) e il report mensile del mese che
contiene quel giorno (calcolato "a tutt'oggi", fino a quel giorno
incluso)
E ogni PDF ha lo stesso contenuto informativo del corrispondente report
a schermo in [51 - report.md](51%20-%20report.md): bambini raggruppati
per classe attiva, con presenze, presenze pre-asilo, presenze post-asilo
e pasti "sì"
E ciascun PDF riporta in intestazione il periodo a cui si riferisce e la
data di generazione, in un formato adatto alla stampa (A4 verticale)
E il corpo stesso dell'email (non solo gli allegati PDF) mostra il
riepilogo del giorno appena concluso in forma tabellare — una tabella
per classe attiva, con le stesse colonne del report giornaliero a
schermo (Bambino, Presenze, Pre-asilo, Post-asilo, Pasti) — non più un
elenco puntato: così il contenuto è leggibile anche senza aprire un
allegato, sia su client email desktop che mobile

## Scenario: idempotenza per giorno
Dato che il job è già stato eseguito con successo per il giorno X
Quando il job viene rieseguito per lo stesso giorno X (es. un retry
manuale, o un doppio trigger di Vercel Cron)
Allora non viene inviata una seconda mail per quel giorno
E ciascuno dei tre report (giornaliero/settimanale/mensile) è tracciato
come inviato in modo indipendente: se, per un motivo qualunque, un solo
report fosse fallito mentre gli altri due sono stati inviati, un nuovo
tentativo invia solo quello mancante

## Scenario: modalità "solo a fine periodo" per settimanale e mensile
Dato che la modalità di invio è configurata su "fine periodo" (vedi
Regole)
Quando il job gira per un giorno che NON è l'ultimo giorno della
settimana (domenica) né l'ultimo giorno del mese
Allora quella notte viene inviato solo il PDF giornaliero, non quello
settimanale né quello mensile
E quando il job gira per una domenica, viene inviato anche il PDF
settimanale della settimana appena conclusa
E quando il job gira per l'ultimo giorno di un mese, viene inviato anche
il PDF mensile del mese appena concluso

## Scenario: nessuna classe attiva o nessun dato
Dato che non esiste alcuna classe attiva, oppure nessun bambino ha dati
per il periodo
Quando il job gira
Allora i PDF vengono comunque generati e inviati, con un contenuto che
indica esplicitamente "nessuna classe attiva" o "nessun dato per questo
periodo" (nessun invio silenzioso saltato: l'assenza di dati è
un'informazione utile quanto la presenza)

## Scenario: riepilogo delle ore di lavoro del personale nel corpo dell'email
Dato che il job pianificato gira, e viene inviato il report giornaliero
Quando genero il corpo dell'email
Allora, oltre alla tabella di presenze/pasti, il corpo mostra una
sezione "Ore di lavoro" con una tabella — una riga per ciascuna persona
abilitata al report ore (vedi
[17 - ore-di-lavoro.md](17%20-%20ore-di-lavoro.md)) — con nome, ore
ordinarie e straordinarie registrate nella settimana che contiene il
giorno appena concluso (fino a quel giorno incluso, "a tutt'oggi"), il
totale, e il saldo di monte ore attuale (vedi
[19 - monte-ore.md](19%20-%20monte-ore.md))
E se nessuna persona è abilitata al report ore, la sezione mostra
esplicitamente che non c'è personale abilitato, invece di essere omessa

## Scenario: PDF mensile delle ore del personale in allegato
Dato che quella notte viene inviato anche il report mensile di
presenze/pasti (vedi "modalità solo a fine periodo" sopra: sempre in
modalità "sempre", solo l'ultima notte del mese in modalità
"fine_periodo")
Quando l'email viene inviata
Allora, oltre agli allegati già previsti, è allegato anche un PDF con le
ore di lavoro del personale del mese "a tutt'oggi" (calcolato allo
stesso modo del report mensile di presenze/pasti — vedi Regole)
E il PDF contiene una pagina per ciascuna persona abilitata al report
ore, con: il suo nome, il mese solare a cui si riferisce, il profilo
orario di riferimento assegnato (nome e ore per giorno), e una tabella
con un giorno per riga (data, giorno della settimana, stato, ore
ordinarie, ore straordinarie, ed eventuale dettaglio — motivo
straordinario, codice malattia o nota assenza) limitatamente alle
settimane di quel mese già confermate (vedi [18](18%20-%20report-ore-lavoro.md))
E se una o più settimane del mese non sono ancora state confermate, il
PDF lo segnala esplicitamente per quella persona (intervallo di date
escluso, non semplicemente omesso in silenzio)
E in fondo alla pagina di ciascuna persona compare il riepilogo del
mese: variazione di monte ore nel mese (somma dei movimenti
`settimanale` la cui settimana inizia in quel mese) e saldo di monte
ore a fine mese

## Regole
- Destinatario configurabile, non hardcoded: variabile d'ambiente
  `REPORT_EMAIL_DESTINATARIO`, con `info@asilosartorio.it` come valore
  di default se la variabile non è impostata. Accetta un solo indirizzo
  in questa fase (più destinatari è backlog, non richiesto ora).
- Modalità di invio dei report settimanale/mensile configurabile tramite
  variabile d'ambiente `REPORT_EMAIL_MODALITA_PERIODICI`, due valori
  ammessi:
  - `sempre` (**default**) — settimanale e mensile vengono ricalcolati
    e inviati ogni notte insieme al giornaliero, "a tutt'oggi".
  - `fine_periodo` — settimanale inviato solo la notte di domenica
    (settimana appena conclusa), mensile solo l'ultima notte del mese
    (mese appena concluso); il giornaliero è comunque inviato ogni
    notte in entrambe le modalità.
- Il giorno "riepilogato" da ogni esecuzione del job è sempre quello
  appena concluso nel fuso Europe/Rome (stessa logica già in uso, vedi
  `lib/date.ts`), indipendentemente dalla modalità.
- La settimana va da lunedì a domenica, stessa definizione di
  [51 - report.md](51%20-%20report.md).
- Idempotenza tracciata per tipo di report e periodo di riferimento (non
  più una sola tabella `data → inviato`, ma una entry per
  giornaliero/settimanale/mensile): un nuovo report notturno non deve
  sostituire una tabella esistente ma estenderla, per non perdere lo
  storico degli invii già tracciati da
  `supabase/migrations/0009_scrittura_solo_oggi_maestra.sql`
  (`report_giornalieri_inviati`).
- Il job è protetto dallo stesso meccanismo già in uso per il cron
  esistente (header `Authorization: Bearer $CRON_SECRET` inviato in
  automatico da Vercel Cron quando la variabile d'ambiente `CRON_SECRET`
  è configurata).
- Un errore nell'invio (es. servizio email non raggiungibile) non deve
  marcare il periodo come "inviato": un tentativo successivo deve poter
  ritentare lo stesso periodo (vedi scenario idempotenza).
- Il PDF mensile delle ore di lavoro non ha una propria idempotenza
  separata: è generato e allegato insieme al report mensile di
  presenze/pasti, quindi segue esattamente la stessa condizione di invio
  e lo stesso tracciamento (`report_periodici_inviati`, tipo
  `mensile`) — se il mensile risulta già inviato per quella data, non si
  rigenera nulla, PDF ore lavoro incluso.

## Note di implementazione
- Il job esiste già per il solo report giornaliero HTML (senza PDF):
  `app/api/cron/report-presenze/route.ts`, `lib/reportPresenze.ts`,
  `vercel.json` (`"0 23 * * *"`, UTC — cade sempre a/dopo mezzanotte
  Europe/Rome sia in ora solare sia legale). Questo requisito estende
  quella route, non ne crea una nuova: stesso orario di esecuzione,
  stesso invio via `lib/email.ts` (Resend), stessa protezione
  `CRON_SECRET`.
- **Generazione PDF: nessuna libreria di generazione PDF è presente nel
  progetto oggi.** `CLAUDE.md` richiede di non introdurre nuove
  dipendenze senza chiederlo prima: la scelta della libreria (es. una
  libreria PDF leggera lato server, oppure il rendering HTML→PDF di una
  pagina già esistente) resta un passaggio da concordare esplicitamente
  in fase di implementazione, non è stata decisa qui.
- Il contenuto dei tre PDF, e quello della tabella nel corpo
  dell'email, riusano la stessa logica di aggregazione già scritta per
  la UI di [51 - report.md](51%20-%20report.md) (`lib/report.ts`), per
  evitare di duplicare il calcolo di presenze/pasti/pre-asilo/
  post-asilo in più posti (vedi `CLAUDE.md`, sezione Analisi statica —
  `jscpd`).
- Il riepilogo ore nel corpo email e il PDF mensile ore lavoro riusano
  allo stesso modo la logica già scritta per
  [18 - report-ore-lavoro.md](18%20-%20report-ore-lavoro.md) e
  [19 - monte-ore.md](19%20-%20monte-ore.md) (`lib/oreLavoro.ts`,
  `lib/monteOre.ts`), tramite un nuovo modulo di aggregazione
  `lib/reportOreLavoro.ts` (pattern identico a `lib/reportPresenze.ts`)
  e un generatore PDF `lib/pdfOreLavoro.ts` che riusa i primitivi di
  disegno già presenti in `lib/pdfReport.ts` (gestione pagina/
  interruzione, disegno riga) invece di duplicarli.
