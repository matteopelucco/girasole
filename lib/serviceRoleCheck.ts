// Girasole — service-role-check (issue #214, sotto-issue d di #38).
//
// Logica PURA (nessun I/O) del controllo statico che impedisce a
// `createAdminClient` (client Supabase con la service_role key, che bypassa
// la RLS) e a `SUPABASE_SERVICE_ROLE_KEY` di comparire fuori da una lista
// ammessa di file (ADR-0002). Il wrapper `scripts/service-role-check.mts` legge
// i file del repo e passa qui {percorso, contenuto}; i test sono in
// lib/serviceRoleCheck.test.ts.
//
// Come ammettere un'eccezione: aggiungere una voce a FILE_AMMESSI (con
// motivazione) e aggiornare ADR-0002 nella stessa PR; è una modifica che
// richiede review umana (spesso anche di rls-guardian).
//
// Limiti dell'euristica: non è un parser JS completo. Commenti e stringhe sono
// riconosciuti, i letterali regex no (un letterale regex che contiene un
// apice o un backtick può confondere lo scanner fino a fine riga o, per il
// backtick, oltre). Il controllo è una rete di sicurezza contro l'errore
// distratto, non una barriera contro chi vuole aggirarlo: la barriera è la
// review della PR.

export interface FileSorgente {
  percorso: string;
  contenuto: string;
}

// 'factory' = il nome della factory, 'chiave' = il nome della variabile d'ambiente.
export type TipoUso = 'factory' | 'chiave' | 'import-admin';

export interface Violazione {
  file: string;
  riga: number;
  tipo: TipoUso;
  testo: string;
}

export interface VoceAmmessa {
  /** Percorso esatto, oppure prefisso di cartella se termina con `/`. */
  percorso: string;
  motivo: string;
}

// Nomi costruiti come stringhe: questo file non deve contenere il simbolo nel
// codice, e il controllo non deve dipendere da un'eccezione su sé stesso.
const NOME_FACTORY = 'createAdminClient';
// (composta: una stringa esatta con il nome verrebbe segnalata dal controllo stesso)
const NOME_CHIAVE = ['SUPABASE', 'SERVICE', 'ROLE', 'KEY'].join('_');
const MODULO_FACTORY = 'lib/supabase/admin';

/** File in cui l'uso della service_role è ammesso (ADR-0002). */
export const FILE_AMMESSI: readonly VoceAmmessa[] = [
  {
    percorso: 'lib/supabase/admin.ts',
    motivo: 'La factory stessa: legge la service_role key, solo lato server.',
  },
  {
    percorso: 'app/api/cron/',
    motivo: 'Cron notturni (allarmi, report presenze): nessuna sessione utente da cui ereditare i permessi.',
  },
  {
    percorso: 'lib/reportPresenze.ts',
    motivo: 'Aggregazione del report notturno, chiamata solo dal cron report-presenze (stessa ragione del cron).',
  },
  {
    percorso: 'lib/grantCheck.ts',
    motivo: 'Analisi statica del grant-check: nomina createAdminClient dentro letterali regex, non lo chiama.',
  },
  {
    percorso: 'app/admin/maestre/actions.ts',
    motivo: 'Gestione utenti: Admin API di Supabase Auth (createUser/updateUserById/deleteUser), non esiste come RPC.',
  },
  {
    percorso: 'scripts/',
    motivo: 'Script di CI e di manutenzione (es. crea-utenti-e2e.mjs): non fanno parte del bundle dell\'app.',
  },
  {
    percorso: 'e2e/',
    motivo: 'Test end-to-end: girano in CI contro il DB di test, non fanno parte del bundle dell\'app.',
  },
];

const REGEX_TEST = /\.(test|spec)\.(ts|tsx|mts|js|jsx|mjs)$/;

export function normalizzaPercorso(percorso: string): string {
  return percorso.replace(/\\/g, '/').replace(/^(\.\/)+/, '');
}

/** True se il file può usare la service_role (voce in FILE_AMMESSI o file di test). */
export function usoAmmesso(percorso: string): boolean {
  const p = normalizzaPercorso(percorso);
  if (REGEX_TEST.test(p)) return true;
  return FILE_AMMESSI.some((v) => (v.percorso.endsWith('/') ? p.startsWith(v.percorso) : p === v.percorso));
}

interface Scansione {
  /** Come il sorgente, ma con commenti e contenuto delle stringhe sostituiti da spazi. */
  codice: string;
  stringhe: { valore: string; riga: number }[];
}

// Scanner minimale: separa codice, commenti e stringhe. I template literal
// hanno una pila per annidare le espressioni `${ ... }` (che sono codice).
function scansiona(src: string): Scansione {
  let codice = '';
  const stringhe: { valore: string; riga: number }[] = [];
  let riga = 1;
  let i = 0;
  // Profondità delle graffe aperte in codice, per ogni template in corso.
  const pilaTemplate: number[] = [];
  let graffe = 0;

  const emettiBlank = (c: string) => {
    codice += c === '\n' || c === '\r' ? c : ' ';
    if (c === '\n') riga++;
  };

  const leggiStringa = (apice: string) => {
    const inizio = riga;
    let valore = '';
    codice += ' ';
    i++;
    while (i < src.length) {
      const c = src[i];
      if (c === '\\') {
        valore += src[i + 1] ?? '';
        emettiBlank(c);
        if (i + 1 < src.length) emettiBlank(src[i + 1]);
        i += 2;
        continue;
      }
      if (c === apice) {
        codice += ' ';
        i++;
        break;
      }
      if (c === '\n') break; // stringa non terminata: riparti dalla riga dopo
      valore += c;
      emettiBlank(c);
      i++;
    }
    stringhe.push({ valore, riga: inizio });
  };

  // Legge il contenuto di un template fino a `${` (ritorna true) o al backtick di chiusura.
  const leggiTemplate = (): boolean => {
    while (i < src.length) {
      const c = src[i];
      if (c === '\\') {
        emettiBlank(c);
        if (i + 1 < src.length) emettiBlank(src[i + 1]);
        i += 2;
        continue;
      }
      if (c === '`') {
        codice += ' ';
        i++;
        return false;
      }
      if (c === '$' && src[i + 1] === '{') {
        codice += '  ';
        i += 2;
        return true;
      }
      emettiBlank(c);
      i++;
    }
    return false;
  };

  const entraInTemplate = () => {
    codice += ' ';
    i++;
    if (leggiTemplate()) {
      pilaTemplate.push(graffe);
      graffe = 0;
    }
  };

  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === '/' && n === '/') {
      while (i < src.length && src[i] !== '\n') {
        emettiBlank(src[i]);
        i++;
      }
    } else if (c === '/' && n === '*') {
      emettiBlank(c);
      emettiBlank(n);
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
        emettiBlank(src[i]);
        i++;
      }
      if (i < src.length) {
        codice += '  ';
        i += 2;
      }
    } else if (c === "'" || c === '"') {
      leggiStringa(c);
    } else if (c === '`') {
      entraInTemplate();
    } else if (c === '{') {
      graffe++;
      codice += c;
      i++;
    } else if (c === '}') {
      if (pilaTemplate.length > 0 && graffe === 0) {
        // Fine dell'espressione `${...}`: si torna dentro il template.
        graffe = pilaTemplate.pop() as number;
        codice += ' ';
        i++;
        if (leggiTemplate()) {
          pilaTemplate.push(graffe);
          graffe = 0;
        }
      } else {
        graffe = Math.max(0, graffe - 1);
        codice += c;
        i++;
      }
    } else {
      if (c === '\n') riga++;
      codice += c;
      i++;
    }
  }
  return { codice, stringhe };
}

function risolviSpecificatore(spec: string, fileDir: string): string | null {
  let p: string;
  if (spec.startsWith('@/')) {
    p = spec.slice(2);
  } else if (spec.startsWith('./') || spec.startsWith('../')) {
    p = `${fileDir}/${spec}`;
  } else {
    return null;
  }
  const parti: string[] = [];
  for (const seg of p.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') parti.pop();
    else parti.push(seg);
  }
  return parti.join('/').replace(/\.(ts|tsx|mts|js|jsx|mjs)$/, '');
}

function regexIdentificatore(nome: string): RegExp {
  return new RegExp(`(?<![\\w$])${nome}(?![\\w$])`, 'g');
}

function numeroRiga(testo: string, indice: number): number {
  let riga = 1;
  for (let k = 0; k < indice; k++) if (testo[k] === '\n') riga++;
  return riga;
}

/** Violazioni: usi della service_role in file non ammessi, ordinati per file, riga, tipo. */
export function trovaUsiNonAmmessi(files: readonly FileSorgente[]): Violazione[] {
  const out: Violazione[] = [];
  for (const file of files) {
    const percorso = normalizzaPercorso(file.percorso);
    if (usoAmmesso(percorso)) continue;

    const righe = file.contenuto.split(/\r?\n/);
    const { codice, stringhe } = scansiona(file.contenuto);
    const visti = new Set<string>();
    const aggiungi = (riga: number, tipo: TipoUso) => {
      const chiave = `${riga}:${tipo}`;
      if (visti.has(chiave)) return;
      visti.add(chiave);
      out.push({ file: percorso, riga, tipo, testo: (righe[riga - 1] ?? '').trim() });
    };

    for (const [nome, tipo] of [
      [NOME_FACTORY, 'factory'],
      [NOME_CHIAVE, 'chiave'],
    ] as const) {
      for (const m of codice.matchAll(regexIdentificatore(nome))) {
        aggiungi(numeroRiga(codice, m.index ?? 0), tipo);
      }
    }

    const dir = percorso.includes('/') ? percorso.slice(0, percorso.lastIndexOf('/')) : '';
    for (const s of stringhe) {
      const valore = s.valore.trim();
      if (valore === NOME_CHIAVE) aggiungi(s.riga, 'chiave');
      if (risolviSpecificatore(valore, dir) === MODULO_FACTORY) aggiungi(s.riga, 'import-admin');
    }
  }
  return out.sort((a, b) => a.file.localeCompare(b.file) || a.riga - b.riga || a.tipo.localeCompare(b.tipo));
}

const DESCRIZIONE: Record<TipoUso, string> = {
  factory: `usa ${NOME_FACTORY} (service_role, bypassa la RLS)`,
  chiave: `legge ${NOME_CHIAVE}`,
  'import-admin': 'importa lib/supabase/admin',
};

export function formattaViolazioni(violazioni: readonly Violazione[]): string {
  const righe = violazioni.map((v) => `${v.file}:${v.riga}: ${DESCRIZIONE[v.tipo]} — ${v.testo}`);
  return [
    ...righe,
    '',
    'La service_role key bypassa la RLS: è ammessa solo nei file elencati in FILE_AMMESSI',
    '(lib/serviceRoleCheck.ts): factory, cron e relative librerie, gestione utenti, script e test.',
    'Rimedio preferito: non usarla. Per un\'azione avviata da un utente serve una funzione Postgres',
    '(RPC, `security definer` con il controllo del ruolo dentro) chiamata con la sessione dell\'utente,',
    'oppure il client della sessione con le policy RLS già esistenti.',
    'Se l\'uso è davvero necessario (nessuna sessione utente, Admin API di Auth), aggiungi il file a',
    'FILE_AMMESSI in lib/serviceRoleCheck.ts con la motivazione e aggiorna ADR-0002 nella stessa PR',
    '(richiede review umana, con rls-guardian).',
  ].join('\n');
}

/** Messaggio se la scansione non è affidabile (nessun file, o factory non trovata); altrimenti null. */
export function guardiaFile(files: readonly FileSorgente[]): string | null {
  if (files.length === 0) return 'Nessun file sorgente letto: scansione non affidabile.';
  if (!files.some((f) => normalizzaPercorso(f.percorso) === 'lib/supabase/admin.ts')) {
    return 'lib/supabase/admin.ts non è tra i file letti: percorsi o cartelle scansionate non corrispondono, controllo non affidabile.';
  }
  return null;
}
