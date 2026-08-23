# 04 — Tipi di dato ed entità

## Attori
Admin.

## Obiettivo
Definire i dati e le relazioni delle entità principali del sistema:
Utente, Classe, Anno Scolastico, Alunno.

## Utente
È l'utente che si connette all'applicativo per soddisfare un bisogno
(admin, maestra o genitore — vedi
[03 - utenti-e-ruoli.md](03%20-%20utenti-e-ruoli.md)).

Dati obbligatori: Nome, Cognome, Email.
Dati facoltativi: Indirizzo di residenza, Note.

Ruolo → vedi [03 - utenti-e-ruoli.md](03%20-%20utenti-e-ruoli.md).

## Classe
Rappresenta l'entità classe (`sezioni` a DB, stesso nome usato nel resto
dell'app — vedi [50 - amministrazione_base.md](50%20-%20amministrazione_base.md)),
a cui appartiene un bambino. Segrega l'accesso ai genitori: solo i
genitori dei bambini appartenenti alla classe X vedono i dati della
classe X.

Dati obbligatori: Nome, Attiva (true/false) — le classi non attive non
sono visualizzabili nel sistema da parte dei genitori.

## Anno Scolastico
Dati obbligatori: Nome.

## Alunno
Rappresenta l'alunno frequentante l'asilo (`bambini` a DB, stesso nome
usato nel resto dell'app).

Dati obbligatori: Nome, Cognome, Data di nascita, Sesso.
Dati facoltativi: Note alimentari (`note_allergie` a DB), Altre note.

Un alunno è univoco per Nome + Cognome + Data di nascita (senza distinguere
maiuscole/minuscole): non possono esistere due alunni con questi tre dati
identici — evita inserimenti duplicati dello stesso bambino.

## Relazioni
- **Alunno → Classe**: un alunno appartiene a tante classi nel tempo (un
  alunno che entra in materna 1 ed esce in materna 3 è associato a 3
  classi).
- **Classe → Anno Scolastico**: una classe può appartenere a un solo
  anno scolastico.
- **Alunno → Utente "genitore"**: relazione 1:n, ma limitata — massimo
  un padre e una madre per alunno.
- **Utente "maestra" → Classe**: una maestra gestisce N classi (vedi
  [50 - amministrazione_base.md](50%20-%20amministrazione_base.md)).

## Scenario: admin crea un anno scolastico
Dato che sono autenticato come admin
Quando su `/admin` inserisco un nome (es. "2026/2027") nel form "Anni
scolastici" e confermo
Allora l'anno scolastico compare nell'elenco, disponibile per essere
scelto quando si crea una classe

## Scenario: admin crea una classe con anno scolastico
Quando su `/admin` creo una sezione scegliendo (opzionalmente) un anno
scolastico
Allora la sezione compare in elenco collegata a quell'anno scolastico

## Scenario: admin disattiva e riattiva una classe
Dato che una sezione esiste ed è attiva
Quando su `/admin` premo "Disattiva" su quella sezione
Allora la sezione è marcata "non attiva" in elenco
E premendo "Riattiva" torna attiva

## Scenario: admin inserisce un alunno con data di nascita e sesso
Quando su `/admin` compilo nome, cognome, data di nascita, sesso e
sezione di un bambino, e confermo
Allora il bambino compare in elenco con i dati inseriti

## Scenario: impedire un alunno duplicato
Dato che esiste già un alunno con un certo nome, cognome e data di
nascita
Quando provo a crearne un altro su `/admin` con nome, cognome e data di
nascita identici (anche scritti con maiuscole/minuscole diverse)
Allora vedo un errore chiaro e il nuovo alunno non viene creato

## Scenario: admin aggiunge indirizzo e note a un utente
Quando su `/admin/maestre` compilo indirizzo di residenza e/o note in
fase di creazione o modifica di un utente, e confermo
Allora i dati sono salvati e restano visibili modificando di nuovo
quell'utente

## Regole
- I nomi delle entità nel codice/DB restano quelli già in uso nel resto
  del progetto: `sezioni` per Classe, `bambini` per Alunno (vedi
  `CLAUDE.md`, sezione Convenzioni) — evita una rinomina ad ampio
  raggio di tabelle/RLS/pagine già in produzione.
- `bambini.sezione_id` resta la "classe corrente" di un alunno, usata da
  presenze/pasti (vedi
  [13 - segna-presenza.md](13%20-%20segna-presenza.md),
  [14 - segna-pasto.md](14%20-%20segna-pasto.md)). Lo storico multi-classe
  nel tempo è modellato a parte (vedi Fuori scope sotto).
- L'unicità Nome+Cognome+Data di nascita è imposta con un indice unico
  case-insensitive in DB (`supabase/migrations/0010_alunno_univoco.sql`),
  non solo lato UI: chi crea un bambino via API/script bypassando
  l'interfaccia resta comunque protetto dal duplicato.

## Fuori scope in questa fase
Le seguenti parti dello schema sono pronte a DB (migration
`supabase/migrations/0006_data_types.sql`) ma senza una UI dedicata,
con lo stesso approccio già usato per il portale genitori (vedi
[00 - overview.md](00%20-%20overview.md)):
- Storico "alunno → classe nel tempo" (tabella
  `bambini_sezioni_storico`): oggi l'admin gestisce solo la classe
  corrente di un alunno (`bambini.sezione_id`), non lo storico
  multi-anno.
- Distinzione padre/madre su un genitore (`bambini_genitori.tipo_genitore`,
  con vincolo di al più un padre e una madre per alunno): non esiste
  ancora una pagina che colleghi genitori e alunni.
- Il filtro "classe non attiva non visibile ai genitori" si applicherà
  quando verrà costruito il portale genitori (Fase 3): oggi lo staff
  (admin/maestra) vede comunque tutte le classi, attive o no.
