import { descrizioneBambinoRetta, GIORNO_ALLARME_RETTE, type BambinoRetta } from './allarmeRette';
import type { StatoOperativoGiorno, UtenteSettimanaNonConfermata } from './allarmi';
import { formattaDataItaliana } from './date';
import { escapeHtml } from './htmlEscape';

// Email di riepilogo dei controlli (specs/07 - allarmi.md): un'unica email
// al giorno che riporta SEMPRE tutti i controlli, ciascuno con l'ora in cui
// è stato fatto, lo stato e, se da sistemare, che cosa manca e l'azione per
// risolvere. Tutto puro (nessun I/O, nessun `new Date()` nascosto): l'ora e
// i dati arrivano dal cron.

export type StatoControllo = 'ok' | 'da_sistemare' | 'non_applicabile' | 'non_controllato';

export type IdControllo = 'appello' | 'pasti-rojac' | 'rette-genitori' | 'mail-rojac-mensile' | 'ore-lavoro';

export type ControlloRiepilogo = {
  id: IdControllo;
  nome: string;
  // Istante in cui il controllo è stato fatto; null se non è stato fatto
  // affatto (stato "non_controllato").
  ora: Date | null;
  stato: StatoControllo;
  // Righe in testo semplice (nessun HTML: l'escape lo fa htmlRiepilogoAllarmi).
  dettaglio: string[];
  // Solo per "da_sistemare": l'azione da fare per risolvere.
  azione: string | null;
  // Solo per "non_applicabile" / "non_controllato": perché.
  motivo: string | null;
};

export type InputRiepilogo = {
  // Data di oggi, "YYYY-MM-DD" (fuso Europe/Rome).
  oggi: string;
  // Falso in un giorno di chiusura (weekend compreso, specs/53).
  giornoAttivo: boolean;
  // Vero se sono passate le 10:00 Europe/Rome.
  dopoOrario: boolean;
  // Istante assegnato ai controlli non eseguiti (non applicabili).
  oraRiepilogo: Date;
  // null se i controlli di giornata non sono stati calcolati (giorno
  // chiuso o prima delle 10:00).
  giornata: { ora: Date; stato: StatoOperativoGiorno } | null;
  rette: { ora: Date; mancanti: BambinoRetta[] };
  ore: { ora: Date; intervallo: string; utenti: UtenteSettimanaNonConfermata[] };
};

const AZIONE_APPELLO =
  'Segnare presenza, assenza o malattia di tutti i bambini in "Presenze e pasti" (entro la giornata).';
const AZIONE_PASTI = 'Comunicare i pasti di oggi a Rojac dalla schermata "Presenze e pasti" (entro la giornata).';
const AZIONE_RETTE = 'Inviare le comunicazioni delle rette ai genitori dalla tabella "Rette".';
const AZIONE_ORE = 'Confermare le ore della settimana in "Ore di lavoro".';

// "HH:MM" nel fuso Europe/Rome.
export function formattaOraRoma(istante: Date): string {
  return new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(istante);
}

function controlloBase(
  id: IdControllo,
  nome: string,
  ora: Date | null,
  stato: StatoControllo,
  extra: Partial<Pick<ControlloRiepilogo, 'dettaglio' | 'azione' | 'motivo'>> = {}
): ControlloRiepilogo {
  return { id, nome, ora, stato, dettaglio: extra.dettaglio ?? [], azione: extra.azione ?? null, motivo: extra.motivo ?? null };
}

function motivoGiornata(input: InputRiepilogo): string | null {
  if (!input.giornoAttivo) return 'giorno di chiusura';
  if (!input.dopoOrario) return 'prima delle 10:00 (i controlli di giornata si fanno solo dopo)';
  if (input.giornata?.stato.nessunDatoAtteso) return 'nessun bambino attivo da segnare';
  return null;
}

// Controlli di giornata (appello, pasti a Rojac): solo dopo le 10:00 in un
// giorno di apertura, perché alcune anomalie si correggono solo entro la
// giornata.
function controlliGiornata(input: InputRiepilogo): [ControlloRiepilogo, ControlloRiepilogo] {
  const motivo = motivoGiornata(input);
  if (motivo || !input.giornata) {
    const m = motivo ?? 'controllo non eseguito';
    return [
      controlloBase('appello', 'Appello', input.oraRiepilogo, 'non_applicabile', { motivo: m }),
      controlloBase('pasti-rojac', 'Pasti a Rojac', input.oraRiepilogo, 'non_applicabile', { motivo: m }),
    ];
  }

  const { ora, stato } = input.giornata;
  const appello = stato.presenzeIncomplete
    ? controlloBase('appello', 'Appello', ora, 'da_sistemare', {
        dettaglio: ['Non tutti i bambini hanno una presenza, un\'assenza o una malattia segnata per oggi.'],
        azione: AZIONE_APPELLO,
      })
    : controlloBase('appello', 'Appello', ora, 'ok', { dettaglio: ['Tutti i bambini hanno una voce per oggi.'] });
  const pasti = stato.pastiNonConfermati
    ? controlloBase('pasti-rojac', 'Pasti a Rojac', ora, 'da_sistemare', {
        dettaglio: ['I pasti di oggi non sono stati comunicati a Rojac.'],
        azione: AZIONE_PASTI,
      })
    : controlloBase('pasti-rojac', 'Pasti a Rojac', ora, 'ok', { dettaglio: ['Pasti di oggi comunicati a Rojac.'] });
  return [appello, pasti];
}

function controlloRette(input: InputRiepilogo): ControlloRiepilogo {
  const nome = 'Rette ai genitori';
  const giorno = Number(input.oggi.slice(8, 10));
  if (giorno < GIORNO_ALLARME_RETTE) {
    return controlloBase('rette-genitori', nome, input.oraRiepilogo, 'non_applicabile', {
      motivo: `prima del giorno ${GIORNO_ALLARME_RETTE} del mese`,
    });
  }
  const { ora, mancanti } = input.rette;
  if (!mancanti.length) {
    return controlloBase('rette-genitori', nome, ora, 'ok', {
      dettaglio: ['Nessuna comunicazione della retta da inviare questo mese.'],
    });
  }
  const quanti = mancanti.length === 1 ? '1 bambino' : `${mancanti.length} bambini`;
  return controlloBase('rette-genitori', nome, ora, 'da_sistemare', {
    dettaglio: [`Comunicazione della retta del mese non inviata a ${quanti}:`, ...mancanti.map(descrizioneBambinoRetta)],
    azione: AZIONE_RETTE,
  });
}

function controlloOre(input: InputRiepilogo): ControlloRiepilogo {
  const nome = 'Ore di lavoro';
  const { ora, intervallo, utenti } = input.ore;
  if (!utenti.length) {
    return controlloBase('ore-lavoro', nome, ora, 'ok', {
      dettaglio: [`Settimana ${intervallo} confermata da tutti.`],
    });
  }
  return controlloBase('ore-lavoro', nome, ora, 'da_sistemare', {
    dettaglio: [
      `Settimana ${intervallo} non ancora confermata da:`,
      ...utenti.map((u) => `${u.nome} ${u.cognome} (${u.email})`),
    ],
    azione: AZIONE_ORE,
  });
}

// L'ordine è quello dell'email: giornata, mensili, ore. La mail mensile dei
// pasti a Rojac non ha ancora un controllo vero (issue #282, in attesa del
// registro degli invii #281): compare come "non ancora controllata" e non
// fa mai scattare l'email.
export function costruisciControlliRiepilogo(input: InputRiepilogo): ControlloRiepilogo[] {
  const [appello, pasti] = controlliGiornata(input);
  return [
    appello,
    pasti,
    controlloRette(input),
    controlloBase('mail-rojac-mensile', 'Mail mensile dei pasti a Rojac', null, 'non_controllato', {
      motivo: 'controllo non ancora attivo',
    }),
    controlloOre(input),
  ];
}

export function riepilogoDaSistemare(controlli: ControlloRiepilogo[]): boolean {
  return controlli.some((c) => c.stato === 'da_sistemare');
}

export function oggettoRiepilogoAllarmi(controlli: ControlloRiepilogo[], oggi: string): string {
  const n = controlli.filter((c) => c.stato === 'da_sistemare').length;
  const quanti = n === 1 ? '1 controllo da sistemare' : `${n} controlli da sistemare`;
  return `Allarmi: ${quanti} — ${formattaDataItaliana(oggi)}`;
}

const ETICHETTA_STATO: Record<StatoControllo, string> = {
  ok: 'OK',
  da_sistemare: 'DA SISTEMARE',
  non_applicabile: 'NON APPLICABILE OGGI',
  non_controllato: 'NON ANCORA CONTROLLATO',
};

const COLORE_STATO: Record<StatoControllo, string> = {
  ok: '#1a7f37',
  da_sistemare: '#b42318',
  non_applicabile: '#555555',
  non_controllato: '#555555',
};

function htmlControllo(c: ControlloRiepilogo): string {
  const ora = c.ora ? `ore ${formattaOraRoma(c.ora)}` : 'non eseguito';
  const dettaglio = c.dettaglio.length
    ? `<ul>${c.dettaglio.map((riga) => `<li>${escapeHtml(riga)}</li>`).join('')}</ul>`
    : '';
  const motivo = c.motivo ? `<p>Motivo: ${escapeHtml(c.motivo)}.</p>` : '';
  const azione = c.azione ? `<p><strong>Cosa fare:</strong> ${escapeHtml(c.azione)}</p>` : '';
  return (
    `<h3>${escapeHtml(c.nome)} — ` +
    `<span style="color:${COLORE_STATO[c.stato]}">${ETICHETTA_STATO[c.stato]}</span> ` +
    `<small>(${ora})</small></h3>${dettaglio}${motivo}${azione}`
  );
}

// Corpo HTML dell'email: tutti i controlli, sempre. Nomi, sezioni ed email
// sono dati liberi e vanno escapati (issue #220).
export function htmlRiepilogoAllarmi(controlli: ControlloRiepilogo[], oggi: string): string {
  return (
    `<p>Riepilogo dei controlli di ${escapeHtml(formattaDataItaliana(oggi))}. ` +
    `Per ogni controllo sono indicati l'ora in cui è stato fatto e lo stato.</p>` +
    controlli.map(htmlControllo).join('')
  );
}
