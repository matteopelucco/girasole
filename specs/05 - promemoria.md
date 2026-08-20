# 05 — Promemoria

## Attori
Maestra, admin (creazione e lettura). Genitore: sola lettura dei
promemoria a lui destinati, fuori scope UI in questa fase.

## Obiettivo
Permettere a maestra o admin di pubblicare una comunicazione per tutte le
famiglie, per una sezione, o per un singolo bambino, e vederne lo storico.

## Scenario: creare un promemoria per tutti
Dato che sono autenticata come maestra o admin
Quando compilo titolo e testo, scelgo destinatario "Tutti" e pubblico
Allora il promemoria compare in cima alla lista, visibile a tutto lo staff

## Scenario: creare un promemoria per una sezione
Quando scelgo destinatario "Una sezione" e seleziono una sezione
Allora il promemoria viene salvato con quella sezione come destinatario
E in futuro (portale genitori) sarà visibile solo alle famiglie di quella
sezione

## Scenario: creare un promemoria per un singolo bambino
Quando scelgo destinatario "Un bambino" e seleziono un bambino
Allora il promemoria viene salvato con quel bambino come destinatario

## Scenario: lista dei promemoria in dashboard
Dato che sono staff (maestra o admin)
Quando apro la dashboard
Allora vedo gli ultimi promemoria pubblicati, più recenti per primi, con
titolo, testo, tipo di destinatario e data

## Regole
- `destinatario_tipo` è uno tra `tutti`, `sezione`, `bambino`; solo il
  campo coerente (`sezione_id` o `bambino_id`) viene valorizzato.
- Solo lo staff (maestra o admin) può creare promemoria (RLS su
  `promemoria` in `supabase/migrations/0001_init.sql`).
- Lo staff vede tutti i promemoria, indipendentemente dal destinatario;
  un genitore (quando la UI esisterà, Fase 3) vedrà solo quelli
  destinati a "tutti", alla sezione di suo figlio, o a suo figlio.
