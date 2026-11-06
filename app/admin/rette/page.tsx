import Link from 'next/link';
import { NavHeader } from '@/components/NavHeader';
import { FormConEsito } from '@/components/FormConEsito';
import { PulsanteInvio } from '@/components/PulsanteInvio';
import { requireAdmin } from '@/lib/auth';
import { chiusurePerPeriodo } from '@/lib/calendarioScolastico';
import { formattaImporto, giorniAperturaMese, meseRettaRichiesto, pastiNonUsufruiti } from '@/lib/comunicazioneRetta';
import {
  formattaDataOraItaliana,
  formattaMeseItaliano,
  meseDaData,
  mesePrecedente,
  meseSuccessivo,
  oggi,
  primoGiornoMese,
  ultimoGiornoMese,
} from '@/lib/date';
import { hrefVerificaBonifico } from '@/lib/pagamentiBambino';
import { gettoniMesePrecedente } from '@/lib/prezzi';
import { leggiPrezzi } from '@/lib/prezziDati';
import { pastiEffettiviPerBambino } from '@/lib/retteDati';
import { raggruppaPerSezione } from '@/lib/sezioni';
import { Pulsante } from '@/components/ui/pulsante';
import { StatoVuoto } from '@/components/ui/stato-vuoto';
import { Tabella, TabellaCella, TabellaCorpo, TabellaIntestazione, TabellaRiga, TabellaScorrevole, TabellaTitolo } from '@/components/ui/tabella';
import { RigaRettaDaInviare } from '@/components/RigaRettaDaInviare';
import { StatoBonifico } from '@/components/StatoBonifico';
import {
  annullaComunicazioneRetta,
  inviaComunicazioneRettaSingola,
  inviaComunicazioniRetta,
} from './actions';

export const dynamic = 'force-dynamic';

type ComunicazioneRettaRiga = {
  id: string;
  email_destinatario: string;
  retta_mensile: number | string;
  costo_pasti: number | string;
  conguaglio_pasti: number | string;
  marca_da_bollo: number | string;
  costo_pre_asilo: number | string;
  costo_post_asilo: number | string;
  gettoni_pre_asilo: number | string;
  numero_gettoni_pre_asilo: number;
  gettoni_post_asilo: number | string;
  numero_gettoni_post_asilo: number;
  costi_extra: number | string;
  note_costi_extra: string | null;
  credito_debito: number | string;
  nota_credito_debito: string | null;
  totale: number | string;
  mese: string;
  inviata_il: string;
  bonifico_stato: 'in_attesa' | 'corretto' | 'importo_errato';
  bonifico_importo_ricevuto: number | string | null;
  bonifico_nota: string | null;
  bonifico_verificato_da_nome: string | null;
  bonifico_verificato_il: string | null;
};

// Gettoni di una retta già inviata (sola lettura): importo e numero.
function CellaGettoniInviati({ importo, numero, voce }: { importo: number; numero: number; voce: 'pre-asilo' | 'post-asilo' }) {
  return (
    <TabellaCella allinea="destra" className="whitespace-nowrap px-2 py-1.5">
      <div data-testid={`importo-gettoni-${voce}`}>{formattaImporto(importo)} €</div>
      <div className="text-xs text-stone-500" data-testid={`numero-gettoni-${voce}`}>
        {numero} gettoni
      </div>
    </TabellaCella>
  );
}

// Riga di un bambino già comunicato (specs/56): stessa forma sia nella
// vista del mese corrente sia in quella di revisione di un mese passato
// — solo "Annulla invio" cambia (mai disponibile per un mese passato, né
// per un bonifico già verificato — specs/59), fattorizzata qui per non
// duplicare le celle tra le due viste (CLAUDE.md, jscpd). Il bonifico (specs/59)
// qui è solo in lettura, con il link "Verifica" alla riga giusta di
// "Pagamenti bambino", dove si verifica o si annulla la verifica.
function RigaComunicazione({
  bambino,
  comunicazione,
  mostraAnnullaInvio,
  mese,
}: {
  bambino: { id: string; nome: string; cognome: string };
  comunicazione: ComunicazioneRettaRiga;
  mostraAnnullaInvio: boolean;
  mese: string;
}) {
  return (
    <TabellaRiga className="bg-emerald-50/40">
      <TabellaTitolo allinea="sinistra" scope="row" className="whitespace-nowrap px-2 py-1.5 font-normal">
        <Link href={`/admin/bambini/${bambino.id}`} className="hover:underline">
          {bambino.nome} {bambino.cognome}
        </Link>
        <div className="text-xs text-stone-500">({comunicazione.email_destinatario})</div>
      </TabellaTitolo>
      <TabellaCella allinea="destra" className="whitespace-nowrap px-2 py-1.5">
        {formattaImporto(Number(comunicazione.retta_mensile))} €
      </TabellaCella>
      <TabellaCella allinea="destra" className="whitespace-nowrap px-2 py-1.5">
        {formattaImporto(Number(comunicazione.marca_da_bollo))} €
      </TabellaCella>
      <TabellaCella allinea="destra" className="whitespace-nowrap px-2 py-1.5">
        {formattaImporto(Number(comunicazione.costo_pasti))} €
      </TabellaCella>
      <TabellaCella allinea="destra" className="whitespace-nowrap px-2 py-1.5">
        {formattaImporto(Number(comunicazione.conguaglio_pasti))} €
      </TabellaCella>
      <TabellaCella allinea="destra" className="whitespace-nowrap px-2 py-1.5">
        {formattaImporto(Number(comunicazione.costo_pre_asilo))} €
      </TabellaCella>
      <TabellaCella allinea="destra" className="whitespace-nowrap px-2 py-1.5">
        {formattaImporto(Number(comunicazione.costo_post_asilo))} €
      </TabellaCella>
      <CellaGettoniInviati importo={Number(comunicazione.gettoni_pre_asilo)} numero={comunicazione.numero_gettoni_pre_asilo} voce="pre-asilo" />
      <CellaGettoniInviati importo={Number(comunicazione.gettoni_post_asilo)} numero={comunicazione.numero_gettoni_post_asilo} voce="post-asilo" />
      <TabellaCella allinea="destra" className="whitespace-nowrap px-2 py-1.5">
        {formattaImporto(Number(comunicazione.costi_extra))} €
      </TabellaCella>
      <TabellaCella allinea="sinistra" className="px-2 py-1.5 text-stone-600">{comunicazione.note_costi_extra ?? ''}</TabellaCella>
      <TabellaCella allinea="destra" className="px-2 py-1.5">
        <div>{formattaImporto(Number(comunicazione.credito_debito))} €</div>
        {comunicazione.nota_credito_debito && (
          <div className="text-left text-xs text-stone-500">{comunicazione.nota_credito_debito}</div>
        )}
      </TabellaCella>
      <TabellaCella allinea="destra" className="whitespace-nowrap px-2 py-1.5 font-medium" data-testid="totale-riga">
        {formattaImporto(Number(comunicazione.totale))} €
      </TabellaCella>
      <TabellaCella allinea="sinistra" className="whitespace-nowrap px-2 py-1.5 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-emerald-800">Inviata il {formattaDataOraItaliana(comunicazione.inviata_il)}</span>
          {mostraAnnullaInvio && comunicazione.bonifico_stato === 'in_attesa' && (
            <PulsanteInvio
              mantieniTesto
              formAction={annullaComunicazioneRetta.bind(null, bambino.id, mese)}
              variante="secondario"
              misura="piccolo"
              className="border-red-300 bg-transparent px-2 py-0.5 text-danger hover:bg-danger-soft"
            >
              Annulla invio
            </PulsanteInvio>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <StatoBonifico
            stato={comunicazione.bonifico_stato}
            totale={Number(comunicazione.totale)}
            importoRicevuto={comunicazione.bonifico_importo_ricevuto !== null ? Number(comunicazione.bonifico_importo_ricevuto) : null}
            nota={comunicazione.bonifico_nota}
            verificatoDaNome={comunicazione.bonifico_verificato_da_nome}
            verificatoIl={comunicazione.bonifico_verificato_il}
          />
          <Link
            href={hrefVerificaBonifico(bambino.id, comunicazione.mese)}
            aria-label={`Verifica il bonifico di ${bambino.nome} ${bambino.cognome}`}
            className="text-xs underline"
          >
            Verifica
          </Link>
        </div>
      </TabellaCella>
    </TabellaRiga>
  );
}

const INTESTAZIONE_COLONNE = (
  <TabellaIntestazione>
    <TabellaRiga>
      <TabellaTitolo allinea="sinistra" scope="col" className="px-2 py-1.5 font-medium text-stone-700">
        Bambino
      </TabellaTitolo>
      <TabellaTitolo allinea="destra" scope="col" className="max-w-26 px-2 py-1.5 font-medium text-stone-700">
        Retta
      </TabellaTitolo>
      <TabellaTitolo allinea="destra" scope="col" className="max-w-26 px-2 py-1.5 font-medium text-stone-700">
        Marca da bollo
      </TabellaTitolo>
      <TabellaTitolo allinea="destra" scope="col" className="max-w-26 px-2 py-1.5 font-medium text-stone-700">
        Pasti mese corrente
      </TabellaTitolo>
      <TabellaTitolo allinea="destra" scope="col" className="max-w-26 px-2 py-1.5 font-medium text-stone-700">
        Conguaglio pasti mese precedente
      </TabellaTitolo>
      <TabellaTitolo allinea="destra" scope="col" className="max-w-26 px-2 py-1.5 font-medium text-stone-700">
        Pre-asilo
      </TabellaTitolo>
      <TabellaTitolo allinea="destra" scope="col" className="max-w-26 px-2 py-1.5 font-medium text-stone-700">
        Post-asilo
      </TabellaTitolo>
      <TabellaTitolo allinea="destra" scope="col" className="max-w-26 px-2 py-1.5 font-medium text-stone-700">
        Gettoni pre-asilo
      </TabellaTitolo>
      <TabellaTitolo allinea="destra" scope="col" className="max-w-26 px-2 py-1.5 font-medium text-stone-700">
        Gettoni post-asilo
      </TabellaTitolo>
      <TabellaTitolo allinea="destra" scope="col" className="max-w-26 px-2 py-1.5 font-medium text-stone-700">
        Costi extra
      </TabellaTitolo>
      <TabellaTitolo allinea="sinistra" scope="col" className="max-w-26 px-2 py-1.5 font-medium text-stone-700">
        Nota costi extra
      </TabellaTitolo>
      <TabellaTitolo allinea="destra" scope="col" className="max-w-26 px-2 py-1.5 font-medium text-stone-700">
        Credito/Debito
      </TabellaTitolo>
      <TabellaTitolo allinea="destra" scope="col" className="max-w-26 px-2 py-1.5 font-medium text-stone-700">
        Totale
      </TabellaTitolo>
      <TabellaTitolo allinea="sinistra" scope="col" className="max-w-26 px-2 py-1.5 font-medium text-stone-700">
        Stato
      </TabellaTitolo>
    </TabellaRiga>
  </TabellaIntestazione>
);

// Una tabella per sezione, col nome della sezione come titolo
// (specs/56): stessa intestazione di colonne per tutte, solo le righe
// cambiano. Nessuna tabella per una sezione senza elementi
// (raggruppaPerSezione le filtra già).
function TabellaSezione({ titolo, righe }: { titolo: string; righe: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-stone-800">{titolo}</h2>
      <TabellaScorrevole>
        <Tabella separatori>
          {INTESTAZIONE_COLONNE}
          <TabellaCorpo separatori>{righe}</TabellaCorpo>
        </Tabella>
      </TabellaScorrevole>
    </div>
  );
}

export default async function RettePage(props: { searchParams: Promise<{ mese?: string }> }) {
  const searchParams = await props.searchParams;
  const { supabase, user, profilo } = await requireAdmin();

  const meseReale = meseDaData(oggi());
  const meseVisualizzato = meseRettaRichiesto(searchParams.mese, meseReale);
  const eMeseCorrente = meseVisualizzato === meseReale;

  const { data: sezioni } = await supabase.from('sezioni').select('id, nome').order('nome');

  let contenutoTabelle: React.ReactNode;
  let piePagina: React.ReactNode = null;
  let sottotitolo: React.ReactNode;

  if (eMeseCorrente) {
    const mesePrecedenteValore = mesePrecedente(meseVisualizzato);

    const { data: bambini } = await supabase
      .from('bambini')
      .select('id, nome, cognome, sezione_id')
      .eq('attiva', true)
      .order('cognome');
    const bambinoIds = (bambini ?? []).map((b) => b.id);

    // Presenze di pre/post-asilo del mese precedente (specs/56, gettoni):
    // lette a pagine per lo stesso motivo dei pasti (tetto di 1000 righe).
    async function presenzePrePostMesePrecedente() {
      const righe: { bambino_id: string; data: string; pre_asilo: boolean; post_asilo: boolean }[] = [];
      for (let da = 0; ; da += 1000) {
        const { data } = await supabase
          .from('presenze')
          .select('id, bambino_id, data, pre_asilo, post_asilo')
          .in('bambino_id', bambinoIds)
          .gte('data', primoGiornoMese(mesePrecedenteValore))
          .lte('data', ultimoGiornoMese(mesePrecedenteValore))
          .or('pre_asilo.eq.true,post_asilo.eq.true')
          .order('id')
          .range(da, da + 999);
        righe.push(...(data ?? []));
        if ((data?.length ?? 0) < 1000) break;
      }
      return { data: righe };
    }

    const [
      { data: costi },
      pastiEffettiviPerBambinoMappa,
      { data: comunicazioni },
      { data: creditiDebiti },
      { data: template },
      chiusure,
      { data: presenzePrePost },
      { data: rettePrecedenti },
      prezziPredefiniti,
    ] = await Promise.all([
        bambinoIds.length
          ? supabase.from('costi_bambini').select('*').in('bambino_id', bambinoIds)
          : Promise.resolve({ data: [] }),
        pastiEffettiviPerBambino(supabase, bambinoIds, mesePrecedenteValore),
        bambinoIds.length
          ? supabase.from('comunicazioni_retta').select('*').eq('mese', meseVisualizzato).in('bambino_id', bambinoIds)
          : Promise.resolve({ data: [] }),
        // specs/58: al più un credito/debito "da conteggiare" per
        // bambino su questo mese (indice unico parziale), quindi una
        // mappa 1:1 basta — nessuna somma necessaria.
        bambinoIds.length
          ? supabase
              .from('crediti_debiti_bambini')
              .select('bambino_id, importo, nota')
              .in('bambino_id', bambinoIds)
              .eq('mese_competenza', meseVisualizzato)
              .is('applicato_il', null)
          : Promise.resolve({ data: [] }),
        supabase.from('impostazioni_email_retta').select('oggetto, corpo').eq('id', true).maybeSingle(),
        chiusurePerPeriodo(supabase, primoGiornoMese(mesePrecedenteValore), ultimoGiornoMese(meseVisualizzato)),
        bambinoIds.length ? presenzePrePostMesePrecedente() : Promise.resolve({ data: [] }),
        // Retta inviata del mese precedente: dice cosa fu coperto dall'abbonamento.
        bambinoIds.length
          ? supabase
              .from('comunicazioni_retta')
              .select('bambino_id, costo_pre_asilo, costo_post_asilo')
              .eq('mese', mesePrecedenteValore)
              .in('bambino_id', bambinoIds)
          : Promise.resolve({ data: [] }),
        // Prezzi predefiniti: abbonamento di riferimento per l'avviso sui
        // gettoni quando quello della scheda è 0 (RET-21). null se non leggibili.
        leggiPrezzi(supabase),
      ]);
    const oggettoTemplate = template?.oggetto ?? 'Promemoria retta {{mese}}';
    const corpoTemplate = template?.corpo ?? '';

    const giorniApertura = giorniAperturaMese(meseVisualizzato, chiusure);
    const costiPerBambino = new Map((costi ?? []).map((c) => [c.bambino_id, c]));
    const comunicazionePerBambino = new Map((comunicazioni ?? []).map((c) => [c.bambino_id, c]));
    const creditoDebitoPerBambino = new Map(
      (creditiDebiti ?? []).map((c) => [c.bambino_id, { importo: Number(c.importo), nota: c.nota }])
    );
    // Pasti potenziali: giorni di servizio pasto del mese precedente,
    // pagati in anticipo (stesso calendario per tutti i bambini).
    const pastiPotenziali = giorniAperturaMese(mesePrecedenteValore, chiusure);

    const presenzePrePostPerBambino = new Map<string, { data: string; preAsilo: boolean; postAsilo: boolean }[]>();
    for (const riga of presenzePrePost ?? []) {
      const elenco = presenzePrePostPerBambino.get(riga.bambino_id) ?? [];
      elenco.push({ data: riga.data, preAsilo: riga.pre_asilo, postAsilo: riga.post_asilo });
      presenzePrePostPerBambino.set(riga.bambino_id, elenco);
    }
    const rettaPrecedentePerBambino = new Map(
      (rettePrecedenti ?? []).map((r) => [
        r.bambino_id,
        { costoPreAsilo: Number(r.costo_pre_asilo), costoPostAsilo: Number(r.costo_post_asilo) },
      ])
    );

    sottotitolo = (
      <p className="mt-1 text-sm text-stone-600">
        Giorni di apertura stimati questo mese: {giorniApertura}. Pasti potenziali del mese precedente (giorni di
        apertura): {pastiPotenziali}. Si modificano solo i gettoni, i costi
        extra e la relativa nota per una correzione ad-hoc: le altre voci vengono dalla scheda del bambino
        (conguaglio pasti e credito/debito si correggono con il credito/debito della scheda). Il totale di ogni
        riga si aggiorna mentre scrivi e coincide con quello che verrà comunicato.
      </p>
    );

    function rigaBambino(bambino: { id: string; nome: string; cognome: string }) {
      const comunicazione = comunicazionePerBambino.get(bambino.id);
      const costiBambino = costiPerBambino.get(bambino.id);

      if (comunicazione) {
        return (
          <RigaComunicazione
            key={bambino.id}
            bambino={bambino}
            comunicazione={comunicazione}
            mostraAnnullaInvio
            mese={meseVisualizzato}
          />
        );
      }

      if (!costiBambino?.email_promemoria) {
        return (
          <TabellaRiga key={bambino.id}>
            <TabellaTitolo allinea="sinistra" scope="row" className="whitespace-nowrap px-2 py-1.5 font-normal">
              <Link href={`/admin/bambini/${bambino.id}`} className="hover:underline">
                {bambino.nome} {bambino.cognome}
              </Link>
            </TabellaTitolo>
            <TabellaCella allinea="sinistra" colSpan={13} className="px-2 py-1.5 text-xs text-amber-700">
              Costi o email non configurati —{' '}
              <Link href={`/admin/bambini/${bambino.id}`} className="underline">
                completa la scheda
              </Link>
            </TabellaCella>
          </TabellaRiga>
        );
      }

      const creditoDebito = creditoDebitoPerBambino.get(bambino.id);
      const gettoni = gettoniMesePrecedente({
        meseCorrente: meseVisualizzato,
        presenze: presenzePrePostPerBambino.get(bambino.id) ?? [],
        chiusure,
        costi: {
          preAsiloRichiesto: costiBambino.pre_asilo_richiesto,
          postAsiloRichiesto: costiBambino.post_asilo_richiesto,
          gettonePreAsilo: Number(costiBambino.gettone_pre_asilo),
          gettonePostAsilo: Number(costiBambino.gettone_post_asilo),
        },
        rettaMesePrecedente: rettaPrecedentePerBambino.get(bambino.id) ?? null,
      });
      const pastiEffettivi = pastiEffettiviPerBambinoMappa.get(bambino.id) ?? 0;

      return (
        <RigaRettaDaInviare
          key={bambino.id}
          bambino={bambino}
          email={costiBambino.email_promemoria}
          mese={meseVisualizzato}
          fissi={{
            prezzoMensile: Number(costiBambino.prezzo_mensile),
            prezzoBuonoPasto: Number(costiBambino.prezzo_buono_pasto),
            giorniAperturaMeseCorrente: giorniApertura,
            pastiPotenzialiMesePrecedente: pastiPotenziali,
            pastiEffettiviMesePrecedente: pastiEffettivi,
            marcaDaBollo: Number(costiBambino.prezzo_marca_da_bollo),
            preAsiloRichiesto: costiBambino.pre_asilo_richiesto,
            prezzoPreAsilo: Number(costiBambino.prezzo_pre_asilo),
            postAsiloRichiesto: costiBambino.post_asilo_richiesto,
            prezzoPostAsilo: Number(costiBambino.prezzo_post_asilo),
            creditoDebito: creditoDebito?.importo ?? 0,
          }}
          gettoni={gettoni}
          abbonamento={{
            pre: {
              attivo: costiBambino.pre_asilo_richiesto,
              prezzoScheda: Number(costiBambino.prezzo_pre_asilo),
              prezzoPrezzi: prezziPredefiniti?.prezzi.abbonamento_pre_asilo ?? null,
            },
            post: {
              attivo: costiBambino.post_asilo_richiesto,
              prezzoScheda: Number(costiBambino.prezzo_post_asilo),
              prezzoPrezzi: prezziPredefiniti?.prezzi.abbonamento_post_asilo ?? null,
            },
          }}
          pastiNonUsufruiti={pastiNonUsufruiti(pastiPotenziali, pastiEffettivi)}
          notaCreditoDebito={creditoDebito?.nota ?? null}
          oggettoTemplate={oggettoTemplate}
          corpoTemplate={corpoTemplate}
          formAction={inviaComunicazioneRettaSingola.bind(null, bambino.id, true)}
          formActionSenzaInvio={inviaComunicazioneRettaSingola.bind(null, bambino.id, false)}
        />
      );
    }

    const gruppi = raggruppaPerSezione(bambini ?? [], (b) => b.sezione_id, sezioni ?? []);

    contenutoTabelle = gruppi.length ? (
      <div className="space-y-6">
        {gruppi.map((gruppo) => (
          <TabellaSezione key={gruppo.titolo} titolo={gruppo.titolo} righe={gruppo.elementi.map(rigaBambino)} />
        ))}
      </div>
    ) : (
      <StatoVuoto allineamento="centro">Nessun bambino attivo.</StatoVuoto>
    );

    piePagina = (
      <PulsanteInvio
        variante="primario"
        misura="normale"
        confermaMessaggio="Sei sicuro di voler inviare le comunicazioni? Verrà inviata un'email a ogni bambino con email configurata non ancora comunicato questo mese."
        className="mt-4"
      >
        Invia comunicazioni
      </PulsanteInvio>
    );
  } else {
    // Revisione di un mese passato (specs/56, scenario "navigare a un
    // mese passato per rivedere le comunicazioni inviate"): sola
    // lettura, solo i bambini con una comunicazione registrata per
    // quel mese — niente "da inviare" (inviare/annullare resta
    // possibile solo per il mese corrente). I bambini non sono
    // filtrati per `attiva`: un bambino comunicato quel mese e poi
    // disattivato deve restare visibile nella revisione storica.
    const { data: comunicazioniPassate } = await supabase
      .from('comunicazioni_retta')
      .select('*')
      .eq('mese', meseVisualizzato);
    const idBambiniComunicati = (comunicazioniPassate ?? []).map((c) => c.bambino_id);
    const { data: bambiniComunicati } = idBambiniComunicati.length
      ? await supabase.from('bambini').select('id, nome, cognome, sezione_id').in('id', idBambiniComunicati)
      : { data: [] };
    const bambinoPerId = new Map((bambiniComunicati ?? []).map((b) => [b.id, b]));

    const righe = (comunicazioniPassate ?? [])
      .filter((c) => bambinoPerId.has(c.bambino_id))
      .map((c) => ({ comunicazione: c, bambino: bambinoPerId.get(c.bambino_id)! }))
      .sort((a, b) => `${a.bambino.cognome} ${a.bambino.nome}`.localeCompare(`${b.bambino.cognome} ${b.bambino.nome}`, 'it'));

    sottotitolo = (
      <p className="mt-1 text-sm text-stone-600">
        Revisione di sola lettura: solo le comunicazioni effettivamente inviate in questo mese. Invio e annullamento
        restano possibili solo per il mese corrente.
      </p>
    );

    const gruppi = raggruppaPerSezione(righe, (r) => r.bambino.sezione_id, sezioni ?? []);

    contenutoTabelle = gruppi.length ? (
      <div className="space-y-6">
        {gruppi.map((gruppo) => (
          <TabellaSezione
            key={gruppo.titolo}
            titolo={gruppo.titolo}
            righe={gruppo.elementi.map(({ bambino, comunicazione }) => (
              <RigaComunicazione
                key={bambino.id}
                bambino={bambino}
                comunicazione={comunicazione}
                mostraAnnullaInvio={false}
                mese={meseVisualizzato}
              />
            ))}
          />
        ))}
      </div>
    ) : (
      <StatoVuoto allineamento="centro">Nessuna comunicazione inviata in questo mese.</StatoVuoto>
    );
  }

  return (
    <NavHeader nome={profilo?.nome || user.email || ''} ruolo={profilo?.ruolo ?? null}>
      {/* Niente max-w (a differenza delle altre pagine admin): la
          tabella di Rette ha molte colonne strette, su schermi larghi
          il limite classico la stringeva in uno scroll orizzontale
          interno mentre restava tanto spazio libero ai lati (uso solo
          da desktop, per scelta esplicita). */}
      <main className="mx-auto max-w-[1800px] space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Pulsante asChild variante="secondario" misura="normale" className="px-3 py-1.5">
                <Link href={`/admin/rette?mese=${mesePrecedente(meseVisualizzato)}`} aria-label="Mese precedente">
                  ←
                </Link>
              </Pulsante>
              <h1 className="text-lg font-medium">Rette — {formattaMeseItaliano(meseVisualizzato)}</h1>
              {!eMeseCorrente && (
                <Pulsante asChild variante="secondario" misura="normale" className="px-3 py-1.5">
                  <Link href={`/admin/rette?mese=${meseSuccessivo(meseVisualizzato)}`} aria-label="Mese successivo">
                    →
                  </Link>
                </Pulsante>
              )}
            </div>
            {sottotitolo}
          </div>
          <Link href="/admin/rette/template" className="text-sm text-stone-600 underline hover:text-stone-900">
            Modello email
          </Link>
        </div>

        {eMeseCorrente ? (
          <FormConEsito action={inviaComunicazioniRetta}>
            {contenutoTabelle}
            {piePagina}
          </FormConEsito>
        ) : (
          contenutoTabelle
        )}
      </main>
    </NavHeader>
  );
}
