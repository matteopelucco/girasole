# 61 — Mail mensile dei pasti a Rojac

## Attori
Solo Admin. Maestra, assistente e genitore non vedono né l'invio né il
modello della mail.

## Obiettivo
Rojac (la mensa esterna) fattura all'asilo a fine mese. Dalla sezione
"Report", vista **Mensile**, l'admin invia a Rojac una mail di riepilogo
del mese con due numeri:

- **pasti bambini**: la somma dei pasti comunicati ogni giorno dalle
  maestre (il log "Comunicazione pasti" già mostrato nel report, vedi
  [16 - comunicazione-pasti-rojac.md](16%20-%20comunicazione-pasti-rojac.md)
  e [51 - report.md](51%20-%20report.md));
- **pasti insegnanti**: ogni giorno di scuola l'asilo ne chiede 2 in più,
  per le insegnanti; sono quindi 2 × i giorni di scuola del mese.

La mail ha come destinatario l'indirizzo di Rojac e, in copia (CC),
l'indirizzo dell'asilo. Oggetto e corpo vengono da un modello
modificabile e salvabile da interfaccia, come per le rette
([56 - comunicazione-retta-mensile.md](56%20-%20comunicazione-retta-mensile.md)).

## Scenario: vedere il riepilogo mensile per Rojac nel report
Dato che sono autenticato come admin e ho aperto "Report" in vista
"Mensile" per il mese corrente o un mese passato
Allora sotto l'elenco "Comunicazione pasti" vedo il riquadro "Mail
mensile a Rojac" con il numero di pasti bambini, il numero di pasti
insegnanti e il totale dei pasti del mese
E vedo il pulsante "Invia a Rojac" e il link "Modello email Rojac"

## Scenario: i pasti insegnanti sono 2 per ogni giorno di scuola
Dato che sto guardando il riquadro "Mail mensile a Rojac" di un mese
Allora i pasti insegnanti sono 2 × i giorni di scuola del mese: i giorni
che non sono sabato o domenica e non cadono in un giorno di chiusura
([53 - calendario-scolastico.md](53%20-%20calendario-scolastico.md))
E nel mese corrente si contano solo i giorni fino a oggi compreso (il
mese non è ancora finito, come per il report mensile "a tutt'oggi" di
[52 - report-email-automatico.md](52%20-%20report-email-automatico.md))
E un giorno di scuola conta anche se quel giorno nessuna maestra ha
comunicato i pasti

## Scenario: il riquadro non c'è per gli altri ruoli e per le altre viste
Dato che sono autenticato come maestra o assistente, oppure come admin in
vista "Settimanale" o "Giornaliero", oppure su un mese futuro
Allora non vedo il riquadro "Mail mensile a Rojac"

## Scenario: anteprima prima dell'invio
Dato che sto guardando il riquadro "Mail mensile a Rojac"
Quando premo "Invia a Rojac"
Allora si apre un'anteprima con il destinatario (indirizzo di Rojac), la
copia (indirizzo dell'asilo), l'oggetto e il corpo con i segnaposto già
sostituiti
E vedo i pulsanti "Conferma invio" e "Annulla"

## Scenario: annullare l'anteprima non invia nulla
Dato che l'anteprima è aperta
Quando premo "Annulla"
Allora l'anteprima si chiude e nessuna mail parte

## Scenario: confermare l'invio manda la mail a Rojac con l'asilo in copia
Dato che l'anteprima è aperta, l'indirizzo di Rojac è configurato e il
servizio email è raggiungibile
Quando premo "Conferma invio"
Allora parte una sola mail a Rojac, con l'indirizzo dell'asilo in CC
E nel riquadro compare la conferma "Riepilogo inviato a Rojac"

## Scenario: una risposta di Rojac arriva all'asilo, non al mittente tecnico
Dato che la mail mensile è stata inviata a Rojac
Quando Rojac preme "Rispondi"
Allora la risposta va all'indirizzo dell'asilo
(`destinatarioNotifiche()`, `Reply-To`) e non all'indirizzo mittente
tecnico (`RESEND_MITTENTE`, che non è una casella letta da nessuno)
E Rojac resta in A (TO) e l'asilo in CC, invariati

## Scenario: indirizzo di Rojac non configurato
Dato che l'indirizzo email di Rojac non è configurato
Allora al posto dell'invio il riquadro mi avvisa che l'indirizzo di Rojac
non è configurato e non posso inviare nessuna mail

## Scenario: errore nell'invio
Dato che l'anteprima è aperta
Quando premo "Conferma invio" e il servizio email risponde con un errore
Allora vedo un messaggio d'errore chiaro (specs/05) e nessun invio è
considerato riuscito

## Scenario: modificare il modello della mail
Dato che sono su "Modello email Rojac" (raggiungibile dal riquadro nel
report)
Quando modifico oggetto e/o corpo, usando i segnaposto disponibili
documentati in pagina, e salvo
Allora il nuovo modello viene salvato e usato dalle prossime anteprime e
dai prossimi invii
E vedo la data/ora dell'ultimo salvataggio aggiornarsi sotto il pulsante
"Salva modello" (specs/05)

## Scenario: accesso negato a chi non è admin
Dato che sono autenticato come maestra, assistente o genitore
Quando provo ad aprire `/admin/rojac/template`
Allora vengo reindirizzato alla dashboard

## Regole
- Il mese è quello della vista "Mensile" del report (`?periodo=YYYY-MM`).
  L'invio è possibile solo per il mese corrente e per i mesi passati.
- Pasti bambini = somma di `pasti_comunicati.numero_pasti` delle date del
  mese; pasti insegnanti = `PASTI_INSEGNANTI_AL_GIORNO` (2) × giorni di
  scuola; totale = pasti bambini + pasti insegnanti. Logica pura in
  `lib/emailRojac.ts` (con unit test).
- Segnaposto del modello, sostituiti al momento dell'anteprima e
  dell'invio: `{{mese}}`, `{{pasti_bambini}}`, `{{pasti_insegnanti}}`,
  `{{giorni_scuola}}`, `{{totale_pasti}}`. Un segnaposto sconosciuto resta
  invariato (stessa regola di specs/56).
- Il testo della mail è HTML: il modello viene escapato e gli a capo
  diventano interruzioni di riga.
- Indirizzo di Rojac: variabile d'ambiente `ROJAC_EMAIL_DESTINATARIO`
  (secret applicativo, mai committato; per ora non da interfaccia).
  Indirizzo in copia: l'indirizzo di notifica dell'asilo
  (`destinatarioNotifiche()`, `REPORT_EMAIL_DESTINATARIO`, default
  `info@asilosartorio.it`).
- Il modello è una tabella a riga singola `impostazioni_email_rojac`
  (migration 0060), leggibile e modificabile solo dall'admin (RLS).
- Lo stesso indirizzo dell'asilo è impostato anche come `Reply-To`
  (parametro `rispondiA` di `inviaEmail`, come per le comunicazioni ai
  genitori di specs/56; issue #263): senza, la risposta di Rojac
  tornerebbe al mittente tecnico.
- L'invio usa lo stesso servizio degli altri invii (`lib/email.ts`,
  Resend). Questo requisito non registra un log degli invii: ogni invio
  richiede un'anteprima e una conferma esplicita.

## Fuori scope
- Invio automatico a fine mese e modifica dell'indirizzo di Rojac da
  interfaccia.
- Registro persistente degli invii a Rojac e blocco del doppio invio
  dello stesso mese.
