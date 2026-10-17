// Sagome di caricamento della pagina "Calendario" (specs/64): stessa altezza e
// stessa struttura dei contenuti veri, così quando arrivano i dati la pagina
// non salta. Il testo "Caricamento…" è per chi usa uno screen reader.

function Sagoma({ className }: { className: string }) {
  return <div aria-hidden className={`rounded-xl bg-stone-200 motion-safe:animate-pulse ${className}`} />;
}

export function ScheletroChiusure() {
  return (
    <div role="status" className="space-y-2">
      <span className="sr-only">Caricamento dei giorni di chiusura…</span>
      <Sagoma className="h-[60px]" />
      <Sagoma className="h-[60px]" />
    </div>
  );
}

export function ScheletroEventi() {
  return (
    <div role="status" className="space-y-5">
      <span className="sr-only">Caricamento degli eventi…</span>
      <Sagoma className="h-7 w-40" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-3">
          <Sagoma className="h-[60px] w-12 shrink-0" />
          <Sagoma className="h-[84px] flex-1" />
        </div>
      ))}
    </div>
  );
}
