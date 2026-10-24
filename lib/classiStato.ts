// Tono dei pulsanti di stato (Presente/Assente/Malattia, Sì/No, Pre/Post-asilo
// — specs/13 e 14): un colore per stato, non un unico "selezionato"
// monocromatico, come richiesto da specs/01 - ux.md ("pulsanti e menu
// colorati"). Qui c'è solo la scelta del tono (logica pura, testabile); le
// classi vere sono in `components/ui/pulsante-stato.tsx`.
//
// Toni: `spento` (non selezionato, bordo e sfondo bianco), `successo` (verde:
// Presente, Sì), `neutro` (grigio: Assente), `negativo` (rosso: Malattia,
// No), `info` (azzurro: Pre-asilo, Post-asilo — toggle indipendenti dai tre
// stati primari, di colore distinto per non confonderli con "Presente" pur
// implicandolo).
export type TonoPulsanteStato = 'spento' | 'successo' | 'neutro' | 'negativo' | 'info';

const TONO_SELEZIONATO: Record<string, TonoPulsanteStato> = {
  presente: 'successo',
  si: 'successo',
  assente: 'neutro',
  no: 'negativo',
  malattia: 'negativo',
};

export function tonoPulsanteStato(stato: string, selezionato: boolean): TonoPulsanteStato {
  return selezionato ? (TONO_SELEZIONATO[stato] ?? 'spento') : 'spento';
}

export function tonoPulsanteToggle(selezionato: boolean): TonoPulsanteStato {
  return selezionato ? 'info' : 'spento';
}
