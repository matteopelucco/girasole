import { describe, expect, it } from 'vitest';
import {
  MOTIVO_NON_ESEGUITO,
  MOTIVO_NON_INDICATO,
  conteggioPerMotivo,
  estraiTestSaltati,
  riepilogoSaltatiMarkdown,
} from './playwright-skip-riepilogo';

function test(
  stato: string,
  annotations: { type: string; description?: string }[] = [],
  projectName = 'chromium'
) {
  return { projectName, annotations, status: stato, results: [{ status: stato }] };
}

const reportEsempio = {
  suites: [
    {
      title: '01-ux.spec.ts',
      file: '01-ux.spec.ts',
      specs: [
        {
          title: 'test radice saltato',
          file: '01-ux.spec.ts',
          tests: [test('skipped', [{ type: 'skip', description: 'richiede E2E_ADMIN_EMAIL/PASSWORD' }])],
        },
        { title: 'test passato', file: '01-ux.spec.ts', tests: [test('expected')] },
      ],
      suites: [
        {
          title: 'Scenario: navigazione',
          file: '01-ux.spec.ts',
          specs: [
            {
              title: 'maestra vede la lista',
              file: '01-ux.spec.ts',
              tests: [
                test('skipped', [{ type: 'skip', description: 'richiede E2E_MAESTRA_EMAIL/PASSWORD' }]),
              ],
            },
          ],
          suites: [
            {
              title: 'annidata',
              file: '01-ux.spec.ts',
              specs: [
                {
                  title: 'altro',
                  file: '01-ux.spec.ts',
                  tests: [
                    test('skipped', [{ type: 'skip', description: 'richiede E2E_MAESTRA_EMAIL/PASSWORD' }]),
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      title: '19-monte-ore.spec.ts',
      file: '19-monte-ore.spec.ts',
      specs: [
        { title: 'senza motivo', file: '19-monte-ore.spec.ts', tests: [test('skipped', [{ type: 'skip' }])] },
        {
          title: 'mai partito',
          file: '19-monte-ore.spec.ts',
          tests: [test('skipped')],
        },
      ],
    },
  ],
};

describe('estraiTestSaltati', () => {
  it('raccoglie i test saltati attraverso suite annidate, con file, titolo completo e motivo', () => {
    const saltati = estraiTestSaltati(reportEsempio);
    expect(saltati).toHaveLength(5);
    expect(saltati[0]).toEqual({
      file: '01-ux.spec.ts',
      titolo: 'test radice saltato',
      motivo: 'richiede E2E_ADMIN_EMAIL/PASSWORD',
      progetto: 'chromium',
    });
    expect(saltati[1].titolo).toBe('Scenario: navigazione > maestra vede la lista');
    expect(saltati[2].titolo).toBe('Scenario: navigazione > annidata > altro');
  });

  it('ignora i test non saltati', () => {
    const saltati = estraiTestSaltati(reportEsempio);
    expect(saltati.map((s) => s.titolo)).not.toContain('test passato');
  });

  it("usa un motivo esplicito quando l'annotazione skip non ha descrizione", () => {
    const saltati = estraiTestSaltati(reportEsempio);
    expect(saltati.find((s) => s.titolo === 'senza motivo')?.motivo).toBe(MOTIVO_NON_INDICATO);
  });

  it('distingue i test mai eseguiti (nessuna annotazione) da quelli saltati con un motivo', () => {
    const saltati = estraiTestSaltati(reportEsempio);
    expect(saltati.find((s) => s.titolo === 'mai partito')?.motivo).toBe(MOTIVO_NON_ESEGUITO);
  });

  it('considera anche fixme come motivo di salto', () => {
    const report = {
      suites: [
        {
          title: 'a.spec.ts',
          specs: [
            {
              title: 't',
              file: 'a.spec.ts',
              tests: [test('skipped', [{ type: 'fixme', description: 'da sistemare' }])],
            },
          ],
        },
      ],
    };
    expect(estraiTestSaltati(report)[0].motivo).toBe('da sistemare');
  });

  it('preferisce lo stato dell’ultimo risultato quando il test non è saltato nei retry', () => {
    const report = {
      suites: [
        {
          title: 'a.spec.ts',
          specs: [
            {
              title: 't',
              file: 'a.spec.ts',
              tests: [{ status: 'flaky', annotations: [], results: [{ status: 'failed' }, { status: 'passed' }] }],
            },
          ],
        },
      ],
    };
    expect(estraiTestSaltati(report)).toEqual([]);
  });

  it.each([undefined, null, 42, 'testo', [], {}, { suites: 'no' }, { suites: [null, 3, {}] }])(
    'non lancia con un report vuoto o malformato (%j)',
    (input) => {
      expect(() => estraiTestSaltati(input)).not.toThrow();
      expect(estraiTestSaltati(input)).toEqual([]);
    }
  );

  it('ignora specs e tests malformati senza perdere quelli validi', () => {
    const report = {
      suites: [
        {
          title: 'a.spec.ts',
          specs: [
            null,
            { title: 'senza tests' },
            { title: 'tests rotti', tests: [null, 7, { status: 'skipped', annotations: 'no' }] },
          ],
        },
      ],
    };
    const saltati = estraiTestSaltati(report);
    expect(saltati).toHaveLength(1);
    expect(saltati[0].motivo).toBe(MOTIVO_NON_ESEGUITO);
  });
});

describe('conteggioPerMotivo', () => {
  it('conta per motivo ordinando dal più frequente, a parità in ordine alfabetico', () => {
    const conteggi = conteggioPerMotivo(estraiTestSaltati(reportEsempio));
    expect(conteggi[0]).toEqual({ motivo: 'richiede E2E_MAESTRA_EMAIL/PASSWORD', conteggio: 2 });
    expect(conteggi.map((c) => c.conteggio)).toEqual([2, 1, 1, 1]);
    expect(conteggi.slice(1).map((c) => c.motivo)).toEqual(
      [...conteggi.slice(1).map((c) => c.motivo)].sort((a, b) => a.localeCompare(b))
    );
  });

  it('restituisce una lista vuota senza saltati', () => {
    expect(conteggioPerMotivo([])).toEqual([]);
  });
});

describe('riepilogoSaltatiMarkdown', () => {
  it('elenca totale, conteggio per motivo e dettaglio file/titolo/motivo', () => {
    const md = riepilogoSaltatiMarkdown(reportEsempio);
    expect(md).toContain('## Test e2e saltati');
    expect(md).toContain('5');
    expect(md).toContain('richiede E2E_MAESTRA_EMAIL/PASSWORD');
    expect(md).toContain('01-ux.spec.ts');
    expect(md).toContain('Scenario: navigazione > maestra vede la lista');
  });

  it('segnala che nessun test è stato saltato', () => {
    const md = riepilogoSaltatiMarkdown({ suites: [] });
    expect(md).toContain('Nessun test saltato');
  });

  it('segnala un report non leggibile senza lanciare', () => {
    expect(() => riepilogoSaltatiMarkdown(undefined)).not.toThrow();
    expect(riepilogoSaltatiMarkdown(undefined)).toContain('Report JSON di Playwright non disponibile');
  });

  it('neutralizza i caratteri che romperebbero la tabella Markdown', () => {
    const report = {
      suites: [
        {
          title: 'a.spec.ts',
          specs: [
            {
              title: 'a | b\nc',
              file: 'a.spec.ts',
              tests: [test('skipped', [{ type: 'skip', description: 'x | y' }])],
            },
          ],
        },
      ],
    };
    const md = riepilogoSaltatiMarkdown(report);
    expect(md).toContain('a \\| b c');
    expect(md).toContain('x \\| y');
  });
});
