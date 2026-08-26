# 06 — Controllo di consistenza dei dati

## Attori
Maestra, assistente, admin — ovunque vedano presenze/pasti di un
bambino: elenchi di [13 - segna-presenza.md](13%20-%20segna-presenza.md)
e [14 - segna-pasto.md](14%20-%20segna-pasto.md), report a schermo e
drill-down giorno per giorno di
[51 - report.md](51%20-%20report.md), report via email di
[52 - report-email-automatico.md](52%20-%20report-email-automatico.md).

## Obiettivo
Segnalare con un warning ben visibile, ovunque un bambino/giorno venga
mostrato, quando i suoi dati di presenza/pasto/pre-asilo/post-asilo sono
tra loro incoerenti — così un'incoerenza (es. dovuta a correzioni fatte
in ordine diverso, come segnare il pasto e solo dopo correggere la
presenza in assente) resta visibile invece di passare inosservata.
Nessuna riga coerente mostra nulla di nuovo: il controllo è silenzioso
quando tutto torna.

## Scenario: nessun warning su una riga coerente
Dato che un bambino ha presenza e pasto coerenti fra loro per un giorno
(es. presente con pasto sì, oppure assente senza pasto segnato)
Quando guardo la sua riga in Presenze, Pasti, nel report o nel
drill-down
Allora non vedo alcun warning

## Scenario: warning per pasto segnato con presenza assente
Dato che un bambino è segnato "assente" per un giorno ma il suo pasto
per quello stesso giorno è segnato "sì"
Quando guardo la sua riga in Presenze o in Pasti per quel giorno
Allora vedo un'etichetta di warning con un messaggio che spiega
l'incoerenza (pasto "sì" con presenza assente)

## Scenario: warning per pasto segnato con presenza malattia
Dato che un bambino è segnato "malattia" per un giorno ma il suo pasto
per quello stesso giorno è segnato "sì"
Quando guardo la sua riga in Presenze o in Pasti per quel giorno
Allora vedo lo stesso tipo di warning, con un messaggio equivalente
riferito alla malattia

## Scenario: warning nel report a schermo
Dato che un bambino ha un giorno incoerente (una delle regole sotto)
all'interno del periodo mostrato dal report (giornaliero, settimanale o
mensile)
Quando guardo la tabella del report
Allora vedo un warning sulla riga di quel bambino, anche se il periodo
copre più giorni e solo uno di essi è incoerente

## Scenario: warning nel drill-down giorno per giorno
Dato che sto guardando il drill-down di un bambino (report settimanale o
mensile)
Quando un giorno del periodo è incoerente
Allora vedo un warning sulla riga di quel giorno specifico

## Scenario: warning nel report via email
Dato che il report notturno viene generato e inviato (specs/52)
Quando un bambino ha un giorno incoerente nel periodo riepilogato da uno
dei tre allegati (giornaliero/settimanale/mensile)
Allora il PDF di quell'allegato riporta un'indicazione di warning sulla
riga di quel bambino (testo semplice, non un'emoji — i font usati per
generare i PDF non supportano caratteri fuori dal set Latin-1/WinAnsi)

## Regole
Le regole di incoerenza controllate, per una singola riga
bambino/giorno:
- Pasto "sì" con presenza "assente".
- Pasto "sì" con presenza "malattia".
- Pre-asilo attivo con presenza diversa da "presente" (incluso nessuno
  stato segnato).
- Post-asilo attivo con presenza diversa da "presente" (incluso nessuno
  stato segnato).

Due combinazioni descritte come requisito ma **non controllabili**,
perché strutturalmente impossibili con lo schema dati attuale, quindi
omesse dal controllo:
- Presenza "presente" insieme ad "assente" o "malattia": `stato` è
  un'unica colonna a valore singolo (`presente`/`assente`/`malattia`),
  non tre flag indipendenti — non può mai valere due cose insieme.
- Pre-asilo/post-asilo attivi con presenza "presente" **richiesta**: è
  già l'unico caso ammesso, non un'incoerenza (vedi
  [13 - segna-presenza.md](13%20-%20segna-presenza.md), "Presenza
  ordinaria, pre-asilo e post-asilo").

Perché il controllo serve comunque, nonostante alcuni vincoli esistano
già a livello di scrittura:
- Pre-asilo/post-asilo con presenza non "presente" è già impedito da un
  vincolo di database sulla stessa riga (CHECK su `presenze`, vedi
  [13 - segna-presenza.md](13%20-%20segna-presenza.md)) — non dovrebbe
  mai poter accadere per dati scritti dall'app. Il controllo qui è
  difesa in profondità (es. dati storici precedenti al vincolo).
- Pasto "sì" con presenza assente/malattia è invece un caso realmente
  raggiungibile: il vincolo esistente (trigger su `pasti`, vedi
  [14 - segna-pasto.md](14%20-%20segna-pasto.md)) blocca solo la
  scrittura del pasto quando la presenza è *già* assente/malattia, ma
  non impedisce di segnare prima il pasto "sì" e *poi* correggere la
  presenza in assente/malattia (le due tabelle sono indipendenti,
  scritte da azioni separate — vedi "Presenza e pasto sono indipendenti"
  in [14 - segna-pasto.md](14%20-%20segna-pasto.md)). Questo è il caso
  reale che il warning intercetta.
- Il messaggio del warning è specifico (spiega quale regola è violata),
  non un'etichetta generica, per permettere una correzione rapida senza
  dover indovinare il problema.
- Il controllo è di sola visualizzazione: non blocca alcuna azione né
  modifica i dati, si limita a segnalare.
