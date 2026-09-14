// Formato dell'email di promemoria retta (specs/55 - costi-bambino.md):
// richiede una parte locale, una @ e un dominio con almeno un punto —
// non un validatore RFC 5322 completo (fuori scope), solo per
// intercettare errori di battitura evidenti prima di salvare. Funzione
// pura, nessun I/O.
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailValida(email: string): boolean {
  return REGEX_EMAIL.test(email);
}
