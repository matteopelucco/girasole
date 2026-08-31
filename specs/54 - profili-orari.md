# 54 — Profili orari

## Attori
Admin.

## Obiettivo
Dare all'admin uno strumento per definire, in un pannello dedicato,
degli "orari tipo" (es. "35 ore settimanali", "32 ore settimanali",
"Assistente 3h/giorno") con le ore previste per ciascun giorno feriale,
e assegnarne uno a ciascuna persona — così da avere, per ogni membro del
personale abilitato al report ore (vedi
[17 - ore-di-lavoro.md](17%20-%20ore-di-lavoro.md)), un riferimento di
quante ore dovrebbe lavorare ogni giorno. **Come** questo riferimento
verrà poi usato (confronto con le ore segnate, calcolo di
straordinari/assenze, riepiloghi) è fuori scope, sarà definito in una
fase successiva.

## Scenario: creare un profilo orario
Dato che sono autenticato come admin
Quando su `/admin/profili-orari` inserisco un nome (es. "35 ore
settimanali") e le ore previste per lunedì, martedì, mercoledì, giovedì
e venerdì, e confermo
Allora il profilo compare nell'elenco, con il totale ore settimanali
calcolato automaticamente (somma dei 5 giorni)

## Scenario: modificare un profilo orario
Dato che ho aperto la scheda di dettaglio di un profilo orario esistente
Quando trovo un form con nome e ore pre-caricati, modifico uno o più
valori e confermo
Allora i nuovi dati sono salvati e restano visibili riaprendo la scheda,
totale settimanale ricalcolato di conseguenza

## Scenario: eliminare un profilo orario
Dato che sono sulla scheda di dettaglio di un profilo orario
Quando premo "Elimina" e confermo
Allora il profilo scompare dall'elenco
E ogni utente a cui era assegnato resta con i propri dati invariati, ma
senza più un profilo assegnato ("Nessun profilo orario") — l'eliminazione
non è mai bloccata dal fatto che il profilo sia in uso

## Scenario: assegnare un profilo orario a un utente esistente
Dato che un utente esiste già
Quando su `/admin/maestre` scelgo un profilo orario dal menu "Profilo
orario" per quell'utente e premo "Aggiorna"
Allora il profilo scelto è salvato e resta selezionato riaprendo la
pagina

## Scenario: scegliere subito un profilo orario in fase di creazione utente
Quando su `/admin/maestre` creo un nuovo utente e scelgo un profilo
orario dal menu "Profilo orario" prima di confermare
Allora l'utente viene creato con quel profilo già assegnato

## Scenario: rimuovere l'assegnazione di un profilo orario
Quando su `/admin/maestre` scelgo "Nessun profilo orario" per un utente
che ne aveva uno assegnato, e premo "Aggiorna"
Allora quell'utente risulta senza profilo orario assegnato

## Scenario: accesso negato a chi non è admin
Dato che sono autenticato come maestra, assistente o genitore
Quando provo ad aprire `/admin/profili-orari`
Allora vengo reindirizzato alla dashboard

## Regole
- Un profilo orario ha un nome libero (`profili_orari.nome`, nessun
  formato imposto: l'admin può scrivere "35 ore settimanali" o
  qualunque altra etichetta gli sia comoda) e un numero di ore per
  ciascuno dei 5 giorni feriali (lunedì-venerdì): numeri non negativi,
  fino a due decimali (es. 7, 7.5). Sabato e domenica non sono previsti:
  l'asilo è chiuso implicitamente ogni weekend (vedi
  [53 - calendario-scolastico.md](53%20-%20calendario-scolastico.md)).
- Il totale ore settimanali mostrato in elenco e nella scheda è sempre
  calcolato come somma dei 5 giorni, non un campo salvato a parte da
  tenere sincronizzato a mano.
- L'assegnazione profilo↔utente (`profili.profilo_orario_id`) e
  l'abilitazione al report ore (`profili.abilitato_ore_lavoro`, vedi
  [17 - ore-di-lavoro.md](17%20-%20ore-di-lavoro.md)) sono due controlli
  indipendenti: il selettore "Profilo orario" è disponibile per
  qualunque utente su `/admin/maestre`, abilitato o no. Assegnare un
  profilo non abilita automaticamente il report ore, e abilitare il
  report ore non richiede necessariamente un profilo già assegnato —
  in quel caso l'utente è abilitato ma senza profilo, stato valido e
  non bloccante in questa fase.
- Solo un profilo con ruolo `admin` può creare, modificare, eliminare o
  assegnare profili orari (RLS in
  `supabase/migrations/0024_profili_orari.sql`); nessun altro ruolo li
  legge in questa fase (non ancora mostrati allo staff, vedi Obiettivo).
- Eliminare un profilo orario assegnato a uno o più utenti non è
  bloccato: l'assegnazione di quegli utenti torna semplicemente vuota
  (`on delete set null`), stesso pattern già usato per
  `sezioni.anno_scolastico_id` (vedi
  [04 - data-types.md](04%20-%20data-types.md)).
- Fuori scope in questa fase: come i profili orari verranno
  effettivamente usati (form di inserimento ore/assenze, confronto con
  le ore segnate, calcolo di straordinari o assenze, riepiloghi,
  export) — qui si definiscono e si assegnano solo i profili.
