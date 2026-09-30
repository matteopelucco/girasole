import { giorniInRange, lunediSettimana, meseDaData, primoGiornoMese, ultimoGiornoMese } from '@/lib/date';
import type { GiornoChiusura } from '@/lib/calendarioScolastico';
import {
  arrotondaAQuartiDora,
  differenzaGiornoOreLavoro,
  oreOrdinariePreviste,
  statoPredefinitoGiornoOreLavoro,
  type StatoGiornoOreLavoro,
} from '@/lib/oreLavoro';
import { riepilogoSettimanaDaDifferenze, type RiepilogoSettimanaOreLavoro } from '@/lib/monteOre';
import type { ProfiloOrario } from '@/lib/profiliOrari';

// Vista mensile dell'admin sulle ore di un dipendente (specs/18): logica
// pura, nessun I/O — le query stanno nella pagina.

// Mese da mostrare (specs/18): `richiesta` ('AAAA-MM', query string
// `?mese=`) se è un mese valido e non nel futuro rispetto a `oggiData`,
// altrimenti il mese corrente. Funzione pura.
export function meseOreLavoroRichiesto(richiesta: string | undefined, oggiData: string): string {
  const corrente = meseDaData(oggiData);
  if (!richiesta || !/^\d{4}-(0[1-9]|1[0-2])$/.test(richiesta)) return corrente;
  return richiesta > corrente ? corrente : richiesta;
}

// Lunedì delle settimane che toccano il mese, in ordine (per il rimando
// alla vista settimanale e lo stato di conferma di ciascuna).
export function settimaneDelMese(mese: string): string[] {
  const settimane = new Set<string>();
  for (const data of giorniInRange(primoGiornoMese(mese), ultimoGiornoMese(mese))) {
    settimane.add(lunediSettimana(data));
  }
  return [...settimane];
}

// Riga di `ore_lavoro_giorni` come letta dal database (numeric può
// arrivare come stringa via PostgREST).
export type GiornoSalvatoOreLavoro = {
  data: string;
  stato: string;
  ore_ordinarie: number | string;
  ore_straordinarie: number | string;
  motivo_straordinario: string | null;
  codice_malattia: string | null;
  nota_assenza: string | null;
};

export type RigaMeseOreLavoro = {
  data: string;
  stato: StatoGiornoOreLavoro;
  orePreviste: number;
  oreErogate: number;
  // Ore in più (+) o in meno (−) rispetto al previsto: 0 per gli stati non
  // lavorativi (malattia/assenza/chiusura/ferie).
  differenza: number;
  // Motivo della differenza, codice malattia o nota di assenza.
  dettaglio: string;
  // true se il giorno è lavorativo e già trascorso (entra nei totali).
  conteggiato: boolean;
  // false se è un valore predefinito, non ancora salvato.
  salvato: boolean;
};

// Una riga per ogni giorno del mese (specs/18): valori salvati, oppure
// quelli predefiniti (Chiusura per i giorni di chiusura, altrimenti
// lavorativo con le ore previste e differenza 0). Funzione pura.
export function righeMeseOreLavoro({
  mese,
  oggiData,
  salvati,
  profiloOrario,
  chiusure,
}: {
  mese: string;
  oggiData: string;
  salvati: GiornoSalvatoOreLavoro[];
  profiloOrario: ProfiloOrario | null | undefined;
  chiusure: GiornoChiusura[];
}): RigaMeseOreLavoro[] {
  const perData = new Map(salvati.map((g) => [g.data, g]));
  return giorniInRange(primoGiornoMese(mese), ultimoGiornoMese(mese)).map((data) => {
    const g = perData.get(data);
    const stato = (g?.stato ?? statoPredefinitoGiornoOreLavoro(data, chiusure)) as StatoGiornoOreLavoro;
    const orePreviste = oreOrdinariePreviste(profiloOrario, data);
    const lavorativo = stato === 'lavorativo';

    let oreErogate = 0;
    let differenza = 0;
    if (lavorativo) {
      if (g) {
        const ordinarie = Number(g.ore_ordinarie);
        const straordinarie = Number(g.ore_straordinarie);
        oreErogate = ordinarie + straordinarie;
        differenza = arrotondaAQuartiDora(differenzaGiornoOreLavoro(orePreviste, ordinarie, straordinarie));
      } else {
        oreErogate = orePreviste;
      }
    }

    let dettaglio = '';
    if (lavorativo && differenza !== 0) dettaglio = g?.motivo_straordinario ?? '';
    else if (stato === 'malattia') dettaglio = g?.codice_malattia ? `Codice: ${g.codice_malattia}` : '';
    else if (stato === 'assenza') dettaglio = g?.nota_assenza ? `Nota: ${g.nota_assenza}` : '';

    return {
      data,
      stato,
      orePreviste,
      oreErogate,
      differenza,
      dettaglio,
      conteggiato: lavorativo && data <= oggiData,
      salvato: !!g,
    };
  });
}

// Totali del mese (specs/18): stessa regola della vista settimanale sui
// soli giorni lavorativi già trascorsi. Funzione pura.
export function riepilogoMeseOreLavoro(righe: RigaMeseOreLavoro[]): RiepilogoSettimanaOreLavoro {
  return riepilogoSettimanaDaDifferenze(
    righe.map((r) => ({
      stato: r.conteggiato ? 'lavorativo' : 'non-conteggiato',
      orePreviste: r.orePreviste,
      differenza: r.differenza,
    }))
  );
}
