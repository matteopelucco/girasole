import { describe, expect, it } from 'vitest';
import {
  valutaAmbienteAnteprima,
  valutaDeploymentAnteprima,
  valutaRepoPrAnteprima,
  valutaUrlAnteprima,
} from './guardiaAnteprima';

const REPO = 'proprietario/girasole';
const URL_OK = 'https://girasole-abc123xyz-squadra.vercel.app';

describe('valutaUrlAnteprima', () => {
  it('accetta l\'indirizzo di una anteprima e restituisce solo l\'origine', () => {
    expect(valutaUrlAnteprima(URL_OK)).toEqual({ ok: true, url: URL_OK });
    expect(valutaUrlAnteprima(`${URL_OK}/login?x=1`)).toEqual({ ok: true, url: URL_OK });
  });

  it('accetta l\'indirizzo di ramo di una anteprima', () => {
    const url = 'https://girasole-git-feat-issue-1-squadra.vercel.app';
    expect(valutaUrlAnteprima(url)).toEqual({ ok: true, url });
  });

  it('rifiuta la produzione', () => {
    const esito = valutaUrlAnteprima('https://girasole.vercel.app');
    expect(esito.ok).toBe(false);
    if (!esito.ok) expect(esito.motivo).toMatch(/produzione/i);
  });

  it('rifiuta l\'indirizzo di ramo del ramo di produzione (main)', () => {
    expect(valutaUrlAnteprima('https://girasole-git-main-squadra.vercel.app').ok).toBe(false);
  });

  it('rifiuta un indirizzo vuoto o non valido', () => {
    expect(valutaUrlAnteprima(undefined).ok).toBe(false);
    expect(valutaUrlAnteprima(null).ok).toBe(false);
    expect(valutaUrlAnteprima('').ok).toBe(false);
    expect(valutaUrlAnteprima('non un url').ok).toBe(false);
  });

  it('rifiuta localhost e ogni dominio non Vercel', () => {
    expect(valutaUrlAnteprima('http://localhost:3000').ok).toBe(false);
    expect(valutaUrlAnteprima('https://asilo-sartorio.example.com').ok).toBe(false);
    expect(valutaUrlAnteprima('https://girasole-abc.example.com').ok).toBe(false);
  });

  it('rifiuta un altro progetto Vercel', () => {
    expect(valutaUrlAnteprima('https://altroprogetto-abc-squadra.vercel.app').ok).toBe(false);
    expect(valutaUrlAnteprima('https://xgirasole-abc-squadra.vercel.app').ok).toBe(false);
  });

  it('rifiuta http (non cifrato)', () => {
    expect(valutaUrlAnteprima('http://girasole-abc-squadra.vercel.app').ok).toBe(false);
  });

  it('rifiuta trucchi con credenziali, porte e domini annidati', () => {
    expect(valutaUrlAnteprima('https://girasole.vercel.app@girasole-abc-squadra.vercel.app').ok).toBe(false);
    expect(valutaUrlAnteprima('https://girasole-abc-squadra.vercel.app:8443').ok).toBe(false);
    expect(valutaUrlAnteprima('https://girasole-abc-squadra.vercel.app.evil.com').ok).toBe(false);
    expect(valutaUrlAnteprima('https://evil.com/girasole-abc-squadra.vercel.app').ok).toBe(false);
  });

  it('non fa differenza tra maiuscole e minuscole nel dominio', () => {
    expect(valutaUrlAnteprima('https://GIRASOLE.vercel.app').ok).toBe(false);
    expect(valutaUrlAnteprima('https://Girasole-Abc-Squadra.vercel.app')).toEqual({
      ok: true,
      url: 'https://girasole-abc-squadra.vercel.app',
    });
  });
});

describe('valutaAmbienteAnteprima', () => {
  it('accetta Preview, anche con il nome del progetto', () => {
    expect(valutaAmbienteAnteprima('Preview').ok).toBe(true);
    expect(valutaAmbienteAnteprima('preview').ok).toBe(true);
    expect(valutaAmbienteAnteprima('Preview – girasole').ok).toBe(true);
    expect(valutaAmbienteAnteprima('Preview - girasole').ok).toBe(true);
  });

  it('rifiuta produzione e valori vuoti o simili', () => {
    expect(valutaAmbienteAnteprima('Production').ok).toBe(false);
    expect(valutaAmbienteAnteprima('Production – girasole').ok).toBe(false);
    expect(valutaAmbienteAnteprima('').ok).toBe(false);
    expect(valutaAmbienteAnteprima(undefined).ok).toBe(false);
    expect(valutaAmbienteAnteprima('Previewer').ok).toBe(false);
    expect(valutaAmbienteAnteprima('staging').ok).toBe(false);
  });
});

describe('valutaRepoPrAnteprima', () => {
  it('accetta quando tutte le PR del commit vengono dallo stesso repo', () => {
    expect(valutaRepoPrAnteprima(REPO, [REPO]).ok).toBe(true);
    expect(valutaRepoPrAnteprima(REPO, [REPO, REPO]).ok).toBe(true);
    expect(valutaRepoPrAnteprima(REPO, ['Proprietario/Girasole']).ok).toBe(true);
  });

  it('rifiuta un fork', () => {
    const esito = valutaRepoPrAnteprima(REPO, ['qualcuno/girasole']);
    expect(esito.ok).toBe(false);
    if (!esito.ok) expect(esito.motivo).toMatch(/fork|altro repository/i);
  });

  it('rifiuta se anche una sola PR viene da fuori', () => {
    expect(valutaRepoPrAnteprima(REPO, [REPO, 'qualcuno/girasole']).ok).toBe(false);
  });

  it('rifiuta se non si trova nessuna PR o il repo di origine è sconosciuto', () => {
    expect(valutaRepoPrAnteprima(REPO, []).ok).toBe(false);
    expect(valutaRepoPrAnteprima(REPO, ['']).ok).toBe(false);
    expect(valutaRepoPrAnteprima('', [REPO]).ok).toBe(false);
  });
});

describe('valutaDeploymentAnteprima', () => {
  const base = {
    repository: REPO,
    stato: 'success',
    ambiente: 'Preview',
    urlAnteprima: URL_OK,
    repoTestaPr: [REPO],
  };

  it('accetta una anteprima riuscita di una PR dello stesso repo', () => {
    expect(valutaDeploymentAnteprima(base)).toEqual({ ok: true, url: URL_OK });
  });

  it('rifiuta se il deploy non è riuscito', () => {
    expect(valutaDeploymentAnteprima({ ...base, stato: 'failure' }).ok).toBe(false);
    expect(valutaDeploymentAnteprima({ ...base, stato: 'pending' }).ok).toBe(false);
  });

  it('rifiuta se l\'ambiente non è Preview, anche con un indirizzo di anteprima', () => {
    expect(valutaDeploymentAnteprima({ ...base, ambiente: 'Production' }).ok).toBe(false);
  });

  it('rifiuta la produzione, anche se l\'ambiente dice Preview', () => {
    expect(valutaDeploymentAnteprima({ ...base, urlAnteprima: 'https://girasole.vercel.app' }).ok).toBe(false);
  });

  it('rifiuta un fork', () => {
    expect(valutaDeploymentAnteprima({ ...base, repoTestaPr: ['altri/girasole'] }).ok).toBe(false);
  });

  it('spiega sempre il motivo del rifiuto', () => {
    const esito = valutaDeploymentAnteprima({ ...base, ambiente: 'Production' });
    expect(esito.ok).toBe(false);
    if (!esito.ok) expect(esito.motivo.length).toBeGreaterThan(10);
  });
});
