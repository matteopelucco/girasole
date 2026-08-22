# 14 — Segna pasto

## Attori
Maestra (sui bambini delle sue sezioni), Admin (su tutti i bambini).

## Obiettivo
Registrare in pochi tap se un bambino ha mangiato a pranzo, con particolare
attenzione a rendere visibili le eventuali allergie/intolleranze prima di
segnare il pasto, seguendo il flusso calendario → Pasti → classe →
bambini descritto in
[12 - dashboard-maestre.md](12%20-%20dashboard-maestre.md).

## Scenario: da Pasti si arriva alla classe e poi ai bambini
Dato che ho aperto "Pasti" dalla dashboard per una data
Quando seleziono una classe
Allora vedo l'elenco dei bambini di quella classe con lo stato pasto di
quella data, se già segnato

## Scenario: le allergie sono visibili prima di segnare il pasto
Dato che un bambino ha `note_allergie` compilato (es. "Allergia alle
arachidi")
Quando guardo la riga di quel bambino nell'elenco
Allora vedo un'etichetta ben visibile con il testo dell'allergia, accanto
al nome del bambino, indipendentemente dallo stato del pasto

## Scenario: segnare che un bambino ha mangiato
Quando premo "Sì" sulla riga pasto di un bambino
Allora lo stato pasto di oggi per quel bambino diventa "sì"

## Scenario: segnare un pasto parziale con nota
Quando premo "Parziale" e scrivo una nota (es. "solo il primo")
Allora lo stato diventa "parziale" con quella nota salvata

## Scenario: segnare che un bambino non ha mangiato
Quando premo "No" sulla riga pasto di un bambino
Allora lo stato pasto di oggi per quel bambino diventa "no"

## Scenario: la maestra non può modificare il pasto di una data diversa da oggi
Dato che sono autenticata come maestra e ho aperto Pasti per una data
diversa da oggi (passata o futura)
Quando guardo l'elenco bambini di una mia classe
Allora vedo lo stato eventualmente già registrato ma senza pulsanti per
modificarlo: è in sola lettura

## Regole
- Stati validi: `si`, `no`, `parziale`.
- Un solo record di pasto per bambino per giorno (upsert su
  `bambino_id, data`).
- La nota è testo libero, opzionale.
- Scrittura consentita solo allo staff: la maestra della sezione del
  bambino, o l'admin (vedi RLS su `pasti` in
  `supabase/migrations/0001_init.sql`).
- La data usata è "oggi" nel fuso orario Europe/Rome (non UTC), vedi
  `lib/date.ts`.
- Il ruolo "maestra" può scrivere solo sulla data odierna, l'admin su
  qualunque data — stessa regola e stesso meccanismo (RLS) di
  [13 - segna-presenza.md](13%20-%20segna-presenza.md).
- Presenza e pasto sono indipendenti: si può segnare il pasto anche senza
  aver ancora segnato la presenza (utile se la maestra segna prima il
  pranzo e la presenza a fine giornata).
- Se il bambino risulta "malattia" per la data visualizzata, l'etichetta
  malattia appare anche in questo elenco, accanto al nome (vedi
  [13 - segna-presenza.md](13%20-%20segna-presenza.md)).
