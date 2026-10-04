import Link from 'next/link';
import { NavHeader } from '@/components/NavHeader';
import { requireAdmin } from '@/lib/auth';
import { formattaImporto } from '@/lib/comunicazioneRetta';
import { formattaDataOraItaliana, formattaMeseItaliano, meseDaData, oggi } from '@/lib/date';
import {
  annoScolasticoDelMese,
  annoScolasticoRichiesto,
  ETICHETTE_VOCI,
  etichettaAnnoScolastico,
  mesiAnnoScolastico,
  totaleRichiesto,
  vociComunicazione,
} from '@/lib/pagamentiBambino';

export const dynamic = 'force-dynamic';

const COLONNE_COMUNICAZIONE =
  'mese, retta_mensile, marca_da_bollo, costo_pasti, conguaglio_pasti, costo_pre_asilo, costo_post_asilo, costi_extra, note_costi_extra, credito_debito, nota_credito_debito, totale, inviata_il';

const CLASSE_FRECCIA =
  'rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-100';

// specs/60 - pagamenti-bambino.md: vista di sola lettura, riservata
// all'admin, degli importi richiesti a un bambino mese per mese lungo un
// anno scolastico (settembre-giugno). Gli importi sono quelli registrati
// nella comunicazione retta (`comunicazioni_retta`, specs/56), cioè
// esattamente quelli della mail: nessun ricalcolo, quindi nessuna
// duplicazione della logica di `lib/comunicazioneRetta.ts`. Letture con la
// sessione dell'admin (RLS), nessuna chiave di servizio, nessuna scrittura.
export default async function PagamentiBambinoPage({
  searchParams,
}: {
  searchParams: { bambino?: string; anno?: string };
}) {
  const { supabase, user, profilo } = await requireAdmin();

  // Anche i bambini non più attivi: lo storico resta consultabile.
  const { data: bambini } = await supabase
    .from('bambini')
    .select('id, nome, cognome, attiva')
    .order('cognome')
    .order('nome');
  // Il bambino scelto deve essere uno di quelli elencati: un id non valido o
  // inesistente equivale a nessuna scelta.
  const bambino = (bambini ?? []).find((b) => b.id === searchParams.bambino) ?? null;

  const annoRiferimento = annoScolasticoDelMese(meseDaData(oggi()));
  const anno = annoScolasticoRichiesto(searchParams.anno, annoRiferimento);
  const mesi = mesiAnnoScolastico(anno);

  const comunicazioni = bambino
    ? ((
        await supabase
          .from('comunicazioni_retta')
          .select(COLONNE_COMUNICAZIONE)
          .eq('bambino_id', bambino.id)
          .in('mese', mesi)
      ).data ?? [])
    : [];
  const comunicazionePerMese = new Map(comunicazioni.map((c) => [c.mese as string, c]));

  const href = (annoDestinazione: number) =>
    `/admin/pagamenti-bambino?bambino=${encodeURIComponent(bambino?.id ?? '')}&anno=${annoDestinazione}`;

  return (
    <NavHeader nome={profilo?.nome || user.email || ''} ruolo={profilo?.ruolo ?? null}>
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-lg font-medium">Pagamenti bambino</h1>
          <p className="mt-1 text-sm text-stone-600">
            Importo richiesto mese per mese, scomposto nelle voci che lo compongono: è quello comunicato ai
            genitori con la mail delle rette (sola lettura).
          </p>
        </div>

        <form method="get" className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="bambino" className="text-sm font-medium text-stone-700">
              Bambino
            </label>
            <select
              id="bambino"
              name="bambino"
              defaultValue={bambino?.id ?? ''}
              className="min-w-[16rem] rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm"
            >
              <option value="">— Seleziona —</option>
              {(bambini ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.cognome} {b.nome}
                  {b.attiva ? '' : ' (non attivo)'}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded-lg bg-emerald-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-800"
          >
            Mostra
          </button>
        </form>

        {!bambino ? (
          <p className="rounded-xl border border-stone-200 bg-white px-4 py-6 text-center text-sm text-stone-600 shadow-sm">
            Scegli un bambino per vedere i suoi pagamenti.
          </p>
        ) : (
          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-base font-semibold text-stone-900">
                {bambino.nome} {bambino.cognome}
              </h2>
              <div className="flex items-center gap-2">
                <Link href={href(anno - 1)} aria-label="Anno scolastico precedente" className={CLASSE_FRECCIA}>
                  ←
                </Link>
                <span className="text-sm font-medium text-stone-700">
                  Anno scolastico {etichettaAnnoScolastico(anno)}
                </span>
                {anno < annoRiferimento && (
                  <Link href={href(anno + 1)} aria-label="Anno scolastico successivo" className={CLASSE_FRECCIA}>
                    →
                  </Link>
                )}
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-stone-200 text-sm">
                <caption className="sr-only">
                  Importi richiesti a {bambino.nome} {bambino.cognome}, anno scolastico {etichettaAnnoScolastico(anno)}
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className="px-2 py-1.5 text-left font-medium text-stone-700">
                      Mese
                    </th>
                    {ETICHETTE_VOCI.map((etichetta) => (
                      <th
                        key={etichetta}
                        scope="col"
                        className="max-w-[6.5rem] px-2 py-1.5 text-right font-medium text-stone-700"
                      >
                        {etichetta}
                      </th>
                    ))}
                    <th scope="col" className="px-2 py-1.5 text-right text-base font-semibold text-stone-900">
                      Totale
                    </th>
                    <th scope="col" className="px-2 py-1.5 text-left font-medium text-stone-700">
                      Inviata
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {mesi.map((mese) => {
                    const comunicazione = comunicazionePerMese.get(mese);
                    return (
                      <tr key={mese} className={comunicazione ? 'bg-emerald-50/40' : undefined}>
                        <th scope="row" className="whitespace-nowrap px-2 py-2 text-left font-normal capitalize">
                          {formattaMeseItaliano(mese)}
                        </th>
                        {comunicazione ? (
                          <>
                            {vociComunicazione(comunicazione).map((voce) => (
                              <td key={voce.etichetta} className="px-2 py-2 text-right">
                                <div className="whitespace-nowrap">{formattaImporto(voce.importo)} €</div>
                                {voce.nota && <div className="text-left text-xs text-stone-500">{voce.nota}</div>}
                              </td>
                            ))}
                            <td className="whitespace-nowrap px-2 py-2 text-right text-base font-bold text-stone-900">
                              {formattaImporto(Number(comunicazione.totale))} €
                            </td>
                            <td className="whitespace-nowrap px-2 py-2 text-left text-xs text-emerald-800">
                              Inviata il {formattaDataOraItaliana(comunicazione.inviata_il)}
                            </td>
                          </>
                        ) : (
                          <td
                            colSpan={ETICHETTE_VOCI.length + 2}
                            className="px-2 py-2 text-left text-xs text-stone-500"
                          >
                            Non ancora comunicata
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                {comunicazioni.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-stone-300 bg-stone-50">
                      <td
                        colSpan={ETICHETTE_VOCI.length + 1}
                        className="px-2 py-2 text-right text-sm font-semibold text-stone-700"
                      >
                        Totale richiesto ({comunicazioni.length} {comunicazioni.length === 1 ? 'mese' : 'mesi'})
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right text-base font-bold text-stone-900">
                        {formattaImporto(totaleRichiesto(comunicazioni))} €
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </section>
        )}
      </main>
    </NavHeader>
  );
}
