export type SottosezioneImpostazioni = {
  href: string;
  titolo: string;
  descrizione: string;
  icona: string;
};

// Sottosezioni di "Impostazioni" (/admin/impostazioni-avanzate), nell'ordine
// in cui compaiono. Unica fonte (specs/57): da qui derivano sia i riquadri
// della pagina sia le voci rientrate del menu (lib/navigazione.ts), così non
// possono divergere. Per aggiungerne un'altra basta una nuova voce qui.
export const SOTTOSEZIONI_IMPOSTAZIONI: SottosezioneImpostazioni[] = [
  {
    href: '/admin/reset-giornata',
    titolo: 'Reset giornata',
    descrizione:
      'Elimina tutte le presenze e i pasti registrati per una data, di tutte le classi. Azione irreversibile.',
    icona: '🧹',
  },
  {
    href: '/admin/parametri-funzionamento',
    titolo: 'Parametri di funzionamento',
    descrizione: "Consulta i parametri legati all'ambiente di esecuzione, come le variabili d'ambiente (sola lettura).",
    icona: '🎛️',
  },
  {
    href: '/admin/cron-job',
    titolo: 'Azioni',
    descrizione: 'Controlla quando sono partiti i job pianificati, come il report notturno, e con quale esito.',
    icona: '⏰',
  },
  {
    href: '/admin/maestre',
    titolo: 'Utenti',
    descrizione: 'Gestisci gli utenti e i loro ruoli, e assegna maestre e assistenti alle sezioni.',
    icona: '👥',
  },
];
