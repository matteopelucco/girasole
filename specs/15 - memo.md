# 15 — Avvisi

## Attori
Maestra, assistente, admin (creazione e lettura). Genitore: sola lettura
degli avvisi a lui destinati.

## Obiettivo
Permettere a maestra, assistente o admin di pubblicare, modificare e
cancellare un avviso per tutte le famiglie, per una sezione, o per un
singolo bambino, e vederne lo storico. L'avviso ha opzionalmente una
data di validità: oltre quella data, non viene più mostrato ai genitori,
ma solo allo staff (admin, maestre, assistenti), che può cancellarlo.

Nota terminologica: fino a questo requisito, la funzionalità e l'entità
dati si chiamavano "promemoria" — termine mantenuto nel codice e nello
schema del database (tabella `promemoria`, server action
`creaPromemoria`/`aggiornaPromemoria`/`eliminaPromemoria`, route
`/dashboard/promemoria/[id]`) per non introdurre una rinomina ad ampio
raggio di tabelle/RLS/pagine già in produzione — stesso principio già
applicato a Classe/Alunno rispetto a `sezioni`/`bambini` (vedi
[04 - data-types.md](04%20-%20data-types.md)). **In tutto ciò che vede
l'utente — titoli, pulsanti, messaggi — il termine è invece "Avviso"
(singolare) / "Avvisi" (plurale)**, non più "Promemoria".

## Selezione del destinatario: menu a cascata
La scelta del destinatario segue tre passi, ciascuno rivelato solo
quando serve — non più tre menu a tendina sempre visibili
contemporaneamente (comportamento precedente giudicato macchinoso,
soprattutto la scelta del bambino da un unico elenco piatto con tutti i
bambini di tutte le classi, senza raggruppamento):

1. Un menu a tendina "Destinatario" con tre voci: **Tutti** (selezionato
   di default), **Una sezione**, **Un bambino**.
2. Se il destinatario è "Tutti", non compare nessun campo aggiuntivo:
   l'avviso è pronto per essere pubblicato.
3. Se il destinatario è "Una sezione", compare un secondo menu a tendina
   con l'elenco delle sezioni: quella scelta è la sezione destinataria.
4. Se il destinatario è "Un bambino", compare un secondo menu a tendina
   con l'elenco delle sezioni. Scegliendo una sezione, compare un terzo
   menu a tendina con l'elenco dei soli bambini di quella sezione (non
   più tutti i bambini di tutte le classi insieme): quello scelto è il
   bambino destinatario. La sezione scelta in questo passo è solo un
   filtro per restringere l'elenco bambini, non viene salvata come
   sezione destinataria dell'avviso.

## Scenario: creare un avviso per tutti
Dato che sono autenticata come maestra, assistente o admin
Quando compilo titolo e testo, lascio "Tutti" nel campo "destinatario"
(già selezionato di default) e pubblico
Allora l'avviso compare in cima alla lista, visibile a tutti gli utenti

## Scenario: creare un avviso per una sezione
Quando scelgo destinatario "Una sezione"
Allora compare un secondo campo "sezione", dove scelgo la sezione in cui
deve apparire l'avviso, e l'avviso viene salvato con quella sezione come
destinatario
E sarà visibile solo alle famiglie di quella sezione

## Scenario: creare un avviso per un singolo bambino
Quando scelgo destinatario "Un bambino"
Allora compare un secondo campo "sezione": lo scelgo per restringere
l'elenco
E compare quindi un terzo campo "bambino", che mostra solo i bambini
attivi di quella sezione
E scelto il bambino, l'avviso viene salvato con quel bambino come
destinatario
E sarà visibile solo alla famiglia di quel bambino

## Scenario: cambiare la sezione filtro aggiorna l'elenco bambini
Dato che ho scelto destinatario "Un bambino" e una prima sezione, con il
relativo elenco bambini visibile
Quando cambio la sezione scelta nel secondo campo
Allora il terzo campo si aggiorna mostrando solo i bambini della nuova
sezione scelta, e un bambino eventualmente già selezionato per la
sezione precedente non resta selezionato

## Scenario: tornare a "Tutti" nasconde i campi sezione/bambino
Dato che ho scelto destinatario "Una sezione" o "Un bambino", con i
relativi campi aggiuntivi visibili
Quando riporto il destinatario su "Tutti"
Allora i campi sezione (e bambino) spariscono dal form

## Scenario: il form si svuota dopo aver pubblicato un avviso
Quando pubblico un avviso con successo
Allora il form torna vuoto (titolo, testo e destinatario ripristinati ai
valori iniziali — destinatario di nuovo su "Tutti", nessun campo
sezione/bambino visibile), pronto per inserirne subito un altro senza
dover cancellare a mano il contenuto precedente

## Scenario: lista degli avvisi in dashboard
Dato che sono staff (maestra, assistente o admin)
Quando apro la dashboard
Allora vedo gli ultimi avvisi pubblicati, più recenti per primi, con
titolo, testo, tipo di destinatario e data

## Scenario: modifica di un avviso
Quando vedo la lista degli avvisi
Allora posso accedere ad un dettaglio, dove si carica un form con tutti
i dati dell'avviso (inclusa la stessa selezione a cascata del
destinatario, pre-compilata coerentemente con il destinatario salvato)
e posso procedere all'aggiornamento

## Scenario: cancellazione di un avviso
Quando vedo la lista degli avvisi
Allora posso accedere ad un dettaglio, dove insieme al form di modifica,
appare un pulsante "Elimina avviso"; quando premo il pulsante elimina,
mi viene chiesta conferma ("Sì", "Annulla");
se premo "Sì", il sistema cancella l'avviso e torna alla lista, con un
messaggio di feedback
se premo "Annulla", il sistema nasconde il form di conferma

## Regole
- `destinatario_tipo` è uno tra `tutti`, `sezione`, `bambino`; solo il
  campo coerente (`sezione_id` o `bambino_id`) viene salvato — se il
  destinatario è "Un bambino", `sezione_id` non viene salvato (è stato
  solo un filtro in fase di scelta): la colonna resta nulla.
- Se il destinatario è "Una sezione" ma non è stata scelta una sezione,
  o "Un bambino" ma non è stato scelto un bambino, la pubblicazione
  viene rifiutata con un messaggio d'errore chiaro (validazione sia
  lato client — campo obbligatorio — sia lato server).
- Solo lo staff (maestra, assistente o admin) può creare avvisi (RLS su
  `promemoria` in `supabase/migrations/0001_init.sql`).
- Lo staff vede tutti gli avvisi, indipendentemente dal destinatario; un
  genitore (quando la UI esisterà, Fase 3) vedrà solo quelli destinati a
  "tutti", alla sezione di suo figlio, o a suo figlio.
- Modificare o cancellare un avviso è permesso a qualunque membro dello
  staff (maestra, assistente o admin), non solo a chi lo ha creato —
  coerente con "lo staff vede tutti gli avvisi" (RLS in
  `supabase/migrations/0012_pasto_senza_parziale.sql`).
- La cancellazione richiede una conferma esplicita ("Sì"/"Annulla") per
  evitare cancellazioni accidentali con un tap.
