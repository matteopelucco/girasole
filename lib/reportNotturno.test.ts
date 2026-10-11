import { describe, expect, it } from 'vitest';
import {
  anomalieDati,
  celleGiornaliere,
  descrizioniAllegati,
  formattaCorpoIntroduttivoHtml,
  INTESTAZIONI_GIORNALIERO,
  type SezioneGiornaliera,
} from './reportNotturno';
import type { RigaReportGiornaliera } from './report';

function riga(sovrascrizioni: Partial<RigaReportGiornaliera> = {}): RigaReportGiornaliera {
  return {
    id: '1',
    nome: 'Anna',
    cognome: 'Bianchi',
    presenze: 1,
    preAsilo: 0,
    postAsilo: 1,
    pasti: 1,
    inconsistenze: [],
    stato: 'presente',
    nota: null,
    ...sovrascrizioni,
  };
}

const GIORNO = '2026-10-10';

describe('celleGiornaliere', () => {
  it('ha una cella per ogni intestazione, con Sì/- per pre-asilo, post-asilo e pasto', () => {
    const celle = celleGiornaliere(riga());
    expect(celle).toHaveLength(INTESTAZIONI_GIORNALIERO.length);
    expect(celle).toEqual(['Anna Bianchi', 'Presente', '-', 'Sì', 'Sì', '']);
  });

  it('riporta lo stato in italiano e la nota per assenze e malattie', () => {
    expect(celleGiornaliere(riga({ stato: 'malattia', nota: 'febbre', presenze: 0, postAsilo: 0, pasti: 0 }))).toEqual([
      'Anna Bianchi',
      'Malattia',
      '-',
      '-',
      '-',
      'febbre',
    ]);
    expect(celleGiornaliere(riga({ stato: 'assente' }))[1]).toBe('Assente');
    expect(celleGiornaliere(riga({ stato: 'non_segnato' }))[1]).toBe('Non segnato');
  });

  it('segnala le inconsistenze in testo semplice (il font PDF non codifica le emoji)', () => {
    expect(celleGiornaliere(riga({ inconsistenze: ['x'] }))[0]).toBe('Anna Bianchi [!] INCONSISTENZA');
  });
});

describe('anomalieDati', () => {
  it('nessuna anomalia con dati regolari', () => {
    expect(anomalieDati([{ nome: 'Girasoli', righe: [riga()] }], GIORNO)).toEqual([]);
  });

  it('segnala l\'assenza di classi attive', () => {
    expect(anomalieDati([], GIORNO)).toEqual(['Nessuna classe attiva.']);
  });

  it('segnala una classe senza bambini attivi', () => {
    const sezioni: SezioneGiornaliera[] = [
      { nome: 'Girasoli', righe: [riga()] },
      { nome: 'Margherite', righe: [] },
    ];
    expect(anomalieDati(sezioni, GIORNO)).toEqual(['La classe Margherite non ha bambini attivi.']);
  });

  it('segnala le inconsistenze con il nome del bambino e della classe', () => {
    const sezioni: SezioneGiornaliera[] = [
      { nome: 'Girasoli', righe: [riga({ inconsistenze: ['Pasto segnato ma presenza assente.'] })] },
    ];
    expect(anomalieDati(sezioni, GIORNO)).toEqual([
      'Inconsistenza per Anna Bianchi (Girasoli): Pasto segnato ma presenza assente.',
    ]);
  });

  it('segnala i bambini non segnati quando almeno uno è stato segnato', () => {
    const sezioni: SezioneGiornaliera[] = [
      {
        nome: 'Girasoli',
        righe: [riga(), riga({ id: '2', nome: 'Luca', cognome: 'Verdi', stato: 'non_segnato', presenze: 0 })],
      },
    ];
    expect(anomalieDati(sezioni, GIORNO)).toEqual(['Presenza non segnata per Luca Verdi (Girasoli).']);
  });

  it('se nessuno è stato segnato dà una sola riga, non una per bambino', () => {
    const sezioni: SezioneGiornaliera[] = [
      {
        nome: 'Girasoli',
        righe: [riga({ stato: 'non_segnato' }), riga({ id: '2', stato: 'non_segnato' })],
      },
    ];
    const anomalie = anomalieDati(sezioni, GIORNO);
    expect(anomalie).toHaveLength(1);
    expect(anomalie[0]).toContain('Nessuna presenza registrata');
    expect(anomalie[0]).toContain('sabato 10 ottobre 2026');
  });
});

describe('descrizioniAllegati', () => {
  it('descrive i soli report inviati, nell\'ordine giornaliero, settimanale, mensile (+ ore del personale)', () => {
    const d = descrizioniAllegati(['giornaliero', 'mensile'], GIORNO);
    expect(d).toHaveLength(3);
    expect(d[0]).toContain('Report giornaliero');
    expect(d[1]).toContain('Report mensile');
    expect(d[1]).toContain('fino a');
    expect(d[2]).toContain('ore del personale');
    expect(d[2]).toContain('settimane confermate');
    expect(d[2]).toContain('monte ore');
  });

  it('il settimanale riporta l\'intervallo e non aggiunge le ore del personale', () => {
    const d = descrizioniAllegati(['settimanale'], GIORNO);
    expect(d).toHaveLength(1);
    expect(d[0]).toContain('Report settimanale');
    expect(d[0]).toContain('5 ott');
  });
});

describe('formattaCorpoIntroduttivoHtml', () => {
  const generatoIl = new Date('2026-10-10T22:05:00Z'); // 11/10/2026 00:05 a Roma

  it('contiene descrizione, giorno, elenco allegati, data di invio e anomalie', () => {
    const html = formattaCorpoIntroduttivoHtml({
      dataReport: GIORNO,
      generatoIl,
      descrizioni: ['Report giornaliero: x'],
      anomalie: ['Nessuna classe attiva.'],
    });
    expect(html).toContain('sabato 10 ottobre 2026');
    expect(html).toContain('<li>Report giornaliero: x</li>');
    expect(html).toContain('11/10/2026');
    expect(html).toContain('00:05');
    expect(html).toContain('Anomalie riscontrate');
    expect(html).toContain('<li>Nessuna classe attiva.</li>');
  });

  it('senza anomalie lo dice esplicitamente invece di omettere la sezione', () => {
    const html = formattaCorpoIntroduttivoHtml({ dataReport: GIORNO, generatoIl, descrizioni: [], anomalie: [] });
    expect(html).toContain('Anomalie riscontrate');
    expect(html).toContain('Nessuna anomalia riscontrata.');
  });

  it('senza allegati lo dice, e rende come testo le anomalie con markup', () => {
    const html = formattaCorpoIntroduttivoHtml({
      dataReport: GIORNO,
      generatoIl,
      descrizioni: [],
      anomalie: ['<script>x</script> D\'Angelo & Co'],
    });
    expect(html).toContain('Nessun allegato');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt; D&#39;Angelo &amp; Co');
  });
});
