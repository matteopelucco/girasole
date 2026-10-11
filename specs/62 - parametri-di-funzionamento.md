# 62 — Parametri di funzionamento

## Attori
Solo Admin. Maestra, assistente e genitore non vedono la voce di menu né
raggiungono la pagina.

## Obiettivo
Dare all'admin una sezione, sotto "Impostazioni", dove consultare e
(in seguito) modificare alcune variabili di funzionamento oggi legate
all'ambiente di esecuzione, che servono spesso o devono almeno essere
visibili all'amministratore. In questa prima fase la pagina contiene solo
il titolo e una breve descrizione: le sezioni vere e proprie arriveranno
con le issue successive.

## Scenario: "Parametri di funzionamento" compare nel menu sotto "Impostazioni", solo per l'admin
Dato che sono autenticato come admin
Quando guardo la sidebar di navigazione
Allora vedo la voce "Parametri di funzionamento" (`/admin/parametri-funzionamento`)
E sta subito sotto "Impostazioni", rientrata come "Utenti", prima di "Utenti"
E se sono maestra, assistente o genitore non vedo questa voce

## Scenario: la pagina si apre e mostra titolo e breve descrizione
Dato che sono autenticato come admin
Quando apro "Parametri di funzionamento" dal menu
Allora arrivo a `/admin/parametri-funzionamento`
E vedo il titolo "Parametri di funzionamento" e una breve descrizione della sezione
E la voce di menu "Parametri di funzionamento" risulta evidenziata
E la pagina non ha violazioni di accessibilità gravi

## Scenario: accesso negato a chi non è admin
Dato che sono autenticato come maestra, assistente o genitore
Quando provo ad aprire `/admin/parametri-funzionamento`
Allora vengo reindirizzato alla dashboard

## Regole
- Pagina riservata all'admin con `requireAdmin`, come le altre pagine
  `/admin/*`. Nessun dato letto o scritto: non servono migration né RLS.
- La voce di menu è in `lib/navigazione.ts`, rientrata (`rientrata: true`)
  tra "Impostazioni" e "Utenti".
- La pagina è pensata per ospitare più sezioni, una sotto l'altra, ciascuna
  con un proprio titolo: aggiungerne una è aggiungere un blocco sotto
  l'intestazione.
