import { describe, expect, it } from 'vitest';
import { vociMenu, vociMenuConStato } from './navigazione';

describe('vociMenu', () => {
  it('include solo "Dashboard" per maestra, assistente, genitore e ruolo assente', () => {
    for (const ruolo of ['maestra', 'assistente', 'genitore', null, undefined]) {
      const voci = vociMenu(ruolo);
      expect(voci).toEqual([{ href: '/dashboard', etichetta: 'Dashboard', icona: '🏠' }]);
    }
  });

  it('include le voci di amministrazione per admin, nell\'ordine storico della barra orizzontale', () => {
    const voci = vociMenu('admin');
    expect(voci.map((v) => v.href)).toEqual([
      '/dashboard',
      '/admin',
      '/admin/maestre',
      '/admin/calendario',
      '/admin/profili-orari',
    ]);
  });
});

describe('vociMenuConStato', () => {
  it('evidenzia "Dashboard" su /dashboard e sulle sue sotto-pagine', () => {
    for (const pathname of ['/dashboard', '/dashboard/presenze', '/dashboard/report/anagrafica']) {
      const attive = vociMenuConStato('maestra', pathname).filter((v) => v.attivo);
      expect(attive.map((v) => v.href)).toEqual(['/dashboard']);
    }
  });

  it('evidenzia la voce admin più specifica invece del generico /admin', () => {
    const attive = vociMenuConStato('admin', '/admin/maestre/qualcosa').filter((v) => v.attivo);
    expect(attive.map((v) => v.href)).toEqual(['/admin/maestre']);
  });

  it('evidenzia "Sezioni e bambini" per /admin e le sue sotto-pagine non specifiche', () => {
    for (const pathname of ['/admin', '/admin/bambini/123']) {
      const attive = vociMenuConStato('admin', pathname).filter((v) => v.attivo);
      expect(attive.map((v) => v.href)).toEqual(['/admin']);
    }
  });

  it('non evidenzia nulla su un pathname che non corrisponde a nessuna voce', () => {
    const attive = vociMenuConStato('maestra', '/login').filter((v) => v.attivo);
    expect(attive).toEqual([]);
  });
});
