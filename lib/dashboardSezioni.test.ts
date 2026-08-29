import { describe, expect, it } from 'vitest';
import { cardsDashboard } from './dashboardSezioni';

// cardsDashboard è pura (nessun I/O): copre la disposizione bilanciata
// a due colonne richiesta da specs/12 e specs/17 — l'ultima card occupa
// l'intera larghezza solo quando il numero di card visibili è dispari.
describe('cardsDashboard', () => {
  it('maestra con sezioni, senza abilitazione ore: Presenze, Pasti, Report — Report a larghezza intera (3, dispari)', () => {
    const cards = cardsDashboard({ data: '2026-08-29', haSezioni: true, ruolo: 'maestra', abilitatoOreLavoro: false });

    expect(cards.map((c) => c.etichetta)).toEqual(['Presenze', 'Pasti', 'Report']);
    expect(cards[0].spanIntero).toBe(false);
    expect(cards[1].spanIntero).toBe(false);
    expect(cards[2].spanIntero).toBe(true);
  });

  it('maestra con sezioni e abilitazione ore: 4 card (pari), nessuna a larghezza intera', () => {
    const cards = cardsDashboard({ data: '2026-08-29', haSezioni: true, ruolo: 'maestra', abilitatoOreLavoro: true });

    expect(cards.map((c) => c.etichetta)).toEqual(['Presenze', 'Pasti', 'Report', 'Ore di lavoro']);
    expect(cards.every((c) => !c.spanIntero)).toBe(true);
  });

  it('assistente con sezioni, senza Pasti: Presenze e Report (2, pari), nessuna a larghezza intera', () => {
    const cards = cardsDashboard({ data: '2026-08-29', haSezioni: true, ruolo: 'assistente', abilitatoOreLavoro: false });

    expect(cards.map((c) => c.etichetta)).toEqual(['Presenze', 'Report']);
    expect(cards.every((c) => !c.spanIntero)).toBe(true);
  });

  it('assistente con sezioni e abilitazione ore: 3 card (dispari), Ore di lavoro a larghezza intera', () => {
    const cards = cardsDashboard({ data: '2026-08-29', haSezioni: true, ruolo: 'assistente', abilitatoOreLavoro: true });

    expect(cards.map((c) => c.etichetta)).toEqual(['Presenze', 'Report', 'Ore di lavoro']);
    expect(cards[2].spanIntero).toBe(true);
  });

  it('senza sezioni assegnate: solo Report, a larghezza intera', () => {
    const cards = cardsDashboard({ data: '2026-08-29', haSezioni: false, ruolo: 'maestra', abilitatoOreLavoro: false });

    expect(cards.map((c) => c.etichetta)).toEqual(['Report']);
    expect(cards[0].spanIntero).toBe(true);
  });

  it('senza sezioni ma con abilitazione ore: Report e Ore di lavoro (2, pari)', () => {
    const cards = cardsDashboard({ data: '2026-08-29', haSezioni: false, ruolo: 'admin', abilitatoOreLavoro: true });

    expect(cards.map((c) => c.etichetta)).toEqual(['Report', 'Ore di lavoro']);
    expect(cards.every((c) => !c.spanIntero)).toBe(true);
  });

  it('gli href di Presenze e Pasti includono la data passata', () => {
    const cards = cardsDashboard({ data: '2026-08-29', haSezioni: true, ruolo: 'maestra', abilitatoOreLavoro: false });

    expect(cards[0].href).toBe('/dashboard/presenze?data=2026-08-29');
    expect(cards[1].href).toBe('/dashboard/pasti?data=2026-08-29');
  });

  it('la card Ore di lavoro punta a /dashboard/ore-lavoro con l\'icona 🕒', () => {
    const cards = cardsDashboard({ data: '2026-08-29', haSezioni: false, ruolo: 'admin', abilitatoOreLavoro: true });
    const ore = cards.find((c) => c.etichetta === 'Ore di lavoro');

    expect(ore?.href).toBe('/dashboard/ore-lavoro');
    expect(ore?.icona).toBe('🕒');
  });
});
