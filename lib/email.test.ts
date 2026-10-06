import { describe, expect, it } from 'vitest';
import { costruisciPayloadEmail } from './email';

const base = { mittente: 'Girasole <girasole@example.org>', oggetto: 'Oggetto', html: '<p>Ciao</p>' };

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
