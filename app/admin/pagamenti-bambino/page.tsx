import Link from 'next/link';
import { NavHeader } from '@/components/NavHeader';
import { Etichetta } from '@/components/ui/etichetta';
import { Pulsante } from '@/components/ui/pulsante';
import { Selezione } from '@/components/ui/selezione';
import { StatoVuoto } from '@/components/ui/stato-vuoto';
import { Tabella, TabellaCella, TabellaCorpo, TabellaIntestazione, TabellaPiede, TabellaRiga, TabellaScorrevole, TabellaTitolo } from '@/components/ui/tabella';
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

// specs/60 - pagamenti-bambino.md: vista di sola lettura, riservata
// all'admin, degli importi richiesti a un bambino mese per mese lungo un
// anno scolastico (settembre-giugno). Gli importi sono quelli registrati
// nella comunicazione retta (`comunicazioni_retta`, specs/56), cioè
// esattamente quelli della mail: nessun ricalcolo, quindi nessuna
// duplicazione della logica di `lib/comunicazioneRetta.ts`. Letture con la
// sessione dell'admin (RLS), nessuna chiave di servizio, nessuna scrittura.
export default async function PagamentiBambinoPage(
  props: {
    searchParams: Promise<{ bambino?: string; anno?: string }>;
  }
) {
  const searchParams = await props.searchParams;
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
            <Etichetta htmlFor="bambino">Bambino</Etichetta>
            <Selezione id="bambino" name="bambino" defaultValue={bambino?.id ?? ''} className="min-w-[16rem] bg-white">
              <option value="">— Seleziona —</option>
              {(bambini ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.cognome} {b.nome}
                  {b.attiva ? '' : ' (non attivo)'}
                </option>
              ))}
            </Selezione>
          </div>
          <Pulsante type="submit" variante="primario" misura="normale">
            Mostra
          </Pulsante>
        </form>

        {!bambino ? (
          <StatoVuoto allineamento="centro">Scegli un bambino per vedere i suoi pagamenti.</StatoVuoto>
        ) : (
          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-base font-semibold text-stone-900">
                {bambino.nome} {bambino.cognome}
              </h2>
              <div className="flex items-center gap-2">
                <Pulsante asChild variante="secondario" misura="normale" className="px-3 py-1.5">
                  <Link href={href(anno - 1)} aria-label="Anno scolastico precedente">
                    ←
                  </Link>
                </Pulsante>
                <span className="text-sm font-medium text-stone-700">
                  Anno scolastico {etichettaAnnoScolastico(anno)}
                </span>
                {anno < annoRiferimento && (
                  <Pulsante asChild variante="secondario" misura="normale" className="px-3 py-1.5">
                    <Link href={href(anno + 1)} aria-label="Anno scolastico successivo">
                      →
                    </Link>
                  </Pulsante>
                )}
              </div>
            </div>

            <TabellaScorrevole>
              <Tabella separatori>
                <caption className="sr-only">
                  Importi richiesti a {bambino.nome} {bambino.cognome}, anno scolastico {etichettaAnnoScolastico(anno)}
                </caption>
                <TabellaIntestazione>
                  <TabellaRiga>
                    <TabellaTitolo allinea="sinistra" scope="col" className="px-2 py-1.5 font-medium text-stone-700">
                      Mese
                    </TabellaTitolo>
                    {ETICHETTE_VOCI.map((etichetta) => (
                      <TabellaTitolo allinea="destra"
                        key={etichetta}
                        scope="col"
                        className="max-w-26 px-2 py-1.5 font-medium text-stone-700"
                      >
                        {etichetta}
                      </TabellaTitolo>
                    ))}
                    <TabellaTitolo allinea="destra" scope="col" className="px-2 py-1.5 text-base font-semibold text-stone-900">
                      Totale
                    </TabellaTitolo>
                    <TabellaTitolo allinea="sinistra" scope="col" className="px-2 py-1.5 font-medium text-stone-700">
                      Inviata
                    </TabellaTitolo>
                  </TabellaRiga>
                </TabellaIntestazione>
                <TabellaCorpo separatori>
                  {mesi.map((mese) => {
                    const comunicazione = comunicazionePerMese.get(mese);
                    return (
                      <TabellaRiga key={mese} className={comunicazione ? 'bg-emerald-50/40' : undefined}>
                        <TabellaTitolo allinea="sinistra" scope="row" className="whitespace-nowrap px-2 py-2 font-normal capitalize">
                          {formattaMeseItaliano(mese)}
                        </TabellaTitolo>
                        {comunicazione ? (
                          <>
                            {vociComunicazione(comunicazione).map((voce) => (
                              <TabellaCella allinea="destra" key={voce.etichetta} className="px-2 py-2">
                                <div className="whitespace-nowrap">{formattaImporto(voce.importo)} €</div>
                                {voce.nota && <div className="text-left text-xs text-stone-500">{voce.nota}</div>}
                              </TabellaCella>
                            ))}
                            <TabellaCella allinea="destra" className="whitespace-nowrap px-2 py-2 text-base font-bold text-stone-900">
                              {formattaImporto(Number(comunicazione.totale))} €
                            </TabellaCella>
                            <TabellaCella allinea="sinistra" className="whitespace-nowrap px-2 py-2 text-xs text-emerald-800">
                              Inviata il {formattaDataOraItaliana(comunicazione.inviata_il)}
                            </TabellaCella>
                          </>
                        ) : (
                          <TabellaCella allinea="sinistra"
                            colSpan={ETICHETTE_VOCI.length + 2}
                            className="px-2 py-2 text-xs text-stone-500"
                          >
                            Non ancora comunicata
                          </TabellaCella>
                        )}
                      </TabellaRiga>
                    );
                  })}
                </TabellaCorpo>
                {comunicazioni.length > 0 && (
                  <TabellaPiede>
                    <TabellaRiga className="border-t-2 border-stone-300 bg-stone-50">
                      <TabellaCella allinea="destra"
                        colSpan={ETICHETTE_VOCI.length + 1}
                        className="px-2 py-2 text-sm font-semibold text-stone-700"
                      >
                        Totale richiesto ({comunicazioni.length} {comunicazioni.length === 1 ? 'mese' : 'mesi'})
                      </TabellaCella>
                      <TabellaCella allinea="destra" className="whitespace-nowrap px-2 py-2 text-base font-bold text-stone-900">
                        {formattaImporto(totaleRichiesto(comunicazioni))} €
                      </TabellaCella>
                      <TabellaCella />
                    </TabellaRiga>
                  </TabellaPiede>
                )}
              </Tabella>
            </TabellaScorrevole>
          </section>
        )}
      </main>
    </NavHeader>
  );
}
