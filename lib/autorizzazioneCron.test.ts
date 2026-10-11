import { describe, expect, it } from 'vitest';
import { decidiAutorizzazioneCron, richiedeSecretCron, type AmbienteCron } from './autorizzazioneCron';

const PRODUZIONE: AmbienteCron = { vercelEnv: 'production', vercel: '1' };
const ANTEPRIMA: AmbienteCron = { vercelEnv: 'preview', vercel: '1' };
const LOCALE: AmbienteCron = {};
const SECRET = 'un-secret-di-prova-lungo-abbastanza';

describe('richiedeSecretCron', () => {
  it('in produzione e nelle anteprime di Vercel il secret è obbligatorio', () => {
    expect(richiedeSecretCron(PRODUZIONE)).toBe(true);
    expect(richiedeSecretCron(ANTEPRIMA)).toBe(true);
  });

  it('in locale e nella CI (nessuna variabile di Vercel) non è obbligatorio', () => {
    expect(richiedeSecretCron(LOCALE)).toBe(false);
    expect(richiedeSecretCron({ vercelEnv: '', vercel: '' })).toBe(false);
  });

  it('con `vercel dev` (VERCEL_ENV=development) non è obbligatorio', () => {
    expect(richiedeSecretCron({ vercelEnv: 'development', vercel: '1' })).toBe(false);
  });

  it('un valore di VERCEL_ENV sconosciuto conta come ambiente protetto', () => {
    expect(richiedeSecretCron({ vercelEnv: 'staging' })).toBe(true);
  });

  it('su Vercel senza VERCEL_ENV (variabili di sistema non esposte) conta come ambiente protetto', () => {
    expect(richiedeSecretCron({ vercel: '1' })).toBe(true);
  });
});

describe('decidiAutorizzazioneCron', () => {
  describe('con CRON_SECRET configurato', () => {
    it.each([
      ['produzione', PRODUZIONE],
      ['anteprima', ANTEPRIMA],
      ['locale', LOCALE],
    ])('in %s accetta il secret giusto', (_nome, ambiente) => {
      expect(decidiAutorizzazioneCron({ secret: SECRET, authorization: `Bearer ${SECRET}`, ambiente })).toBe(true);
    });

    it.each([
      ['produzione', PRODUZIONE],
      ['anteprima', ANTEPRIMA],
      ['locale', LOCALE],
    ])('in %s rifiuta un secret sbagliato', (_nome, ambiente) => {
      expect(decidiAutorizzazioneCron({ secret: SECRET, authorization: 'Bearer secret-sbagliato', ambiente })).toBe(
        false
      );
    });

    it('rifiuta un secret che differisce solo per un carattere o per la lunghezza', () => {
      const ambiente = PRODUZIONE;
      expect(decidiAutorizzazioneCron({ secret: SECRET, authorization: `Bearer ${SECRET}x`, ambiente })).toBe(false);
      expect(decidiAutorizzazioneCron({ secret: SECRET, authorization: `Bearer ${SECRET.slice(0, -1)}`, ambiente })).toBe(
        false
      );
      expect(
        decidiAutorizzazioneCron({ secret: SECRET, authorization: `Bearer ${SECRET.slice(0, -1)}X`, ambiente })
      ).toBe(false);
    });

    it('rifiuta la richiesta senza header Authorization', () => {
      expect(decidiAutorizzazioneCron({ secret: SECRET, authorization: null, ambiente: PRODUZIONE })).toBe(false);
      expect(decidiAutorizzazioneCron({ secret: SECRET, authorization: undefined, ambiente: LOCALE })).toBe(false);
      expect(decidiAutorizzazioneCron({ secret: SECRET, authorization: '', ambiente: LOCALE })).toBe(false);
    });

    it('rifiuta un header malformato', () => {
      const ambiente = PRODUZIONE;
      expect(decidiAutorizzazioneCron({ secret: SECRET, authorization: SECRET, ambiente })).toBe(false);
      expect(decidiAutorizzazioneCron({ secret: SECRET, authorization: `bearer ${SECRET}`, ambiente })).toBe(false);
      expect(decidiAutorizzazioneCron({ secret: SECRET, authorization: `Basic ${SECRET}`, ambiente })).toBe(false);
      expect(decidiAutorizzazioneCron({ secret: SECRET, authorization: `Bearer  ${SECRET}`, ambiente })).toBe(false);
      expect(decidiAutorizzazioneCron({ secret: SECRET, authorization: 'Bearer ', ambiente })).toBe(false);
    });
  });

  describe('senza CRON_SECRET', () => {
    it.each([
      ['assente', undefined],
      ['vuoto', ''],
      ['di soli spazi', '   '],
    ])('in produzione rifiuta tutto se il secret è %s', (_nome, secret) => {
      for (const authorization of [null, '', 'Bearer ', 'Bearer qualunque', `Bearer ${secret ?? ''}`]) {
        expect(decidiAutorizzazioneCron({ secret, authorization, ambiente: PRODUZIONE })).toBe(false);
      }
    });

    it('nelle anteprime di Vercel rifiuta tutto', () => {
      expect(decidiAutorizzazioneCron({ secret: undefined, authorization: null, ambiente: ANTEPRIMA })).toBe(false);
      expect(decidiAutorizzazioneCron({ secret: undefined, authorization: 'Bearer x', ambiente: ANTEPRIMA })).toBe(false);
    });

    it('in locale e nella CI resta aperta, come prima', () => {
      expect(decidiAutorizzazioneCron({ secret: undefined, authorization: null, ambiente: LOCALE })).toBe(true);
      expect(decidiAutorizzazioneCron({ secret: '', authorization: 'Bearer x', ambiente: LOCALE })).toBe(true);
    });
  });
});
