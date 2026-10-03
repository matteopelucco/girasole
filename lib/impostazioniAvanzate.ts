export type AzioneAvanzata = {
  href: string;
  titolo: string;
  descrizione: string;
  icona: string;
};

// Azioni di amministrazione avanzate elencate in /admin/impostazioni-avanzate
// (specs/57 - reset-giornata.md). Per aggiungerne un'altra basta una nuova
// voce qui: pagina e menu (evidenziazione della voce "Impostazioni
// avanzate" sulle pagine delle azioni) la riprendono da questo elenco.
export const AZIONI_AVANZATE: AzioneAvanzata[] = [
  {
    href: '/admin/reset-giornata',
    titolo: 'Reset giornata',
    descrizione:
      'Elimina tutte le presenze e i pasti registrati per una data, di tutte le classi. Azione irreversibile.',
    icona: '🧹',
  },
];
