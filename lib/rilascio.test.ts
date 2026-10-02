import { describe, expect, it } from 'vitest';
import {
  decidiTag,
  generaNoteRilascio,
  leggiVersione,
  parseCommitConvenzionale,
} from './rilascio';

describe('leggiVersione', () => {
  it('legge la versione semver da un package.json', () => {
    expect(leggiVersione(JSON.stringify({ name: 'x', version: '0.49.25' }))).toBe('0.49.25');
  });

  it('accetta una pre-release', () => {
    expect(leggiVersione(JSON.stringify({ version: '1.0.0-rc.1' }))).toBe('1.0.0-rc.1');
  });

  it.each([
    ['JSON non valido', '{non json'],
    ['version assente', JSON.stringify({ name: 'x' })],
    ['version non stringa', JSON.stringify({ version: 12 })],
    ['version non semver', JSON.stringify({ version: 'latest' })],
    ['radice non oggetto', JSON.stringify([1, 2])],
  ])('restituisce null con %s', (_nome, contenuto) => {
    expect(leggiVersione(contenuto)).toBeNull();
  });

  it('restituisce null con contenuto mancante', () => {
    expect(leggiVersione(undefined)).toBeNull();
  });
});

describe('decidiTag', () => {
  it('crea il tag quando la versione cambia', () => {
    expect(decidiTag('0.49.24', '0.49.25', false)).toBe('v0.49.25');
  });

  it('non crea il tag quando la versione e invariata', () => {
    expect(decidiTag('0.49.25', '0.49.25', false)).toBeNull();
  });

  it('crea il tag con versione precedente illeggibile (nel dubbio rilascia, il workflow e idempotente)', () => {
    expect(decidiTag(null, '0.49.25', false)).toBe('v0.49.25');
  });

  it('non crea il tag se la versione corrente e illeggibile, nemmeno con forza', () => {
    expect(decidiTag('0.49.24', null, false)).toBeNull();
    expect(decidiTag('0.49.24', null, true)).toBeNull();
  });

  it('con forza crea il tag anche a versione invariata (recupero manuale)', () => {
    expect(decidiTag('0.49.25', '0.49.25', true)).toBe('v0.49.25');
  });
});

describe('parseCommitConvenzionale', () => {
  it('estrae tipo e descrizione', () => {
    expect(parseCommitConvenzionale('fix: wrap long cell text in PDF tables')).toEqual({
      tipo: 'fix',
      ambito: null,
      breaking: false,
      descrizione: 'wrap long cell text in PDF tables',
    });
  });

  it('estrae l ambito', () => {
    expect(parseCommitConvenzionale('fix(presenze): block absence after Rojac')).toMatchObject({
      tipo: 'fix',
      ambito: 'presenze',
      breaking: false,
    });
  });

  it('riconosce il breaking change con !', () => {
    expect(parseCommitConvenzionale('feat(db)!: drop legacy column')).toMatchObject({
      tipo: 'feat',
      ambito: 'db',
      breaking: true,
    });
    expect(parseCommitConvenzionale('refactor!: rename API')).toMatchObject({ breaking: true });
  });

  it('mantiene il suffisso della PR nella descrizione', () => {
    expect(parseCommitConvenzionale('fix(ci): wait for hydration (#168)')).toMatchObject({
      descrizione: 'wait for hydration (#168)',
    });
  });

  it('accetta il tipo in maiuscolo normalizzandolo', () => {
    expect(parseCommitConvenzionale('Feat: something')).toMatchObject({ tipo: 'feat' });
  });

  it.each([
    'Merge pull request #1 from x/y',
    'update stuff',
    'unknown: not a known type',
    'feat:',
    'feat: ',
    '',
  ])('restituisce null per %j', (subject) => {
    expect(parseCommitConvenzionale(subject)).toBeNull();
  });
});

describe('generaNoteRilascio', () => {
  it('raggruppa per tipo nell ordine fisso e include l ambito', () => {
    const note = generaNoteRilascio([
      'docs: explain release flow',
      'fix(presenze): block absence (#10)',
      'feat: add monthly PDF (#11)',
      'feat(admin): reopen week (#12)',
    ]);
    expect(note).toBe(
      [
        '### Nuove funzionalità',
        '- add monthly PDF (#11)',
        '- **admin**: reopen week (#12)',
        '',
        '### Correzioni',
        '- **presenze**: block absence (#10)',
        '',
        '### Documentazione',
        '- explain release flow',
        '',
      ].join('\n')
    );
  });

  it('mette i breaking change in cima, anche se il tipo e un altro', () => {
    const note = generaNoteRilascio(['fix: small', 'feat(db)!: drop column']);
    expect(note.startsWith('### Breaking changes\n- **db**: drop column\n')).toBe(true);
    expect(note).toContain('### Correzioni\n- small');
    // il breaking non e duplicato nella sezione del suo tipo
    expect(note).not.toContain('### Nuove funzionalità');
  });

  it('manda i messaggi non convenzionali in Altro, tali e quali', () => {
    const note = generaNoteRilascio(['feat: a', 'random message']);
    expect(note).toContain('### Altro\n- random message');
  });

  it('ignora righe vuote e commit di merge', () => {
    const note = generaNoteRilascio(['', 'Merge branch main into x', 'fix: a']);
    expect(note).toBe(['### Correzioni', '- a', ''].join('\n'));
  });

  it('con nessun commit restituisce un messaggio di default', () => {
    expect(generaNoteRilascio([])).toBe('Nessuna modifica rilevante.\n');
  });
});
