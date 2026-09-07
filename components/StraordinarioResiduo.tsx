import { formattaDataOraItaliana } from '@/lib/date';
import { FormConEsito, type EsitoAzione } from '@/components/FormConEsito';
import { PulsanteInvio } from '@/components/PulsanteInvio';

const ETICHETTE_DECISIONE: Record<string, string> = {
  pagamento_mensile: 'messo a pagamento mensile',
  monte_ore: 'scalato dal monte ore',
};

// Straordinario residuo di una settimana confermata (specs/19 - monte-ore.md):
// la quota di straordinario che, quella settimana, non è servita a
// coprire nessuna carenza NON scala automaticamente il monte ore — resta
// in attesa che l'admin scelga se metterla a pagamento mensile o
// scalarla dal monte ore. Nessun elemento se non c'è alcuno straordinario
// residuo (nulla da decidere).
export function StraordinarioResiduo({
  straordinarioResiduo,
  decisione,
  decisioneAt,
  modalitaAdmin,
  utenteId,
  settimanaInizio,
  decidi,
}: {
  straordinarioResiduo: number;
  decisione: string | null;
  decisioneAt: string | null;
  modalitaAdmin: boolean;
  utenteId: string;
  settimanaInizio: string;
  decidi: (statoPrecedente: EsitoAzione, formData: FormData) => Promise<EsitoAzione>;
}) {
  if (!straordinarioResiduo) return null;

  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
      {decisione ? (
        <p>
          {straordinarioResiduo}h di straordinario residuo {ETICHETTE_DECISIONE[decisione] ?? decisione}
          {decisioneAt && ` il ${formattaDataOraItaliana(decisioneAt).replace('_', ' alle ')}`}.
        </p>
      ) : (
        <>
          <p>
            {straordinarioResiduo}h di straordinario restano in attesa di una decisione dell&apos;admin: pagamento
            mensile, oppure scalo dal monte ore.
          </p>
          {modalitaAdmin && (
            <div className="mt-2 flex flex-wrap gap-2">
              <FormConEsito action={decidi}>
                <input type="hidden" name="utente_id" value={utenteId} />
                <input type="hidden" name="settimana_inizio" value={settimanaInizio} />
                <input type="hidden" name="decisione" value="pagamento_mensile" />
                <PulsanteInvio className="rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-sm font-medium text-sky-900 hover:bg-sky-100">
                  Metti a pagamento mensile
                </PulsanteInvio>
              </FormConEsito>
              <FormConEsito action={decidi}>
                <input type="hidden" name="utente_id" value={utenteId} />
                <input type="hidden" name="settimana_inizio" value={settimanaInizio} />
                <input type="hidden" name="decisione" value="monte_ore" />
                <PulsanteInvio className="rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-sm font-medium text-sky-900 hover:bg-sky-100">
                  Scala dal monte ore
                </PulsanteInvio>
              </FormConEsito>
            </div>
          )}
        </>
      )}
    </div>
  );
}
