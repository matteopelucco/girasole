import { formattaMeseItaliano } from '@/lib/date';
import { formattaOreConSegno } from '@/lib/oreLavoro';
import type { RigaCalcoloMensileMonteOre } from '@/lib/monteOreMensile';

// Calcolo completo del monte ore "mese per mese" (specs/19): ore previste,
// differenza (fatte in più/in meno rispetto al previsto), movimenti
// registrati dall'admin nel mese e saldo a fine mese. Informativo: il
// saldo è solo la somma dei movimenti manuali. Visibile al diretto
// interessato e all'admin, sempre completo (non dipende dalla settimana
// mostrata). Server Component, nessuno stato.
export function CalcoloMensileMonteOre({ righe }: { righe: RigaCalcoloMensileMonteOre[] }) {
  if (!righe.length) return null;
  return (
    <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
      <table className="w-full text-left text-sm text-stone-700">
        <caption className="mb-2 text-left font-medium text-stone-800">Calcolo mese per mese</caption>
        <thead>
          <tr className="border-b border-stone-200 text-xs text-stone-600">
            <th scope="col" className="py-1 pr-3 font-medium">
              Mese
            </th>
            <th scope="col" className="py-1 pr-3 text-right font-medium">
              Ore previste
            </th>
            <th scope="col" className="py-1 pr-3 text-right font-medium">
              Differenza ore
            </th>
            <th scope="col" className="py-1 pr-3 text-right font-medium">
              Movimenti
            </th>
            <th scope="col" className="py-1 text-right font-medium">
              Saldo
            </th>
          </tr>
        </thead>
        <tbody>
          {righe.map((r) => (
            <tr key={r.mese} className="border-b border-stone-100 last:border-0">
              <th scope="row" className="py-1 pr-3 font-normal capitalize">
                {formattaMeseItaliano(r.mese)}
              </th>
              <td className="py-1 pr-3 text-right">{r.orePreviste}h</td>
              <td className="py-1 pr-3 text-right">{formattaOreConSegno(r.differenza)}h</td>
              <td className="py-1 pr-3 text-right">{formattaOreConSegno(r.movimenti)}h</td>
              <td className="py-1 text-right font-medium">{r.saldo}h</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
