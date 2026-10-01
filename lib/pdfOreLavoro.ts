import { rgb } from 'pdf-lib';
import {
  MARGINE,
  ALTEZZA_RIGA,
  DIMENSIONE_TESTO,
  LARGHEZZA_PAGINA,
  larghezzeColonnePesate,
  disegnaRiga,
  creaDocumentoPdf,
} from '@/lib/pdfReport';
import { formattaOreConSegno } from '@/lib/oreLavoro';
import { descrizioneSaldoMonteOre, LEGENDA_MONTE_ORE } from '@/lib/monteOre';

// PDF mensile delle ore di lavoro del personale (specs/52 -
// report-email-automatico.md, specs/19 - monte-ore.md, specs/18): una
// pagina (o più) per persona abilitata al report ore, con riepilogo del
// mese, prospetto delle settimane, elenco di tutti i giorni, totale e saldo
// del monte ore. Nessun I/O qui: chi chiama (lib/reportOreLavoro.ts) ha già
// preparato i dati con lib/pdfOreLavoroDati.ts, stesso principio di
// lib/pdfReport.ts — riusa i suoi primitivi di disegno invece di duplicarli
// (CLAUDE.md, jscpd).

export type GiornoPdfOreLavoro = {
  data: string;
  stato: string;
  // Già formattate ("7h", "+1h", oppure "-" se non si applicano).
  oreDovute: string;
  oreErogate: string;
  differenza: string;
  commento: string;
};

export type SettimanaPdfOreLavoro = { intervallo: string; confermata: boolean };

export type PersonaPdfOreLavoro = {
  nome: string;
  profiloOrarioNome: string | null;
  profiloOrarioDettaglio: string | null;
  // Totali del mese: stessa regola della vista mensile (lib/oreLavoroMese.ts).
  riepilogo: { oreDovute: number; oreErogate: number; differenza: number };
  settimane: SettimanaPdfOreLavoro[];
  giorni: GiornoPdfOreLavoro[];
  // Saldo attuale del monte ore, gestito a mano dall'admin (specs/19).
  saldoAttuale: number;
};

const INTESTAZIONI_RIEPILOGO = ['Ore dovute', 'Ore erogate', 'Differenza'];
const PESI_RIEPILOGO = [1, 1, 1];
const INTESTAZIONI_SETTIMANE = ['Settimana', 'Stato'];
const PESI_SETTIMANE = [3, 2];
const INTESTAZIONI_GIORNI = ['Giorno', 'Stato', 'Ore dovute', 'Ore erogate', 'Differenza', 'Commento'];
const PESI_GIORNI = [1.3, 1.9, 1, 1, 1, 3.6];

// Nome del file PDF mensile delle ore di lavoro: lo stesso per l'allegato
// del cron notturno e per il download dell'admin (specs/18, specs/52).
export function nomeFilePdfOreLavoroMensile(mese: string): string {
  return `ore-lavoro-${mese}.pdf`;
}

export async function generaPdfOreLavoroMensile(
  titoloMese: string,
  persone: PersonaPdfOreLavoro[],
  generatoIl: Date
): Promise<Uint8Array> {
  const { doc, font, fontGrassetto, g } = await creaDocumentoPdf(generatoIl);
  const larghezzaPagina = LARGHEZZA_PAGINA - MARGINE * 2;
  const larghezzeRiepilogo = larghezzeColonnePesate(PESI_RIEPILOGO);
  const larghezzeSettimane = larghezzeColonnePesate(PESI_SETTIMANE);
  const larghezzeGiorni = larghezzeColonnePesate(PESI_GIORNI);

  const titoloSezione = (testo: string) => {
    g.nuovaPaginaSeServe(3);
    g.pagina.drawText(testo, { x: MARGINE, y: g.y, size: DIMENSIONE_TESTO + 1, font: fontGrassetto });
    g.y -= ALTEZZA_RIGA;
  };

  // Nessuna persona abilitata: il PDF lo dice, invece di restare vuoto.
  if (!persone.length) {
    g.pagina.drawText(`Ore di lavoro — ${titoloMese}`, { x: MARGINE, y: g.y, size: 16, font: fontGrassetto });
    g.y -= 28;
    g.pagina.drawText('Nessun membro del personale è abilitato al report ore.', {
      x: MARGINE,
      y: g.y,
      size: DIMENSIONE_TESTO,
      font,
    });
  }

  persone.forEach((persona, indice) => {
    if (indice > 0) g.nuovaPagina();

    g.pagina.drawText(persona.nome, { x: MARGINE, y: g.y, size: 16, font: fontGrassetto, color: rgb(0, 0, 0) });
    g.y -= 22;
    g.pagina.drawText(`Ore di lavoro — ${titoloMese}`, { x: MARGINE, y: g.y, size: 11, font, color: rgb(0.3, 0.3, 0.3) });
    g.y -= 18;
    g.pagina.drawText(
      persona.profiloOrarioNome
        ? `Profilo orario: ${persona.profiloOrarioNome}${persona.profiloOrarioDettaglio ? ` (${persona.profiloOrarioDettaglio})` : ''}`
        : 'Nessun profilo orario assegnato',
      { x: MARGINE, y: g.y, size: DIMENSIONE_TESTO, font, color: rgb(0.3, 0.3, 0.3) }
    );
    g.y -= 24;

    const { riepilogo } = persona;
    const totali = [
      `${riepilogo.oreDovute}h`,
      `${riepilogo.oreErogate}h`,
      `${formattaOreConSegno(riepilogo.differenza)}h`,
    ];

    titoloSezione('Riepilogo del mese');
    disegnaRiga(g, font, fontGrassetto, INTESTAZIONI_RIEPILOGO, larghezzeRiepilogo, true);
    disegnaRiga(g, font, fontGrassetto, totali, larghezzeRiepilogo, false);
    g.y -= 8;

    titoloSezione('Settimane del mese');
    disegnaRiga(g, font, fontGrassetto, INTESTAZIONI_SETTIMANE, larghezzeSettimane, true);
    for (const settimana of persona.settimane) {
      disegnaRiga(
        g,
        font,
        fontGrassetto,
        [settimana.intervallo, settimana.confermata ? 'Confermata' : 'Da confermare'],
        larghezzeSettimane,
        false
      );
    }
    g.y -= 8;

    titoloSezione('Giorni del mese');
    disegnaRiga(g, font, fontGrassetto, INTESTAZIONI_GIORNI, larghezzeGiorni, true);
    for (const giorno of persona.giorni) {
      disegnaRiga(
        g,
        font,
        fontGrassetto,
        [giorno.data, giorno.stato, giorno.oreDovute, giorno.oreErogate, giorno.differenza, giorno.commento],
        larghezzeGiorni,
        false
      );
    }
    // Totale riassuntivo in fondo alla tabella, allineato alle sue colonne.
    disegnaRiga(g, font, fontGrassetto, ['Totale mese', '', ...totali, ''], larghezzeGiorni, true);
    g.y -= 8;

    // Monte ore: saldo attuale con la convenzione del segno (specs/19).
    titoloSezione('Monte ore');
    disegnaRiga(g, font, fontGrassetto, [`Saldo attuale: ${descrizioneSaldoMonteOre(persona.saldoAttuale)}`], [larghezzaPagina], true);
    disegnaRiga(g, font, fontGrassetto, [`${LEGENDA_MONTE_ORE} Gestito a mano dall'admin.`], [larghezzaPagina], false);
  });

  return doc.save();
}
