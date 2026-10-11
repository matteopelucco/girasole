import { describe, expect, it } from 'vitest';
import { SOTTOSEZIONI_IMPOSTAZIONI } from './impostazioniAvanzate';
import { eGruppo, eGruppoConStato, eStessaPagina, vociLink, vociMenu, vociMenuConStato } from './navigazione';

describe('eStessaPagina', () => {
  it('è vera per lo stesso percorso senza query (caso "Dashboard"/logo su /dashboard)', () => {
    expect(eStessaPagina('/dashboard', '', '/dashboard', '')).toBe(true);
  });

  it('accetta la query con o senza "?" iniziale', () => {
    expect(eStessaPagina('/dashboard/giornata', '?data=2026-10-06', '/dashboard/giornata', 'data=2026-10-06')).toBe(true);
    expect(eStessaPagina('/dashboard/giornata', 'data=2026-10-06', '/dashboard/giornata', '?data=2026-10-06')).toBe(true);
  });

  it('è falsa se cambia il percorso (navigazione reale, es. da /presenze a /dashboard)', () => {
    expect(eStessaPagina('/dashboard', '', '/presenze', '')).toBe(false);
  });

  it('è falsa se cambia la query', () => {
    expect(eStessaPagina('/dashboard/giornata', '?data=2026-10-07', '/dashboard/giornata', 'data=2026-10-06')).toBe(false);
    expect(eStessaPagina('/dashboard', '?x=1', '/dashboard', '')).toBe(false);
  });
});

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
      '/admin/calendario',
      '/admin/profili-orari',
      '/admin/ore-lavoro',
      '/admin/rette',
      '/admin/pagamenti-bambino',
      '/admin/impostazioni-avanzate',
      '/admin/reset-giornata',
      '/admin/parametri-funzionamento',
      '/admin/cron-job',
      '/admin/maestre',
    ]);
  });

  it('raggruppa "Profili orari" e "Ore di lavoro del personale" sotto "Ore dipendenti", dopo il calendario e prima di "Pagamenti" (specs/54)', () => {
    const voci = vociMenu('admin');
    const gruppo = voci.find((v) => v.etichetta === 'Ore dipendenti');
    expect(gruppo && eGruppo(gruppo)).toBe(true);
    expect(gruppo && eGruppo(gruppo) && gruppo.figli.map((f) => [f.etichetta, f.href])).toEqual([
      ['Profili orari', '/admin/profili-orari'],
      ['Ore di lavoro del personale', '/admin/ore-lavoro'],
    ]);
    // Le due voci non sono più di primo livello.
    const primoLivello = voci.filter((v) => !eGruppo(v)).map((v) => v.etichetta);
    expect(primoLivello).not.toContain('Profili orari');
    expect(primoLivello).not.toContain('Ore di lavoro del personale');
    const ordine = voci.map((v) => v.etichetta);
    expect(ordine.indexOf('Calendario scolastico')).toBeLessThan(ordine.indexOf('Ore dipendenti'));
    expect(ordine.indexOf('Ore dipendenti')).toBeLessThan(ordine.indexOf('Pagamenti'));
  });

  it('non mostra "Ore dipendenti" né le sue voci a chi non è admin', () => {
    for (const ruolo of ['maestra', 'assistente', 'genitore', null, undefined]) {
      const voci = vociMenu(ruolo);
      expect(voci.some((v) => v.etichetta === 'Ore dipendenti')).toBe(false);
      expect(vociLink(voci).some((v) => v.href === '/admin/profili-orari' || v.href === '/admin/ore-lavoro')).toBe(false);
    }
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

  it('mette "Impostazioni" in fondo con le sottosezioni rientrate sotto, nello stesso ordine dei riquadri, solo per l\'admin', () => {
    const voci = vociMenu('admin');
    expect(voci.slice(-5).map((v) => v.etichetta)).toEqual([
      'Impostazioni',
      'Reset giornata',
      'Parametri di funzionamento',
      'Cron Job',
      'Utenti',
    ]);
    // Le voci rientrate vengono dallo stesso elenco dei riquadri della pagina.
    expect(voci.slice(-4).map((v) => !eGruppo(v) && v.href)).toEqual(
      SOTTOSEZIONI_IMPOSTAZIONI.map((s) => s.href)
    );
    for (const rientrata of voci.slice(-4)) {
      expect(!eGruppo(rientrata) && rientrata.rientrata).toBe(true);
    }
    expect(vociLink(voci).filter((v) => v.href === '/admin/maestre')).toHaveLength(1);
    expect(vociLink(voci).filter((v) => v.href === '/admin/reset-giornata')).toHaveLength(1);
    for (const ruolo of ['maestra', 'assistente', 'genitore', null, undefined]) {
      expect(vociLink(vociMenu(ruolo)).some((v) => v.href === '/admin/reset-giornata')).toBe(false);
      expect(vociLink(vociMenu(ruolo)).some((v) => v.href === '/admin/impostazioni-avanzate')).toBe(false);
      expect(vociLink(vociMenu(ruolo)).some((v) => v.href === '/admin/parametri-funzionamento')).toBe(false);
      expect(vociLink(vociMenu(ruolo)).some((v) => v.href === '/admin/cron-job')).toBe(false);
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

  it('evidenzia "Impostazioni" sulla sua pagina e "Reset giornata" sulla pagina del reset', () => {
    expect(voceAttive('admin', '/admin/impostazioni-avanzate').map((v) => v.href)).toEqual([
      '/admin/impostazioni-avanzate',
    ]);
    expect(voceAttive('admin', '/admin/reset-giornata').map((v) => v.href)).toEqual(['/admin/reset-giornata']);
  });

  it('evidenzia "Parametri di funzionamento" sulla sua pagina e non "Impostazioni"', () => {
    expect(voceAttive('admin', '/admin/parametri-funzionamento').map((v) => v.href)).toEqual([
      '/admin/parametri-funzionamento',
    ]);
  });

  it('evidenzia "Cron Job" sulla sua pagina e non "Impostazioni"', () => {
    expect(voceAttive('admin', '/admin/cron-job').map((v) => v.href)).toEqual(['/admin/cron-job']);
  });

  it('evidenzia le voci del gruppo "Ore dipendenti" sulle loro pagine', () => {
    expect(voceAttive('admin', '/admin/profili-orari').map((v) => v.href)).toEqual(['/admin/profili-orari']);
    expect(voceAttive('admin', '/admin/ore-lavoro/qualcosa').map((v) => v.href)).toEqual(['/admin/ore-lavoro']);
  });

  it('non evidenzia nulla su un pathname che non corrisponde a nessuna voce', () => {
    const attive = voceAttive('maestra', '/login');
    expect(attive).toEqual([]);
  });
});
