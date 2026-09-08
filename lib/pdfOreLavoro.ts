import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import {
  MARGINE,
  ALTEZZA_RIGA,
  DIMENSIONE_TESTO,
  larghezzeColonnePesate,
  disegnaRiga,
  creaGestorePagine,
} from '@/lib/pdfReport';
import { formattaOreConSegno } from '@/lib/oreLavoro';

// PDF mensile delle ore di lavoro del personale (specs/52 -
// report-email-automatico.md, specs/19 - monte-ore.md): una pagina per
// persona abilitata al report ore, con il dettaglio giorno per giorno
// delle sole settimane di quel mese già confermate (specs/18). Nessun
// I/O qui: chi chiama (lib/reportOreLavoro.ts) ha già preparato i dati,
// stesso principio di lib/pdfReport.ts — riusa i suoi primitivi di
// disegno invece di duplicarli (CLAUDE.md, jscpd).

export type GiornoPdfOreLavoro = {
  data: string;
  stato: string;
  oreDovute: string;
  oreOrdinarie: string;
  oreStraordinarie: string;
  delta: string;
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

// Colonna "Data" già in formato corto con giorno della settimana
// incluso (es. "lun 23/9/26", vedi lib/date.ts:formattaDataCorta): non
// serve più una colonna "Giorno" separata, che spaginava la tabella
// (la data per esteso "martedì 1 settembre 2026" non entrava nella sua
// colonna e sconfinava nella successiva).
const INTESTAZIONI = ['Data', 'Stato', 'Ore dovute', 'Ore ord.', 'Ore straord.', 'Delta', 'Dettaglio'];
const PESI_COLONNE = [1.2, 1.1, 1.2, 1.0, 1.3, 0.9, 3.5];

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
          [giorno.data, giorno.stato, giorno.oreDovute, giorno.oreOrdinarie, giorno.oreStraordinarie, giorno.delta, giorno.dettaglio],
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
    g.pagina.drawText(
      `Variazione del mese: ${formattaOreConSegno(persona.variazioneMese)}h — Saldo attuale: ${persona.saldoAttuale}h`,
      { x: MARGINE, y: g.y, size: DIMENSIONE_TESTO, font }
    );
  });

  return doc.save();
}
