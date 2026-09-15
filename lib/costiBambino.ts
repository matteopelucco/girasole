// Formato dell'email di promemoria retta (specs/55 - costi-bambino.md):
// richiede una parte locale, una @ e un dominio con almeno un punto —
// non un validatore RFC 5322 completo (fuori scope), solo per
// intercettare errori di battitura evidenti prima di salvare. Funzione
// pura, nessun I/O.
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailValida(email: string): boolean {
  return REGEX_EMAIL.test(email);
}

// Il campo "Email promemoria retta" (specs/55) può contenere più
// indirizzi separati da ";" (spazi intorno ignorati): la comunicazione
// retta (specs/56) va a tutti. Funzione pura, nessun I/O.
export function emailsDaCampo(valore: string): string[] {
  return valore
    .split(';')
    .map((parte) => parte.trim())
    .filter(Boolean);
}

// Valido solo se, una volta separato per ";", resta almeno un
// indirizzo e ognuno rispetta il formato email (specs/55, "uno solo
// dei più indirizzi non è valido" — tutto o niente, come un singolo
// indirizzo). Funzione pura, nessun I/O.
export function emailListaValida(valore: string): boolean {
  const indirizzi = emailsDaCampo(valore);
  return indirizzi.length > 0 && indirizzi.every(emailValida);
}
