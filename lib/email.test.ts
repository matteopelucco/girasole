import { describe, expect, it } from 'vitest';
import { costruisciPayloadEmail, modalitaInvioEmail } from './email';

const base = { mittente: 'Girasole <girasole@example.org>', oggetto: 'Oggetto', html: '<p>Ciao</p>' };

// Specs/56 - comunicazione-retta-mensile.md, "invio email simulato nei test"
// e "l'invio simulato è ignorato in produzione": funzione pura sull'ambiente.
describe('modalitaInvioEmail', () => {
  it("senza EMAIL_DRY_RUN l'invio è vero e nessun avviso", () => {
    expect(modalitaInvioEmail({})).toEqual({ simulato: false, avviso: null });
    expect(modalitaInvioEmail({ VERCEL_ENV: 'preview' })).toEqual({ simulato: false, avviso: null });
  });

  it.each(['1', 'true', 'TRUE', 'yes', 'on', ' 1 '])('con EMAIL_DRY_RUN="%s" l\'invio è simulato', (valore) => {
    expect(modalitaInvioEmail({ EMAIL_DRY_RUN: valore })).toEqual({ simulato: true, avviso: null });
    expect(modalitaInvioEmail({ EMAIL_DRY_RUN: valore, VERCEL_ENV: 'preview' }).simulato).toBe(true);
  });

  it.each(['', '0', 'false', 'no', 'off', 'boh'])('con EMAIL_DRY_RUN="%s" l\'invio resta vero', (valore) => {
    expect(modalitaInvioEmail({ EMAIL_DRY_RUN: valore })).toEqual({ simulato: false, avviso: null });
  });

  it('in produzione (VERCEL_ENV=production) EMAIL_DRY_RUN è ignorata, con un avviso', () => {
    const modalita = modalitaInvioEmail({ EMAIL_DRY_RUN: '1', VERCEL_ENV: 'production' });
    expect(modalita.simulato).toBe(false);
    expect(modalita.avviso).toContain('EMAIL_DRY_RUN');
    expect(modalita.avviso).toContain('ignorata');
  });

  it("in produzione senza EMAIL_DRY_RUN attiva non c'è nessun avviso", () => {
    expect(modalitaInvioEmail({ VERCEL_ENV: 'production' })).toEqual({ simulato: false, avviso: null });
    expect(modalitaInvioEmail({ EMAIL_DRY_RUN: '0', VERCEL_ENV: 'production' })).toEqual({ simulato: false, avviso: null });
  });
});

// Specs/56 - comunicazione-retta-mensile.md, "una risposta dei genitori
// arriva all'asilo": funzione pura, nessun invio reale.
describe('costruisciPayloadEmail', () => {
  it('con rispondiA imposta reply_to e lascia invariati to e cc', () => {
    const payload = costruisciPayloadEmail({
      ...base,
      a: ['genitore1@example.com', 'genitore2@example.com'],
      cc: 'asilo@example.org',
      rispondiA: 'asilo@example.org',
    });
    expect(payload.reply_to).toBe('asilo@example.org');
    expect(payload.to).toEqual(['genitore1@example.com', 'genitore2@example.com']);
    expect(payload.cc).toEqual(['asilo@example.org']);
    expect(payload.from).toBe('Girasole <girasole@example.org>');
  });

  it('senza rispondiA (mail interne) non imposta reply_to', () => {
    const payload = costruisciPayloadEmail({ ...base, a: 'asilo@example.org' });
    expect(payload.reply_to).toBeUndefined();
    expect(JSON.parse(JSON.stringify(payload))).not.toHaveProperty('reply_to');
  });

  it('un solo destinatario stringa diventa un array in to; senza cc non c’è cc', () => {
    const payload = costruisciPayloadEmail({ ...base, a: 'genitore@example.com' });
    expect(payload.to).toEqual(['genitore@example.com']);
    expect(payload.cc).toBeUndefined();
  });

  it('gli allegati sono codificati in base64', () => {
    const payload = costruisciPayloadEmail({
      ...base,
      a: 'asilo@example.org',
      allegati: [{ filename: 'a.txt', content: new TextEncoder().encode('ciao') }],
    });
    expect(payload.attachments).toEqual([{ filename: 'a.txt', content: 'Y2lhbw==' }]);
  });
});
