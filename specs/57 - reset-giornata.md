# 57 — Reset presenze e pasti di una giornata

## Attori
Admin.

## Obiettivo
Dare all'admin uno strumento per eliminare tutte le presenze e i pasti
registrati in una data — di tutte le classi — quando i dati risultano
"sporcati" (es. prove fatte per errore in produzione, come capitato ad
agosto 2026). Funziona anche su una data passata: le maestre possono
scrivere solo sulla data odierna (specs/13, specs/14), ma l'admin deve
poter correggere anche un giorno già trascorso.

## Scenario: "Impostazioni" compare in fondo al menu solo per l'admin, con le sottosezioni sotto
Dato che sono autenticato come admin
Quando guardo la sidebar di navigazione
Allora in fondo al menu vedo la voce "Impostazioni" (`/admin/impostazioni-avanzate`)
E sotto, rientrate, nell'ordine: "Reset giornata" (`/admin/reset-giornata`),
"Parametri di funzionamento" (specs/62), "Azioni" (specs/63) e poi
"Utenti" (`/admin/maestre`), che è l'ultima
E "Utenti" non compare più tra le voci di primo livello, dopo il gruppo "Calendario"
E sulla pagina del reset la voce "Reset giornata" risulta evidenziata

## Scenario: la pagina Impostazioni è l'indice di tutte le sottosezioni
Dato che sono autenticato come admin
Quando apro "Impostazioni" dal menu (`/admin/impostazioni-avanzate`)
Allora vedo quattro riquadri, nello stesso ordine delle voci rientrate del
menu: "Reset giornata", "Parametri di funzionamento", "Azioni" e "Utenti",
ciascuno con titolo e breve descrizione
E la pagina non ha violazioni di accessibilità gravi
E premendo "Reset giornata" arrivo alla pagina `/admin/reset-giornata`

## Scenario: maestra, assistente e genitore non vedono Impostazioni
Dato che sono autenticato come maestra, assistente o genitore
Quando guardo la sidebar di navigazione
Allora non vedo la voce "Impostazioni"
E se provo ad aprire `/admin/impostazioni-avanzate` vengo reindirizzato
alla dashboard

## Scenario: vedere cosa c'è da resettare prima di confermare
Dato che sono autenticato come admin e apro "Reset giornata" da
"Impostazioni"
Quando scelgo una data (di default oggi, con lo stesso selettore
←/→/calendario già usato in "Presenze e pasti")
Allora vedo quante presenze e quanti pasti sono registrati per quella
data, su tutte le classi
E se per quella data risulta già una comunicazione dei pasti a Rojac
(specs/16), vedo un avviso con quando e da chi è stata inviata

## Scenario: resettare una giornata richiede una doppia conferma
Dato che ho scelto una data con almeno una presenza o un pasto registrato
Quando premo "Resetta giornata"
Allora vedo un riquadro con un messaggio "Sei sicuro?" e un disclaimer
esplicito: l'operazione è irreversibile, e se quella data è già stata
comunicata (pasti a Rojac, o rientra nel mese di una comunicazione retta
già inviata) i dati comunicati NON vengono corretti e possono risultare
non più coerenti con presenze/pasti (ora azzerati)
E solo premendo un secondo pulsante di conferma esplicito l'eliminazione
viene eseguita; un pulsante "Annulla" chiude il riquadro senza fare nulla

## Scenario: la giornata resettata risulta vuota
Dato che ho confermato il reset di una data
Quando la pagina si aggiorna
Allora vedo "0 presenze" e "0 pasti" per quella data, e posso
inserire nuove presenze/pasti da capo dalle rispettive schermate
(specs/13, specs/14) — il reset stesso non inserisce nulla, si limita a
svuotare

## Scenario: resettare una data senza nulla da resettare
Dato che scelgo una data senza nessuna presenza né nessun pasto
registrato
Quando guardo la pagina
Allora vedo "0 presenze" e "0 pasti"; il pulsante "Resetta giornata"
resta disabilitato (nessuna azione utile da fare)

## Scenario: accesso negato a chi non è admin
Dato che sono autenticato come maestra, assistente o genitore
Quando provo ad aprire `/admin/reset-giornata`
Allora vengo reindirizzato alla dashboard

## Regole
- "Impostazioni" (già "Impostazioni avanzate": cambia solo l'etichetta, il
  titolo della pagina e il percorso `/admin/impostazioni-avanzate` restano
  quelli) è una pagina intermedia, riservata all'admin
  (`requireAdmin`, come le altre pagine `/admin/*`), pensata per ospitare
  nel tempo altre azioni di amministrazione avanzate oltre al reset: ogni
  sottosezione è una voce dell'elenco in `lib/impostazioniAvanzate.ts`
  (titolo, descrizione, icona, href), che è l'unica fonte: da lì derivano sia
  i riquadri della pagina sia le voci rientrate del menu
  (`lib/navigazione.ts`), così non possono divergere. La voce "Impostazioni"
  è in fondo alla sidebar, seguita solo dalle sue sottosezioni rientrate.
  Il percorso `/admin/reset-giornata` e la logica del reset non cambiano.
- Il reset elimina TUTTE le righe di `presenze` e `pasti` con quella
  `data`, indipendentemente dalla sezione o dal bambino — non è
  possibile limitarlo a una singola classe o a un singolo bambino, per
  restare uno strumento semplice per il caso d'uso reale (dati di prova
  che hanno sporcato l'intera giornata). Le presenze a pre-asilo/
  post-asilo sono colonne della stessa riga `presenze`
  (`0016_assistente_e_pre_post_asilo.sql`), quindi spariscono insieme
  al resto senza bisogno di un passo separato.
- Solo un profilo con ruolo `admin` può eseguire il reset (RLS in
  `supabase/migrations/0040_reset_giornata.sql`, nuove policy di
  delete — prima non ne esisteva nessuna su queste due tabelle, nemmeno
  per l'admin): niente eccezioni per maestra/assistente, nemmeno sulla
  propria sezione.
- Il reset NON tocca nessun log di comunicazione già inviata
  (`pasti_comunicati` — specs/16 — o `comunicazioni_retta` — specs/56):
  quei record restano un log immutabile di cosa è stato effettivamente
  comunicato, anche se ora non corrisponde più ai dati (azzerati). È
  esattamente il motivo del disclaimer nella doppia conferma: l'admin
  deve saperlo prima di procedere, non c'è correzione automatica delle
  comunicazioni già partite.
- Nessun log del reset stesso (chi/quando ha resettato): fuori scope in
  questa fase, coerente con l'uso pensato come strumento di emergenza
  occasionale, non un'operazione di routine da tracciare.
- La doppia conferma riusa `components/ConfermaAzione.tsx` (tono
  "distruttivo"), lo stesso componente già usato per altre azioni
  irreversibili nell'app: un primo click su "Resetta giornata" rivela
  il riquadro con messaggio e disclaimer, un secondo click sul pulsante
  di conferma esegue davvero l'eliminazione.
- Nessun vincolo sulla data scelta (a differenza di Ore di lavoro o
  Rette, che bloccano il futuro): una data futura senza nulla da
  resettare è semplicemente innocua (0 righe eliminate), non serve
  impedirla esplicitamente.
