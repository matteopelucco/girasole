// RLS-check (issue #131, esteso da #133): logica pura. Il grant-check (#28)
// verifica solo che i GRANT esistano; qui si controlla che nessun oggetto
// dello schema `public` esposto ad `authenticated` o `anon` aggira la RLS:
//  - tabella (relkind r/p) con grant e `relrowsecurity = false`: chiunque abbia
//    l'anon key (pubblica per design) leggerebbe/scriverebbe tutte le righe;
//  - vista (v) con grant e senza `security_invoker = true`: gira coi diritti del
//    proprietario e scavalca la RLS delle tabelle sottostanti;
//  - vista materializzata (m) o tabella esterna (f) con grant: non hanno RLS
//    (nemmeno `security_invoker` le salva), quindi mai esposte.
//
// Nessun I/O qui (CLAUDE.md, sezione Unit): la query al DB di test sta in
// `scripts/rls-check.mts`.

// r = tabella, p = tabella partizionata, v = vista, m = vista materializzata,
// f = tabella esterna (valori di `pg_class.relkind`).
export type Relkind = 'r' | 'p' | 'v' | 'm' | 'f';
const RELKIND_NOTI: string[] = ['r', 'p', 'v', 'm', 'f'];

export type OggettoRls = {
  nome: string;
  relkind: Relkind;
  rls: boolean;
  grantee: string[];
  reloptions: string[];
};

const RUOLI_ESPOSTI = ['authenticated', 'anon'];

const espone = (o: OggettoRls) => o.grantee.some((g) => RUOLI_ESPOSTI.includes(g));
const eTabella = (o: OggettoRls) => o.relkind === 'r' || o.relkind === 'p';

// Tabelle volutamente esposte senza RLS. VUOTA: nessuna tabella lo è.
// Ogni voce aggiunta qui va motivata in un commento e rivista da rls-guardian.
export const ALLOW_LIST_SENZA_RLS: string[] = [];

// Viste, viste materializzate e tabelle esterne volutamente esposte senza
// garanzie di RLS. VUOTA: nessun oggetto lo è. Ogni voce aggiunta qui va
// motivata in un commento e rivista da rls-guardian.
export const ALLOW_LIST_ESPOSTI_SENZA_RLS: string[] = [];

// Query di sola lettura: una riga per ogni tabella, vista, vista materializzata
// e tabella esterna di `public`, con relkind, stato RLS, opzioni (reloptions,
// da cui `security_invoker`) e ruoli esposti che hanno almeno un privilegio.
export const QUERY_RLS = `select c.relname as nome,
  c.relkind::text as relkind,
  c.relrowsecurity as rls,
  c.reloptions as reloptions,
  coalesce(array(
    select r.rolname from pg_roles r
    where r.rolname in ('authenticated', 'anon')
      and (
        has_table_privilege(r.rolname, c.oid, 'SELECT,INSERT,UPDATE,DELETE')
        or has_any_column_privilege(r.rolname, c.oid, 'SELECT,INSERT,UPDATE')
      )
    order by r.rolname
  ), '{}') as grantee
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')`;

export function trovaSenzaRls(
  oggetti: OggettoRls[],
  allowList: string[] = ALLOW_LIST_SENZA_RLS,
): OggettoRls[] {
  return oggetti.filter((o) => eTabella(o) && !o.rls && !allowList.includes(o.nome) && espone(o));
}

// Booleani come li accetta Postgres (parse_bool): prefissi di true/yes, on, 1.
const VERO = ['t', 'tr', 'tru', 'true', 'y', 'ye', 'yes', 'on', '1'];

// `reloptions` è una lista di "chiave=valore". Vale l'ultima occorrenza; ogni
// valore non riconosciuto come vero conta come falso (fail-closed).
export function hasSecurityInvoker(reloptions: string[]): boolean {
  let valore = false;
  for (const opt of reloptions) {
    const eq = opt.indexOf('=');
    if (eq < 0 || opt.slice(0, eq).trim().toLowerCase() !== 'security_invoker') continue;
    valore = VERO.includes(opt.slice(eq + 1).trim().toLowerCase());
  }
  return valore;
}

// Viste con grant e senza security_invoker = true; viste materializzate e
// tabelle esterne con grant (non hanno RLS, security_invoker non le copre).
export function trovaEspostiSenzaRls(
  oggetti: OggettoRls[],
  allowList: string[] = ALLOW_LIST_ESPOSTI_SENZA_RLS,
): OggettoRls[] {
  return oggetti.filter(
    (o) =>
      !eTabella(o) &&
      !allowList.includes(o.nome) &&
      espone(o) &&
      !(o.relkind === 'v' && hasSecurityInvoker(o.reloptions)),
  );
}

// Tabella che deve esistere nello schema public: se manca, il DB non è
// migrato o il ref è sbagliato, e "nessuna violazione" non significherebbe nulla.
export const TABELLA_NOTA = 'bambini';

// Zero oggetti, o tabella nota assente = risposta inattesa (fail-closed).
export function guardiaTabelle(oggetti: OggettoRls[]): string | null {
  if (oggetti.length === 0) {
    return 'Nessuna tabella letta dal DB: risposta inattesa, controllo non affidabile.';
  }
  if (!oggetti.some((o) => eTabella(o) && o.nome === TABELLA_NOTA)) {
    return `Tabella nota public.${TABELLA_NOTA} assente: DB non migrato o ref sbagliato, controllo non affidabile.`;
  }
  return null;
}

// Normalizza `reloptions`: null/assente = nessuna opzione (una vista senza
// opzioni risulterà senza security_invoker, quindi segnalata); array di stringhe
// o forma testuale "{a=b,c=d}". Altro = errore (fail-closed).
function normalizzaReloptions(v: unknown): string[] | null {
  if (v === null || v === undefined) return [];
  if (Array.isArray(v)) return v.every((x) => typeof x === 'string') ? (v as string[]) : null;
  if (typeof v === 'string' && v.startsWith('{') && v.endsWith('}')) {
    return v
      .slice(1, -1)
      .split(',')
      .map((x) => x.trim().replace(/^"(.*)"$/, '$1'))
      .filter(Boolean);
  }
  return null;
}

// Normalizza la risposta della Management API. Fail-closed: qualunque forma
// inattesa (relkind ignoto, grantee né array né stringa, rls non booleano,
// reloptions illeggibili) è un errore, mai una normalizzazione silenziosa che
// potrebbe nascondere una violazione.
export function normalizzaRighe(risposta: unknown): { oggetti: OggettoRls[] } | { errore: string } {
  if (!Array.isArray(risposta)) return { errore: 'Risposta non affidabile: non è un array di righe.' };
  const oggetti: OggettoRls[] = [];
  for (const r of risposta as Record<string, unknown>[]) {
    if (typeof r !== 'object' || r === null || typeof r.nome !== 'string' || typeof r.rls !== 'boolean') {
      return { errore: `Risposta non affidabile: riga con nome/rls inattesi (${JSON.stringify(r)}).` };
    }
    if (typeof r.relkind !== 'string' || !RELKIND_NOTI.includes(r.relkind)) {
      return { errore: `Risposta non affidabile: relkind inatteso per public.${r.nome} (${JSON.stringify(r.relkind)}).` };
    }
    let grantee: string[];
    if (Array.isArray(r.grantee) && r.grantee.every((g) => typeof g === 'string')) {
      grantee = r.grantee as string[];
    } else if (typeof r.grantee === 'string') {
      // Forma testuale di un array Postgres: "{a,b}".
      grantee = r.grantee.replace(/[{}]/g, '').split(',').filter(Boolean);
    } else {
      return { errore: `Risposta non affidabile: grantee inatteso per public.${r.nome}.` };
    }
    const reloptions = normalizzaReloptions(r.reloptions);
    if (reloptions === null) {
      return { errore: `Risposta non affidabile: reloptions inattesi per public.${r.nome}.` };
    }
    oggetti.push({ nome: r.nome, relkind: r.relkind as Relkind, rls: r.rls, grantee, reloptions });
  }
  return { oggetti };
}

const ruoliEsposti = (o: OggettoRls) => o.grantee.filter((g) => RUOLI_ESPOSTI.includes(g)).join(', ');

export function formattaSenzaRls(violazioni: OggettoRls[]): string {
  const righe = violazioni.map(
    (v) => `RLS disattivata: public.${v.nome} ha grant per ${ruoliEsposti(v)} ma relrowsecurity = false`,
  );
  return [
    ...righe,
    '',
    'Rimedio: abilita la RLS (ALTER TABLE public.<tabella> ENABLE ROW LEVEL SECURITY) e definisci le',
    'policy per i ruoli di specs/ in una migration, insieme alla tabella. NON togliere il grant per far',
    'passare il check: nasconderebbe il problema. Solo se la tabella è davvero pubblica per scelta,',
    'aggiungila (con motivazione) a ALLOW_LIST_SENZA_RLS in lib/rlsCheck.ts, con review di rls-guardian.',
  ].join('\n');
}

const NOME_TIPO: Record<'v' | 'm' | 'f', string> = {
  v: 'vista',
  m: 'vista materializzata',
  f: 'tabella esterna',
};

export function formattaEsposti(violazioni: OggettoRls[]): string {
  const righe = violazioni.map((v) =>
    v.relkind === 'v'
      ? `Vista senza security_invoker: public.${v.nome} (vista) ha grant per ${ruoliEsposti(v)} e scavalca la RLS delle tabelle sottostanti`
      : `Oggetto senza RLS: public.${v.nome} (${NOME_TIPO[v.relkind as 'm' | 'f']}) ha grant per ${ruoliEsposti(v)} e non può avere RLS`,
  );
  return [
    ...righe,
    '',
    'Rimedio: per una vista, creala o modificala con security_invoker = true (CREATE VIEW ... WITH',
    '(security_invoker = true), oppure ALTER VIEW ... SET (security_invoker = true)) in una migration,',
    'così rispetta la RLS di chi la interroga. Per viste materializzate e tabelle esterne (che non hanno',
    'RLS) togli il grant ad anon/authenticated (REVOKE ALL ON public.<oggetto> FROM anon, authenticated)',
    'ed esponi i dati con una vista security_invoker o una funzione. Solo se l\'oggetto è davvero pubblico',
    'per scelta, aggiungilo (con motivazione) a ALLOW_LIST_ESPOSTI_SENZA_RLS in lib/rlsCheck.ts, con',
    'review di rls-guardian.',
  ].join('\n');
}
