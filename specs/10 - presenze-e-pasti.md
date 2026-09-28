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
mockup fornito da Matteo), divisa in tre parti:
- **Intestazione**: nome e cognome in evidenza (titolo della card) e,
  se il campo `sesso` del bambino è compilato (gestito dall'admin, vedi
  [50 - amministrazione_base.md](50%20-%20amministrazione_base.md)),
  un'icona ♀ con la scritta "Femmina" o ♂ con la scritta "Maschio". Lo
  sfondo dell'intestazione è **rosa tenue** per le femmine, **azzurro
  tenue** per i maschi, **neutro** (grigio chiarissimo) se il sesso non
  è compilato, senza icona. Nell'intestazione restano anche l'etichetta
  allergie (se `note_allergie` è compilato, per qualunque ruolo),
  l'etichetta "🚫 Assente" o "🤒 Malattia" se il bambino è segnato così
  per la data, e l'eventuale warning di incoerenza
  ([06 - controllo-consistenza.md](06%20-%20controllo-consistenza.md)).
  Nessuna foto o avatar del bambino.
- **Sezione "Presenza"** (con icona): pulsanti grandi, due per riga,
  nell'ordine Presente, Pre-asilo, Post-asilo, Assente, Malattia; lo
  stato (o l'indicatore) selezionato è pieno, colorato e con un segno ✓,
  gli altri hanno solo il bordo. Sotto, il campo "Nota (opzionale)" della
  presenza e il pulsante "Salva nota" (comportamento in
  [13 - segna-presenza.md](13%20-%20segna-presenza.md)).
- **Sezione "Pasto"** (con icona, solo maestra e admin): pulsanti grandi
  Sì / No affiancati, con lo stesso stile di selezione; sotto, il campo
  "Nota (opzionale)" del pasto e il pulsante "Salva nota" (comportamento
  in [14 - segna-pasto.md](14%20-%20segna-pasto.md)). Se il bambino è
  "assente" o "malattia", la sezione mostra l'etichetta corrispondente al
  posto dei pulsanti.

Le due note (presenza e pasto) restano separate: sono due campi distinti
con significati diversi.

## Scenario: ogni bambino ha una card con intestazione, sezione presenza e sezione pasto
Dato che sono autenticata come maestra (o admin) e ho aperto "Presenze e
pasti" per la data odierna, su uno schermo da computer
Quando guardo la card di un bambino
Allora vedo nell'intestazione il suo nome e cognome come titolo della card
E vedo una sezione "Presenza" con i pulsanti Presente, Pre-asilo,
Post-asilo, Assente, Malattia, il campo "Nota (opzionale)" e "Salva nota"
E vedo, a destra della sezione "Presenza", una sezione "Pasto" con i
pulsanti Sì e No, il campo "Nota (opzionale)" e "Salva nota"

## Scenario: l'intestazione mostra il sesso del bambino con icona e colore
Dato che ho aperto "Presenze e pasti" e vedo tre bambini, una femmina,
un maschio e uno con il sesso non compilato
Quando guardo le loro card
Allora l'intestazione della femmina ha lo sfondo rosa tenue e la scritta
"Femmina" con l'icona ♀
E l'intestazione del maschio ha lo sfondo azzurro tenue e la scritta
"Maschio" con l'icona ♂
E l'intestazione del bambino senza sesso ha uno sfondo neutro, senza
icona né scritta

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
Allora ogni card bambino ha solo la sezione "Presenza"
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
E in ogni card la sezione "Pasto" sta sotto la sezione "Presenza",
dentro la stessa card
E i pulsanti hanno un'area di tocco alta almeno 44px

## Scenario: anche su uno schermo molto stretto non c'è scorrimento orizzontale
Dato che uso uno schermo largo 340px
Quando apro "Presenze e pasti"
Allora non c'è scorrimento orizzontale e la sezione "Pasto" resta dentro
la card, sotto la sezione "Presenza"

## Scenario: su tablet le sezioni sono affiancate
Dato che uso un tablet con una larghezza di 768px
Quando apro "Presenze e pasti"
Allora in ogni card la sezione "Pasto" sta a destra della sezione
"Presenza", alla stessa altezza

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
- Disposizione: sezioni affiancate (presenza a sinistra, pasto a destra)
  da 640px di larghezza dello schermo in su; sotto, presenza sopra e
  pasto sotto nella stessa card (decisione di Matteo nella issue #106:
  con pulsanti grandi, due colonne affiancate su un telefono da 375px
  sarebbero troppo strette; sostituisce la soglia di 360px della prima
  versione). Pulsanti grandi con area di tocco alta almeno 44px.
- Colori dell'intestazione: rosa tenue (Tailwind `pink-100`) per `sesso =
  'F'`, azzurro tenue (`sky-100`) per `'M'`, neutro (`stone-50`) se
  nullo; testo e icone con contrasto sufficiente (controllo axe-core).
  Il sesso è indicato anche a parole ("Femmina"/"Maschio"), non solo col
  colore o con l'icona (specs/01, accessibilità).
- I pulsanti di stato espongono `aria-pressed` (premuto/non premuto): il
  segno ✓ è decorativo e non fa parte del nome del pulsante.
- Ogni card bambino ha un'ancora `#bambino-<id>`, usata come scorciatoia
  dal box di comunicazione pasti (vedi
  [16 - comunicazione-pasti-rojac.md](16%20-%20comunicazione-pasti-rojac.md)).
