import Link from 'next/link';
import { NavHeader } from '@/components/NavHeader';
import { ModificaImporti } from '@/components/ModificaImporti';
import { NotaPagamento } from '@/components/NotaPagamento';
import { StoricoModifiche } from '@/components/StoricoModifiche';
import { VerificaBonifico } from '@/components/VerificaBonifico';
import { Etichetta } from '@/components/ui/etichetta';
import { Pulsante } from '@/components/ui/pulsante';
import { Selezione } from '@/components/ui/selezione';
import { StatoVuoto } from '@/components/ui/stato-vuoto';
import { Tabella, TabellaCella, TabellaCorpo, TabellaIntestazione, TabellaPiede, TabellaRiga, TabellaScorrevole, TabellaTitolo } from '@/components/ui/tabella';
import { requireAdmin } from '@/lib/auth';
import { formattaImporto } from '@/lib/comunicazioneRetta';
import { formattaDataOraItaliana, formattaMeseItaliano, meseDaData, meseSuccessivo, oggi } from '@/lib/date';
import {
  annoScolasticoDelMese,
  annoScolasticoRichiesto,
  ETICHETTE_VOCI,
  etichettaAnnoScolastico,
  mesiAnnoScolastico,
  totaleRichiesto,
  vociComunicazione,
} from '@/lib/pagamentiBambino';
import { valoriDaComunicazione, type ModificaStorico } from '@/lib/modificaImporti';
import {
  marcaBonificoCorretto,
  marcaBonificoImportoErrato,
  modificaImportiComunicazione,
  resettaVerificaBonifico,
  salvaNotaPagamento,
} from './actions';

export const dynamic = 'force-dynamic';

// Data e ora di un istante su due righe ("gg/mm/aaaa" e "hh:mm"): il formato
// base le separa con "_", pensato per i log.
function dataEOra(istante: string): { data: string; ora: string } {
  const [data, ora] = formattaDataOraItaliana(istante).split('_');
  return { data, ora };
}

// Larghezze delle colonne delle voci (predefinita: w-16); le tre con note o con
// intestazioni lunghe sono un po' più larghe.
const LARGHEZZE_COLONNE: Record<string, string> = {
  'Conguaglio pasti': 'w-[4.5rem]',
  'Costi extra': 'w-[5.5rem]',
  'Credito/Debito': 'w-[5.5rem]',
};

const COLONNE_COMUNICAZIONE =
  'id, mese, retta_mensile, marca_da_bollo, costo_pasti, conguaglio_pasti, costo_pre_asilo, costo_post_asilo, gettoni_pre_asilo, numero_gettoni_pre_asilo, gettoni_post_asilo, numero_gettoni_post_asilo, costi_extra, note_costi_extra, credito_debito, nota_credito_debito, totale, inviata_il, bonifico_stato, bonifico_importo_ricevuto, bonifico_nota, bonifico_verificato_da_nome, bonifico_verificato_il, nota_pagamento, modificata_il, modificata_da_nome, totale_mail';

// specs/60 - pagamenti-bambino.md: vista riservata all'admin degli importi
// richiesti a un bambino mese per mese lungo un anno scolastico
// (settembre-giugno). Gli importi sono quelli registrati nella comunicazione
// retta (`comunicazioni_retta`, specs/56), cioè esattamente quelli della mail:
// nessun ricalcolo; si cambiano solo con "Modifica importi" (#421, con storico).
// Per ogni mese comunicato si verifica il bonifico (specs/59) e si scrive una
// nota privata (PAG-16..22).
// Letture e scritture con la sessione dell'admin (RLS), nessuna chiave di
// servizio.
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

  // Storico delle modifiche degli importi (PAG-08), dalla più recente.
  const storicoPerComunicazione = new Map<string, ModificaStorico[]>();
  if (comunicazioni.length > 0) {
    const { data: storico } = await supabase
      .from('modifiche_comunicazioni_retta')
      .select('id, comunicazione_id, modificata_il, modificata_da_nome, motivo, totale_prima, totale_dopo, modifiche')
      .in(
        'comunicazione_id',
        comunicazioni.map((c) => c.id)
      )
      .order('modificata_il', { ascending: false });
    for (const riga of storico ?? []) {
      const elenco = storicoPerComunicazione.get(riga.comunicazione_id) ?? [];
      elenco.push(riga as ModificaStorico);
      storicoPerComunicazione.set(riga.comunicazione_id, elenco);
    }
  }

  const meseCorrente = meseDaData(oggi());

  const href = (annoDestinazione: number) =>
    `/admin/pagamenti-bambino?bambino=${encodeURIComponent(bambino?.id ?? '')}&anno=${annoDestinazione}`;

  return (
    <NavHeader nome={profilo?.nome || user.email || ''} ruolo={profilo?.ruolo ?? null}>
      <main className="mx-auto max-w-[100rem] space-y-6 px-4 py-8">
        <div>
          <h1 className="text-lg font-medium">Pagamenti bambino</h1>
          <p className="mt-1 text-sm text-stone-600">
            Importo richiesto mese per mese, scomposto nelle voci che lo compongono: è quello comunicato ai
            genitori con la mail delle rette (correggibile con «Modifica importi»). Per ogni mese comunicato puoi verificare il
            bonifico e scrivere una nota solo per te.
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

            <TabellaScorrevole
              role="region"
              tabIndex={0}
              aria-label={`Importi richiesti a ${bambino.nome} ${bambino.cognome}, scorrevole in orizzontale`}
            >
              {/* Layout fisso: a 1440 px e oltre le colonne stanno nella pagina; sotto la tabella
                  scorre dentro il suo riquadro (min-w). */}
              <Tabella separatori className="min-w-[70rem] table-fixed">
                <colgroup>
                  <col className="w-20" />
                  {ETICHETTE_VOCI.map((etichetta) => (
                    <col key={etichetta} className={LARGHEZZE_COLONNE[etichetta] ?? "w-16"} />
                  ))}
                  <col className="w-[5.25rem]" />
                  <col className="w-[6.5rem]" />
                  <col />
                </colgroup>
                <caption className="sr-only">
                  Importi richiesti a {bambino.nome} {bambino.cognome}, anno scolastico {etichettaAnnoScolastico(anno)}
                </caption>
                <TabellaIntestazione>
                  <TabellaRiga>
                    <TabellaTitolo allinea="sinistra" scope="col" className="px-1.5 py-1.5 align-bottom font-medium text-stone-700">
                      Mese
                    </TabellaTitolo>
                    {ETICHETTE_VOCI.map((etichetta) => (
                      <TabellaTitolo allinea="destra"
                        key={etichetta}
                        scope="col"
                        className="break-words px-1 py-1.5 align-bottom text-xs font-medium leading-tight text-stone-700"
                      >
                        {etichetta}
                      </TabellaTitolo>
                    ))}
                    <TabellaTitolo allinea="destra" scope="col" className="px-1.5 py-1.5 align-bottom text-sm font-semibold text-stone-900">
                      Totale
                    </TabellaTitolo>
                    <TabellaTitolo allinea="sinistra" scope="col" className="px-1.5 py-1.5 align-bottom font-medium text-stone-700">
                      Inviata
                    </TabellaTitolo>
                    <TabellaTitolo allinea="sinistra" scope="col" className="px-1.5 py-1.5 align-bottom font-medium text-stone-700">
                      Pagamento
                    </TabellaTitolo>
                  </TabellaRiga>
                </TabellaIntestazione>
                <TabellaCorpo separatori>
                  {mesi.map((mese) => {
                    const comunicazione = comunicazionePerMese.get(mese);
                    return (
                      <TabellaRiga
                        key={mese}
                        id={`mese-${mese}`}
                        className={comunicazione ? 'scroll-mt-4 bg-emerald-50/40' : 'scroll-mt-4'}
                      >
                        <TabellaTitolo allinea="sinistra" scope="row" className="px-1.5 py-2 align-top font-normal capitalize">
                          {formattaMeseItaliano(mese)}
                        </TabellaTitolo>
                        {comunicazione ? (
                          <>
                            {vociComunicazione(comunicazione).map((voce) => (
                              <TabellaCella
                                allinea="destra"
                                key={voce.etichetta}
                                className="px-1 py-2 align-top text-xs tabular-nums"
                              >
                                {/* Le voci a zero sono più discrete (grigio), il testo resta. */}
                                <div
                                  className={
                                    voce.importo === 0
                                      ? 'whitespace-nowrap text-stone-500'
                                      : 'whitespace-nowrap font-medium text-stone-900'
                                  }
                                >
                                  {formattaImporto(voce.importo)} €
                                </div>
                                {voce.numeroGettoni !== undefined && (
                                  <div className="whitespace-nowrap text-stone-500">{voce.numeroGettoni} gettoni</div>
                                )}
                                {voce.nota && <div className="mt-0.5 hyphens-auto break-words text-left text-stone-500">{voce.nota}</div>}
                              </TabellaCella>
                            ))}
                            <TabellaCella allinea="destra" className="whitespace-nowrap px-1.5 py-2 align-top text-sm font-bold tabular-nums text-stone-900">
                              {formattaImporto(Number(comunicazione.totale))} €
                            </TabellaCella>
                            <TabellaCella allinea="sinistra" className="px-1.5 py-2 align-top text-xs text-emerald-800">
                              <div>
                                Inviata il {dataEOra(comunicazione.inviata_il).data}
                                <span className="block">alle {dataEOra(comunicazione.inviata_il).ora}</span>
                              </div>
                              {comunicazione.modificata_il && (
                                <>
                                  <div className="mt-1 text-amber-800">
                                    Modificata il {dataEOra(comunicazione.modificata_il).data}
                                    <span className="block">
                                      alle {dataEOra(comunicazione.modificata_il).ora} da {comunicazione.modificata_da_nome}
                                    </span>
                                  </div>
                                  <div className="mt-1 text-stone-600">
                                    Totale della mail: {formattaImporto(Number(comunicazione.totale_mail))} €
                                  </div>
                                </>
                              )}
                              <ModificaImporti
                                bambinoNome={`${bambino.nome} ${bambino.cognome}`}
                                meseEtichetta={formattaMeseItaliano(mese)}
                                attuali={valoriDaComunicazione(comunicazione)}
                                gettoni={{
                                  pre: comunicazione.numero_gettoni_pre_asilo ?? 0,
                                  post: comunicazione.numero_gettoni_post_asilo ?? 0,
                                }}
                                bloccata={comunicazione.bonifico_stato !== 'in_attesa'}
                                salva={modificaImportiComunicazione.bind(null, comunicazione.id)}
                              />
                              <StoricoModifiche modifiche={storicoPerComunicazione.get(comunicazione.id) ?? []} />
                            </TabellaCella>
                            <TabellaCella allinea="sinistra" className="px-1.5 py-2 align-top text-xs">
                              <VerificaBonifico
                                bambinoId={bambino.id}
                                bambinoNome={`${bambino.nome} ${bambino.cognome}`}
                                totale={Number(comunicazione.totale)}
                                stato={comunicazione.bonifico_stato}
                                importoRicevuto={
                                  comunicazione.bonifico_importo_ricevuto !== null
                                    ? Number(comunicazione.bonifico_importo_ricevuto)
                                    : null
                                }
                                nota={comunicazione.bonifico_nota}
                                verificatoDaNome={comunicazione.bonifico_verificato_da_nome}
                                verificatoIl={comunicazione.bonifico_verificato_il}
                                meseSuggerito={meseSuccessivo(mese)}
                                meseMinimo={meseCorrente}
                                marcaCorretto={marcaBonificoCorretto.bind(null, comunicazione.id)}
                                marcaImportoErrato={marcaBonificoImportoErrato.bind(null, comunicazione.id, bambino.id)}
                                resettaVerifica={resettaVerificaBonifico.bind(null, comunicazione.id)}
                              />
                              <div className="mt-2 border-t border-stone-200 pt-2">
                                <NotaPagamento
                                  notaIniziale={comunicazione.nota_pagamento}
                                  nomeCampo={`Nota per ${bambino.nome} ${bambino.cognome}, ${formattaMeseItaliano(mese)}`}
                                  salva={salvaNotaPagamento.bind(null, comunicazione.id)}
                                />
                              </div>
                            </TabellaCella>
                          </>
                        ) : (
                          <TabellaCella allinea="sinistra"
                            colSpan={ETICHETTE_VOCI.length + 3}
                            className="px-1.5 py-2 text-xs text-stone-500"
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
                      <TabellaCella colSpan={2} />
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
