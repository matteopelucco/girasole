// Versione e build mostrate in fondo alle pagine (vedi app/layout.tsx).
// Fonte unica: VERSIONE_APP arriva da `package.json` (letto in
// next.config.mjs, iniettato in process.env — nessun bump manuale qui).
// DATA_BUILD combina lo SHA del commit (VERCEL_GIT_COMMIT_SHA su Vercel,
// `git rev-parse HEAD` in locale, vedi next.config.mjs) con il timestamp
// di build, entrambi calcolati una sola volta al caricamento di
// next.config.mjs — non ad ogni richiesta. Nessuno di questi due valori
// va più aggiornato a mano: il bump prima del push resta necessario solo
// per `package.json`/`package-lock.json` (vedi CLAUDE.md, sezione
// Versioning).

// Uno SHA di commit reale (7-40 caratteri esadecimali) viene abbreviato
// alle prime 7 cifre, come da convenzione comune (`git rev-parse --short`).
// Un placeholder di sviluppo locale (es. "sviluppo-locale") non è esadecimale
// e resta invariato: troncarlo alla cieca lo renderebbe illeggibile.
function abbreviaSha(shaCommit: string): string {
  return /^[0-9a-f]{7,40}$/i.test(shaCommit) ? shaCommit.slice(0, 7) : shaCommit;
}

// Pura (nessun I/O): prende SHA e timestamp già calcolati a build-time e
// produce la stringa mostrata nel footer accanto a "build". Timestamp in
// formato ISO 8601 (es. "2026-09-23T18:06:19.000Z"), convertito nel fuso
// Europe/Rome — coerente con lib/date.ts — e reso come "YYYY-MM-DD
// HH:mm:ss" (locale 'sv-SE': unico modo, senza formattazione manuale, di
// ottenere quell'ordine da Intl.DateTimeFormat).
export function formattaDataBuild(shaCommit: string, timestampBuildIso: string): string {
  const dataFormattata = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(timestampBuildIso));
  return `${dataFormattata} (${abbreviaSha(shaCommit)})`;
}

// Fallback usati solo se next.config.mjs non ha valorizzato process.env
// (non dovrebbe succedere in dev/build normali, ma tsc/vitest possono
// caricare questo modulo senza passare dalla build di Next.js).
export const VERSIONE_APP = process.env.GIRASOLE_VERSIONE_APP ?? '0.0.0-dev';

const shaCommitBuild = process.env.GIRASOLE_BUILD_SHA ?? 'sviluppo-locale';
const timestampBuild = process.env.GIRASOLE_BUILD_TIMESTAMP ?? new Date().toISOString();

export const DATA_BUILD = formattaDataBuild(shaCommitBuild, timestampBuild);
