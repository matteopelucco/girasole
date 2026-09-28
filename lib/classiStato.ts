// Classi Tailwind per i pulsanti di stato (Presente/Assente/Malattia,
// Sì/No — specs/13 e 14): un colore per stato, non un unico
// "selezionato" monocromatico, come richiesto da specs/01 - ux.md
// ("pulsanti e menu colorati"). Stringhe letterali (non composte a
// runtime) perché Tailwind analizza il testo sorgente per generare il
// CSS: un nome di classe costruito con un template `${...}` non
// verrebbe trovato.
//
// Dimensioni (issue #106, specs/10): pulsanti grandi a pillola, alti
// almeno 44px e larghi quanto la cella della griglia che li contiene
// (due per riga nella sezione Presenza, affiancati Sì/No nella sezione
// Pasto); il segno ✓ dello stato selezionato lo aggiunge il componente.
const BASE = 'inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm';

const CLASSI_SELEZIONATO: Record<string, string> = {
  presente: `${BASE} bg-emerald-700 font-semibold text-white shadow-sm`,
  si: `${BASE} bg-emerald-700 font-semibold text-white shadow-sm`,
  assente: `${BASE} bg-stone-600 font-semibold text-white shadow-sm`,
  no: `${BASE} bg-rose-600 font-semibold text-white shadow-sm`,
  malattia: `${BASE} bg-rose-600 font-semibold text-white shadow-sm`,
};

const CLASSE_NON_SELEZIONATO = `${BASE} border border-stone-300 bg-white font-medium text-stone-700 hover:border-stone-500`;

export function classePulsanteStato(stato: string, selezionato: boolean): string {
  return selezionato ? CLASSI_SELEZIONATO[stato] : CLASSE_NON_SELEZIONATO;
}

// Pulsanti "Pre-asilo"/"Post-asilo" (specs/13): toggle indipendenti dai
// tre stati primari, colore distinto (sky) per non essere confusi con
// "Presente" (emerald) pur implicandolo.
const CLASSE_TOGGLE_ATTIVO = `${BASE} bg-sky-700 font-semibold text-white shadow-sm`;

export function classePulsanteToggle(selezionato: boolean): string {
  return selezionato ? CLASSE_TOGGLE_ATTIVO : CLASSE_NON_SELEZIONATO;
}
