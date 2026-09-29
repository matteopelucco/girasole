// RLS-check (issue #131): logica pura. Il grant-check (#28) verifica solo che
// i GRANT esistano; qui si controlla che nessuna tabella dello schema `public`
// con grant ad `authenticated` o `anon` abbia la RLS disattivata
// (`pg_class.relrowsecurity = false`): con il grant e senza RLS, chiunque
// abbia l'anon key (pubblica per design) leggerebbe/scriverebbe tutte le righe.
//
// Nessun I/O qui (CLAUDE.md, sezione Unit): la query al DB di test sta in
// `scripts/rls-check.mts`.

export type TabellaRls = { tabella: string; rls: boolean; grantee: string[] };

const RUOLI_ESPOSTI = ['authenticated', 'anon'];

// Tabelle volutamente esposte senza RLS. VUOTA: nessuna tabella lo è.
// Ogni voce aggiunta qui va motivata in un commento e rivista da rls-guardian.
export const ALLOW_LIST_SENZA_RLS: string[] = [];

// Query di sola lettura: una riga per ogni tabella ordinaria di `public`,
// con stato RLS e ruoli esposti che hanno almeno un privilegio.
export const QUERY_RLS = `select c.relname as tabella,
  c.relrowsecurity as rls,
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
where n.nspname = 'public' and c.relkind in ('r', 'p')`;

export function trovaSenzaRls(
  tabelle: TabellaRls[],
  allowList: string[] = ALLOW_LIST_SENZA_RLS,
): TabellaRls[] {
  return tabelle.filter(
    (t) =>
      !t.rls &&
      !allowList.includes(t.tabella) &&
      t.grantee.some((g) => RUOLI_ESPOSTI.includes(g)),
  );
}

// Tabella che deve esistere nello schema public: se manca, il DB non è
// migrato o il ref è sbagliato, e "nessuna violazione" non significherebbe nulla.
export const TABELLA_NOTA = 'bambini';

// Zero tabelle, o tabella nota assente = risposta inattesa (fail-closed).
export function guardiaTabelle(tabelle: TabellaRls[]): string | null {
  if (tabelle.length === 0) {
    return 'Nessuna tabella letta dal DB: risposta inattesa, controllo non affidabile.';
  }
  if (!tabelle.some((t) => t.tabella === TABELLA_NOTA)) {
    return `Tabella nota public.${TABELLA_NOTA} assente: DB non migrato o ref sbagliato, controllo non affidabile.`;
  }
  return null;
}

// Normalizza la risposta della Management API. Fail-closed: qualunque forma
// inattesa (grantee né array né stringa, rls non booleano) è un errore, mai
// una normalizzazione silenziosa che potrebbe nascondere una violazione.
export function normalizzaRighe(risposta: unknown): { tabelle: TabellaRls[] } | { errore: string } {
  if (!Array.isArray(risposta)) return { errore: 'Risposta non affidabile: non è un array di righe.' };
  const tabelle: TabellaRls[] = [];
  for (const r of risposta as Record<string, unknown>[]) {
    if (typeof r?.tabella !== 'string' || typeof r.rls !== 'boolean') {
      return { errore: `Risposta non affidabile: riga con tabella/rls inattesi (${JSON.stringify(r)}).` };
    }
    let grantee: string[];
    if (Array.isArray(r.grantee) && r.grantee.every((g) => typeof g === 'string')) {
      grantee = r.grantee as string[];
    } else if (typeof r.grantee === 'string') {
      // Forma testuale di un array Postgres: "{a,b}".
      grantee = r.grantee.replace(/[{}]/g, '').split(',').filter(Boolean);
    } else {
      return { errore: `Risposta non affidabile: grantee inatteso per public.${r.tabella}.` };
    }
    tabelle.push({ tabella: r.tabella, rls: r.rls, grantee });
  }
  return { tabelle };
}

export function formattaSenzaRls(violazioni: TabellaRls[]): string {
  const righe = violazioni.map(
    (v) =>
      `RLS disattivata: public.${v.tabella} ha grant per ${v.grantee
        .filter((g) => RUOLI_ESPOSTI.includes(g))
        .join(', ')} ma relrowsecurity = false`,
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
