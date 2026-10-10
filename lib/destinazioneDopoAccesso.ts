export const DESTINAZIONE_PREDEFINITA = '/dashboard';

// Caratteri di controllo (incluso a capo e tab), spazi e backslash.
const CARATTERI_NON_AMMESSI = /[\u0000- \u007f-\u009f\\]/;

/**
 * Valida la destinazione dopo l'accesso con il link email: sono ammessi solo
 * percorsi interni al sito. Qualunque altro valore diventa '/dashboard'.
 *
 * Approccio: filtro preliminare sulla forma del valore (inizia con una sola
 * '/', nessun carattere di controllo/spazio/backslash), poi lo si risolve con
 * `new URL(valore, origin)` verificando che l'origine resti quella del sito;
 * si restituisce solo `pathname + search + hash` della forma normalizzata, mai
 * il testo grezzo. Funzione pura: nessun accesso a rete o a Supabase.
 */
export function destinazioneDopoAccesso(
  next: unknown,
  origin: string = 'http://localhost'
): string {
  if (typeof next !== 'string' || next === '') return DESTINAZIONE_PREDEFINITA;
  if (!next.startsWith('/') || next.startsWith('//')) return DESTINAZIONE_PREDEFINITA;
  if (CARATTERI_NON_AMMESSI.test(next)) return DESTINAZIONE_PREDEFINITA;

  let url: URL;
  try {
    url = new URL(next, origin);
  } catch {
    return DESTINAZIONE_PREDEFINITA;
  }
  if (url.origin !== new URL(origin).origin) return DESTINAZIONE_PREDEFINITA;

  const percorso = `${url.pathname}${url.search}${url.hash}`;
  // Dopo la normalizzazione deve restare un percorso interno semplice.
  if (!percorso.startsWith('/') || percorso.startsWith('//')) return DESTINAZIONE_PREDEFINITA;
  return percorso;
}
