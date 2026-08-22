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
I requisiti dettagliati sono organizzati per scenario in questa cartella.
Numerazione: `0x` requisiti trasversali, `1x` schermata/flusso principale
della maestra, `5x` amministrazione.

- [01 - ux.md](01%20-%20ux.md) — specifiche non funzionali di User
  Experience, trasversali a tutti gli scenari
- [02 - password-recovery.md](02%20-%20password-recovery.md) — recupero
  password dimenticata
- [03 - utenti-e-ruoli.md](03%20-%20utenti-e-ruoli.md) — dati di un
  utente, ruoli disponibili e gestione utenti direttamente dall'app
- [04 - data-types.md](04%20-%20data-types.md) — entità Utente, Classe,
  Anno Scolastico, Alunno e relazioni tra loro
- [05 - feedback.md](05%20-%20feedback.md) — feedback visivo sulle
  azioni (avviata/in corso/riuscita/fallita), trasversale a tutti gli
  scenari che scrivono sul database
- [11 - login.md](11%20-%20login.md) — login e schermata di login
- [12 - dashboard-maestre.md](12%20-%20dashboard-maestre.md) — dashboard
  maestra: lista bambini della sezione con stato presenza/pasto del
  giorno
- [13 - segna-presenza.md](13%20-%20segna-presenza.md) — presente /
  assente / malattia, con nota opzionale
- [14 - segna-pasto.md](14%20-%20segna-pasto.md) — sì / no / parziale, con
  nota opzionale ed evidenza delle allergie del bambino
- [15 - memo.md](15%20-%20memo.md) — promemoria per tutti, una sezione o
  un bambino
- [50 - amministrazione_base.md](50%20-%20amministrazione_base.md) — creazione
  sezioni/bambini e assegnazione maestre alle sezioni (admin)

Quando si aggiunge un requisito nuovo che non rientra in nessuno scenario
esistente, creare un nuovo file numerato in questa cartella (seguendo la
numerazione sopra) e aggiungerlo all'indice qui sopra.
