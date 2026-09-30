import { rgb } from 'pdf-lib';
import {
  MARGINE,
  ALTEZZA_RIGA,
  DIMENSIONE_TESTO,
  larghezzeColonnePesate,
  disegnaRiga,
  creaDocumentoPdf,
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
  // Situazione completa del monte ore (specs/19, specs/52): gestito a mano
  // dall'admin, il saldo è la somma dei movimenti.
  saldoAttuale: number;
  movimenti: MovimentoPdfMonteOre[];
  calcoloMensile: RigaCalcoloMensilePdf[];
};

export type MovimentoPdfMonteOre = { data: string; variazione: number; nota: string };

export type RigaCalcoloMensilePdf = {
  mese: string; // già formattato (es. "settembre 2026")
  orePreviste: number;
  differenza: number;
  movimenti: number;
  saldo: number;
};

// Colonna "Data" già in formato corto con giorno della settimana
// incluso (es. "lun 23/9/26", vedi lib/date.ts:formattaDataCorta): non
// serve più una colonna "Giorno" separata, che spaginava la tabella
// (la data per esteso "martedì 1 settembre 2026" non entrava nella sua
// colonna e sconfinava nella successiva).
const INTESTAZIONI = ['Data', 'Stato', 'Ore dovute', 'Ore ord.', 'Ore straord.', 'Delta', 'Dettaglio'];
const PESI_COLONNE = [1.2, 1.1, 1.2, 1.0, 1.3, 0.9, 3.5];
const INTESTAZIONI_MOVIMENTI = ['Data', 'Variazione', 'Nota'];
const PESI_MOVIMENTI = [1.4, 1.2, 6];
const INTESTAZIONI_CALCOLO = ['Mese', 'Ore previste', 'Differenza', 'Movimenti', 'Saldo'];
const PESI_CALCOLO = [2, 1.3, 1.3, 1.3, 1.1];

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
  const larghezze = larghezzeColonnePesate(PESI_COLONNE);
  const larghezzeMovimenti = larghezzeColonnePesate(PESI_MOVIMENTI);
  const larghezzeCalcolo = larghezzeColonnePesate(PESI_CALCOLO);

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

    // Monte ore: situazione completa (gestito a mano dall'admin).
    g.nuovaPaginaSeServe(3);
    g.pagina.drawText('Monte ore', { x: MARGINE, y: g.y, size: 12, font: fontGrassetto });
    g.y -= ALTEZZA_RIGA + 2;
    g.pagina.drawText(`Saldo attuale: ${persona.saldoAttuale}h (gestito a mano dall'admin)`, {
      x: MARGINE,
      y: g.y,
      size: DIMENSIONE_TESTO,
      font: fontGrassetto,
    });
    g.y -= ALTEZZA_RIGA + 4;

    g.pagina.drawText('Movimenti', { x: MARGINE, y: g.y, size: DIMENSIONE_TESTO, font: fontGrassetto });
    g.y -= ALTEZZA_RIGA;
    if (!persona.movimenti.length) {
      g.pagina.drawText('Nessun movimento registrato.', { x: MARGINE, y: g.y, size: DIMENSIONE_TESTO, font });
      g.y -= ALTEZZA_RIGA;
    } else {
      disegnaRiga(g.pagina, font, fontGrassetto, INTESTAZIONI_MOVIMENTI, larghezzeMovimenti, g.y, true);
      g.y -= ALTEZZA_RIGA;
      for (const movimento of persona.movimenti) {
        g.nuovaPaginaSeServe(1);
        disegnaRiga(
          g.pagina,
          font,
          fontGrassetto,
          [movimento.data, `${formattaOreConSegno(movimento.variazione)}h`, movimento.nota],
          larghezzeMovimenti,
          g.y,
          false
        );
        g.y -= ALTEZZA_RIGA;
      }
    }
    g.y -= 6;

    g.nuovaPaginaSeServe(3);
    g.pagina.drawText('Calcolo mese per mese', { x: MARGINE, y: g.y, size: DIMENSIONE_TESTO, font: fontGrassetto });
    g.y -= ALTEZZA_RIGA;
    if (!persona.calcoloMensile.length) {
      g.pagina.drawText('Nessun dato.', { x: MARGINE, y: g.y, size: DIMENSIONE_TESTO, font });
      g.y -= ALTEZZA_RIGA;
    } else {
      disegnaRiga(g.pagina, font, fontGrassetto, INTESTAZIONI_CALCOLO, larghezzeCalcolo, g.y, true);
      g.y -= ALTEZZA_RIGA;
      for (const riga of persona.calcoloMensile) {
        g.nuovaPaginaSeServe(1);
        disegnaRiga(
          g.pagina,
          font,
          fontGrassetto,
          [
            riga.mese,
            `${riga.orePreviste}h`,
            `${formattaOreConSegno(riga.differenza)}h`,
            `${formattaOreConSegno(riga.movimenti)}h`,
            `${riga.saldo}h`,
          ],
          larghezzeCalcolo,
          g.y,
          false
        );
        g.y -= ALTEZZA_RIGA;
      }
    }
  });

  return doc.save();
}
