import { describe, expect, it } from 'vitest';
import { righeOSollevaErrore, formattaTabellaReportHtml, type SezioneConRighe } from './reportPresenze';
import type { RigaReportBambino } from './report';

// righeOSollevaErrore è l'unica funzione pura di questo modulo (le altre
// fanno query Supabase, coperte solo da e2e — vedi CLAUDE.md). Copre il
// bug corretto in produzione: un errore di query mascherato da "nessun
// dato" produceva un report vuoto indistinguibile da una notte senza
// dati reali (vedi TASKS.md).
describe('righeOSollevaErrore', () => {
  it('restituisce data quando non c\'è errore', () => {
    const righe = [{ id: '1' }, { id: '2' }];
    expect(righeOSollevaErrore({ data: righe, error: null }, 'lettura sezioni')).toBe(righe);
  });

  it('restituisce un array vuoto se data è null e non c\'è errore', () => {
    expect(righeOSollevaErrore({ data: null, error: null }, 'lettura sezioni')).toEqual([]);
  });

  it('solleva un errore con la descrizione e il messaggio originale se la query è fallita', () => {
    expect(() =>
      righeOSollevaErrore({ data: null, error: { message: 'JWT invalid' } }, 'lettura sezioni')
    ).toThrow('lettura sezioni: JWT invalid');
  });
});

function riga(sovrascrizioni: Partial<RigaReportBambino> = {}): RigaReportBambino {
  return {
    id: '1',
    nome: 'Anna',
    cognome: 'Bianchi',
    presenze: 1,
    preAsilo: 0,
    postAsilo: 1,
    pasti: 1,
    inconsistenze: [],
    ...sovrascrizioni,
  };
}

// formattaTabellaReportHtml è la funzione pura che genera il corpo HTML
// del report notturno (specs/52 - report-email-automatico.md): niente
// I/O, chi chiama passa i dati già aggregati (stessa forma usata dalla
// pagina Report a schermo e dai PDF email — vedi lib/pdfReport.test.ts).
describe('formattaTabellaReportHtml', () => {
  it('genera una tabella (non un elenco puntato) con le colonne del report a schermo', () => {
    const sezioni: SezioneConRighe[] = [{ nome: 'Girasoli', righe: [riga()] }];
    const html = formattaTabellaReportHtml('Presenze del 24 agosto 2026', sezioni);

    expect(html).not.toContain('<ul>');
    expect(html).not.toContain('<li>');
    expect(html).toContain('<table');
    expect(html).toContain('Girasoli');
    expect(html).toContain('Anna Bianchi');
    expect(html).toContain('Bambino');
    expect(html).toContain('Presenze');
    expect(html).toContain('Pre-asilo');
    expect(html).toContain('Post-asilo');
    expect(html).toContain('Pasti');
  });

  it('senza classi mostra "Nessuna classe attiva"', () => {
    const html = formattaTabellaReportHtml('Presenze del 24 agosto 2026', []);
    expect(html).toContain('Nessuna classe attiva.');
  });

  it('una classe senza bambini mostra "Nessun bambino in questa classe" (stessa dicitura dello schermo)', () => {
    const sezioni: SezioneConRighe[] = [{ nome: 'Margherite', righe: [] }];
    const html = formattaTabellaReportHtml('Presenze del 24 agosto 2026', sezioni);
    expect(html).toContain('Margherite');
    expect(html).toContain('Nessun bambino in questa classe.');
    expect(html).not.toContain('<table');
  });

  it('un bambino con inconsistenze mostra l\'avviso ⚠️', () => {
    const sezioni: SezioneConRighe[] = [
      { nome: 'Girasoli', righe: [riga({ inconsistenze: ['Pasto segnato ma presenza assente.'] })] },
    ];
    const html = formattaTabellaReportHtml('Presenze del 24 agosto 2026', sezioni);
    expect(html).toContain('⚠️');
    expect(html).toContain('Pasto segnato ma presenza assente.');
  });

  it('un bambino senza inconsistenze non mostra alcun avviso', () => {
    const sezioni: SezioneConRighe[] = [{ nome: 'Girasoli', righe: [riga()] }];
    const html = formattaTabellaReportHtml('Presenze del 24 agosto 2026', sezioni);
    expect(html).not.toContain('⚠️');
  });
});
