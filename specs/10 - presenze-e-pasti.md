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
bambino ha **una sola card** con un'intestazione, una sezione presenza e
una sezione pasto (affiancate su tablet e desktop, una sotto l'altra su
telefono). Le regole di dominio restano quelle di
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

Card bambino (disegno rivisto nella issue
[#106](https://github.com/matteopelucco/girasole/issues/106), su un
mockup fornito da Matteo, struttura rivista nella issue
[#110](https://github.com/matteopelucco/girasole/issues/110)), su **una
sola colonna a qualunque larghezza** (telefono, tablet, computer), divisa
dall'alto in basso in quattro parti separate da una linea sottile:
- **Intestazione**: a sinistra un avatar illustrato in un cerchio con
  bordo bianco, a destra nome e cognome in evidenza (titolo della card).
  L'avatar dipende dal campo `sesso` del bambino (gestito dall'admin,
  vedi [50 - amministrazione_base.md](50%20-%20amministrazione_base.md)),
  ed è un'illustrazione generica, non una foto (issue
  [#108](https://github.com/matteopelucco/girasole/issues/108)): una
  **bambina** (capelli lunghi, cerchietto) su sfondo rosa per `F`, un
  **bambino** (capelli corti) su sfondo azzurro per `M`, una **sagoma
  neutra** grigia se il sesso non è compilato. Niente simboli ♀/♂ né
  scritte "Femmina"/"Maschio". Lo sfondo dell'intestazione è **rosa
  tenue** per le femmine, **azzurro tenue** per i maschi, **grigio** se
  il sesso non è compilato. Nell'intestazione restano anche l'etichetta
  allergie (se `note_allergie` è compilato, per qualunque ruolo),
  l'etichetta "🚫 Assente" o "🤒 Malattia" se il bambino è segnato così
  per la data, e l'eventuale warning di incoerenza
  ([06 - controllo-consistenza.md](06%20-%20controllo-consistenza.md)).
  Nessuna foto del bambino: l'avatar è lo stesso per tutti i bambini
  dello stesso sesso.
- **Sezione "Presenza"** (icona piena di una persona): pulsanti grandi,
  due per riga, nell'ordine Presente, Pre-asilo, Post-asilo, Assente,
  Malattia; lo stato (o l'indicatore) selezionato è pieno, colorato e con
  un segno ✓, gli altri hanno solo il bordo (comportamento in
  [13 - segna-presenza.md](13%20-%20segna-presenza.md)).
- **Sezione "Pasto"** (icona piena di forchetta e coltello, solo maestra
  e admin): pulsanti grandi
  Sì / No affiancati, con lo stesso stile di selezione, **senza campo
  nota** (comportamento in [14 - segna-pasto.md](14%20-%20segna-pasto.md)).
  Se il bambino è "assente" o "malattia", la sezione mostra l'etichetta
  corrispondente al posto dei pulsanti.
- **Sezione "Nota"** (icona piena di un documento), in fondo alla card:
  etichetta "Nota (opzionale)", campo di testo a tutta larghezza e sotto
  il pulsante "Salva nota" a tutta larghezza. È la nota della presenza
  (`presenze.note`, comportamento in
  [13 - segna-presenza.md](13%20-%20segna-presenza.md)): cambia solo la
  posizione, non il dato. In sola lettura (giorno non modificabile) la
  sezione mostra il testo della nota, e non compare se la nota è vuota.

Una sola nota per card, quella della presenza (issue
[#109](https://github.com/matteopelucco/girasole/issues/109)): con presenza
e pasto nella stessa card, una seconda nota per il pasto era una
ridondanza. Le note pasto già salvate restano nel database
(`pasti.note`), ma la schermata non le mostra né le modifica più.

## Scenario: ogni bambino ha una card con intestazione, sezione presenza, sezione pasto e nota
Dato che sono autenticata come maestra (o admin) e ho aperto "Presenze e
pasti" per la data odierna, su uno schermo da computer
Quando guardo la card di un bambino
Allora vedo nell'intestazione il suo nome e cognome come titolo della card
E vedo una sezione "Presenza" con i pulsanti Presente, Pre-asilo,
Post-asilo, Assente, Malattia
E vedo, sotto la sezione "Presenza", una sezione "Pasto" con i pulsanti
Sì e No
E vedo, sotto la sezione "Pasto", in fondo alla card, una sezione "Nota"
con il campo "Nota (opzionale)" e il pulsante "Salva nota"
E nella card c'è un solo campo "Nota (opzionale)"

## Scenario: l'intestazione mostra l'avatar del bambino in base al sesso
Dato che ho aperto "Presenze e pasti" e vedo tre bambini, una femmina,
un maschio e uno con il sesso non compilato
Quando guardo le loro card
Allora l'intestazione della femmina ha lo sfondo rosa tenue e l'avatar
di una bambina, con nome accessibile "Bambina"
E l'intestazione del maschio ha lo sfondo azzurro tenue e l'avatar di
un bambino, con nome accessibile "Bambino"
E l'intestazione del bambino senza sesso ha lo sfondo grigio e un
avatar neutro, decorativo
E in nessuna intestazione compaiono le scritte "Femmina" o "Maschio"

## Scenario: lo stato selezionato è evidenziato con un segno di spunta
Dato che un bambino è segnato "presente" per la data visualizzata
Quando guardo la sua sezione "Presenza"
Allora il pulsante "Presente" è pieno, colorato e con il segno ✓, e
risulta premuto anche per le tecnologie assistive
E gli altri pulsanti di stato non sono premuti

## Scenario: un cambio di presenza si vede subito nella sezione pasto della stessa card
Dato che ho aperto "Presenze e pasti" per la data odierna e un bambino
ha i pulsanti Sì/No disponibili nella sezione "Pasto"
Quando premo "Assente" nella sezione "Presenza" della sua card
Allora nella stessa card, senza cambiare pagina, la sezione "Pasto"
mostra l'etichetta "🚫 Assente" al posto dei pulsanti Sì/No

## Scenario: l'assistente vede solo la sezione presenza
Dato che sono autenticata come assistente (con almeno una sezione
assegnata) e ho aperto "Presenze e pasti"
Quando guardo la pagina
Allora ogni card bambino ha la sezione "Presenza" e, sotto, la sezione
"Nota"
E non vedo nessuna sezione "Pasto", nessun pulsante Sì/No, nessun
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

## Scenario: su telefono le sezioni sono una sotto l'altra
Dato che uso un telefono con una larghezza di 375px
Quando apro "Presenze e pasti"
Allora non c'è scorrimento orizzontale
E in ogni card la sezione "Pasto" sta sotto la sezione "Presenza" e la
sezione "Nota" sotto la sezione "Pasto", dentro la stessa card
E i pulsanti hanno un'area di tocco alta almeno 44px

## Scenario: anche su uno schermo molto stretto non c'è scorrimento orizzontale
Dato che uso uno schermo largo 340px
Quando apro "Presenze e pasti"
Allora non c'è scorrimento orizzontale e la sezione "Pasto" resta dentro
la card, sotto la sezione "Presenza"

## Scenario: anche su tablet e computer le sezioni sono una sotto l'altra
Dato che uso un tablet (768px) o un computer (1280px)
Quando apro "Presenze e pasti"
Allora in ogni card la sezione "Pasto" sta sotto la sezione "Presenza" e
la sezione "Nota" sotto la sezione "Pasto", come su telefono

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
- Disposizione: una sola colonna a qualunque larghezza, Presenza →
  Pasto → Nota (decisione di Matteo nella issue #110: stessa card su
  telefono e su computer; sostituisce l'affiancamento da 640px della
  issue #106). Pulsanti grandi con area di tocco alta almeno 44px.
- Presenza, Pasto e Nota sono nello stesso form: premendo uno stato di
  presenza si salva anche la nota scritta nel campo (scenario "segnare
  un'assenza con nota" di [13 - segna-presenza.md](13%20-%20segna-presenza.md));
  i pulsanti del pasto non toccano la nota.
- Colori dell'intestazione: rosa tenue (Tailwind `pink-100`) per `sesso =
  'F'`, azzurro tenue (`sky-100`) per `'M'`, grigio (`stone-100`) se
  nullo (o con un valore inatteso); testo con contrasto sufficiente
  (controllo axe-core).
- Avatar: SVG inline (nessuna dipendenza né immagine esterna). Per le
  tecnologie assistive il sesso non è affidato al solo colore: l'avatar
  ha `role="img"` e nome accessibile "Bambina" o "Bambino" (specs/01,
  accessibilità); l'avatar neutro è decorativo (`aria-hidden`), perché
  non aggiunge informazione.
- I pulsanti di stato espongono `aria-pressed` (premuto/non premuto): il
  segno ✓ è decorativo e non fa parte del nome del pulsante.
- Ogni card bambino ha un'ancora `#bambino-<id>`, usata come scorciatoia
  dal box di comunicazione pasti (vedi
  [16 - comunicazione-pasti-rojac.md](16%20-%20comunicazione-pasti-rojac.md)).
