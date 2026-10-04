import { describe, expect, it } from 'vitest';
import { eGruppo, eGruppoConStato, vociLink, vociMenu, vociMenuConStato } from './navigazione';

describe('vociMenu', () => {
  it('include solo "Dashboard" per maestra, assistente, genitore e ruolo assente', () => {
    for (const ruolo of ['maestra', 'assistente', 'genitore', null, undefined]) {
      const voci = vociMenu(ruolo);
      expect(voci).toEqual([{ href: '/dashboard', etichetta: 'Dashboard', icona: '🏠' }]);
    }
  });

  it('include le voci di amministrazione per admin, nell\'ordine storico della barra orizzontale', () => {
    const voci = vociMenu('admin');
    expect(vociLink(voci).map((v) => v.href)).toEqual([
      '/dashboard',
      '/admin',
      '/admin/maestre',
      '/admin/calendario',
      '/admin/profili-orari',
      '/admin/ore-lavoro',
      '/admin/rette',
      '/admin/pagamenti-bambino',
      '/admin/impostazioni-avanzate',
    ]);
  });

  it('raggruppa "Rette" e "Pagamenti bambino" sotto "Pagamenti", che non è una pagina (specs/60)', () => {
    const voci = vociMenu('admin');
    const gruppo = voci.find((v) => v.etichetta === 'Pagamenti');
    expect(gruppo && eGruppo(gruppo)).toBe(true);
    expect(gruppo && eGruppo(gruppo) && gruppo.figli.map((f) => [f.etichetta, f.href])).toEqual([
      ['Rette', '/admin/rette'],
      ['Pagamenti bambino', '/admin/pagamenti-bambino'],
    ]);
    // "Rette" non è più di primo livello.
    expect(voci.filter((v) => !eGruppo(v)).some((v) => v.etichetta === 'Rette')).toBe(false);
  });

  it('non mostra "Pagamenti" né "Pagamenti bambino" a chi non è admin', () => {
    for (const ruolo of ['maestra', 'assistente', 'genitore', null, undefined]) {
      const voci = vociMenu(ruolo);
      expect(voci.some((v) => v.etichetta === 'Pagamenti')).toBe(false);
      expect(vociLink(voci).some((v) => v.href === '/admin/pagamenti-bambino' || v.href === '/admin/rette')).toBe(false);
    }
  });

  it('mette "Impostazioni avanzate" per ultima, solo per l\'admin, senza "Reset giornata" di primo livello', () => {
    const voci = vociMenu('admin');
    expect(voci[voci.length - 1].etichetta).toBe('Impostazioni avanzate');
    expect(vociLink(voci).some((v) => v.href === '/admin/reset-giornata')).toBe(false);
    for (const ruolo of ['maestra', 'assistente', 'genitore', null, undefined]) {
      expect(vociLink(vociMenu(ruolo)).some((v) => v.href === '/admin/impostazioni-avanzate')).toBe(false);
    }
  });
});

// Le voci cliccabili evidenziate come attive (gruppi appiattiti nei figli).
function voceAttive(ruolo: string, pathname: string) {
  return vociMenuConStato(ruolo, pathname)
    .flatMap((e) => (eGruppoConStato(e) ? e.figli : [e]))
    .filter((v) => v.attivo);
}

describe('vociMenuConStato', () => {
  it('evidenzia "Dashboard" su /dashboard e sulle sue sotto-pagine', () => {
    for (const pathname of ['/dashboard', '/dashboard/presenze', '/dashboard/report/anagrafica']) {
      const attive = voceAttive('maestra', pathname);
      expect(attive.map((v) => v.href)).toEqual(['/dashboard']);
    }
  });

  it('evidenzia la voce admin più specifica invece del generico /admin', () => {
    const attive = voceAttive('admin', '/admin/maestre/qualcosa');
    expect(attive.map((v) => v.href)).toEqual(['/admin/maestre']);
  });

  it('evidenzia "Sezioni e bambini" per /admin e le sue sotto-pagine non specifiche', () => {
    for (const pathname of ['/admin', '/admin/bambini/123']) {
      const attive = voceAttive('admin', pathname);
      expect(attive.map((v) => v.href)).toEqual(['/admin']);
    }
  });

  it('evidenzia "Rette" e "Pagamenti bambino" sulle loro pagine, mai il gruppo "Pagamenti"', () => {
    expect(voceAttive('admin', '/admin/rette').map((v) => v.href)).toEqual(['/admin/rette']);
    expect(voceAttive('admin', '/admin/rette/template').map((v) => v.href)).toEqual(['/admin/rette']);
    expect(voceAttive('admin', '/admin/pagamenti-bambino').map((v) => v.href)).toEqual(['/admin/pagamenti-bambino']);
    const gruppo = vociMenuConStato('admin', '/admin/rette').find((e) => e.etichetta === 'Pagamenti');
    expect(gruppo && eGruppoConStato(gruppo)).toBe(true);
  });

  it('evidenzia "Impostazioni avanzate" anche sulle pagine delle sue azioni', () => {
    for (const pathname of ['/admin/impostazioni-avanzate', '/admin/reset-giornata']) {
      const attive = voceAttive('admin', pathname);
      expect(attive.map((v) => v.href)).toEqual(['/admin/impostazioni-avanzate']);
    }
  });

  it('non evidenzia nulla su un pathname che non corrisponde a nessuna voce', () => {
    const attive = voceAttive('maestra', '/login');
    expect(attive).toEqual([]);
  });
});
