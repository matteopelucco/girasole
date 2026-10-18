import { describe, expect, it } from 'vitest';
import type { MotivoErroreCalendario, RisultatoSincronizzazione } from './calendarioIcal';
import {
  DURATA_MASSIMA_GUARDIA_MS,
  MESSAGGIO_DISATTIVATA,
  MESSAGGIO_GIA_IN_CORSO,
  esitoSincronizzazioneManuale,
  sincronizzazioneInCorso,
} from './sincronizzazioneManuale';

// Solo logica pura (specs/64, "Sincronizzazione a mano"; issue #326).

describe('esitoSincronizzazioneManuale', () => {
  it('senza indirizzo è OK con la frase "Sincronizzazione disattivata"', () => {
    expect(esitoSincronizzazioneManuale({ stato: 'disattivata' })).toEqual({
      stato: 'OK',
      messaggio: MESSAGGIO_DISATTIVATA,
    });
    expect(MESSAGGIO_DISATTIVATA).toBe('Sincronizzazione disattivata: nessun indirizzo impostato.');
  });

  it('riuscita è OK con i soli tre numeri (aggiunti, aggiornati, tolti)', () => {
    const esito = esitoSincronizzazioneManuale({ stato: 'ok', inseriti: 4, aggiornati: 1, rimossi: 2, totale: 9 });
    expect(esito).toEqual({ stato: 'OK', messaggio: 'Eventi aggiunti: 4, aggiornati: 1, tolti: 2.' });
  });

  it('con tutti zeri dice che non è cambiato nulla', () => {
    const esito = esitoSincronizzazioneManuale({ stato: 'ok', inseriti: 0, aggiornati: 0, rimossi: 0, totale: 8 });
    expect(esito).toEqual({ stato: 'OK', messaggio: 'Eventi aggiunti: 0, aggiornati: 0, tolti: 0.' });
  });

  it('un errore è ERRORE con il motivo dall\'elenco fisso', () => {
    const esito = esitoSincronizzazioneManuale({ stato: 'errore', motivo: 'feed_non_valido' });
    expect(esito).toEqual({ stato: 'ERRORE', messaggio: 'Calendario non sincronizzato: feed non valido.' });
  });

  it('ogni motivo dà una frase che non contiene indirizzi, stack o chiavi', () => {
    const motivi: MotivoErroreCalendario[] = [
      'indirizzo_non_valido',
      'non_raggiungibile',
      'risposta_non_valida',
      'feed_non_valido',
      'analisi_lenta',
      'analisi_incompleta',
      'impostazione_non_leggibile',
      'salvataggio',
      'imprevisto',
    ];
    for (const motivo of motivi) {
      const esito = esitoSincronizzazioneManuale({ stato: 'errore', motivo });
      expect(esito.stato).toBe('ERRORE');
      expect(esito.messaggio).toMatch(/^Calendario non sincronizzato: [a-zà-ù ,]+\.$/);
      expect(esito.messaggio).not.toMatch(/https?:|@|Error/);
    }
  });

  it('un motivo fuori elenco (dato corrotto) diventa "errore imprevisto"', () => {
    const corrotto = { stato: 'errore', motivo: 'https://calendar.google.com/segreto.ics' } as unknown as RisultatoSincronizzazione;
    const esito = esitoSincronizzazioneManuale(corrotto);
    expect(esito).toEqual({ stato: 'ERRORE', messaggio: 'Calendario non sincronizzato: errore imprevisto.' });
  });

  it('numeri non validi (negativi, decimali, NaN) diventano 0', () => {
    const sporco = { stato: 'ok', inseriti: -3, aggiornati: 1.5, rimossi: Number.NaN, totale: 1 } as RisultatoSincronizzazione;
    expect(esitoSincronizzazioneManuale(sporco).messaggio).toBe('Eventi aggiunti: 0, aggiornati: 0, tolti: 0.');
  });

  it('uno stato sconosciuto è ERRORE imprevisto, mai un OK', () => {
    const strano = { stato: 'boh' } as unknown as RisultatoSincronizzazione;
    expect(esitoSincronizzazioneManuale(strano).stato).toBe('ERRORE');
  });
});

describe('sincronizzazioneInCorso', () => {
  const adesso = 1_000_000;

  it('senza un lancio registrato non c\'è nulla in corso', () => {
    expect(sincronizzazioneInCorso(null, adesso)).toBe(false);
  });

  it('un lancio appena partito è in corso', () => {
    expect(sincronizzazioneInCorso(adesso - 1000, adesso)).toBe(true);
  });

  it('la guardia decade dopo la durata massima della funzione', () => {
    expect(sincronizzazioneInCorso(adesso - DURATA_MASSIMA_GUARDIA_MS + 1, adesso)).toBe(true);
    expect(sincronizzazioneInCorso(adesso - DURATA_MASSIMA_GUARDIA_MS, adesso)).toBe(false);
  });

  it('un orologio che torna indietro non blocca per sempre', () => {
    expect(sincronizzazioneInCorso(adesso + 5000, adesso)).toBe(false);
  });

  it('il rifiuto ha una frase fissa', () => {
    expect(MESSAGGIO_GIA_IN_CORSO).toBe('Una sincronizzazione è già in corso: attendi che finisca.');
  });
});
