import { CampoImporto, FormImporti, type StatoImporti } from './FormImporti';
import { PulsanteInvio } from './PulsanteInvio';
import { Avviso } from '@/components/ui/avviso';
import { riquadroVariants } from '@/components/ui/riquadro';
import { CAMPI_PREZZI, formattaImporto } from '@/lib/prezzi';
import type { PrezziLetti } from '@/lib/prezziDati';
import { cn } from '@/lib/utils';

// Sezione "Prezzi" di "Parametri di funzionamento" (specs/62, issue #396): gli
// otto prezzi predefiniti dell'asilo, usati solo per compilare i costi di un
// bambino nuovo. Non cambiano mai i bambini esistenti.
export function SezionePrezzi({
  letti,
  salva,
}: {
  // null = prezzi non leggibili: niente campi, per non far salvare valori inventati.
  letti: PrezziLetti | null;
  salva: (statoPrecedente: StatoImporti, formData: FormData) => Promise<StatoImporti>;
}) {
  return (
    <section aria-labelledby="titolo-prezzi" className="space-y-3">
      <div>
        <h2 id="titolo-prezzi" className="text-base font-medium">
          Prezzi
        </h2>
        <p data-testid="descrizione-prezzi" className="mt-1 text-sm text-stone-600">
          I prezzi predefiniti dell&apos;asilo. Servono solo per compilare i costi dei bambini nuovi: cambiarli qui
          non cambiano i costi dei bambini già esistenti. La retta predefinita dipende dal tipo della sezione.
        </p>
      </div>

      {letti === null ? (
        <Avviso tono="errore">Impossibile leggere i prezzi. Riprova più tardi.</Avviso>
      ) : (
        <FormImporti
          action={salva}
          chiave={letti.aggiornatoIl}
          messaggioSalvato="Prezzi salvati"
          className={cn(riquadroVariants(), 'space-y-4 p-4')}
        >
          {/* Data dell'ultimo salvataggio letta con i prezzi: se nel frattempo un altro
              admin ha salvato, il salvataggio viene rifiutato. */}
          <input type="hidden" name="aggiornato_il" value={letti.aggiornatoIl} />
          <div className="grid gap-3 sm:grid-cols-2">
            {CAMPI_PREZZI.map(({ colonna, etichetta }) => (
              <CampoImporto
                key={colonna}
                name={colonna}
                etichetta={etichetta}
                defaultValue={formattaImporto(letti.prezzi[colonna])}
              />
            ))}
          </div>
          <PulsanteInvio variante="primario" misura="normale">
            Salva prezzi
          </PulsanteInvio>
        </FormImporti>
      )}
    </section>
  );
}
