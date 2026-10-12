import { describe, expect, it } from 'vitest';
import {
  CRON_JOB,
  LANCI_PER_PAGINA,
  LIMITE_MASSIMO,
  MESSAGGIO_CONFERMA_LANCIO,
  esitoLancioFallito,
  esitoLancioManuale,
  etichettaLancio,
  formattaInizioLancio,
  inizioFinestraInCorso,
  lancioInCorso,
  nomeCronValido,
  gruppiCron,
  hrefCaricaAltri,
  limitiDaParametri,
  messaggioErroreSicuro,
  problemaReportNotturno,
  problemaRiepilogoAllarmi,
  statoLancio,
  type RigaCronEsecuzione,
} from './cronEsecuzioni';

// Solo logica pura (specs/63 - cron-job.md): la lettura e la scrittura del
// registro su Supabase sono in lib/cronEsecuzioniDati.ts, coperte da e2e.

function riga(nome: string, iniziato_il: string, altro: Partial<RigaCronEsecuzione> = {}): RigaCronEsecuzione {
  return {
    id: `${nome}-${iniziato_il}`,
    nome,
    iniziato_il,
    finito_il: null,
    esito: 'ok',
    messaggio_errore: null,
    estemporaneo: false,
    ...altro,
  };
}

describe('CRON_JOB', () => {
  it('elenca i due job pianificati con il nome della loro route', () => {
    expect(CRON_JOB.map((c) => c.nome)).toEqual(['report-presenze', 'allarmi']);
    expect(CRON_JOB.map((c) => c.titolo)).toEqual(['Report notturno', 'Riepilogo allarmi']);
  });
});

describe('limitiDaParametri', () => {
  it('usa 20 per ogni job se la query string non dice nulla', () => {
    expect(limitiDaParametri({})).toEqual({ 'report-presenze': 20, allarmi: 20 });
  });

  it('legge il limite di ciascun job dal parametro con il suo nome', () => {
    expect(limitiDaParametri({ allarmi: '40' })).toEqual({ 'report-presenze': 20, allarmi: 40 });
  });

  it('ignora valori non validi, negativi o minori di 20', () => {
    for (const valore of ['abc', '-40', '0', '5', '', '20.5']) {
      expect(limitiDaParametri({ allarmi: valore }).allarmi).toBe(LANCI_PER_PAGINA);
    }
  });

  it('arrotonda al multiplo di 20 inferiore e non supera il massimo', () => {
    expect(limitiDaParametri({ allarmi: '45' }).allarmi).toBe(40);
    expect(limitiDaParametri({ allarmi: '100000' }).allarmi).toBe(LIMITE_MASSIMO);
  });

  it('con un parametro ripetuto usa il primo valore', () => {
    expect(limitiDaParametri({ allarmi: ['60', '80'] }).allarmi).toBe(60);
  });
});

describe('hrefCaricaAltri', () => {
  it('aumenta di 20 solo il job scelto e conserva i limiti già allargati degli altri', () => {
    expect(hrefCaricaAltri('allarmi', { 'report-presenze': 20, allarmi: 20 })).toBe('/admin/cron-job?allarmi=40');
    expect(hrefCaricaAltri('report-presenze', { 'report-presenze': 40, allarmi: 60 })).toBe(
      '/admin/cron-job?report-presenze=60&allarmi=60'
    );
  });
});

describe('gruppiCron', () => {
  it('raggruppa per nome, nell\'ordine di CRON_JOB, dal lancio più recente', () => {
    const gruppi = gruppiCron(
      [
        riga('allarmi', '2026-10-01T09:30:00Z'),
        riga('report-presenze', '2026-10-01T23:00:00Z'),
        riga('allarmi', '2026-10-02T09:30:00Z'),
        riga('report-presenze', '2026-09-30T23:00:00Z'),
      ],
      { 'report-presenze': 20, allarmi: 20 }
    );
    expect(gruppi.map((g) => g.nome)).toEqual(['report-presenze', 'allarmi']);
    expect(gruppi[0].lanci.map((l) => l.iniziato_il)).toEqual(['2026-10-01T23:00:00Z', '2026-09-30T23:00:00Z']);
    expect(gruppi[1].lanci.map((l) => l.iniziato_il)).toEqual(['2026-10-02T09:30:00Z', '2026-10-01T09:30:00Z']);
    expect(gruppi.every((g) => !g.altri)).toBe(true);
  });

  it('un job senza lanci ha comunque il suo gruppo, vuoto', () => {
    const gruppi = gruppiCron([riga('allarmi', '2026-10-02T09:30:00Z')], { 'report-presenze': 20, allarmi: 20 });
    expect(gruppi[0]).toMatchObject({ nome: 'report-presenze', lanci: [], altri: false });
  });

  it('ignora i lanci di job non in elenco', () => {
    const gruppi = gruppiCron([riga('sconosciuto', '2026-10-02T09:30:00Z')], { 'report-presenze': 20, allarmi: 20 });
    expect(gruppi.flatMap((g) => g.lanci)).toEqual([]);
  });

  it('mostra al più il limite del job e segnala che ce ne sono altri', () => {
    const righe = Array.from({ length: 21 }, (_, i) => riga('allarmi', `2026-01-${String(i + 1).padStart(2, '0')}T09:30:00Z`));
    const [, allarmi] = gruppiCron(righe, { 'report-presenze': 20, allarmi: 20 });
    expect(allarmi.lanci).toHaveLength(20);
    expect(allarmi.lanci[0].iniziato_il).toBe('2026-01-21T09:30:00Z');
    expect(allarmi.lanci[19].iniziato_il).toBe('2026-01-02T09:30:00Z');
    expect(allarmi.altri).toBe(true);
    expect(gruppiCron(righe.slice(0, 20), { 'report-presenze': 20, allarmi: 20 })[1].altri).toBe(false);
  });
});

describe('statoLancio', () => {
  const adesso = new Date('2026-10-02T10:00:00Z');

  it('OK senza messaggio', () => {
    expect(statoLancio(riga('allarmi', '2026-10-02T09:30:00Z', { esito: 'ok' }), adesso)).toEqual({
      stato: 'OK',
      messaggio: null,
    });
  });

  it('KO con il messaggio registrato, o un testo di ripiego se manca', () => {
    expect(
      statoLancio(riga('allarmi', '2026-10-02T09:30:00Z', { esito: 'ko', messaggio_errore: 'Invio email fallito (500)' }), adesso)
    ).toEqual({ stato: 'KO', messaggio: 'Invio email fallito (500)' });
    expect(statoLancio(riga('allarmi', '2026-10-02T09:30:00Z', { esito: 'ko' }), adesso)).toEqual({
      stato: 'KO',
      messaggio: 'Nessun dettaglio disponibile.',
    });
  });

  it('senza esito: "In corso" nei primi 15 minuti, poi KO interrotto', () => {
    expect(statoLancio(riga('allarmi', '2026-10-02T09:46:00Z', { esito: null }), adesso)).toEqual({
      stato: 'In corso',
      messaggio: null,
    });
    expect(statoLancio(riga('allarmi', '2026-10-02T09:44:59Z', { esito: null }), adesso)).toEqual({
      stato: 'KO',
      messaggio: 'Esecuzione interrotta: nessun esito registrato.',
    });
  });
});

describe('formattaInizioLancio', () => {
  it('mostra data e ora nel fuso Europe/Rome', () => {
    expect(formattaInizioLancio('2026-10-01T23:00:00Z')).toBe('02/10/2026 alle 01:00');
    expect(formattaInizioLancio('2026-01-15T11:30:00Z')).toBe('15/01/2026 alle 12:30');
  });
});

describe('messaggioErroreSicuro', () => {
  it('usa solo il messaggio dell\'errore, mai lo stack, e solo la prima riga', () => {
    const errore = new Error('Invio email fallito (500): servizio non disponibile\n    at inviaEmail (lib/email.ts:83:11)');
    const messaggio = messaggioErroreSicuro(errore);
    expect(messaggio).toBe('Invio email fallito (500): servizio non disponibile');
    expect(messaggio).not.toContain('at ');
  });

  it('accetta oggetti con un messaggio (es. errori di Supabase) e stringhe', () => {
    expect(messaggioErroreSicuro({ message: 'permission denied for table x' })).toBe('permission denied for table x');
    expect(messaggioErroreSicuro('timeout')).toBe('timeout');
  });

  it('senza un messaggio leggibile usa un testo di ripiego', () => {
    expect(messaggioErroreSicuro(undefined)).toBe('Errore senza messaggio.');
    expect(messaggioErroreSicuro(new Error(''))).toBe('Errore senza messaggio.');
    expect(messaggioErroreSicuro({ codice: 42 })).toBe('Errore senza messaggio.');
  });

  it('nasconde indirizzi email, token Bearer, JWT e stringhe lunghe simili a chiavi', () => {
    const messaggio = messaggioErroreSicuro(
      new Error(
        'Invio a staff@example.test fallito: Authorization Bearer abc123 rifiutato, jwt eyJhbGciOi.eyJzdWIiOi.c2lnbmF0dXJl, chiave re_AbCdEfGhIjKlMnOpQrStUvWxYz'
      )
    );
    expect(messaggio).not.toContain('staff@example.test');
    expect(messaggio).not.toContain('abc123');
    expect(messaggio).not.toContain('eyJ');
    expect(messaggio).not.toContain('AbCdEfGhIjKlMnOpQrStUvWxYz');
    expect(messaggio).toContain('[nascosto]');
    expect(messaggio.startsWith('Invio a [nascosto] fallito')).toBe(true);
  });

  it('tronca a 300 caratteri', () => {
    const messaggio = messaggioErroreSicuro(new Error('parola '.repeat(100)));
    expect(messaggio.length).toBe(300);
    expect(messaggio.endsWith('…')).toBe(true);
  });
});

describe('problemaReportNotturno', () => {
  it('nessun problema se nessun report è in errore', () => {
    expect(problemaReportNotturno({ giornaliero: 'inviato', settimanale: 'gia_inviato', mensile: 'saltato' })).toBeNull();
  });

  it('elenca i report non prodotti', () => {
    expect(problemaReportNotturno({ giornaliero: 'inviato', settimanale: 'errore', mensile: 'errore' })).toBe(
      'Report non prodotti: settimanale, mensile.'
    );
  });
});

describe('problemaRiepilogoAllarmi', () => {
  it('KO solo se il registro degli invii ha rifiutato la riga', () => {
    for (const esito of ['inviato', 'gia_inviato', 'tutto_ok']) {
      expect(problemaRiepilogoAllarmi(esito)).toBeNull();
    }
    expect(problemaRiepilogoAllarmi('errore_registro')).toBe(
      'Registro degli allarmi inviati non disponibile: email di riepilogo non inviata.'
    );
  });
});

// Lancio a mano (specs/63, "Lancio a mano", issue #302).
describe('etichettaLancio', () => {
  it('etichetta "estemporaneo" solo i lanci a mano', () => {
    expect(etichettaLancio(riga('allarmi', '2026-10-02T09:30:00Z', { estemporaneo: true }))).toBe('estemporaneo');
    expect(etichettaLancio(riga('allarmi', '2026-10-02T09:30:00Z'))).toBeNull();
  });
});

describe('nomeCronValido', () => {
  it("accetta solo i nomi dei job dell'elenco", () => {
    expect(nomeCronValido('allarmi')).toBe(true);
    expect(nomeCronValido('report-presenze')).toBe(true);
  });

  it('rifiuta ogni altro valore arrivato dal browser', () => {
    for (const valore of ['', 'Allarmi', 'allarmi ', 'sconosciuto', '../allarmi', null, undefined, 42, ['allarmi']]) {
      expect(nomeCronValido(valore), String(valore)).toBe(false);
    }
  });
});

describe('lancioInCorso', () => {
  const adesso = new Date('2026-10-02T10:00:00Z');

  it('è vero se un lancio dello stesso job è senza esito da meno di 15 minuti', () => {
    expect(lancioInCorso([riga('allarmi', '2026-10-02T09:50:00Z', { esito: null })], 'allarmi', adesso)).toBe(true);
  });

  it('conta anche un lancio a mano ancora in corso', () => {
    const righe = [riga('allarmi', '2026-10-02T09:59:00Z', { esito: null, estemporaneo: true })];
    expect(lancioInCorso(righe, 'allarmi', adesso)).toBe(true);
  });

  it('ignora i lanci finiti, quelli interrotti da più di 15 minuti e quelli degli altri job', () => {
    const righe = [
      riga('allarmi', '2026-10-02T09:55:00Z', { esito: 'ok' }),
      riga('allarmi', '2026-10-02T09:56:00Z', { esito: 'ko', messaggio_errore: 'x' }),
      riga('allarmi', '2026-10-02T09:44:00Z', { esito: null }),
      riga('report-presenze', '2026-10-02T09:58:00Z', { esito: null }),
    ];
    expect(lancioInCorso(righe, 'allarmi', adesso)).toBe(false);
    expect(lancioInCorso(righe, 'report-presenze', adesso)).toBe(true);
  });

  it("senza lanci non c'è niente in corso", () => {
    expect(lancioInCorso([], 'allarmi', adesso)).toBe(false);
  });
});

describe('inizioFinestraInCorso', () => {
  it("è l'istante di 15 minuti prima, in ISO", () => {
    expect(inizioFinestraInCorso(new Date('2026-10-02T10:00:00Z'))).toBe('2026-10-02T09:45:00.000Z');
  });
});

describe('esitoLancioManuale / esitoLancioFallito', () => {
  it('OK se il lavoro finisce senza problemi', () => {
    expect(esitoLancioManuale(null)).toEqual({ stato: 'OK' });
    expect(esitoLancioManuale(undefined)).toEqual({ stato: 'OK' });
  });

  it('KO con la frase fissa se una parte del lavoro non è riuscita', () => {
    expect(esitoLancioManuale('Report non prodotti: mensile.')).toEqual({
      stato: 'KO',
      messaggio: 'Report non prodotti: mensile.',
    });
  });

  it('KO con il messaggio ripulito se il lavoro solleva un errore', () => {
    const errore = new Error('Invio fallito per segreteria@example.test con Bearer abc.def\n    at stack');
    expect(esitoLancioFallito(errore)).toEqual({
      stato: 'KO',
      messaggio: 'Invio fallito per [nascosto] con Bearer [nascosto]',
    });
  });
});

describe('MESSAGGIO_CONFERMA_LANCIO', () => {
  it('avvisa che il lancio invia davvero le email', () => {
    expect(MESSAGGIO_CONFERMA_LANCIO).toBe('Questo lancio invia davvero le email. Procedere?');
  });
});
