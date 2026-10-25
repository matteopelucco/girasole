// Grant-migrazioni-check (issue #359): logica pura. Ricostruisce dai file SQL
// di `supabase/migrations/` i GRANT ESPLICITI che ogni tabella di `public`
// riceve per ruolo, così il controllo non dipende dai privilegi di default
// di Supabase. Dal 30 ottobre 2026 una tabella nuova in `public` non li
// riceve più da sola: senza GRANT nelle migration, un `supabase db reset`
// (la CI lo fa a ogni PR) darebbe "permission denied" anche se oggi il
// grant-check sul DB di test passa grazie ai default.
//
// Nessun I/O qui (CLAUDE.md, sezione Unit): la lettura dei file sta in
// `scripts/grant-migrazioni-check.mts`. Il confronto con le tabelle usate dal
// codice riusa `estraiRichieste`/`verificaGrant` di lib/grantCheck.ts.
//
// Limiti (euristica statica, volutamente semplice):
// - si considerano `create table`, `drop table`, `alter table ... rename to`,
//   `grant` e `revoke` su tabelle di `public`, in ordine di nome file;
// - i corpi di funzione tra dollari e i commenti sono ignorati; una stringa
//   letterale che contiene `--` o `;` non è gestita (non ce ne sono nelle
//   migration, e basterebbe un falso rosso, non un falso verde);
// - un GRANT limitato a certe colonne (`grant update (col) on t`) conta come
//   privilegio sulla tabella, come nello script che legge il DB; una REVOKE
//   di colonna toglie invece l'intero privilegio (direzione prudente);
// - non vede i GRANT eventualmente dati fuori dalle migration (vietato) né la
//   RLS: è un controllo "anti permission-denied", non di sicurezza.

import type { GrantDb } from './grantCheck';

export type FileSql = { nome: string; contenuto: string };

export type Analisi = {
  /** GRANT esplicitamente presenti dopo aver applicato tutte le migration. */
  grant: GrantDb;
  /** Tabelle di `public` esistenti dopo tutte le migration. */
  tabelle: string[];
};

const PRIVILEGI_TABELLA = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'];

/**
 * Tabelle di `public` volutamente senza GRANT a `authenticated`/`service_role`,
 * con la motivazione. Aggiungerne una richiede review umana (rls-guardian).
 */
export const TABELLE_SENZA_GRANT_AMMESSE: Readonly<Record<string, string>> = {
  tentativi_reset_password:
    'Letta e scritta solo dalla funzione security definer puo_richiedere_reset_password (migration 0003/0004): nessun accesso diretto via API, per evitare l\'enumerazione delle email.',
};

function pulisciSql(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(/\r?\n/)
    .map((riga) => riga.replace(/--.*$/, ''))
    .join('\n')
    .replace(/\$(\w*)\$[\s\S]*?\$\1\$/g, '');
}

function normalizza(istruzione: string): string {
  return istruzione.replace(/\s+/g, ' ').trim();
}

function elencoPrivilegi(testo: string): string[] {
  const nomi = testo
    .toLowerCase()
    .replace(/\([^)]*\)/g, '') // colonne
    .split(',')
    .map((p) => p.trim().toUpperCase());
  return nomi.flatMap((p) => (p === 'ALL' || p === 'ALL PRIVILEGES' ? PRIVILEGI_TABELLA : [p]));
}

export function analizzaMigrazioni(files: readonly FileSql[]): Analisi {
  const stato = new Map<string, Map<string, Set<string>>>();

  const ordinati = [...files].sort((a, b) => a.nome.localeCompare(b.nome));
  for (const file of ordinati) {
    for (const grezza of pulisciSql(file.contenuto).split(';')) {
      const s = normalizza(grezza);
      let m: RegExpMatchArray | null;
      if ((m = s.match(/^create table (?:if not exists )?public\.(\w+)/i))) {
        if (!stato.has(m[1])) stato.set(m[1], new Map());
      } else if ((m = s.match(/^drop table (?:if exists )?(.+?)(?: cascade| restrict)?$/i))) {
        for (const t of m[1].split(',')) stato.delete(t.trim().replace(/^public\./, ''));
      } else if ((m = s.match(/^alter table (?:if exists )?(?:only )?public\.(\w+) rename to (\w+)$/i))) {
        const voce = stato.get(m[1]);
        if (voce) {
          stato.delete(m[1]);
          stato.set(m[2], voce);
        }
      } else if (
        (m = s.match(/^(grant|revoke) (.+?) on (?:table )?(public\.[\w.,. ]+?) (?:to|from) (.+?)(?: with grant option| cascade| restrict)?$/i))
      ) {
        const concede = m[1].toLowerCase() === 'grant';
        const privilegi = elencoPrivilegi(m[2]);
        const ruoli = m[4].split(',').map((r) => r.trim().toLowerCase());
        for (const nomeTabella of m[3].split(',')) {
          const voce = stato.get(nomeTabella.trim().replace(/^public\./, ''));
          if (!voce) continue; // tabella di altri schemi o non creata qui
          for (const ruolo of ruoli) {
            const set = voce.get(ruolo) ?? new Set<string>();
            voce.set(ruolo, set);
            for (const p of privilegi) {
              if (concede) set.add(p);
              else set.delete(p);
            }
          }
        }
      }
    }
  }

  const grant: GrantDb = [];
  for (const [tabella, ruoli] of stato) {
    for (const [grantee, privilegi] of ruoli) {
      for (const privilegio of privilegi) grant.push({ grantee, tabella, privilegio });
    }
  }
  return { grant, tabelle: [...stato.keys()].sort() };
}

/** Tabelle esistenti senza alcun GRANT a authenticated né service_role e non ammesse. */
export function tabelleSenzaGrant(
  analisi: Analisi,
  ammesse: Readonly<Record<string, string>> = TABELLE_SENZA_GRANT_AMMESSE,
): string[] {
  const conGrant = new Set(
    analisi.grant.filter((g) => g.grantee === 'authenticated' || g.grantee === 'service_role').map((g) => g.tabella),
  );
  return analisi.tabelle.filter((t) => !conGrant.has(t) && !(t in ammesse));
}

/** Messaggio se l'analisi non è affidabile (nessuna tabella o nessun grant letti); altrimenti null. */
export function guardiaAnalisi(analisi: Analisi): string | null {
  return analisi.tabelle.length === 0 || analisi.grant.length === 0
    ? 'Nessuna tabella o nessun GRANT letto dalle migration: parser rotto o cartella sbagliata, controllo non affidabile.'
    : null;
}

export function formattaTabelleSenzaGrant(tabelle: string[]): string {
  return [
    ...tabelle.map((t) => `Nessun GRANT esplicito nelle migration per public.${t}`),
    '',
    'Dal 30 ottobre 2026 Supabase non concede più privilegi di default alle tabelle nuove di `public`:',
    'ogni tabella nasce col suo GRANT (solo i privilegi necessari, per ruolo) nella stessa migration che',
    'crea la tabella e le sue policy RLS. Se la tabella è davvero accessibile solo da funzioni',
    'security definer, aggiungila a TABELLE_SENZA_GRANT_AMMESSE (lib/grantMigrazioni.ts) con la motivazione.',
  ].join('\n');
}

export function formattaGrantMancanti(righe: string[]): string {
  return [
    ...righe,
    '',
    'Il codice usa queste tabelle, ma nelle migration manca il GRANT esplicito: oggi funziona solo grazie ai',
    'privilegi di default di Supabase, che dal 30 ottobre 2026 non ci sono più. Aggiungi il GRANT (solo il',
    'privilegio e il ruolo necessari, mai quello generico) nella migration della tabella o in una nuova.',
  ].join('\n');
}
