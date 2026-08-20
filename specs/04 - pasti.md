# 04 — Pasti

## Attori
Maestra (sui bambini delle sue sezioni), Admin (su tutti i bambini).

## Obiettivo
Registrare in pochi tap se un bambino ha mangiato a pranzo, con particolare
attenzione a rendere visibili le eventuali allergie/intolleranze prima di
segnare il pasto.

## Scenario: le allergie sono visibili prima di segnare il pasto
Dato che un bambino ha `note_allergie` compilato (es. "Allergia alle
arachidi")
Quando la maestra guarda la riga di quel bambino nella dashboard
Allora vede un'etichetta ben visibile con il testo dell'allergia, accanto
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
- Presenza e pasto sono indipendenti: si può segnare il pasto anche senza
  aver ancora segnato la presenza (utile se la maestra segna prima il
  pranzo e la presenza a fine giornata).
