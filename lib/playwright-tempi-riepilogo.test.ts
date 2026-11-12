import { describe, expect, it } from 'vitest';
import { calcolaTempi, riepilogoTempiMarkdown } from './playwright-tempi-riepilogo';

function spec(file: string, progetto: string, durate: number[]) {
  return {
    title: `test di ${file}`,
    file,
    tests: [{ projectName: progetto, results: durate.map((duration) => ({ duration, status: 'passed' })) }],
  };
}

const report = {
  stats: { duration: 600_000 },
  suites: [
    {
      title: 'a.spec.ts',
      file: 'a.spec.ts',
      specs: [spec('a.spec.ts', 'chromium', [60_000])],
      suites: [{ title: 'gruppo', specs: [spec('a.spec.ts', 'chromium', [30_000, 30_000])] }],
    },
    { title: 'b.spec.ts', file: 'b.spec.ts', specs: [spec('b.spec.ts', 'chromium-rette', [180_000])] },
  ],
};

describe('calcolaTempi', () => {
  it('somma le durate per progetto e per file, compresi i tentativi ripetuti e i describe annidati', () => {
    const tempi = calcolaTempi(report);
    expect(tempi?.durataTotaleMs).toBe(600_000);
    expect(tempi?.progetti).toEqual([
      { nome: 'chromium-rette', test: 1, durataMs: 180_000 },
      { nome: 'chromium', test: 2, durataMs: 120_000 },
    ]);
    expect(tempi?.file).toEqual([
      { nome: 'b.spec.ts', progetto: 'chromium-rette', test: 1, durataMs: 180_000 },
      { nome: 'a.spec.ts', progetto: 'chromium', test: 2, durataMs: 120_000 },
    ]);
  });

  it('un test senza risultati conta come test con durata zero', () => {
    const tempi = calcolaTempi({
      suites: [{ title: 'c.spec.ts', file: 'c.spec.ts', specs: [{ file: 'c.spec.ts', tests: [{ projectName: 'chromium', results: [] }] }] }],
    });
    expect(tempi?.progetti).toEqual([{ nome: 'chromium', test: 1, durataMs: 0 }]);
  });

  it('un report assente o di forma inattesa non fa lanciare eccezioni', () => {
    expect(calcolaTempi(undefined)).toBeNull();
    expect(calcolaTempi('testo')).toBeNull();
    expect(calcolaTempi({ suites: 'no' })).toBeNull();
    expect(calcolaTempi({ suites: [] })).toBeNull();
  });
});

describe('riepilogoTempiMarkdown', () => {
  it('mostra durata totale, tabella per progetto e file più lenti, in minuti', () => {
    const md = riepilogoTempiMarkdown(report);
    expect(md).toContain('Durata totale: 10,0 min');
    expect(md).toContain('| chromium-rette | 1 | 3,0 min |');
    expect(md).toContain('| b.spec.ts | chromium-rette | 1 | 3,0 min |');
  });

  it('i file più lenti sono al massimo 15', () => {
    const suites = Array.from({ length: 20 }, (_, i) => ({
      title: `f${i}.spec.ts`,
      file: `f${i}.spec.ts`,
      specs: [spec(`f${i}.spec.ts`, 'chromium', [1000 + i])],
    }));
    const md = riepilogoTempiMarkdown({ suites });
    expect(md.match(/^\| f\d+\.spec\.ts /gm)).toHaveLength(15);
    expect(md).toContain('| f19.spec.ts ');
    expect(md).not.toContain('| f0.spec.ts ');
  });

  it('senza report dice che i tempi non sono disponibili', () => {
    expect(riepilogoTempiMarkdown(undefined)).toContain('non disponibili');
  });
});
