# 13 — Segna presenza

## Attori
Maestra (sui bambini delle sue sezioni), Admin (su tutti i bambini).

## Obiettivo
Registrare in pochi tap lo stato di presenza giornaliero di ogni bambino,
con una nota libera opzionale.

## Scenario: segnare un bambino presente
Dato che sto guardando l'elenco dei bambini nella dashboard (vedi
[12 - dashboard-maestre.md](12%20-%20dashboard-maestre.md))
Quando premo il pulsante "Presente" su un bambino
Allora lo stato di presenza di oggi per quel bambino diventa "presente"
E il pulsante "Presente" resta evidenziato come stato corrente

## Scenario: segnare un'assenza con nota
Quando premo "Assente" e scrivo una nota (es. "influenza, rientra lunedì")
Allora lo stato diventa "assente" con quella nota salvata

## Scenario: correggere uno stato già segnato
Dato che un bambino è già segnato "presente" per oggi
Quando premo "Malattia"
Allora lo stato per oggi viene sovrascritto in "malattia"
E resta un solo record di presenza per quel bambino per quella data

## Regole
- Stati validi: `presente`, `assente`, `malattia`.
- Un solo record di presenza per bambino per giorno (upsert su
  `bambino_id, data`).
- La nota è testo libero, opzionale.
- Scrittura consentita solo allo staff: la maestra della sezione del
  bambino, o l'admin (vedi RLS su `presenze` in
  `supabase/migrations/0001_init.sql`).
- La data usata è "oggi" nel fuso orario Europe/Rome (non UTC), vedi
  `lib/date.ts`.
