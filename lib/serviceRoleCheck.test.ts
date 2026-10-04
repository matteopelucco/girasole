import { describe, expect, it } from 'vitest';
import {
  FILE_AMMESSI,
  formattaViolazioni,
  guardiaFile,
  normalizzaPercorso,
  trovaUsiNonAmmessi,
  usoAmmesso,
  type FileSorgente,
} from './serviceRoleCheck';

const f = (percorso: string, contenuto: string): FileSorgente => ({ percorso, contenuto });

describe('normalizzaPercorso', () => {
  it('converte i backslash di Windows e toglie il ./ iniziale', () => {
    expect(normalizzaPercorso('app\\admin\\maestre\\actions.ts')).toBe('app/admin/maestre/actions.ts');
    expect(normalizzaPercorso('./lib/a.ts')).toBe('lib/a.ts');
    expect(normalizzaPercorso('.\\lib\\a.ts')).toBe('lib/a.ts');
  });
});

describe('usoAmmesso / FILE_AMMESSI', () => {
  it('ammette la factory, il cron, la gestione utenti, gli script e i test', () => {
    for (const p of [
      'lib/supabase/admin.ts',
      'app/api/cron/allarmi/route.ts',
      'app/api/cron/report-presenze/route.ts',
      'lib/reportPresenze.ts',
      'app/admin/maestre/actions.ts',
      'scripts/crea-utenti-e2e.mjs',
      'e2e/auth.setup.ts',
      'lib/qualcosa.test.ts',
      'components/Foo.test.tsx',
    ]) {
      expect(usoAmmesso(p), p).toBe(true);
    }
  });

  it('non ammette server action, route utente e altre librerie', () => {
    for (const p of [
      'app/admin/ore-lavoro/pdf/route.ts',
      'app/presenze/actions.ts',
      'app/admin/maestre/altro.ts',
      'lib/pastiRojac.ts',
      'lib/supabase/server.ts',
      'components/Foo.tsx',
      'app/api/cronaca/route.ts',
    ]) {
      expect(usoAmmesso(p), p).toBe(false);
    }
  });

  it('riconosce i percorsi con backslash', () => {
    expect(usoAmmesso('app\\api\\cron\\allarmi\\route.ts')).toBe(true);
    expect(usoAmmesso('app\\presenze\\actions.ts')).toBe(false);
  });

  it('ogni voce della lista ha una motivazione', () => {
    expect(FILE_AMMESSI.length).toBeGreaterThan(0);
    for (const v of FILE_AMMESSI) expect(v.motivo.length, v.percorso).toBeGreaterThan(10);
  });
});

describe('trovaUsiNonAmmessi', () => {
  it('non segnala un uso in un file ammesso', () => {
    const src = "import { createAdminClient } from '@/lib/supabase/admin';\nconst a = createAdminClient();";
    expect(trovaUsiNonAmmessi([f('app/api/cron/allarmi/route.ts', src)])).toEqual([]);
  });

  it('segnala un uso in una server action, con file e riga', () => {
    const src = [
      "'use server';",
      "import { createAdminClient } from '@/lib/supabase/admin';",
      '',
      'export async function azione() {',
      '  const admin = createAdminClient();',
      '}',
    ].join('\n');
    const v = trovaUsiNonAmmessi([f('app/presenze/actions.ts', src)]);
    expect(v.map((x) => [x.file, x.riga, x.tipo])).toEqual([
      ['app/presenze/actions.ts', 2, 'factory'],
      ['app/presenze/actions.ts', 2, 'import-admin'],
      ['app/presenze/actions.ts', 5, 'factory'],
    ]);
  });

  it('segnala l\'import con alias diverso', () => {
    const src = "import { createAdminClient as creaClient } from '@/lib/supabase/admin';\ncreaClient();";
    const v = trovaUsiNonAmmessi([f('app/x/route.ts', src)]);
    expect(v.some((x) => x.tipo === 'factory' && x.riga === 1)).toBe(true);
  });

  it('segnala l\'import namespace e l\'import dinamico del modulo admin', () => {
    const ns = trovaUsiNonAmmessi([f('app/x/a.ts', "import * as adm from '@/lib/supabase/admin';\nadm['create' + 'AdminClient']();")]);
    expect(ns.map((x) => x.tipo)).toEqual(['import-admin']);
    const dyn = trovaUsiNonAmmessi([f('app/x/b.ts', "const m = await import('@/lib/supabase/admin');")]);
    expect(dyn.map((x) => x.tipo)).toEqual(['import-admin']);
    const req = trovaUsiNonAmmessi([f('app/x/c.js', 'const m = require("@/lib/supabase/admin");')]);
    expect(req.map((x) => x.tipo)).toEqual(['import-admin']);
  });

  it('risolve gli import relativi verso lib/supabase/admin', () => {
    expect(trovaUsiNonAmmessi([f('lib/foo.ts', "import { x } from './supabase/admin';")]).map((v) => v.tipo)).toEqual(['import-admin']);
    expect(trovaUsiNonAmmessi([f('app/a/b.ts', "import { x } from '../../lib/supabase/admin';")]).map((v) => v.tipo)).toEqual(['import-admin']);
    expect(trovaUsiNonAmmessi([f('app/a/b.ts', "import { x } from './admin';")])).toEqual([]);
  });

  it('non segnala commenti che citano createAdminClient', () => {
    const src = [
      '// non usa createAdminClient perché c\'è la RPC',
      '/* createAdminClient() era qui',
      '   e anche SUPABASE_SERVICE_ROLE_KEY */',
      'const ok = 1; // vedi lib/supabase/admin.ts: createAdminClient',
    ].join('\n');
    expect(trovaUsiNonAmmessi([f('app/x/actions.ts', src)])).toEqual([]);
  });

  it('non segnala stringhe che citano createAdminClient senza usarlo', () => {
    const src = [
      "const a = 'createAdminClient';",
      'const b = "usa createAdminClient()";',
      'const c = `createAdminClient ${1}`;',
      "const d = 'Manca SUPABASE_SERVICE_ROLE_KEY';",
    ].join('\n');
    expect(trovaUsiNonAmmessi([f('app/x/actions.ts', src)])).toEqual([]);
  });

  it('vede il codice dentro un\'espressione ${} di un template literal', () => {
    const v = trovaUsiNonAmmessi([f('app/x/a.ts', 'const s = `x ${createAdminClient()} y`;')]);
    expect(v.map((x) => x.tipo)).toEqual(['factory']);
  });

  it('un apice dentro un commento non apre una stringa', () => {
    const src = "// l'utente\nconst a = createAdminClient();";
    expect(trovaUsiNonAmmessi([f('app/x/a.ts', src)]).map((v) => v.riga)).toEqual([2]);
  });

  it('segnala SUPABASE_SERVICE_ROLE_KEY in un file non ammesso', () => {
    const src = 'const k = process.env.SUPABASE_SERVICE_ROLE_KEY;';
    const v = trovaUsiNonAmmessi([f('lib/altro.ts', src)]);
    expect(v.map((x) => [x.riga, x.tipo])).toEqual([[1, 'chiave']]);
  });

  it('segnala SUPABASE_SERVICE_ROLE_KEY letta con parentesi quadre', () => {
    const v = trovaUsiNonAmmessi([f('lib/altro.ts', "const k = process.env['SUPABASE_SERVICE_ROLE_KEY'];")]);
    expect(v.map((x) => x.tipo)).toEqual(['chiave']);
  });

  it('ammette SUPABASE_SERVICE_ROLE_KEY nella factory e negli script', () => {
    const src = 'process.env.SUPABASE_SERVICE_ROLE_KEY!';
    expect(trovaUsiNonAmmessi([f('lib/supabase/admin.ts', src), f('scripts/x.mjs', src)])).toEqual([]);
  });

  it('funziona con i percorsi Windows (backslash) e riporta il percorso normalizzato', () => {
    const v = trovaUsiNonAmmessi([
      f('app\\presenze\\actions.ts', 'createAdminClient();'),
      f('app\\api\\cron\\allarmi\\route.ts', 'createAdminClient();'),
    ]);
    expect(v.map((x) => x.file)).toEqual(['app/presenze/actions.ts']);
  });

  it('non confonde identificatori che contengono il nome', () => {
    const src = 'const createAdminClientMock = 1; const x = miocreateAdminClient;';
    expect(trovaUsiNonAmmessi([f('app/x/a.ts', src)])).toEqual([]);
  });

  it('conta bene le righe con CRLF e commenti multi-riga', () => {
    const src = '/* a\r\n b */\r\nconst a = createAdminClient();';
    expect(trovaUsiNonAmmessi([f('app/x/a.ts', src)]).map((v) => v.riga)).toEqual([3]);
  });
});

describe('formattaViolazioni', () => {
  it('indica file, riga, rimedio e dove ammettere un\'eccezione', () => {
    const msg = formattaViolazioni([
      { file: 'app/presenze/actions.ts', riga: 5, tipo: 'factory', testo: 'const a = createAdminClient();' },
    ]);
    expect(msg).toContain('app/presenze/actions.ts:5');
    expect(msg).toContain('createAdminClient');
    expect(msg).toContain('FILE_AMMESSI');
    expect(msg).toContain('lib/serviceRoleCheck.ts');
    expect(msg).toContain('ADR-0002');
  });
});

describe('guardiaFile', () => {
  it('segnala un elenco vuoto o privo della factory (scansione rotta)', () => {
    expect(guardiaFile([])).not.toBeNull();
    expect(guardiaFile([f('lib/a.ts', 'x')])).not.toBeNull();
  });

  it('passa quando la factory è tra i file letti', () => {
    expect(guardiaFile([f('lib\\supabase\\admin.ts', 'x')])).toBeNull();
  });
});
