// "A capo" del testo nelle celle dei PDF (specs/52, scenario "testo lungo
// nelle celle delle tabelle PDF"). Logica pura: la misura del testo è una
// funzione passata dal chiamante (nel PDF è `font.widthOfTextAtSize`), così
// si testa senza pdf-lib.

export const ALTEZZA_RIGA_TABELLA = 16;
export const INTERLINEA_TABELLA = 11;

// Sostituisce con "?" ogni carattere che il font non sa codificare (es. le
// emoji con Helvetica/WinAnsi): senza, pdf-lib solleva un errore e l'intero
// PDF non viene generato. Itera per code point, così un'emoji vale un "?".
export function sostituisciNonCodificabili(testo: string, supporta: (codePoint: number) => boolean): string {
  let risultato = '';
  for (const carattere of testo) {
    risultato += supporta(carattere.codePointAt(0) as number) ? carattere : '?';
  }
  return risultato;
}

// Spezza `testo` in righe che non superano `larghezzaMax`. Va a capo tra le
// parole; una parola più larga della colonna viene spezzata per caratteri
// (mai oltre il margine, mai persa). Spazi e a-capo sono ridotti a uno
// spazio. Restituisce sempre almeno una riga (anche vuota).
export function righeDiTesto(testo: string, larghezzaMax: number, misura: (testo: string) => number): string[] {
  const parole = testo.split(/\s+/).filter(Boolean);
  const righe: string[] = [];
  let corrente = '';

  for (const parola of parole) {
    const candidata = corrente ? `${corrente} ${parola}` : parola;
    if (misura(candidata) <= larghezzaMax) {
      corrente = candidata;
      continue;
    }
    if (corrente) righe.push(corrente);
    corrente = '';
    // Parola sola: se non entra nemmeno da sola la si spezza per caratteri.
    let resto = parola;
    while (misura(resto) > larghezzaMax && Array.from(resto).length > 1) {
      let pezzo = '';
      for (const carattere of resto) {
        if (pezzo && misura(pezzo + carattere) > larghezzaMax) break;
        pezzo += carattere;
      }
      righe.push(pezzo);
      resto = resto.slice(pezzo.length);
    }
    corrente = resto;
  }

  righe.push(corrente);
  return righe;
}

// Altezza di una riga di tabella alta `righeDiTesto` righe di testo: la
// prima vale l'altezza standard, ogni altra un'interlinea.
export function altezzaRigaTabella(numeroRigheDiTesto: number): number {
  return ALTEZZA_RIGA_TABELLA + (Math.max(1, numeroRigheDiTesto) - 1) * INTERLINEA_TABELLA;
}
