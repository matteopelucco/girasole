import { escapeHtml } from '@/lib/htmlEscape';
import { sostituisciPlaceholder } from '@/lib/comunicazioneRetta';
import { isGiornoChiuso, type GiornoChiusura } from '@/lib/calendarioScolastico';
import { formattaMeseItaliano, giorniInRange, primoGiornoMese, ultimoGiornoMese } from '@/lib/date';

// Mail mensile dei pasti a Rojac (specs/61 - email-pasti-rojac.md):
// funzioni pure, nessun I/O — chi chiama (la pagina Report, l'azione di
// invio) ha già letto pasti comunicati, chiusure e modello.

// Ogni giorno di scuola l'asilo chiede a Rojac 2 pasti in più, per le
// insegnanti (specs/61): un solo punto da cambiare se il numero varia.
export const PASTI_INSEGNANTI_AL_GIORNO = 2;

export type RiepilogoMensileRojac = {
  mese: string;
  pastiBambini: number;
  giorniScuola: number;
  pastiInsegnanti: number;
  totalePasti: number;
};

// Mese "YYYY-MM" ammesso per l'invio: valido, corrente o passato (mai
// futuro, specs/61 "Regole").
export function meseInviabileRojac(mese: string, meseCorrente: string): boolean {
  return /^\d{4}-\d{2}$/.test(mese) && mese <= meseCorrente;
}

// Giorni di scuola di un mese: né weekend né chiusura registrata. Nel
// mese corrente solo fino a oggi compreso (il mese non è finito: stesso
// criterio "a tutt'oggi" del report mensile, specs/52); un mese futuro
// non ne ha nessuno. Non dipende da quali giorni hanno una comunicazione
// pasti.
export function giorniScuolaMese(mese: string, chiusure: GiornoChiusura[], oggiData: string): number {
  const fine = ultimoGiornoMese(mese);
  const ultimo = oggiData < fine ? oggiData : fine;
  const inizio = primoGiornoMese(mese);
  if (ultimo < inizio) return 0;
  return giorniInRange(inizio, ultimo).filter((data) => !isGiornoChiuso(data, chiusure)).length;
}

export function riepilogoMensileRojac({
  mese,
  pastiBambini,
  chiusure,
  oggiData,
}: {
  mese: string;
  pastiBambini: number;
  chiusure: GiornoChiusura[];
  oggiData: string;
}): RiepilogoMensileRojac {
  const giorniScuola = giorniScuolaMese(mese, chiusure, oggiData);
  const pastiInsegnanti = giorniScuola * PASTI_INSEGNANTI_AL_GIORNO;
  return { mese, pastiBambini, giorniScuola, pastiInsegnanti, totalePasti: pastiBambini + pastiInsegnanti };
}

// Oggetto e corpo della mail: segnaposto sostituiti. `testo` è il corpo
// semplice (per l'anteprima a schermo); `html` è lo stesso testo escapato
// una volta sola (il modello è testo, non markup) con gli a capo come <br>
// (per l'invio). L'oggetto resta testo semplice.
export function componiEmailRojac(
  template: { oggetto: string; corpo: string },
  riepilogo: RiepilogoMensileRojac
): { oggetto: string; testo: string; html: string } {
  const valori = {
    mese: formattaMeseItaliano(riepilogo.mese),
    pasti_bambini: String(riepilogo.pastiBambini),
    pasti_insegnanti: String(riepilogo.pastiInsegnanti),
    giorni_scuola: String(riepilogo.giorniScuola),
    totale_pasti: String(riepilogo.totalePasti),
  };
  const testo = sostituisciPlaceholder(template.corpo, valori);
  return {
    oggetto: sostituisciPlaceholder(template.oggetto, valori),
    testo,
    html: escapeHtml(testo).replace(/\n/g, '<br>'),
  };
}
