// Classi Tailwind per i pulsanti di stato (Presente/Assente/Malattia,
// Sì/No/Parziale — specs/13 e 14): un colore per stato, non un unico
// "selezionato" monocromatico, come richiesto da specs/01 - ux.md
// ("pulsanti e menu colorati"). Stringhe letterali (non composte a
// runtime) perché Tailwind analizza il testo sorgente per generare il
// CSS: un nome di classe costruito con un template `${...}` non
// verrebbe trovato.
const CLASSI_SELEZIONATO: Record<string, string> = {
  presente: 'rounded-full bg-emerald-700 px-3 py-1 text-xs font-semibold text-white shadow-sm',
  si: 'rounded-full bg-emerald-700 px-3 py-1 text-xs font-semibold text-white shadow-sm',
  assente: 'rounded-full bg-stone-600 px-3 py-1 text-xs font-semibold text-white shadow-sm',
  no: 'rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white shadow-sm',
  malattia: 'rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white shadow-sm',
};

const CLASSE_NON_SELEZIONATO =
  'rounded-full border border-stone-300 bg-white px-3 py-1 text-xs text-stone-600 hover:border-stone-500';

export function classePulsanteStato(stato: string, selezionato: boolean): string {
  return selezionato ? CLASSI_SELEZIONATO[stato] : CLASSE_NON_SELEZIONATO;
}

// Pulsanti "Pre-asilo"/"Post-asilo" (specs/13): toggle indipendenti dai
// tre stati primari, colore distinto (sky) per non essere confusi con
// "Presente" (emerald) pur implicandolo.
const CLASSE_TOGGLE_ATTIVO =
  'rounded-full bg-sky-700 px-3 py-1 text-xs font-semibold text-white shadow-sm';

export function classePulsanteToggle(selezionato: boolean): string {
  return selezionato ? CLASSE_TOGGLE_ATTIVO : CLASSE_NON_SELEZIONATO;
}
