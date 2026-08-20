# SPEC.md — Fase 1: uso quotidiano maestre

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

## Funzionalità Fase 1
1. **Login** — email/password via Supabase Auth. ✅ (scaffold)
2. **Dashboard maestra** — lista bambini della propria sezione con stato
   presenza/pasto del giorno corrente.
3. **Segna presenza** — per ogni bambino: presente / assente / malattia, con
   nota opzionale.
4. **Segna pasto** — per ogni bambino: sì / no / parziale, con nota
   opzionale.
5. **Promemoria** — la maestra (o admin) crea un promemoria per: tutti, una
   sezione, o un singolo bambino. Lista dei promemoria visibile in dashboard.
6. **Amministrazione base** — pagina per admin per creare sezioni, bambini, e
   assegnare maestre alle sezioni (necessaria per bootstrap iniziale, non è
   ancora nello scaffold).

## Fuori scope per questa fase
- Rette e pagamenti genitori (Fase 2).
- Report mensili aggregati per amministrazione (Fase 2).
- Portale genitori con interfaccia dedicata (Fase 3).

## Note UX
- Le maestre useranno l'app soprattutto da tablet/telefono in sezione:
  priorità a interfaccia rapida, pochi tap, testo leggibile.
- Le note su allergie/intolleranze (`bambini.note_allergie`) devono essere
  ben visibili quando si segna il pasto — è il caso d'uso con più impatto se
  sbagliato.
