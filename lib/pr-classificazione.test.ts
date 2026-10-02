import { describe, expect, it } from 'vitest';
import {
  classificaPR,
  eNonCodiceCI,
  eNonCodiceReview,
  eSoloBumpDiVersione,
  type FileCambiatoPR,
} from './pr-classificazione';

const packageJsonBase = JSON.stringify({ name: 'girasole', version: '0.42.14', dependencies: {} });
const packageJsonHeadBumpSolo = JSON.stringify({
  name: 'girasole',
  version: '0.42.15',
  dependencies: {},
});
const packageJsonHeadDipendenza = JSON.stringify({
  name: 'girasole',
  version: '0.42.15',
  dependencies: { next: '15.0.0' },
});

const packageLockBase = JSON.stringify({
  name: 'girasole',
  version: '0.42.14',
  packages: { '': { name: 'girasole', version: '0.42.14' } },
});
const packageLockHeadBumpSolo = JSON.stringify({
  name: 'girasole',
  version: '0.42.15',
  packages: { '': { name: 'girasole', version: '0.42.15' } },
});
const packageLockHeadDipendenza = JSON.stringify({
  name: 'girasole',
  version: '0.42.15',
  packages: {
    '': { name: 'girasole', version: '0.42.15' },
    'node_modules/nuova-dipendenza': { version: '1.0.0' },
  },
});

describe('eSoloBumpDiVersione', () => {
  it('riconosce un bump puro di package.json', () => {
    expect(eSoloBumpDiVersione(packageJsonBase, packageJsonHeadBumpSolo)).toBe(true);
  });

  it('riconosce un bump puro di package-lock.json (root + packages[""])', () => {
    expect(eSoloBumpDiVersione(packageLockBase, packageLockHeadBumpSolo)).toBe(true);
  });

  it('rifiuta un cambio di dipendenza travestito da bump in package.json', () => {
    expect(eSoloBumpDiVersione(packageJsonBase, packageJsonHeadDipendenza)).toBe(false);
  });

  it('rifiuta un cambio di dipendenza in package-lock.json', () => {
    expect(eSoloBumpDiVersione(packageLockBase, packageLockHeadDipendenza)).toBe(false);
  });

  it('rifiuta contenuti non JSON validi', () => {
    expect(eSoloBumpDiVersione('non è json', packageJsonHeadBumpSolo)).toBe(false);
  });

  it('rifiuta se manca il contenuto base o head', () => {
    expect(eSoloBumpDiVersione(undefined, packageJsonHeadBumpSolo)).toBe(false);
    expect(eSoloBumpDiVersione(packageJsonBase, undefined)).toBe(false);
  });
});

describe('eNonCodiceCI', () => {
  it('è false per una lista vuota (nel dubbio, codice)', () => {
    expect(eNonCodiceCI([])).toBe(false);
  });

  it('è true per soli file docs/specs/README/CHANGELOG', () => {
    const file: FileCambiatoPR[] = [
      { path: 'docs/programma-attivita.md' },
      { path: 'specs/50 - amministrazione_base.md' },
      { path: 'CHANGELOG.md' },
      { path: 'README.md' },
    ];
    expect(eNonCodiceCI(file)).toBe(true);
  });

  it('TASKS.md (abolito, #118) non è più un file "non codice"', () => {
    expect(eNonCodiceCI([{ path: 'TASKS.md' }])).toBe(false);
    expect(eNonCodiceReview([{ path: 'TASKS.md' }])).toBe(false);
  });

  it('è true per un bump puro di package.json + package-lock.json insieme a docs', () => {
    const file: FileCambiatoPR[] = [
      { path: 'CHANGELOG.md' },
      {
        path: 'package.json',
        contenutoBase: packageJsonBase,
        contenutoHead: packageJsonHeadBumpSolo,
      },
      {
        path: 'package-lock.json',
        contenutoBase: packageLockBase,
        contenutoHead: packageLockHeadBumpSolo,
      },
    ];
    expect(eNonCodiceCI(file)).toBe(true);
  });

  it('è false se package.json cambia anche una dipendenza', () => {
    const file: FileCambiatoPR[] = [
      {
        path: 'package.json',
        contenutoBase: packageJsonBase,
        contenutoHead: packageJsonHeadDipendenza,
      },
    ];
    expect(eNonCodiceCI(file)).toBe(false);
  });

  it('è true per CLAUDE.md (istruzioni, non codice: niente build/e2e)', () => {
    expect(eNonCodiceCI([{ path: 'CLAUDE.md' }])).toBe(true);
  });

  it('è false per un file con nome simile a CLAUDE.md (solo il file esatto)', () => {
    expect(eNonCodiceCI([{ path: 'lib/CLAUDE.md' }])).toBe(false);
    expect(eNonCodiceCI([{ path: 'CLAUDE.md.bak' }])).toBe(false);
  });

  it('è false per CLAUDE.md insieme a codice applicativo', () => {
    expect(eNonCodiceCI([{ path: 'CLAUDE.md' }, { path: 'lib/date.ts' }])).toBe(false);
  });

  it('è false per .claude/agents/reviewer.md', () => {
    expect(eNonCodiceCI([{ path: '.claude/agents/reviewer.md' }])).toBe(false);
  });

  it('è false per un mix docs + lib', () => {
    const file: FileCambiatoPR[] = [{ path: 'docs/foo.md' }, { path: 'lib/date.ts' }];
    expect(eNonCodiceCI(file)).toBe(false);
  });

  it('è true per una PR di soli specs/ (senza nuovi scenari)', () => {
    expect(eNonCodiceCI([{ path: 'specs/13 - segna-presenza.md' }])).toBe(true);
  });

  it('è false per e2e/** e supabase/**', () => {
    expect(eNonCodiceCI([{ path: 'e2e/13-segna-presenza.spec.ts' }])).toBe(false);
    expect(eNonCodiceCI([{ path: 'supabase/migrations/0099_foo.sql' }])).toBe(false);
  });
});

describe('eNonCodiceReview', () => {
  it('è false per una lista vuota', () => {
    expect(eNonCodiceReview([])).toBe(false);
  });

  it('è true per soli README/docs (senza specs)', () => {
    const file: FileCambiatoPR[] = [{ path: 'README.md' }, { path: 'docs/foo.md' }];
    expect(eNonCodiceReview(file)).toBe(true);
  });

  it('resta false quando la PR tocca CLAUDE.md, anche da solo (sempre review)', () => {
    expect(eNonCodiceReview([{ path: 'CLAUDE.md' }])).toBe(false);
  });

  it('resta false quando la PR tocca specs/, anche da sola (sempre review)', () => {
    expect(eNonCodiceReview([{ path: 'specs/13 - segna-presenza.md' }])).toBe(false);
  });

  it('è false per un mix specs + README', () => {
    const file: FileCambiatoPR[] = [
      { path: 'specs/13 - segna-presenza.md' },
      { path: 'README.md' },
    ];
    expect(eNonCodiceReview(file)).toBe(false);
  });
});

describe('classificaPR — nel dubbio è codice', () => {
  it('elenco file non disponibile (git diff fallito): codice sia per la CI sia per la review', () => {
    expect(classificaPR(null)).toEqual({ nonCodiceCI: false, nonCodiceReview: false });
  });

  it('elenco vuoto: codice', () => {
    expect(classificaPR([])).toEqual({ nonCodiceCI: false, nonCodiceReview: false });
  });

  it('solo docs: non codice per entrambe', () => {
    expect(classificaPR([{ path: 'docs/qualcosa.md' }])).toEqual({ nonCodiceCI: true, nonCodiceReview: true });
  });

  it('solo specs: non codice per la CI, codice per la review', () => {
    expect(classificaPR([{ path: 'specs/10 - presenze-e-pasti.md' }])).toEqual({
      nonCodiceCI: true,
      nonCodiceReview: false,
    });
  });

  it('solo CLAUDE.md: non codice per la CI, codice per la review', () => {
    expect(classificaPR([{ path: 'CLAUDE.md' }])).toEqual({
      nonCodiceCI: true,
      nonCodiceReview: false,
    });
  });

  it('codice applicativo: codice per entrambe', () => {
    expect(classificaPR([{ path: 'lib/giornata.ts' }])).toEqual({ nonCodiceCI: false, nonCodiceReview: false });
  });
});
