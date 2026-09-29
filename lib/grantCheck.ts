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
//   `service_role`, ogni altro client è `authenticated`;
// - il privilegio richiesto è il primo metodo di query dopo `.from('tabella')`
//   (select/insert/update/delete/upsert); se non se ne trova nessuno, SELECT.
// Non richiede SELECT implicito per update/delete (WHERE): meglio un falso
// negativo che un rosso rumoroso; le query `anon` non sono coperte.

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

function rimuoviCommenti(src: string): string {
  const senzaBlocchi = src.replace(/\/\*[\s\S]*?\*\//g, '');
  return senzaBlocchi
    .split('\n')
    .filter((riga) => {
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
      blocchi.push(corrente.join('\n'));
      corrente = [];
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

// Ruolo del client su cui è chiamato `.from(...)`: guarda l'identificatore
// (o `createAdminClient()`) che precede la chiamata, anche su più righe.
function ruoloDelRicevente(prima: string, admin: Set<string>): Ruolo {
  if (/createAdminClient\s*\(\s*\)\s*$/.test(prima)) return 'service_role';
  const nome = prima.match(/(\w+)\s*$/)?.[1];
  return nome && admin.has(nome) ? 'service_role' : 'authenticated';
}

export function estraiRichieste(file: string, sorgente: string): Richiesta[] {
  const richieste: Richiesta[] = [];
  for (const blocco of dividiInBlocchi(rimuoviCommenti(sorgente))) {
    const admin = variabiliAdmin(blocco);
    const re = /(?<!\b(?:Array|Buffer|Object|Date|String|Set|Map))\.from\(\s*['"]([a-z_][a-z0-9_]*)['"]\s*\)/g;
    for (const m of blocco.matchAll(re)) {
      const indice = m.index ?? 0;
      const ruolo = ruoloDelRicevente(blocco.slice(0, indice), admin);
      const coda = blocco.slice(indice + m[0].length);
      for (const privilegio of privilegiDellaCatena(coda)) {
        richieste.push({ file, ruolo, tabella: m[1], privilegio });
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

export function formattaViolazioni(violazioni: Violazione[]): string {
  return violazioni
    .map(
      (v) =>
        `GRANT mancante: ${v.privilegio} su public.${v.tabella} per ${v.ruolo} (usata in ${v.file})`,
    )
    .join('\n');
}
