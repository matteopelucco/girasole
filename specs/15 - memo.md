# 15 — Promemoria

## Attori
Maestra, admin (creazione e lettura). Genitore: sola lettura dei
promemoria a lui destinati.

## Obiettivo
Permettere a maestra o admin di pubblicare, modificare e cancellare una comunicazione per tutte le
famiglie, per una sezione, o per un singolo bambino, e vederne lo storico.
La comunicazione ha opzionalmente una data di validità: oltre quella data, non viene più mostrata ai genitori, ma solo a admin e insegnanti, che possono cancellarlo.

## Scenario: creare un promemoria per tutti
Dato che sono autenticata come maestra o admin
Quando compilo titolo e testo, scelgo nel campo "destinatari" "Tutti" e pubblico
Allora il promemoria compare in cima alla lista, visibile a tutti gli utenti

## Scenario: creare un promemoria per una sezione
Quando scelgo destinatario "Una sezione" e seleziono "una sezione" nel campo "destinatari"
Allora compaere un secondo campo "sezione", dove scelgo la sezione in cui deve apparire il promemoria e il promemoria viene salvato con quella sezione come destinatario
E sarà visibile solo alle famiglie di quella sezione

## Scenario: creare un promemoria per un singolo bambino
Quando scelgo nel campo destinatario "Un bambino" 
Allora compare un secondo campo "bambino" che mostra l'elenco di tutti i bambini attivi, il promemoria viene salvato con quel bambino come destinatario
E sarà visibile solo alla famiglia di quel bambino

## Scenario: il form si svuota dopo aver pubblicato un promemoria
Quando pubblico un promemoria con successo
Allora il form torna vuoto (titolo, testo e destinatario ripristinati ai
valori iniziali), pronto per inserirne subito un altro senza dover
cancellare a mano il contenuto precedente

## Scenario: lista dei promemoria in dashboard
Dato che sono staff (maestra o admin)
Quando apro la dashboard
Allora vedo gli ultimi promemoria pubblicati, più recenti per primi, con
titolo, testo, tipo di destinatario e data

## Scenario: modifica di un promemoria
Quando vedo la lista dei promemoria
Allora posso accedere ad un dettaglio, dove si carica un form con tutti i dati del promemoria e 
posso procedere all'aggiornamento del promemoria

## Scenario: cancellazione di un promemoria
Quando vedo la lista dei promemoria
Allora posso accedere ad un dettaglio, dove insieme al form di modifica, appare un pulsante "cancella";
quando premo il pulsante cancella, mi viene chiesta conferma ("si", "annulla"); 
se premo "si", il sistema cancella il promemoria e torna alla lista, con un messaggio di feedback
se premo "annulla", il sistema nasconde il form di conferma

## Regole
- `destinatario_tipo` è uno tra `tutti`, `sezione`, `bambino`; solo il
  campo coerente (`sezione_id` o `bambino_id`) viene valorizzato.
- Solo lo staff (maestra o admin) può creare promemoria (RLS su
  `promemoria` in `supabase/migrations/0001_init.sql`).
- Lo staff vede tutti i promemoria, indipendentemente dal destinatario;
  un genitore (quando la UI esisterà, Fase 3) vedrà solo quelli
  destinati a "tutti", alla sezione di suo figlio, o a suo figlio.
- Modificare o cancellare un promemoria è permesso a qualunque membro
  dello staff (maestra o admin), non solo a chi lo ha creato — coerente
  con "lo staff vede tutti i promemoria" (RLS in
  `supabase/migrations/0012_pasto_senza_parziale.sql`).
- La cancellazione richiede una conferma esplicita ("sì"/"annulla") per
  evitare cancellazioni accidentali con un tap.
