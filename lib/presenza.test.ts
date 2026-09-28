import { describe, expect, it } from 'vitest';
import {
  assenzaBloccataDaComunicazione,
  messaggioErroreSalvataggioPresenza,
  MESSAGGIO_ASSENZA_BLOCCATA,
  prossimaPresenza,
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
