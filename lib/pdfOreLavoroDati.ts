import { formattaDataCorta, formattaIntervalloItaliano, lunediSettimana, sommaGiorni } from '@/lib/date';
import { ETICHETTE_STATO_ORE_LAVORO, formattaOreConSegno } from '@/lib/oreLavoro';
import { riepilogoMeseOreLavoro, type RigaMeseOreLavoro } from '@/lib/oreLavoroMese';
import { nomeFilePdfOreLavoroMensile, type PersonaPdfOreLavoro } from '@/lib/pdfOreLavoro';

// Dalla vista mensile di una persona (le stesse righe della pagina
// `/dashboard/ore-lavoro/mese`, lib/oreLavoroMese.ts) alla pagina del PDF
// mensile (specs/52, specs/18): logica pura, nessun I/O. Il PDF del
// personale, quello del singolo dipendente e l'allegato del cron passano
// tutti da qui, quindi la pagina di una persona è identica nei tre casi.

const NESSUNA_ORA = '-';

function ore(valore: number): string {
  return `${valore}h`;
}

export function personaPdfOreLavoro({
  nome,
  profiloOrarioNome,
  profiloOrarioDettaglio,
  righe,
  settimane,
  saldoAttuale,
}: {
  nome: string;
  profiloOrarioNome: string | null;
  profiloOrarioDettaglio: string | null;
  righe: RigaMeseOreLavoro[];
  // Lunedì delle settimane che toccano il mese, con lo stato di conferma.
  settimane: { lunedi: string; confermata: boolean }[];
  saldoAttuale: number;
}): PersonaPdfOreLavoro {
  const confermatePerLunedi = new Map(settimane.map((s) => [s.lunedi, s.confermata]));
  const riepilogo = riepilogoMeseOreLavoro(righe);

  return {
    nome,
    profiloOrarioNome,
    profiloOrarioDettaglio,
    riepilogo: {
      oreDovute: riepilogo.orePreviste,
      oreErogate: riepilogo.orePreviste + riepilogo.differenza,
      differenza: riepilogo.differenza,
    },
    settimane: settimane.map((s) => ({
      intervallo: formattaIntervalloItaliano(s.lunedi, sommaGiorni(s.lunedi, 6)),
      confermata: s.confermata,
    })),
    giorni: righe.map((r) => {
      const lavorativo = r.stato === 'lavorativo';
      const daConfermare = confermatePerLunedi.get(lunediSettimana(r.data)) === false;
      const etichetta = ETICHETTE_STATO_ORE_LAVORO[r.stato] ?? r.stato;
      return {
        data: formattaDataCorta(r.data),
        stato: daConfermare ? `${etichetta} (da confermare)` : etichetta,
        oreDovute: lavorativo ? ore(r.orePreviste) : NESSUNA_ORA,
        oreErogate: lavorativo && r.conteggiato ? ore(r.oreErogate) : NESSUNA_ORA,
        differenza: lavorativo && r.conteggiato ? `${formattaOreConSegno(r.differenza)}h` : NESSUNA_ORA,
        commento: r.dettaglio,
      };
    }),
    saldoAttuale,
  };
}

// Nome del file del PDF di un singolo dipendente: quello del personale più
// "cognome-nome" in minuscolo, senza accenti né simboli (sicuro per il
// download). Senza un nome utilizzabile resta il nome del PDF del personale.
export function nomeFilePdfOreLavoroPersona(mese: string, cognome: string, nome: string): string {
  const base = nomeFilePdfOreLavoroMensile(mese);
  const parte = `${cognome} ${nome}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return parte ? base.replace(/[.]pdf$/, `-${parte}.pdf`) : base;
}
