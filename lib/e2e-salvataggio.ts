// Girasole — controllo statico sui test e2e: un solo modo di salvare
// (issue #171, sotto-issue "a" di #77).
//
// Un click su un bottone di salvataggio ("Salva…", "Registra…",
// "Aggiorna…") invia una Server Action. Se il test fa poi un `reload`/`goto`
// senza aver atteso la risposta, la navigazione può annullare l'azione
// ancora in volo e il test diventa intermittente (issue #70). L'unico modo
// ammesso per cliccare quei bottoni è `clickEAttendiAzione` (e2e/helpers.ts).
//
// Logica pura (solo stringhe, niente filesystem): lo script sottile
// scripts/controlla-click-salva.mts legge i file e la applica.
//
// Euristica volutamente prudente (meglio un falso negativo che bloccare un
// push): segnala solo il click scritto direttamente su un
// `getByRole('button', { name: <Salva|Registra|Aggiorna…> })` nella stessa
// istruzione, quando più avanti nello stesso test c'è un `reload`/`goto`.
// Se tra il click e il reload/goto il test ha già atteso l'esito (vedi
// haAtteso) non segnala. Non segue i click su variabili (`const b = page.getByRole(...); b.click()`).

export type ClickSalvaNonAtteso = {
  /** Riga (da 1) dell'istruzione `.click()` non attesa. */
  riga: number;
  /** Riga (da 1) del primo `reload`/`goto` che la segue nello stesso test. */
  rigaRicaricamento: number;
};

// Sostituisce i commenti con spazi (mantenendo gli a capo) così gli offset e
// i numeri di riga restano quelli del file originale. Un `//` preceduto da
// `:` (es. `https://`) non è un commento.
function senzaCommenti(codice: string): string {
  const blank = (m: string) => m.replace(/[^\n]/g, ' ');
  return codice
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:\w'"`])\/\/.*$/gm, (m, prefisso: string) => prefisso + blank(m.slice(prefisso.length)));
}

function rigaDiOffset(codice: string, offset: number): number {
  let riga = 1;
  for (let i = 0; i < offset; i++) {
    if (codice[i] === '\n') riga++;
  }
  return riga;
}

// Inizio di un test o di un blocco che ne delimita il corpo: `test('...'`,
// `test.describe('...'`, `test.afterEach(`... Un `test.skip(cond, 'motivo')`
// dentro un test NON è un confine (il primo argomento non è una stringa).
const CONFINE_TEST = /^[ \t]*(?:test|it)(?:\.\w+)*\(\s*['"`]|^[ \t]*test\.(?:before|after)\w+\(/gm;

const BOTTONE_SALVA =
  /getByRole\(\s*['"]button['"]\s*,\s*\{\s*name:\s*(?:['"`]|\/\^?)(?:Salva|Registra|Aggiorna)/i;

const CLICK = /\.click\(/g;
const RICARICAMENTO = /\.(?:reload|goto)\(/;

// Dopo il click, prima del reload/goto, il test ha già atteso l'esito se c'è
// un'attesa esplicita di rete/navigazione, un altro click atteso, oppure
// un'asserzione "positiva" (es. `toContainText` sul messaggio di esito, che
// non passa finché la risposta non è arrivata). Non contano le asserzioni
// che possono passare subito senza attendere nulla: `.not.` e
// `toHaveCount(0)` (assenza di avvisi).
const ATTESA_ESPLICITA = /clickEAttendiAzione|waitForResponse|waitForURL|waitForLoadState/;

function haAtteso(tratto: string): boolean {
  if (ATTESA_ESPLICITA.test(tratto)) return true;
  for (const m of tratto.matchAll(/expect\(/g)) {
    const fine = tratto.indexOf(';', m.index);
    const asserzione = tratto.slice(m.index, fine === -1 ? undefined : fine);
    if (!/\.not\.|toHaveCount\(\s*0\s*\)/.test(asserzione)) return true;
  }
  return false;
}

export function trovaClickSalvaNonAttesi(codiceOriginale: string): ClickSalvaNonAtteso[] {
  const codice = senzaCommenti(codiceOriginale);

  const confini: number[] = [];
  for (const m of codice.matchAll(CONFINE_TEST)) confini.push(m.index);
  confini.push(codice.length);

  const risultati: ClickSalvaNonAtteso[] = [];
  for (const m of codice.matchAll(CLICK)) {
    const posizione = m.index;

    // Istruzione del click: dall'ultimo `await` precedente al click.
    const inizio = codice.lastIndexOf('await', posizione);
    if (inizio === -1) continue;
    const istruzione = codice.slice(inizio, posizione);
    if (istruzione.includes(';')) continue; // il click non è nella stessa istruzione
    if (!BOTTONE_SALVA.test(istruzione)) continue;
    if (/clickEAttendiAzione|waitForResponse/.test(istruzione)) continue;

    // Fine del test che contiene il click: il primo confine dopo di lui.
    const fine = confini.find((c) => c > posizione) ?? codice.length;
    const dopo = codice.slice(posizione, fine);
    const ricaricamento = RICARICAMENTO.exec(dopo);
    if (!ricaricamento) continue;
    if (haAtteso(dopo.slice(1, ricaricamento.index))) continue;

    risultati.push({
      riga: rigaDiOffset(codice, posizione),
      rigaRicaricamento: rigaDiOffset(codice, posizione + ricaricamento.index),
    });
  }
  return risultati;
}
