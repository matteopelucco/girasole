# 51 — Report

## Attori
Maestra (sulle sezioni di sua competenza), Admin (su tutte le sezioni).

## Obiettivo
Una sezione "Report", raggiungibile dalla dashboard, che mostra in modo
tabellare e sintetico presenze e pasti dei bambini nel tempo, con la
possibilità di entrare nel dettaglio giorno per giorno, e un'anagrafica
delle classi.

## Scenario: aprire il report mostra il mese corrente
Dato che sono autenticata come maestra o admin
Quando apro "Report" dalla dashboard
Allora vedo, per il mese corrente, l'elenco dei bambini raggruppati per
classe (solo le mie classi se sono maestra, tutte le classi attive se
sono admin)
E per ogni bambino vedo il numero di presenze e il numero di pasti "sì"
registrati nel mese

## Scenario: navigare tra i mesi
Dato che sto guardando il report mensile
Quando premo "mese successivo" o "mese precedente"
Allora la tabella si aggiorna con i dati del nuovo mese

## Scenario: passare al report settimanale
Quando scelgo "Settimanale"
Allora vedo la stessa tabella (bambini per classe, presenze e pasti) ma
calcolata sulla settimana corrente (lunedì-domenica), e posso navigare
tra settimane

## Scenario: passare al report giornaliero
Quando scelgo "Giornaliero"
Allora vedo la stessa tabella calcolata su un solo giorno, e posso
navigare tra i giorni
E non vedo alcun modo di aprire il drill-down per un bambino (non ha
senso su un singolo giorno)

## Scenario: drill-down su un bambino (mensile o settimanale)
Dato che sto guardando il report mensile o settimanale
Quando apro il dettaglio di un bambino dalla tabella
Allora vedo un elenco giorno per giorno del periodo, con lo stato di
presenza (presente/assente/malattia/non segnato) e lo stato pasto
(sì/no/non segnato) per ciascun giorno

## Scenario: anagrafica classi
Quando apro "Anagrafica classi"
Allora per ogni classe vedo l'elenco delle maestre assegnate
E l'elenco dei bambini della classe, con nome, cognome, sesso e data di
nascita
E per ogni bambino l'elenco dei suoi genitori, con nome, cognome, email
e numero di telefono

## Regole
- Una maestra vede solo le classi a cui è assegnata (stessa regola di
  [12 - dashboard-maestre.md](12%20-%20dashboard-maestre.md)); l'admin
  le vede tutte.
- "Presenze" nel report conta i giorni con stato `presente`; lo stato
  `malattia` non viene conteggiato come presenza (è comunque visibile
  nel drill-down giorno per giorno).
- "Pasti" nel report conta i giorni con stato `si`.
- Il report mensile/settimanale/giornaliero mostra solo classi attive e
  bambini attivi (stessa regola di
  [13 - segna-presenza.md](13%20-%20segna-presenza.md)); l'anagrafica
  classi mostra invece tutte le classi, anche non attive, per dare
  visibilità completa su chi è assegnato dove.
- La settimana va da lunedì a domenica.
- L'anagrafica classi richiede che una maestra possa vedere il profilo
  (nome/cognome) di eventuali colleghe sulla stessa classe, e i dati dei
  genitori (nome, cognome, email, telefono) dei bambini delle proprie
  classi — permessi nuovi, non necessari altrove nell'app: vedi le
  policy RLS aggiunte in
  `supabase/migrations/0013_report_anagrafica.sql`.
