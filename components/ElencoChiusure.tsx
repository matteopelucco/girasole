import Link from 'next/link';
import { EtichettaPillola } from '@/components/ui/etichetta-pillola';
import { Riquadro, riquadroVariants } from '@/components/ui/riquadro';
import { StatoVuoto } from '@/components/ui/stato-vuoto';
import { cn } from '@/lib/utils';
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

const CLASSI_SCHEDA = 'flex items-center justify-between gap-3 px-3 py-2.5';

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
      <StatoVuoto>
        {modo === 'gestione' ? 'Nessun giorno di chiusura ancora inserito.' : 'Nessun giorno di chiusura in programma.'}
      </StatoVuoto>
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
                <EtichettaPillola tono="neutro">In corso</EtichettaPillola>
              )}
              {modo === 'gestione' && <span className="text-xs text-stone-600">Modifica</span>}
            </div>
          </>
        );

        return (
          <li key={chiusura.id} data-testid="chiusura">
            {modo === 'gestione' ? (
              <Link
                href={`/admin/calendario/${chiusura.id}`}
                className={cn(riquadroVariants({ accento: 'neutro' }), CLASSI_SCHEDA, 'hover:bg-stone-50')}
              >
                {contenuto}
              </Link>
            ) : (
              <Riquadro accento="neutro" className={CLASSI_SCHEDA}>
                {contenuto}
              </Riquadro>
            )}
          </li>
        );
      })}
    </ul>
  );
}
