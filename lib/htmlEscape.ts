/**
 * Escapa i caratteri speciali HTML (`& < > " '`) di un testo, così che
 * venga reso come testo e non interpretato come markup (es. nei corpi
 * delle email HTML).
 *
 * Escapa sempre una volta: va usata sui dati grezzi, una sola volta, al
 * momento dell'inserimento nell'HTML. Un valore già escapato verrebbe
 * escapato di nuovo.
 */
const SOSTITUZIONI: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(testo: string): string {
  return testo.replace(/[&<>"']/g, (c) => SOSTITUZIONI[c]);
}
