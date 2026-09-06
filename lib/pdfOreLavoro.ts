import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import {
  MARGINE,
  ALTEZZA_RIGA,
  DIMENSIONE_TESTO,
  larghezzeColonnePesate,
  disegnaRiga,
  creaGestorePagine,
} from '@/lib/pdfReport';

// PDF mensile delle ore di lavoro del personale (specs/52 -
// report-email-automatico.md, specs/19 - monte-ore.md): una pagina per
// persona abilitata al report ore, con il dettaglio giorno per giorno
// delle sole settimane di quel mese già confermate (specs/18). Nessun
// I/O qui: chi chiama (lib/reportOreLavoro.ts) ha già preparato i dati,
// stesso principio di lib/pdfReport.ts — riusa i suoi primitivi di
// disegno invece di duplicarli (CLAUDE.md, jscpd).

export type GiornoPdfOreLavoro = {
  data: string;
  giornoSettimana: string;
  stato: string;
  oreOrdinarie: string;
  oreStraordinarie: string;
  dettaglio: string;
};

export type PersonaPdfOreLavoro = {
  nome: string;
  profiloOrarioNome: string | null;
  profiloOrarioDettaglio: string | null;
  giorni: GiornoPdfOreLavoro[];
  settimaneNonConfermate: string[];
  variazioneMese: number;
  saldoAttuale: number;
};

const INTESTAZIONI = ['Data', 'Giorno', 'Stato', 'Ore ord.', 'Ore straord.', 'Dettaglio'];
const PESI_COLONNE = [1.3, 1.1, 1.1, 0.9, 0.9, 2.7];

export async function generaPdfOreLavoroMensile(
  titoloMese: string,
  persone: PersonaPdfOreLavoro[]
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontGrassetto = await doc.embedFont(StandardFonts.HelveticaBold);

  const g = creaGestorePagine(doc);
  const larghezze = larghezzeColonnePesate(PESI_COLONNE);

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

    if (!persona.giorni.length) {
      g.pagina.drawText('Nessuna settimana confermata in questo mese.', {
        x: MARGINE,
        y: g.y,
        size: DIMENSIONE_TESTO,
        font,
      });
      g.y -= ALTEZZA_RIGA + 8;
    } else {
      g.nuovaPaginaSeServe(1);
      disegnaRiga(g.pagina, font, fontGrassetto, INTESTAZIONI, larghezze, g.y, true);
      g.y -= ALTEZZA_RIGA;

      for (const giorno of persona.giorni) {
        g.nuovaPaginaSeServe(1);
        disegnaRiga(
          g.pagina,
          font,
          fontGrassetto,
          [giorno.data, giorno.giornoSettimana, giorno.stato, giorno.oreOrdinarie, giorno.oreStraordinarie, giorno.dettaglio],
          larghezze,
          g.y,
          false
        );
        g.y -= ALTEZZA_RIGA;
      }
      g.y -= 8;
    }

    if (persona.settimaneNonConfermate.length) {
      g.nuovaPaginaSeServe(1);
      g.pagina.drawText(
        `Settimane non ancora confermate, escluse: ${persona.settimaneNonConfermate.join(', ')}.`,
        { x: MARGINE, y: g.y, size: DIMENSIONE_TESTO, font, color: rgb(0.5, 0.3, 0) }
      );
      g.y -= ALTEZZA_RIGA + 8;
    }

    g.nuovaPaginaSeServe(2);
    g.pagina.drawText('Monte ore', { x: MARGINE, y: g.y, size: 12, font: fontGrassetto });
    g.y -= ALTEZZA_RIGA;
    const segno = persona.variazioneMese > 0 ? '+' : '';
    g.pagina.drawText(
      `Variazione del mese: ${segno}${persona.variazioneMese}h — Saldo attuale: ${persona.saldoAttuale}h`,
      { x: MARGINE, y: g.y, size: DIMENSIONE_TESTO, font }
    );
  });

  return doc.save();
}
