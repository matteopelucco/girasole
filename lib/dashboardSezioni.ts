import { percorsoGiornata } from '@/lib/giornata';

export type CardDashboard = {
  href: string;
  icona: string;
  etichetta: string;
  classi: string;
  spanIntero: boolean;
};

// Costruisce l'elenco delle card/pulsanti della dashboard (specs/12 -
// dashboard-maestre.md, specs/17 - ore-di-lavoro.md), in ordine, per una
// griglia a due colonne bilanciata: quando il numero di card è dispari,
// l'ultima ha spanIntero = true (occupa l'intera larghezza) per non
// lasciare un buco vuoto in griglia. Funzione pura: chi chiama
// (app/dashboard/page.tsx) ha già risolto ruolo/sezioni assegnate/
// abilitazione, nessun I/O qui.
export function cardsDashboard({
  data,
  haSezioni,
  abilitatoOreLavoro,
}: {
  data: string;
  haSezioni: boolean;
  abilitatoOreLavoro: boolean | null | undefined;
}): CardDashboard[] {
  const cards: Omit<CardDashboard, 'spanIntero'>[] = [];

  // Una sola card "Presenze e pasti" (specs/10, specs/12) per tutti i
  // ruoli dello staff: per l'assistente la schermata mostra solo la parte
  // presenze, quindi la card non dipende più dal ruolo.
  if (haSezioni) {
    cards.push({
      href: percorsoGiornata(data),
      icona: '📋',
      etichetta: 'Presenze e pasti',
      classi: 'bg-emerald-700 hover:bg-emerald-800',
    });
  }

  cards.push({
    href: '/dashboard/report',
    icona: '📊',
    etichetta: 'Report',
    classi: 'bg-sky-700 hover:bg-sky-800',
  });

  if (abilitatoOreLavoro) {
    cards.push({
      href: '/dashboard/ore-lavoro',
      icona: '🕒',
      etichetta: 'Ore di lavoro',
      classi: 'bg-purple-700 hover:bg-purple-800',
    });
  }

  const dispari = cards.length % 2 === 1;
  return cards.map((c, i) => ({ ...c, spanIntero: dispari && i === cards.length - 1 }));
}
