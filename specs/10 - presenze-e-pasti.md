# 10 — Presenze e pasti (schermata unica)

## Attori
Maestra e assistente (sui bambini delle loro sezioni), admin (su tutti i
bambini). **L'assistente vede solo la parte presenze**: non ha alcun
accesso al registro pasti, nemmeno in lettura (vedi
[03 - utenti-e-ruoli.md](03%20-%20utenti-e-ruoli.md)).

## Obiettivo
Richiesta delle insegnanti: gestire presenza e pasto dello stesso bambino
nello stesso posto, senza passare da una schermata all'altra. Una sola
schermata "Presenze e pasti" (rotta `/dashboard/giornata`), raggiunta
dalla dashboard (vedi
[12 - dashboard-maestre.md](12%20-%20dashboard-maestre.md)), in cui ogni
bambino ha **una sola card** con la presenza a sinistra e il pasto a
destra. Le regole di dominio restano quelle di
[13 - segna-presenza.md](13%20-%20segna-presenza.md) (presenza) e
[14 - segna-pasto.md](14%20-%20segna-pasto.md) (pasto); la comunicazione
dei pasti a Rojac resta quella di
[16 - comunicazione-pasti-rojac.md](16%20-%20comunicazione-pasti-rojac.md):
questo file descrive solo come sono disposte nella schermata.

## Struttura della schermata
Dall'alto verso il basso:
1. Titolo "Presenze e pasti" e selettore di data (←/→/calendario), come
   già per le vecchie schermate separate.
2. Riepilogo aggregato di tutte le classi visibili (card "Riepilogo
   giornaliero" — vedi [12 - dashboard-maestre.md](12%20-%20dashboard-maestre.md)).
3. Box di comunicazione pasti a Rojac (solo maestra e admin — vedi
   [16 - comunicazione-pasti-rojac.md](16%20-%20comunicazione-pasti-rojac.md)).
4. Eventuale messaggio di chiusura scolastica o di sola lettura.
5. I bambini raggruppati per sezione: sopra ciascun gruppo una card
   "Sezione {nome}" con il riepilogo della sezione, poi una card per
   bambino.

Card bambino:
- **Intestazione**: nome e cognome, etichetta allergie (se
  `note_allergie` è compilato, per qualunque ruolo), etichetta
  "🚫 Assente" o "🤒 Malattia" se il bambino è segnato così per la data,
  eventuale warning di incoerenza
  ([06 - controllo-consistenza.md](06%20-%20controllo-consistenza.md)).
- **Colonna "Presenza"** (a sinistra): riga Presente / Pre-asilo /
  Post-asilo, riga Assente / Malattia, nota di presenza + "Salva nota"
  (comportamento in [13 - segna-presenza.md](13%20-%20segna-presenza.md)).
- **Colonna "Pasto"** (a destra, solo maestra e admin): Sì / No, nota del
  pasto + "Salva nota" (comportamento in
  [14 - segna-pasto.md](14%20-%20segna-pasto.md)). Se il bambino è
  "assente" o "malattia", la colonna mostra l'etichetta corrispondente al
  posto dei pulsanti.

Le due note (presenza e pasto) restano separate: sono due campi distinti
con significati diversi.

## Scenario: ogni bambino ha una card con la presenza a sinistra e il pasto a destra
Dato che sono autenticata come maestra (o admin) e ho aperto "Presenze e
pasti" per la data odierna
Quando guardo la card di un bambino
Allora vedo nell'intestazione il suo nome e cognome
E vedo una colonna "Presenza" con i pulsanti Presente, Pre-asilo,
Post-asilo, Assente, Malattia, il campo nota e "Salva nota"
E vedo, a destra della colonna "Presenza", una colonna "Pasto" con i
pulsanti Sì e No, il campo nota e "Salva nota"

## Scenario: un cambio di presenza si vede subito nella colonna pasto della stessa card
Dato che ho aperto "Presenze e pasti" per la data odierna e un bambino
ha i pulsanti Sì/No disponibili nella colonna "Pasto"
Quando premo "Assente" nella colonna "Presenza" della sua card
Allora nella stessa card, senza cambiare pagina, la colonna "Pasto"
mostra l'etichetta "🚫 Assente" al posto dei pulsanti Sì/No

## Scenario: l'assistente vede solo la colonna presenza
Dato che sono autenticata come assistente (con almeno una sezione
assegnata) e ho aperto "Presenze e pasti"
Quando guardo la pagina
Allora ogni card bambino ha solo la colonna "Presenza"
E non vedo nessuna colonna "Pasto", nessun pulsante Sì/No, nessun
riepilogo "Pasti: X/Y" e nessun box di comunicazione pasti a Rojac
E la pagina non contiene alcun dato pasto (non solo nascosto: non viene
nemmeno letto dal database per questo ruolo)

## Scenario: le vecchie pagine Presenze e Pasti portano alla schermata unica
Dato che apro un vecchio indirizzo `/dashboard/presenze?data=<data>` o
`/dashboard/pasti?data=<data>` (segnalibro, link salvato)
Quando la pagina si carica
Allora vengo portata a `/dashboard/giornata?data=<data>`, per la stessa
data (senza data, alla data odierna)
E questo vale anche per l'assistente: aprendo `/dashboard/pasti` arriva
alla schermata unica, dove non vede alcun dato pasto

## Scenario: la schermata è usabile a larghezza mobile
Dato che uso un telefono con una larghezza di 375px
Quando apro "Presenze e pasti"
Allora non c'è scorrimento orizzontale
E in ogni card la colonna "Pasto" sta a destra della colonna "Presenza"
E i pulsanti hanno un'area di tocco alta almeno 32px

## Scenario: sotto i 360px il pasto va sotto la presenza
Dato che uso uno schermo più stretto di 360px
Quando apro "Presenze e pasti"
Allora in ogni card la colonna "Pasto" sta sotto la colonna "Presenza",
dentro la stessa card, senza scorrimento orizzontale

## Regole
- Rotta: `/dashboard/giornata?data=<YYYY-MM-DD>`. Le vecchie rotte
  `/dashboard/presenze` e `/dashboard/pasti` restano solo come
  reindirizzamento (stessa data), per non rompere segnalibri e link già
  salvati.
- Presenza e pasto restano indipendenti (si può segnare il pasto prima
  della presenza, vedi [14 - segna-pasto.md](14%20-%20segna-pasto.md)):
  la schermata unica cambia solo la disposizione, non le regole né i
  permessi (RLS invariata).
- Per l'assistente la pagina non legge `pasti` né `pasti_comunicati`
  (niente query, non solo niente render): la RLS già glielo impedisce,
  ma non si fa nemmeno la richiesta. Di conseguenza i suoi pulsanti Assente/Malattia non
  possono essere disabilitati in anticipo dopo la comunicazione a Rojac:
  è il database a rifiutare, con un messaggio comprensibile (vedi
  [16 - comunicazione-pasti-rojac.md](16%20-%20comunicazione-pasti-rojac.md),
  anche per l'informazione che il rifiuto lascia dedurre).
- Disposizione: colonne affiancate da 360px di larghezza dello schermo in
  su; sotto, presenza sopra e pasto sotto nella stessa card. Pulsanti
  compatti (etichetta corta) con area di tocco alta almeno 32px.
- Ogni card bambino ha un'ancora `#bambino-<id>`, usata come scorciatoia
  dal box di comunicazione pasti (vedi
  [16 - comunicazione-pasti-rojac.md](16%20-%20comunicazione-pasti-rojac.md)).
