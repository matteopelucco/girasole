import type { ReactNode } from 'react';

// Card con titolo attorno agli specchietti riassuntivi (Presenze/Pasti,
// sia aggregati su tutte le classi sia della singola classe — specs/12,
// specs/13, specs/14), stesso stile card già usato altrove (es. le
// sezioni del Report, app/dashboard/report/page.tsx).
export function CardRiepilogo({ titolo, children }: { titolo: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-white p-3 shadow-xs">
      <h2 className="mb-2 text-sm font-semibold text-stone-800 wrap-anywhere">{titolo}</h2>
      {children}
    </div>
  );
}
