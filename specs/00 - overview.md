# 00 — Overview — Fase 1: uso quotidiano maestre

## Obiettivo
Permettere alle maestre di registrare in pochi tap presenze e pasti
giornalieri dei bambini della propria sezione, e pubblicare
promemoria/comunicazioni per le famiglie.

## Ruoli
- **admin**: accesso completo, gestisce sezioni/bambini/utenti.
- **maestra**: legge/scrive solo sui bambini delle sezioni a cui è assegnata
  (tabella `maestre_sezioni`).
- **genitore**: sola lettura sui dati del proprio figlio. Fuori dallo scope
  UI di questa fase, ma schema dati e RLS sono già pronti.

## Fuori scope per questa fase
- Rette e pagamenti genitori (Fase 2).
- Report mensili aggregati per amministrazione (Fase 2).
- Portale genitori con interfaccia dedicata (Fase 3).

## Indice degli scenari
I requisiti dettagliati sono organizzati per scenario in questa cartella,
uno per funzionalità della Fase 1:

- [01 - login.md](01%20-%20login.md) — accesso all'app e schermata di login
- [02 - dashboard.md](02%20-%20dashboard.md) — dashboard maestra/admin
- [03 - presenze.md](03%20-%20presenze.md) — segnare la presenza di un bambino
- [04 - pasti.md](04%20-%20pasti.md) — segnare il pasto di un bambino
- [05 - promemoria.md](05%20-%20promemoria.md) — comunicazioni per le famiglie
- [06 - amministrazione.md](06%20-%20amministrazione.md) — gestione di
  sezioni, bambini e maestre (admin)

Quando si aggiunge un requisito nuovo che non rientra in nessuno scenario
esistente, creare un nuovo file numerato in questa cartella e aggiungerlo
all'indice qui sopra.
