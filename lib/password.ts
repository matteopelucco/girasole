// Almeno 8 caratteri, una minuscola, una maiuscola, un numero, un carattere speciale.
const REGEX_PASSWORD_COMPLESSA = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export function passwordAbbastanzaComplessa(password: string): boolean {
  return REGEX_PASSWORD_COMPLESSA.test(password);
}

export const REGOLA_PASSWORD =
  'Almeno 8 caratteri, con una lettera minuscola, una maiuscola, un numero e un carattere speciale.';
