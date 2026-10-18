// Schede generiche di una pagina (specs/63 "Azioni", specs/64 "Calendario
// attività", issue #325 e #328). La scheda attiva sta nell'indirizzo
// (`?scheda=...`), così la pagina si disegna sul server e vale anche con
// "ricarica" e con il link diretto. Ogni pagina definisce le sue schede
// (`Scheda[]`, la prima è quella iniziale) e usa `components/Schede.tsx`.
export type Scheda<Id extends string = string> = { id: Id; etichetta: string; href: string };

// Identificativi per collegare le schede al pannello (ARIA).
export const ID_PANNELLO_SCHEDE = 'pannello-schede';

export function idTabScheda(id: string): string {
  return `scheda-${id}`;
}

// Scheda scelta dai parametri dell'indirizzo; un valore assente o sconosciuto
// dà la scheda iniziale (la prima).
export function schedaDaParametri<Id extends string>(
  parametri: Record<string, string | string[] | undefined>,
  schede: readonly [Scheda<Id>, ...Scheda<Id>[]]
): Id {
  const grezzo = parametri.scheda;
  const valore = Array.isArray(grezzo) ? grezzo[0] : grezzo;
  return schede.find((s) => s.id === valore)?.id ?? schede[0].id;
}

// Indice della scheda raggiunta con un tasto (frecce sinistra/destra circolari,
// Home, Fine); null per qualunque altro tasto.
export function indiceDaTasto(tasto: string, corrente: number, quante: number): number | null {
  switch (tasto) {
    case 'ArrowRight':
      return (corrente + 1) % quante;
    case 'ArrowLeft':
      return (corrente - 1 + quante) % quante;
    case 'Home':
      return 0;
    case 'End':
      return quante - 1;
    default:
      return null;
  }
}
