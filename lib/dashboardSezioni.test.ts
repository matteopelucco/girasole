import { describe, expect, it } from 'vitest';
import { cardsDashboard } from './dashboardSezioni';

// cardsDashboard è pura (nessun I/O): copre la disposizione bilanciata
// a due colonne richiesta da specs/12 e specs/17 — l'ultima card occupa
// l'intera larghezza solo quando il numero di card visibili è dispari.
// Dalla schermata unica (specs/10) c'è una sola card "Presenze e pasti",
// uguale per maestra, assistente e admin.
describe('cardsDashboard', () => {
  it('con sezioni, senza abilitazione ore: "Presenze e pasti" e Report (2, pari), nessuna a larghezza intera', () => {
    const cards = cardsDashboard({ data: '2026-08-29', haSezioni: true, abilitatoOreLavoro: false });

    expect(cards.map((c) => c.etichetta)).toEqual(['Presenze e pasti', 'Report']);
    expect(cards.every((c) => !c.spanIntero)).toBe(true);
  });

  it('con sezioni e abilitazione ore: 3 card (dispari), Ore di lavoro a larghezza intera', () => {
    const cards = cardsDashboard({ data: '2026-08-29', haSezioni: true, abilitatoOreLavoro: true });

    expect(cards.map((c) => c.etichetta)).toEqual(['Presenze e pasti', 'Report', 'Ore di lavoro']);
    expect(cards[0].spanIntero).toBe(false);
    expect(cards[1].spanIntero).toBe(false);
    expect(cards[2].spanIntero).toBe(true);
  });

  it('senza sezioni assegnate: solo Report, a larghezza intera', () => {
    const cards = cardsDashboard({ data: '2026-08-29', haSezioni: false, abilitatoOreLavoro: false });

    expect(cards.map((c) => c.etichetta)).toEqual(['Report']);
    expect(cards[0].spanIntero).toBe(true);
  });

  it('senza sezioni ma con abilitazione ore: Report e Ore di lavoro (2, pari)', () => {
    const cards = cardsDashboard({ data: '2026-08-29', haSezioni: false, abilitatoOreLavoro: true });

    expect(cards.map((c) => c.etichetta)).toEqual(['Report', 'Ore di lavoro']);
    expect(cards.every((c) => !c.spanIntero)).toBe(true);
  });

  it('la card "Presenze e pasti" punta alla schermata unica con la data passata e l\'icona 📋', () => {
    const cards = cardsDashboard({ data: '2026-08-29', haSezioni: true, abilitatoOreLavoro: false });

    expect(cards[0].href).toBe('/dashboard/giornata?data=2026-08-29');
    expect(cards[0].icona).toBe('📋');
  });

  it('la card Ore di lavoro punta a /dashboard/ore-lavoro con l\'icona 🕒', () => {
    const cards = cardsDashboard({ data: '2026-08-29', haSezioni: false, abilitatoOreLavoro: true });
    const ore = cards.find((c) => c.etichetta === 'Ore di lavoro');

    expect(ore?.href).toBe('/dashboard/ore-lavoro');
    expect(ore?.icona).toBe('🕒');
  });
});
