# ADR-0011 — Libreria di componenti: shadcn/ui, copiata in `components/ui/`

- Stato: Accettata
- Data: 2026-10-20 (issue #337, decisione di Matteo nella serie "UX REVIEW";
  base tecnica in #334, #335 e #336)

## Contesto
La grafica è stata costruita schermata per schermata, senza una libreria di
componenti. Oggi il codice ha circa 30 pulsanti verdi identici scritti a mano,
circa 70 campi, 12 etichette di stato, 14 riquadri di avviso e 5 finestre di
dialogo, ognuno con la sua stringa di classi Tailwind. Cambiare l'aspetto di un
pulsante vuol dire toccare decine di file, e chi lavora dopo (persone o agenti)
non sa cosa riusare e cosa no, quindi ne scrive un'altra copia.

La revisione della grafica ("UX REVIEW", 20 issue) ha bisogno di una base
comune. Il progetto usa Tailwind e deve restare nel free tier, con poche
dipendenze e un'app che deve restare leggera su telefono.

## Decisione
Si adotta **shadcn/ui**. Non è un pacchetto da installare: i componenti si
**copiano nel repo**, in `components/ui/`, e da quel momento sono codice del
progetto, che si può leggere e modificare. Sono scritti con Tailwind, usano
Radix per il comportamento (tastiera, focus, ruoli accessibili) e si stilano con
i token di significato di `app/globals.css` (issue #335).

- **Stile e configurazione**: `components.json` (stile `new-york`, Tailwind 4,
  alias `@/components/ui` e `@/lib/utils`). Base introdotta dalla issue #336.
- **Tailwind 4** (issue #334): shadcn/ui lavora con la versione 4; il passaggio è
  stato fatto prima, senza differenze visibili.
- **Dipendenze approvate da Matteo**, solo queste: `clsx`, `tailwind-merge`,
  `class-variance-authority`, `tw-animate-css`, `radix-ui`. Il CLI `shadcn` non è
  una dipendenza del progetto: si lancia con `npx` solo quando serve.
- **Non approvate**: `@base-ui/react` (la variante Base UI di shadcn non si usa;
  si usa quella con Radix) e `lucide-react` (le icone dei componenti copiati si
  sostituiscono con quelle di `components/icone.tsx`, vedi la guida).
- **Helper `cn`** in `lib/utils.ts`: unisce classi e risolve i conflitti di
  Tailwind.
- **Regola d'uso**: niente nuove stringhe di classi per pulsanti e campi fuori
  da `components/ui/`. Chi serve un pulsante, un campo o un riquadro usa (o
  aggiunge) il componente.

La guida pratica (elenco, quando usarli, come aggiungerne uno) è in
`docs/sviluppo-dettagli.md`, sezione "Componenti di `components/ui/`".

## Alternative scartate
- **MUI, Mantine, Chakra UI**: hanno un sistema di stile proprio, parallelo a
  Tailwind. Si avrebbero due modi di decidere l'aspetto, un peso maggiore nel
  bundle e un tema da far convivere con i token esistenti.
- **HeroUI e daisyUI**: lavorano solo con Tailwind 4 e hanno un aspetto proprio
  (HeroUI) o classi semantiche proprie (daisyUI), da contrastare per ottenere
  il look del progetto.
- **TailGrids**: comunità piccola, la parte migliore è a pagamento.
- **Headless UI, Radix o Base UI da soli**: danno il comportamento ma nessuno
  stile, e andrebbe riscritto tutto a mano. shadcn/ui parte da Radix e aggiunge
  proprio lo stile. Radix resta quindi come dipendenza, ma non come scelta
  diretta per le schermate.
- **Continuare caso per caso**: è la situazione di partenza, che ha prodotto le
  copie da unificare.

## Conseguenze
- **Aggiornamenti a mano**: i componenti copiati non si aggiornano da soli con
  `npm update`. Se shadcn/ui corregge un difetto, va riportato a mano (o
  rilanciando il CLI sul singolo componente e rivedendo la differenza). In
  cambio, nessun aggiornamento esterno può cambiare l'aspetto senza una PR.
- **Una sola fonte per l'aspetto**: cambiare un pulsante significa cambiare un
  file. Le pagine importano `components/ui/` e non ripetono le classi.
- **Il passaggio a Tailwind 4 è un prerequisito** ed è già avvenuto (#334).
- **Le dipendenze nuove restano un confine**: oltre alle cinque elencate non se
  ne aggiungono senza chiedere. Un componente che ne richiede altre (per
  esempio `lucide-react`) va adattato oppure serve una nuova approvazione.
- **Migrazione graduale**: i componenti arrivano con le issue successive della
  serie. Finché una schermata non è migrata, le sue classi restano dove sono;
  solo il codice nuovo segue la regola. I pulsanti di stato Presente/Assente/Sì/No
  sono migrati nella issue #350 (`components/ui/pulsante-stato.tsx`).
- **Nome accessibile, ruolo, `data-testid` e struttura dei contenitori** delle
  schermate non cambiano migrando (le e2e usano `getByRole`, `getByLabel` e
  `locator('..')`).
