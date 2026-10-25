// Girasole — controllo delle classi per pulsanti e campi fuori da
// `components/ui/` (issue #351, serie "UX REVIEW", ADR 0011).
//
// Regola (specs/01 - ux.md, "Sistema di componenti"): nel codice nuovo non si
// aggiungono stringhe di classi per pulsanti e campi fuori da
// `components/ui/`; se manca una variante, si aggiunge al componente.
//
// Logica PURA (nessun I/O): lo script sottile `scripts/controlla-ui.mts`
// legge i file di app/, components/ e lib/ e la applica; i test sono in
// lib/controlloUi.test.ts. Stesso schema di lib/serviceRoleCheck.ts.
//
// Come riconosce una violazione: guarda ogni stringa tra virgolette (anche i
// template literal) come un elenco di classi e cerca le combinazioni tipiche:
//  - pulsante: tinta piena senza prefisso (`bg-<colore>-500..900`, oppure
//    `bg-white` insieme a un bordo grigio) più il padding `px-*` e `py-*`;
//  - campo: bordo grigio (`border-stone-200..400`) più un bordo diverso al
//    focus (`focus:border-*`).
// Non è un parser: le classi spezzate su più stringhe (`cn('a', cond && 'b')`)
// sfuggono. È una rete contro la copia distratta, non una barriera: la
// barriera è la review della PR. Riquadri, etichette e badge (senza il
// padding del pulsante) non vengono segnalati.
//
// Come ammettere un file: nuova voce in ECCEZIONI con il motivo, nella stessa
// PR e con review umana. Una voce che non serve più fa fallire il controllo
// (così l'elenco non conserva eccezioni dimenticate).

export interface FileSorgente {
  percorso: string;
  contenuto: string;
}

export type TipoViolazione = 'pulsante' | 'campo';

export interface ViolazioneUi {
  file: string;
  /** Riga (da 1) in cui inizia la stringa di classi. */
  riga: number;
  tipo: TipoViolazione;
}

export interface EccezioneUi {
  /** Percorso esatto del file (relativo alla radice, con `/`). */
  percorso: string;
  motivo: string;
}

export interface EsitoControlloUi {
  violazioni: ViolazioneUi[];
  /** Voci di ECCEZIONI che non corrispondono più a nessuna violazione. */
  eccezioniObsolete: EccezioneUi[];
}

/**
 * File fuori da `components/ui/` che hanno ancora pulsanti o campi con le
 * classi scritte a mano. Ogni voce dice perché. Non è un permesso a copiare:
 * sono le schermate non ancora migrate, che riprendono le issue successive
 * della serie "UX REVIEW" (spec 01). Per togliere una voce basta sostituire
 * le classi con `Pulsante`/`Campo`; il controllo avvisa quando una voce non
 * serve più.
 */
export const ECCEZIONI: readonly EccezioneUi[] = [
  // Pulsanti con tinta e misure proprie (amber, rounded-lg): sostituirli con
  // <Pulsante> cambierebbe colore, raggio o altezza minima su telefono.
  {
    percorso: 'app/dashboard/giornata/PulsantiAssenzaConAvviso.tsx',
    motivo: 'Due pulsanti (conferma in amber, annulla secondario) con classi proprie; da migrare con la scheda della giornata.',
  },
  {
    percorso: 'components/SelettoreData.tsx',
    motivo: 'Pulsante "Vai" in amber-700 (tinta del selettore, senza variante in <Pulsante>); il campo accanto usa già <Campo>.',
  },
  {
    percorso: 'components/EliminaUtente.tsx',
    motivo: 'Pulsanti Annulla/Elimina della conferma di cancellazione (rosso, py-1.5), dentro <PulsanteInvio> con classi proprie.',
  },
  {
    percorso: 'components/IndirizzoCalendarioNascosto.tsx',
    motivo: 'Pulsante secondario con bordo grigio e sfondo bianco, ancora con classi proprie (px-4 py-2, rounded-lg).',
  },
  {
    percorso: 'components/BottoneSalvaNota.tsx',
    motivo: 'Pulsante di salvataggio a tutta larghezza (sky-700, rounded-full, ombra) che non è una variante di <Pulsante>.',
  },
  // Campi con bordo grigio che cambia al focus: <Campo> usa un anello e non
  // cambia il bordo (specs/01), quindi la migrazione è una differenza visiva.
  {
    percorso: 'app/dashboard/giornata/comune.tsx',
    motivo: 'Campo di testo della giornata (placeholder, bordo scuro al focus), ancora con classi proprie.',
  },
  {
    percorso: 'components/CampiOreSettimana.tsx',
    motivo: 'Campi numerici compatti delle ore per giorno (w-16, px-2 py-1), ancora con classi proprie.',
  },
  {
    percorso: 'components/SelettoreDestinatarioAvviso.tsx',
    motivo: "Tre campi di scelta del destinatario dell'avviso (larghezze diverse), ancora con classi proprie.",
  },
  {
    percorso: 'components/SezioneCalendarioGoogle.tsx',
    motivo: "Campo dell'indirizzo del calendario Google, ancora con classi proprie.",
  },
];

const REGEX_TEST = /\.(test|spec)\.(ts|tsx|mts|js|jsx|mjs)$/;
const CARTELLA_UI = 'components/ui/';

const COLORE = '(?:emerald|red|amber|stone|sky|blue|green|rose|orange|yellow|slate|gray|zinc|neutral)';
const TINTA_PIENA = new RegExp(`^bg-${COLORE}-[5-9]00$`);
const BORDO_GRIGIO = /^border-stone-[234]00$/;
const BORDO_AL_FOCUS = /^focus:border-/;

function normalizzaPercorso(percorso: string): string {
  return percorso.replace(/\\/g, '/').replace(/^(\.\/)+/, '');
}

function tipoDiClassi(classi: string): TipoViolazione | null {
  const token = classi.split(/\s+/).filter(Boolean);
  if (token.length < 2) return null;
  const ha = (re: RegExp) => token.some((t) => re.test(t));

  if (ha(BORDO_GRIGIO) && ha(BORDO_AL_FOCUS)) return 'campo';

  const paddingPulsante = ha(/^px-/) && ha(/^py-/);
  const sfondoPulsante = ha(TINTA_PIENA) || (ha(BORDO_GRIGIO) && token.includes('bg-white'));
  if (paddingPulsante && sfondoPulsante) return 'pulsante';
  return null;
}

interface Stringa {
  valore: string;
  riga: number;
}

// Estrae le stringhe tra virgolette saltando i commenti. Gli apici e le
// virgolette semplici non attraversano mai un a capo (un apostrofo nel testo
// JSX, come `l'utente`, non deve inghiottire le righe dopo); i template
// literal sì, perché le classi vanno spesso su più righe.
function estraiStringhe(src: string): Stringa[] {
  const out: Stringa[] = [];
  let riga = 1;
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === '/' && n === '/') {
      while (i < src.length && src[i] !== '\n') i++;
    } else if (c === '/' && n === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] === '\n') riga++;
        i++;
      }
      i += 2;
    } else if (c === "'" || c === '"' || c === '`') {
      const inizio = riga;
      let valore = '';
      i++;
      while (i < src.length) {
        const d = src[i];
        if (d === '\\') {
          valore += ' ';
          if (src[i + 1] === '\n') riga++;
          i += 2;
          continue;
        }
        if (d === c) {
          i++;
          break;
        }
        if (d === '\n') {
          if (c !== '`') break; // stringa non terminata: riparti dalla riga dopo
          riga++;
        }
        valore += d;
        i++;
      }
      out.push({ valore, riga: inizio });
    } else {
      if (c === '\n') riga++;
      i++;
    }
  }
  return out;
}

/** Tutte le stringhe di classi per pulsanti e campi nei file dati, fuori da components/ui/ e dai test. */
export function trovaClassiRipetute(files: readonly FileSorgente[]): ViolazioneUi[] {
  const out: ViolazioneUi[] = [];
  for (const f of files) {
    const percorso = normalizzaPercorso(f.percorso);
    if (percorso.startsWith(CARTELLA_UI) || REGEX_TEST.test(percorso)) continue;
    for (const s of estraiStringhe(f.contenuto)) {
      const tipo = tipoDiClassi(s.valore);
      if (tipo) out.push({ file: percorso, riga: s.riga, tipo });
    }
  }
  return out.sort((a, b) => a.file.localeCompare(b.file) || a.riga - b.riga || a.tipo.localeCompare(b.tipo));
}

/** Applica l'elenco delle eccezioni: le violazioni rimaste e le voci dell'elenco ormai inutili. */
export function controllaUi(
  files: readonly FileSorgente[],
  eccezioni: readonly EccezioneUi[] = ECCEZIONI,
): EsitoControlloUi {
  const trovate = trovaClassiRipetute(files);
  const ammessi = new Set(eccezioni.map((e) => normalizzaPercorso(e.percorso)));
  const conViolazioni = new Set(trovate.map((v) => v.file));
  return {
    violazioni: trovate.filter((v) => !ammessi.has(v.file)),
    eccezioniObsolete: eccezioni.filter((e) => !conViolazioni.has(normalizzaPercorso(e.percorso))),
  };
}

const DESCRIZIONE: Record<TipoViolazione, string> = {
  pulsante: 'classi di un pulsante scritte a mano: usa <Pulsante> (components/ui/pulsante.tsx)',
  campo: 'classi di un campo scritte a mano: usa <Campo> (components/ui/campo.tsx)',
};

export function formattaEsito(esito: EsitoControlloUi): string {
  const righe = esito.violazioni.map((v) => `${v.file}:${v.riga}: ${DESCRIZIONE[v.tipo]}`);
  for (const e of esito.eccezioniObsolete) {
    righe.push(`${e.percorso}: voce di ECCEZIONI non più necessaria (nessun pulsante o campo copiato): toglila da lib/controlloUi.ts`);
  }
  if (esito.violazioni.length > 0) {
    righe.push(
      '',
      'Pulsanti e campi si prendono da components/ui/ (specs/01 - ux.md, ADR 0011). Se manca una',
      'variante, si aggiunge al componente (class-variance-authority), non si copia la stringa.',
      'Solo per una schermata ancora da migrare: voce in ECCEZIONI (lib/controlloUi.ts) con il',
      'motivo, nella stessa PR e con review umana.',
    );
  }
  return righe.join('\n');
}
