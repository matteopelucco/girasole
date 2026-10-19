import Link from 'next/link';
import { chiusuraInCorso, formattaPeriodoChiusura, type GiornoChiusura } from '@/lib/calendarioScolastico';

// Lista dei giorni di chiusura (specs/64 e specs/53, issue #328): un solo
// componente per la scheda "Giorni di chiusura" di "Calendario attività" e per
// la pagina "Giorni di chiusura" dell'admin, con due modi:
// - `lettura`: sola lettura, ogni giorno è una scheda semplice (la pagina passa
//   solo le chiusure in corso o future);
// - `gestione`: ogni giorno è un link alla sua pagina di modifica, con il
//   rimando "Modifica" (la pagina passa tutte le chiusure).
// Il componente non legge il database: riceve le righe già caricate. Le
// chiusure restano separate dagli eventi di Google (specs/64, regola di
// separazione).
export type ModoElencoChiusure = 'lettura' | 'gestione';

const CLASSI_SCHEDA =
  'flex items-center justify-between gap-3 rounded-xl border border-stone-200 border-l-4 border-l-rose-400 bg-white px-3 py-2.5 shadow-xs';

export function ElencoChiusure({
  chiusure,
  oggi,
  modo,
}: {
  chiusure: GiornoChiusura[];
  oggi: string;
  modo: ModoElencoChiusure;
}) {
  if (chiusure.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-stone-300 bg-white px-4 py-3 text-sm text-stone-700">
        {modo === 'gestione' ? 'Nessun giorno di chiusura ancora inserito.' : 'Nessun giorno di chiusura in programma.'}
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {chiusure.map((chiusura) => {
        const contenuto = (
          <>
            <div className="min-w-0">
              <p className="font-medium text-stone-900">
                {formattaPeriodoChiusura(chiusura.dataInizio, chiusura.dataFine)}
              </p>
              {chiusura.nota && <p className="text-sm text-stone-600 wrap-anywhere">{chiusura.nota}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {chiusuraInCorso(chiusura, oggi) && (
                <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-900">
                  In corso
                </span>
              )}
              {modo === 'gestione' && <span className="text-xs text-stone-600">Modifica</span>}
            </div>
          </>
        );

        return (
          <li key={chiusura.id} data-testid="chiusura">
            {modo === 'gestione' ? (
              <Link href={`/admin/calendario/${chiusura.id}`} className={`${CLASSI_SCHEDA} hover:bg-stone-50`}>
                {contenuto}
              </Link>
            ) : (
              <div className={CLASSI_SCHEDA}>{contenuto}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
