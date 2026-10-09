import { descrizioneBambinoRetta, type BambinoRetta } from './allarmeRette';
import { allarmePersonalePresenzePastiAttivo, type AllarmeDipendente, type StatoPersonaleGiorno } from './allarmi';
import { formattaIntervalloItaliano } from './date';
import { percorsoGiornata } from './giornata';

// Elenco unico degli allarmi attivi di chi guarda (specs/07 - allarmi.md):
// alimenta sia il numero accanto alla campanella sia la pagina "Allarmi",
// così coincidono per costruzione. Logica pura, nessun I/O: i dati li
// carica lib/allarmiDati.ts. Per aggiungere un nuovo tipo di allarme
// (es. rette, Rojac) basta aggiungere un campo a InputElencoAllarmi e una
// voce in componiAllarmi.

export type VoceAllarme = {
  testo: string;
  // Assente nelle righe del personale: sono solo informative (specs/07).
  href?: string;
};

export type Allarme = {
  id: string;
  // 'proprio': riguarda me e ha i link per sistemarlo; 'personale': riga
  // informativa su un collega, solo per l'admin, senza link.
  tipo: 'proprio' | 'personale';
  titolo: string;
  voci: VoceAllarme[];
};

export type SettimanaOre = { inizio: string; fine: string };

export type InputElencoAllarmi = {
  oggi: string;
  adesso: Date;
  giornoAttivo: boolean;
  statoPersonale: StatoPersonaleGiorno;
  // La settimana di riferimento se NON è confermata, altrimenti null.
  settimanaOreNonConfermata: SettimanaOre | null;
  // Solo per l'admin; vuoto per gli altri.
  personale: AllarmeDipendente[];
  // Bambini a cui manca la comunicazione della retta del mese (specs/07):
  // solo per l'admin e solo dal giorno 3; vuoto per gli altri.
  retteNonComunicate: BambinoRetta[];
};

function vociPersonale(allarme: AllarmeDipendente): VoceAllarme[] {
  const voci = allarme.sezioniPresenzeIncomplete.map((nome) => ({ testo: `presenze non segnate (${nome})` }));
  if (allarme.pastiNonConfermati) voci.push({ testo: 'pasti non comunicati' });
  if (allarme.settimanaOreNonConfermata) {
    const { inizio, fine } = allarme.settimanaOreNonConfermata;
    voci.push({ testo: `settimana ore ${formattaIntervalloItaliano(inizio, fine)} non confermata` });
  }
  return voci;
}

export function componiAllarmi(input: InputElencoAllarmi): Allarme[] {
  const elenco: Allarme[] = [];

  if (allarmePersonalePresenzePastiAttivo(input.adesso, input.giornoAttivo, input.statoPersonale)) {
    const voci: VoceAllarme[] = input.statoPersonale.sezioniPresenzeIncomplete.map((sezione) => ({
      testo: `Presenze — ${sezione.nome}`,
      href: percorsoGiornata(input.oggi),
    }));
    if (input.statoPersonale.pastiNonConfermati) {
      voci.push({
        testo: 'Comunicare i pasti a Rojac',
        href: `${percorsoGiornata(input.oggi)}#comunicazione-rojac`,
      });
    }
    elenco.push({ id: 'presenze-pasti', tipo: 'proprio', titolo: 'Presenze e pasti di oggi da completare', voci });
  }

  if (input.settimanaOreNonConfermata) {
    const { inizio, fine } = input.settimanaOreNonConfermata;
    elenco.push({
      id: 'settimana-ore',
      tipo: 'proprio',
      titolo: 'Ore di lavoro della settimana non confermate',
      voci: [
        {
          testo: `Settimana ${formattaIntervalloItaliano(inizio, fine)}: vai su Ore di lavoro per confermarla`,
          href: `/dashboard/ore-lavoro?settimana=${inizio}`,
        },
      ],
    });
  }

  if (input.retteNonComunicate.length > 0) {
    const quanti = input.retteNonComunicate.length;
    elenco.push({
      id: 'rette-non-comunicate',
      tipo: 'proprio',
      titolo: 'Comunicazioni delle rette non inviate',
      voci: [
        {
          testo: `${quanti === 1 ? 'Manca 1 comunicazione' : `Mancano ${quanti} comunicazioni`}: vai su Rette per inviarle`,
          href: '/admin/rette',
        },
        ...input.retteNonComunicate.map((bambino) => ({ testo: descrizioneBambinoRetta(bambino) })),
      ],
    });
  }

  for (const dipendente of input.personale) {
    elenco.push({
      id: `personale-${dipendente.utenteId}`,
      tipo: 'personale',
      titolo: `${dipendente.nome} ${dipendente.cognome}`,
      voci: vociPersonale(dipendente),
    });
  }

  return elenco;
}

// Testo per lo screen reader accanto alla campanella (specs/07).
export function testoNumeroAllarmi(numero: number): string {
  if (numero === 0) return 'Nessun allarme';
  return numero === 1 ? '1 allarme' : `${numero} allarmi`;
}
