# 14 — Segna pasto

## Attori
Maestra (sui bambini delle sue sezioni), Admin (su tutti i bambini).
**L'assistente non è un attore di questo requisito**: non ha alcun
accesso al registro pasti, né in lettura né in scrittura (vedi
[03 - utenti-e-ruoli.md](03%20-%20utenti-e-ruoli.md)).

## Obiettivo
Registrare in pochi tap se un bambino ha mangiato a pranzo, con particolare
attenzione a rendere visibili le eventuali allergie/intolleranze prima di
segnare il pasto, dalla sezione "Pasto" della card di ogni bambino nella
schermata unica "Presenze e pasti" (bambini raggruppati per classe
nella stessa schermata, senza un click intermedio per scegliere la
classe) descritta in
[10 - presenze-e-pasti.md](10%20-%20presenze-e-pasti.md) e
[12 - dashboard-maestre.md](12%20-%20dashboard-maestre.md).

## Scenario: la sezione Pasto mostra lo stato pasto di ogni bambino
Dato che ho aperto "Presenze e pasti" dalla dashboard per una data
Allora vedo l'elenco dei bambini di tutte le mie classi, raggruppati per
sezione, e nella sezione "Pasto" di ciascuna card lo stato pasto di
quella data, se già segnato

## Scenario: riepilogo pasti della classe
Dato che sono su "Presenze e pasti" per una data
Allora vedo, sopra l'elenco bambini di ciascuna classe, nell'intestazione
"Sezione {nome classe}" (la stessa del riepilogo presenze, vedi
[13 - segna-presenza.md](13%20-%20segna-presenza.md)), il conteggio
"Pasti: X/Y", dove X è il numero di bambini segnati "sì" per quella data
e Y il numero di bambini della classe che non risultano "assente" né
"malattia" quel giorno (i soli per cui ha senso segnare il pasto)

## Scenario: le allergie sono visibili prima di segnare il pasto
Dato che un bambino ha `note_allergie` compilato (es. "Allergia alle
arachidi")
Quando guardo la card di quel bambino nell'elenco
Allora vedo nell'intestazione della card un'etichetta ben visibile con il
testo dell'allergia, accanto al nome del bambino, indipendentemente dallo
stato del pasto e della presenza

## Scenario: segnare che un bambino ha mangiato
Quando premo "Sì" nella sezione "Pasto" di un bambino
Allora lo stato pasto di oggi per quel bambino diventa "sì"

## Scenario: segnare che un bambino non ha mangiato
Quando premo "No" nella sezione "Pasto" di un bambino
Allora lo stato pasto di oggi per quel bambino diventa "no"

## Scenario: un bambino assente non è selezionabile per il pasto
Dato che un bambino è segnato "assente" per la data in questione
Quando apro "Presenze e pasti" per quella data
Allora nella sezione "Pasto" della sua card, al posto dei pulsanti Sì/No,
vedo l'etichetta "🚫 Assente"
E non posso selezionare alcuno stato pasto per quel bambino, nemmeno
come admin

## Scenario: un bambino malato non è selezionabile per il pasto
Dato che un bambino è segnato "malattia" per la data in questione
Quando apro "Presenze e pasti" per quella data
Allora nella sezione "Pasto" della sua card, al posto dei pulsanti Sì/No,
vedo l'etichetta "🤒 Malattia"
E non posso selezionare alcuno stato pasto per quel bambino, nemmeno
come admin

## Scenario: la maestra non può modificare il pasto di una data diversa da oggi
Dato che sono autenticata come maestra e ho aperto "Presenze e pasti" per
una data diversa da oggi (passata o futura)
Quando guardo la sezione "Pasto" dei bambini delle mie classi
Allora vedo lo stato eventualmente già registrato ma senza pulsanti per
modificarlo: è in sola lettura

## Scenario: l'assistente non vede alcun dato pasto
Dato che sono autenticata come assistente
Quando apro "Presenze e pasti", oppure provo ad aprire direttamente il
vecchio indirizzo `/dashboard/pasti`
Allora non vedo nessuna sezione "Pasto", nessun pulsante Sì/No e nessun
riepilogo "Pasti: X/Y"; il vecchio indirizzo mi porta alla schermata
unica (vedi [10 - presenze-e-pasti.md](10%20-%20presenze-e-pasti.md)),
sempre senza alcun dato pasto

## Regole
- Stati validi: `si`, `no`. (Lo stato `parziale` è stato rimosso dopo
  un test con un'insegnante: nella pratica un pasto è mangiato o no, un
  eventuale dettaglio va nella nota della presenza — vedi
  `supabase/migrations/0012_pasto_senza_parziale.sql` per la migration
  dei dati storici già segnati "parziale".)
- Un solo record di pasto per bambino per giorno (upsert su
  `bambino_id, data`).
- Il pasto non ha più un campo nota in schermata (issue
  [#109](https://github.com/matteopelucco/girasole/issues/109)): l'unica
  nota della card è quella della presenza
  ([13 - segna-presenza.md](13%20-%20segna-presenza.md)). La colonna
  `pasti.note` resta nel database con le note già salvate: segnare Sì/No
  non la tocca (non la azzera), la schermata non la mostra più.
- Un bambino con presenza "assente" oppure "malattia" per la data in
  questione non può avere un pasto segnato per quella data: vincolo
  imposto anche a livello di database (trigger, vedi
  `supabase/migrations/0012_pasto_senza_parziale.sql`, esteso a
  "malattia" da `supabase/migrations/0017_pasto_blocca_anche_malattia.sql`),
  non solo in UI. Riguardava inizialmente solo "assente" ("un bambino
  malato può comunque aver mangiato, es. a casa poi rientrato"), ma è
  stato esteso su richiesta esplicita: in pratica un bambino segnato
  malato non viene servito a pranzo, quindi il pasto non è selezionabile
  per lui quanto per un assente.
- Scrittura consentita solo alla maestra della sezione del bambino o
  all'admin (vedi RLS su `pasti` in
  `supabase/migrations/0001_init.sql`) — **l'assistente è esclusa
  esplicitamente**, sia dalla RLS sia dalla UI (vedi
  [03 - utenti-e-ruoli.md](03%20-%20utenti-e-ruoli.md)).
- La data usata è "oggi" nel fuso orario Europe/Rome (non UTC), vedi
  `lib/date.ts`.
- Il ruolo "maestra" può scrivere solo sulla data odierna, l'admin su
  qualunque data — stessa regola e stesso meccanismo (RLS) di
  [13 - segna-presenza.md](13%20-%20segna-presenza.md). **Eccezione
  valida per entrambi, admin incluso**: un giorno di chiusura scolastica
  (vedi [53 - calendario-scolastico.md](53%20-%20calendario-scolastico.md)).
- Presenza e pasto sono indipendenti: si può segnare il pasto anche senza
  aver ancora segnato la presenza (utile se la maestra segna prima il
  pranzo e la presenza a fine giornata) — a meno che la presenza non sia
  già "assente" (vedi sopra).
- Se il bambino risulta "malattia" (o "assente") per la data
  visualizzata, l'etichetta appare nell'intestazione della card, accanto
  al nome, e al posto dei pulsanti nella sezione "Pasto" (vedi
  [13 - segna-presenza.md](13%20-%20segna-presenza.md)).
- Dopo la comunicazione dei pasti a Rojac la sezione "Pasto" è in sola
  lettura per la maestra, in ogni classe (l'admin può sempre modificare):
  vedi [16 - comunicazione-pasti-rojac.md](16%20-%20comunicazione-pasti-rojac.md).
- L'elenco bambini mostra solo i bambini attivi, raggruppati per sezione
  (stessa regola e stesso raggruppamento di
  [13 - segna-presenza.md](13%20-%20segna-presenza.md)) e
  [50 - amministrazione_base.md](50%20-%20amministrazione_base.md).
