// Riepilogo numerico in cima all'elenco bambini di una classe (specs/13
// - segna-presenza.md, specs/14 - segna-pasto.md), es. "Presenti: 8/12".
// Con `denominatore` omesso mostra solo il numeratore (es. "Pre-asilo: 3",
// specs/13 - scenario "riepilogo presenze della classe"), dove un
// rapporto su un totale non avrebbe senso.
export function RiepilogoConteggio({
  etichetta,
  numeratore,
  denominatore,
}: {
  etichetta: string;
  numeratore: number;
  denominatore?: number;
}) {
  return (
    <p className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900">
      {etichetta}: {numeratore}
      {denominatore !== undefined && `/${denominatore}`}
    </p>
  );
}
