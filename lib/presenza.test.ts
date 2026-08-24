import { describe, expect, it } from 'vitest';
import { prossimaPresenza } from './presenza';

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
