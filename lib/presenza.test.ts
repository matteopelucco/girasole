import { describe, expect, it } from 'vitest';
import {
  assenzaBloccataDaComunicazione,
  avvisoAzzeramentoPerAssenza,
  datiDaAzzerarePerAssenza,
  assicuraRigaAttesa,
  messaggioErroreSalvataggioPresenza,
  MESSAGGIO_ASSENZA_BLOCCATA,
  MESSAGGIO_DATI_CAMBIATI,
  MESSAGGIO_RIGA_NON_VALIDA,
  prossimaPresenza,
  rigaPresenzaDaDb,
} from './presenza';

describe('prossimaPresenza — stati primari', () => {
  it('presente azzera pre-asilo/post-asilo anche se erano attivi', () => {
    const attuale = { stato: 'presente' as const, preAsilo: true, postAsilo: true };
    expect(prossimaPresenza(attuale, 'presente')).toEqual({
      stato: 'presente',
      preAsilo: false,
      postAsilo: false,
    });
  });

  it('assente azzera pre-asilo/post-asilo', () => {
    const attuale = { stato: 'presente' as const, preAsilo: true, postAsilo: false };
    expect(prossimaPresenza(attuale, 'assente')).toEqual({
      stato: 'assente',
      preAsilo: false,
      postAsilo: false,
    });
  });

  it('malattia azzera pre-asilo/post-asilo', () => {
    const attuale = { stato: 'presente' as const, preAsilo: false, postAsilo: true };
    expect(prossimaPresenza(attuale, 'malattia')).toEqual({
      stato: 'malattia',
      preAsilo: false,
      postAsilo: false,
    });
  });

  it('funziona anche senza nessuno stato precedente', () => {
    expect(prossimaPresenza(null, 'presente')).toEqual({
      stato: 'presente',
      preAsilo: false,
      postAsilo: false,
    });
  });
});

describe('prossimaPresenza — pre-asilo', () => {
  it('attiva pre-asilo e forza lo stato a presente, partendo da nessuno stato', () => {
    expect(prossimaPresenza(null, 'pre_asilo')).toEqual({
      stato: 'presente',
      preAsilo: true,
      postAsilo: false,
    });
  });

  it('attiva pre-asilo forzando lo stato a presente da assente', () => {
    const attuale = { stato: 'assente' as const, preAsilo: false, postAsilo: false };
    expect(prossimaPresenza(attuale, 'pre_asilo')).toEqual({
      stato: 'presente',
      preAsilo: true,
      postAsilo: false,
    });
  });

  it('attiva pre-asilo forzando lo stato a presente da malattia', () => {
    const attuale = { stato: 'malattia' as const, preAsilo: false, postAsilo: false };
    expect(prossimaPresenza(attuale, 'pre_asilo')).toEqual({
      stato: 'presente',
      preAsilo: true,
      postAsilo: false,
    });
  });

  it('ripremuto quando già attivo lo disattiva, restando presente', () => {
    const attuale = { stato: 'presente' as const, preAsilo: true, postAsilo: false };
    expect(prossimaPresenza(attuale, 'pre_asilo')).toEqual({
      stato: 'presente',
      preAsilo: false,
      postAsilo: false,
    });
  });

  it('non tocca post-asilo se già attivo', () => {
    const attuale = { stato: 'presente' as const, preAsilo: false, postAsilo: true };
    expect(prossimaPresenza(attuale, 'pre_asilo')).toEqual({
      stato: 'presente',
      preAsilo: true,
      postAsilo: true,
    });
  });
});

describe('prossimaPresenza — post-asilo', () => {
  it('attiva post-asilo e forza lo stato a presente, partendo da nessuno stato', () => {
    expect(prossimaPresenza(null, 'post_asilo')).toEqual({
      stato: 'presente',
      preAsilo: false,
      postAsilo: true,
    });
  });

  it('ripremuto quando già attivo lo disattiva, restando presente', () => {
    const attuale = { stato: 'presente' as const, preAsilo: false, postAsilo: true };
    expect(prossimaPresenza(attuale, 'post_asilo')).toEqual({
      stato: 'presente',
      preAsilo: false,
      postAsilo: false,
    });
  });

  it('non tocca pre-asilo se già attivo', () => {
    const attuale = { stato: 'presente' as const, preAsilo: true, postAsilo: false };
    expect(prossimaPresenza(attuale, 'post_asilo')).toEqual({
      stato: 'presente',
      preAsilo: true,
      postAsilo: true,
    });
  });

  it('entrambi attivi insieme (pre-asilo poi post-asilo)', () => {
    let riga = prossimaPresenza(null, 'pre_asilo');
    riga = prossimaPresenza(riga, 'post_asilo');
    expect(riga).toEqual({ stato: 'presente', preAsilo: true, postAsilo: true });
  });
});

describe('assenzaBloccataDaComunicazione (specs/16, blocco dopo la comunicazione a Rojac)', () => {
  const base = { ruolo: 'maestra', pastiComunicati: true, mangiato: 'si', statoAttuale: 'presente' as const };

  it('maestra, pasti comunicati, pasto sì, bambino presente: bloccato', () => {
    expect(assenzaBloccataDaComunicazione(base)).toBe(true);
  });

  it('assistente: stesso blocco della maestra', () => {
    expect(assenzaBloccataDaComunicazione({ ...base, ruolo: 'assistente' })).toBe(true);
  });

  it('bambino senza ancora una presenza, pasto sì: bloccato', () => {
    expect(assenzaBloccataDaComunicazione({ ...base, statoAttuale: null })).toBe(true);
    expect(assenzaBloccataDaComunicazione({ ...base, statoAttuale: undefined })).toBe(true);
  });

  it('admin: mai bloccato', () => {
    expect(assenzaBloccataDaComunicazione({ ...base, ruolo: 'admin' })).toBe(false);
  });

  it('pasti non ancora comunicati: non bloccato', () => {
    expect(assenzaBloccataDaComunicazione({ ...base, pastiComunicati: false })).toBe(false);
  });

  it('pasto "no" o non segnato: non bloccato (non è nel conteggio comunicato)', () => {
    expect(assenzaBloccataDaComunicazione({ ...base, mangiato: 'no' })).toBe(false);
    expect(assenzaBloccataDaComunicazione({ ...base, mangiato: null })).toBe(false);
    expect(assenzaBloccataDaComunicazione({ ...base, mangiato: undefined })).toBe(false);
  });

  it('bambino già assente o malato: non bloccato (nota o passaggio assente <-> malattia)', () => {
    expect(assenzaBloccataDaComunicazione({ ...base, statoAttuale: 'assente' })).toBe(false);
    expect(assenzaBloccataDaComunicazione({ ...base, statoAttuale: 'malattia' })).toBe(false);
  });

  it('ruolo sconosciuto o assente: trattato come non-admin (bloccato)', () => {
    expect(assenzaBloccataDaComunicazione({ ...base, ruolo: null })).toBe(true);
  });
});

describe('messaggioErroreSalvataggioPresenza', () => {
  it('il rifiuto del trigger di 0052 diventa un messaggio comprensibile', () => {
    const messaggio = messaggioErroreSalvataggioPresenza(
      'Impossibile segnare assente o malattia: il pasto di questo bambino è già stato comunicato a Rojac.'
    );
    expect(messaggio).toBe(MESSAGGIO_ASSENZA_BLOCCATA);
    expect(messaggio).not.toContain('Impossibile salvare la presenza');
  });

  it('ogni altro errore resta con il prefisso e il dettaglio tecnico', () => {
    expect(messaggioErroreSalvataggioPresenza('new row violates row-level security policy')).toBe(
      'Impossibile salvare la presenza: new row violates row-level security policy'
    );
  });
});

describe('datiDaAzzerarePerAssenza (specs/13, avviso prima di Assente/Malattia)', () => {
  const nulla = { pasto: false, preAsilo: false, postAsilo: false };

  it('bambino presente con pasto sì: da azzerare il pasto', () => {
    expect(datiDaAzzerarePerAssenza({ statoAttuale: 'presente', mangiato: 'si', preAsilo: false, postAsilo: false })).toEqual({
      ...nulla,
      pasto: true,
    });
  });

  it('bambino senza presenza ancora segnata ma con pasto sì: da azzerare il pasto', () => {
    expect(datiDaAzzerarePerAssenza({ statoAttuale: undefined, mangiato: 'si' })).toEqual({ ...nulla, pasto: true });
  });

  it('pre-asilo e post-asilo attivi: da azzerare entrambi', () => {
    expect(
      datiDaAzzerarePerAssenza({ statoAttuale: 'presente', mangiato: 'no', preAsilo: true, postAsilo: true })
    ).toEqual({ pasto: false, preAsilo: true, postAsilo: true });
  });

  it('tutto insieme', () => {
    expect(
      datiDaAzzerarePerAssenza({ statoAttuale: 'presente', mangiato: 'si', preAsilo: true, postAsilo: false })
    ).toEqual({ pasto: true, preAsilo: true, postAsilo: false });
  });

  it('pasto no o non segnato, nessun pre/post: niente da azzerare', () => {
    expect(datiDaAzzerarePerAssenza({ statoAttuale: 'presente', mangiato: 'no' })).toEqual(nulla);
    expect(datiDaAzzerarePerAssenza({ statoAttuale: 'presente' })).toEqual(nulla);
    expect(datiDaAzzerarePerAssenza({ statoAttuale: undefined })).toEqual(nulla);
  });

  it('già assente o malato: niente da azzerare (passare da assente a malattia non cambia i pasti)', () => {
    expect(datiDaAzzerarePerAssenza({ statoAttuale: 'assente', mangiato: 'si' })).toEqual(nulla);
    expect(datiDaAzzerarePerAssenza({ statoAttuale: 'malattia', mangiato: 'si' })).toEqual(nulla);
  });
});

describe('avvisoAzzeramentoPerAssenza', () => {
  it('nessun avviso se non c\'è nulla da azzerare', () => {
    expect(avvisoAzzeramentoPerAssenza({ pasto: false, preAsilo: false, postAsilo: false })).toBeNull();
  });

  it('un solo elemento: singolare', () => {
    expect(avvisoAzzeramentoPerAssenza({ pasto: true, preAsilo: false, postAsilo: false })).toBe(
      'Attenzione: per questo bambino risulta già segnato il pasto. Se confermi, verrà azzerato.'
    );
  });

  it('due elementi: plurale con "e"', () => {
    expect(avvisoAzzeramentoPerAssenza({ pasto: true, preAsilo: true, postAsilo: false })).toBe(
      'Attenzione: per questo bambino risultano già segnati il pasto e il pre-asilo. Se confermi, verranno azzerati.'
    );
  });

  it('tre elementi: elenco con virgola e "e"', () => {
    expect(avvisoAzzeramentoPerAssenza({ pasto: true, preAsilo: true, postAsilo: true })).toBe(
      'Attenzione: per questo bambino risultano già segnati il pasto, il pre-asilo e il post-asilo. Se confermi, verranno azzerati.'
    );
  });
});

describe('rigaPresenzaDaDb', () => {
  it('nessuna riga (inesistente o non visibile): null', () => {
    expect(rigaPresenzaDaDb(null)).toBeNull();
    expect(rigaPresenzaDaDb(undefined)).toBeNull();
  });

  it('converte le colonne del database nel formato dell’applicazione', () => {
    expect(rigaPresenzaDaDb({ stato: 'presente', pre_asilo: true, post_asilo: false })).toEqual({
      stato: 'presente',
      preAsilo: true,
      postAsilo: false,
    });
    expect(rigaPresenzaDaDb({ stato: 'malattia', pre_asilo: false, post_asilo: false })).toEqual({
      stato: 'malattia',
      preAsilo: false,
      postAsilo: false,
    });
  });

  it('stato sconosciuto: errore', () => {
    expect(() => rigaPresenzaDaDb({ stato: 'altro', pre_asilo: false, post_asilo: false })).toThrow(
      MESSAGGIO_RIGA_NON_VALIDA
    );
  });

  it('pre/post-asilo su un bambino non presente: errore (incoerente)', () => {
    expect(() => rigaPresenzaDaDb({ stato: 'assente', pre_asilo: true, post_asilo: false })).toThrow(
      MESSAGGIO_RIGA_NON_VALIDA
    );
    expect(() => rigaPresenzaDaDb({ stato: 'malattia', pre_asilo: false, post_asilo: true })).toThrow(
      MESSAGGIO_RIGA_NON_VALIDA
    );
  });
});

describe('assicuraRigaAttesa', () => {
  const presente = { stato: 'presente' as const, preAsilo: false, postAsilo: false };

  it('riga uguale a quella letta dal database: ok', () => {
    expect(() => assicuraRigaAttesa(presente, { ...presente })).not.toThrow();
  });

  it('nessuna riga né sul database né dal client: ok', () => {
    expect(() => assicuraRigaAttesa(null, null)).not.toThrow();
    expect(() => assicuraRigaAttesa(null, undefined)).not.toThrow();
  });

  it('un indicatore diverso: dati cambiati', () => {
    expect(() => assicuraRigaAttesa(presente, { ...presente, postAsilo: true })).toThrow(
      MESSAGGIO_DATI_CAMBIATI
    );
    expect(() => assicuraRigaAttesa(presente, { ...presente, preAsilo: true })).toThrow(
      MESSAGGIO_DATI_CAMBIATI
    );
  });

  it('stato diverso: dati cambiati', () => {
    expect(() => assicuraRigaAttesa(presente, { ...presente, stato: 'assente' })).toThrow(
      MESSAGGIO_DATI_CAMBIATI
    );
  });

  it('il client dichiara una riga che nel database non c’è (o non è visibile): dati cambiati', () => {
    expect(() => assicuraRigaAttesa(null, presente)).toThrow(MESSAGGIO_DATI_CAMBIATI);
  });

  it('il client dichiara nessuna riga ma nel database c’è: dati cambiati', () => {
    expect(() => assicuraRigaAttesa(presente, null)).toThrow(MESSAGGIO_DATI_CAMBIATI);
  });

  it('valori malformati dal client: dati cambiati, senza rivelare la riga letta', () => {
    const malformata = { stato: 'presente', preAsilo: 'true', postAsilo: 1 } as unknown as typeof presente;
    expect(() => assicuraRigaAttesa(presente, malformata)).toThrow(MESSAGGIO_DATI_CAMBIATI);
    expect(MESSAGGIO_DATI_CAMBIATI).not.toMatch(/presente|assente|malattia/i);
  });
});
