import { Tabella, TabellaCella, TabellaCorpo, TabellaIntestazione, TabellaRiga, TabellaTitolo } from '@/components/ui/tabella';
import { Riquadro } from '@/components/ui/riquadro';
import { formattaMeseItaliano } from '@/lib/date';
import { formattaOreConSegno } from '@/lib/oreLavoro';
import { saldoMonteOreBreve } from '@/lib/monteOre';
import { parteNonConfermata, type RigaCalcoloMensileMonteOre } from '@/lib/monteOreMensile';
import { ConfermaMeseMonteOre } from '@/components/ConfermaMeseMonteOre';
import type { EsitoAzione } from '@/components/FormConEsito';

// Calcolo completo del monte ore "mese per mese" (specs/19): ore previste,
// differenza (fatte in più/in meno rispetto al previsto), movimenti
// registrati dall'admin nel mese e saldo a fine mese. Informativo: il
// saldo è solo la somma dei movimenti manuali. Visibile al diretto
// interessato e all'admin, sempre completo (non dipende dalla settimana
// mostrata. Solo all'admin, sui mesi chiusi, la riga propone "Conferma"
// (specs/19, MOR-01): `conferma` è passata solo in quel caso.
export function CalcoloMensileMonteOre({
  righe,
  utenteId,
  meseCorrente,
  conferma,
}: {
  righe: RigaCalcoloMensileMonteOre[];
  utenteId?: string;
  meseCorrente?: string;
  conferma?: (statoPrecedente: EsitoAzione, formData: FormData) => Promise<EsitoAzione>;
}) {
  return (
    <Riquadro className="overflow-x-auto p-3">
      <h2 id="calcolo-mensile-titolo" className="mb-2 text-left font-medium text-stone-800">
        Calcolo mese per mese
      </h2>
      {!righe.length ? (
        <p className="text-sm text-stone-600">Nessun dato: non ci sono ancora ore registrate né movimenti.</p>
      ) : (
      <Tabella aria-labelledby="calcolo-mensile-titolo" className="text-left text-stone-700">
        <TabellaIntestazione>
          <TabellaRiga className="border-b border-border text-xs text-stone-600">
            <TabellaTitolo scope="col" className="py-1 pr-3 font-medium">
              Mese
            </TabellaTitolo>
            <TabellaTitolo allinea="destra" scope="col" className="py-1 pr-3 font-medium">
              Ore previste
            </TabellaTitolo>
            <TabellaTitolo allinea="destra" scope="col" className="py-1 pr-3 font-medium">
              Differenza ore
            </TabellaTitolo>
            <TabellaTitolo allinea="destra" scope="col" className="py-1 pr-3 font-medium">
              Movimenti (+ a credito / − da recuperare)
            </TabellaTitolo>
            <TabellaTitolo allinea="destra" scope="col" className="py-1 font-medium">
              Saldo a fine mese
            </TabellaTitolo>
          </TabellaRiga>
        </TabellaIntestazione>
        <TabellaCorpo>
          {righe.map((r) => (
            <TabellaRiga key={r.mese} className="border-b border-stone-100 last:border-0">
              <TabellaTitolo scope="row" className="py-1 pr-3 font-normal capitalize">
                {formattaMeseItaliano(r.mese)}
              </TabellaTitolo>
              <TabellaCella allinea="destra" className="py-1 pr-3">{r.orePreviste}h</TabellaCella>
              <TabellaCella allinea="destra" className="py-1 pr-3">
                {formattaOreConSegno(r.differenza)}h
                {conferma && utenteId && meseCorrente && r.mese < meseCorrente && (
                  <ConfermaMeseMonteOre
                    utenteId={utenteId}
                    mese={r.mese}
                    parte={parteNonConfermata(r)}
                    haMovimenti={r.movimenti !== 0}
                    conferma={conferma}
                  />
                )}
              </TabellaCella>
              <TabellaCella allinea="destra" className="py-1 pr-3">{formattaOreConSegno(r.movimenti)}h</TabellaCella>
              <TabellaCella allinea="destra" className="py-1 font-medium">{saldoMonteOreBreve(r.saldo)}</TabellaCella>
            </TabellaRiga>
          ))}
        </TabellaCorpo>
      </Tabella>
      )}
    </Riquadro>
  );
}
