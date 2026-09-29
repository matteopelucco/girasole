// Grant-check meccanico (A26, issue #28): logica pura. Confronta le tabelle
// usate nel codice, per ruolo Postgres, con i GRANT presenti nel DB di test.
// Un GRANT mancante è la causa di ogni errore "permission denied": la RLS
// filtra le righe, ma Postgres richiede comunque il privilegio di base sulla
// tabella (vedi migration 0004, 0008, 0018, 0021, 0034).
//
// Nessun I/O qui (CLAUDE.md, sezione Unit): lettura dei sorgenti e query al
// DB stanno in `scripts/grant-check.mts`.
//
// Euristica di estrazione (statica, volutamente semplice):
// - il file è diviso in blocchi a ogni funzione/const-arrow di primo livello
//   (riga che inizia a colonna 0);
// - il ruolo si decide per ricevente: `.from` chiamato su una variabile
//   assegnata da `createAdminClient()` (o tipizzata come tale) è
//   `service_role`; un parametro generico `SupabaseClient` può essere l'uno
//   o l'altro, quindi richiede il grant per ENTRAMBI i ruoli; ogni altro
//   client è `authenticated`;
// - l'annotazione `// grant-check: service_role` (o `authenticated`) subito
//   sopra una funzione la attribuisce a quel solo ruolo (codice server/cron,
//   oppure helper usato solo con la sessione utente);
// - il privilegio richiesto è il primo metodo di query dopo `.from('tabella')`
//   (select/insert/update/delete/upsert); se non se ne trova nessuno, SELECT.
// Non richiede SELECT implicito per update/delete (WHERE): meglio un falso
// negativo che un rosso rumoroso; le query `anon` non sono coperte.
// Il check è "anti permission-denied", NON un controllo di sicurezza: non
// vede grant in eccesso, RLS né la produzione.

export type Ruolo = 'authenticated' | 'service_role';
export type Privilegio = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';

export type Richiesta = {
  file: string;
  ruolo: Ruolo;
  tabella: string;
  privilegio: Privilegio;
};

export type GrantDb = { grantee: string; tabella: string; privilegio: string }[];

const INIZIO_BLOCCO =
  /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\b|^(?:export\s+)?const\s+\w+\s*=\s*(?:async\s*)?\(/;

const ANNOTAZIONE = /^\s*\/\/\s*grant-check:\s*(service_role|authenticated)\b/;

function rimuoviCommenti(src: string): string {
  const senzaBlocchi = src.replace(/\/\*[\s\S]*?\*\//g, '');
  return senzaBlocchi
    .split('\n')
    .filter((riga) => {
      if (ANNOTAZIONE.test(riga)) return true; // resta: la legge dividiInBlocchi
      const t = riga.trim();
      return !t.startsWith('//') && !t.startsWith('*');
    })
    .join('\n');
}

function dividiInBlocchi(src: string): string[] {
  const blocchi: string[] = [];
  let corrente: string[] = [];
  for (const riga of src.split('\n')) {
    if (INIZIO_BLOCCO.test(riga) && corrente.length > 0) {
      // le annotazioni subito sopra la funzione appartengono al nuovo blocco
      const coda: string[] = [];
      while (corrente.length > 0 && ANNOTAZIONE.test(corrente[corrente.length - 1])) {
        coda.unshift(corrente.pop() as string);
      }
      blocchi.push(corrente.join('\n'));
      corrente = coda;
    }
    corrente.push(riga);
  }
  blocchi.push(corrente.join('\n'));
  return blocchi;
}

function privilegiDellaCatena(coda: string): Privilegio[] {
  const m = coda.match(/^\s*\.(select|insert|update|delete|upsert)\s*\(/);
  switch (m?.[1]) {
    case 'insert':
      return ['INSERT'];
    case 'update':
      return ['UPDATE'];
    case 'delete':
      return ['DELETE'];
    case 'upsert':
      return ['INSERT', 'UPDATE'];
    default:
      return ['SELECT'];
  }
}

// Nomi delle variabili/parametri che nel blocco sono un client admin.
function variabiliAdmin(blocco: string): Set<string> {
  const nomi = new Set<string>();
  for (const m of blocco.matchAll(/(\w+)\s*=\s*createAdminClient\s*\(/g)) nomi.add(m[1]);
  for (const m of blocco.matchAll(/(\w+)\s*:\s*ReturnType<typeof createAdminClient>/g)) nomi.add(m[1]);
  return nomi;
}

// Parametri tipizzati come `SupabaseClient` generico: possono ricevere sia il
// client utente sia quello admin, quindi valgono per entrambi i ruoli.
function variabiliGeneriche(blocco: string): Set<string> {
  const nomi = new Set<string>();
  for (const m of blocco.matchAll(/(\w+)\s*:\s*SupabaseClient\b/g)) nomi.add(m[1]);
  return nomi;
}

const TUTTI: Ruolo[] = ['authenticated', 'service_role'];

// Ruoli del client su cui è chiamato `.from(...)`: guarda l'identificatore
// (o `createAdminClient()`) che precede la chiamata, anche su più righe.
function ruoliDelRicevente(
  prima: string,
  admin: Set<string>,
  generiche: Set<string>,
  forzato: Ruolo | null,
): Ruolo[] {
  if (forzato) return [forzato];
  if (/createAdminClient\s*\(\s*\)\s*$/.test(prima)) return ['service_role'];
  const nome = prima.match(/(\w+)\s*$/)?.[1];
  if (nome && admin.has(nome)) return ['service_role'];
  if (nome && generiche.has(nome)) return TUTTI;
  return ['authenticated'];
}

export function estraiRichieste(file: string, sorgente: string): Richiesta[] {
  const richieste: Richiesta[] = [];
  for (const blocco of dividiInBlocchi(rimuoviCommenti(sorgente))) {
    const admin = variabiliAdmin(blocco);
    const generiche = variabiliGeneriche(blocco);
    const forzato = (blocco.split('\n').map((r) => r.match(ANNOTAZIONE)?.[1]).find(Boolean) ?? null) as Ruolo | null;
    const re = /(?<!\b(?:Array|Buffer|Object|Date|String|Set|Map))\.from\(\s*['"]([a-z_][a-z0-9_]*)['"]\s*\)/g;
    for (const m of blocco.matchAll(re)) {
      const indice = m.index ?? 0;
      const ruoli = ruoliDelRicevente(blocco.slice(0, indice), admin, generiche, forzato);
      const coda = blocco.slice(indice + m[0].length);
      for (const ruolo of ruoli) {
        for (const privilegio of privilegiDellaCatena(coda)) {
          richieste.push({ file, ruolo, tabella: m[1], privilegio });
        }
      }
    }
  }
  return richieste;
}

export type Violazione = Richiesta & { file: string };

export function verificaGrant(richieste: Richiesta[], grant: GrantDb): Violazione[] {
  const presenti = new Set(grant.map((g) => `${g.grantee}|${g.tabella}|${g.privilegio}`));
  const viste = new Set<string>();
  const violazioni: Violazione[] = [];
  for (const r of richieste) {
    const chiave = `${r.ruolo}|${r.tabella}|${r.privilegio}|${r.file}`;
    if (viste.has(chiave)) continue;
    viste.add(chiave);
    if (!presenti.has(`${r.ruolo}|${r.tabella}|${r.privilegio}`)) violazioni.push(r);
  }
  return violazioni;
}

// Guardia sul parser: zero richieste estratte significa estrazione rotta
// (il codice usa sempre il DB), non "tutto a posto". Ritorna il messaggio
// d'errore, o null se va bene.
export function guardiaRichieste(richieste: Richiesta[]): string | null {
  return richieste.length === 0
    ? 'Nessuna richiesta estratta dal codice: parser rotto o cartelle sbagliate, controllo non affidabile.'
    : null;
}

export function formattaViolazioni(violazioni: Violazione[]): string {
  const righe = violazioni.map(
    (v) => `GRANT mancante: ${v.privilegio} su public.${v.tabella} per ${v.ruolo} (usata in ${v.file})`,
  );
  return [
    ...righe,
    '',
    'Rimedio: se la tabella serve solo a codice server/cron, attribuisci il client a service_role',
    "(annotazione `// grant-check: service_role` sulla funzione, o tipo `ReturnType<typeof createAdminClient>`),",
    'NON concedere il grant ad authenticated. Ogni nuovo grant ad authenticated richiede verifica RLS.',
    'Nota: il check è anti permission-denied, non un controllo di sicurezza: non copre grant in eccesso,',
    'RLS né la produzione.',
  ].join('\n');
}
