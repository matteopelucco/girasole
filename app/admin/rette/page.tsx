import Link from 'next/link';
import { NavHeader } from '@/components/NavHeader';
import { FormConEsito } from '@/components/FormConEsito';
import { PulsanteInvio } from '@/components/PulsanteInvio';
import { requireAdmin } from '@/lib/auth';
import { chiusurePerPeriodo } from '@/lib/calendarioScolastico';
import { calcolaRiepilogoRetta, formattaImporto, giorniAperturaMese, meseRettaRichiesto } from '@/lib/comunicazioneRetta';
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
import { InvioSingoloRetta } from '@/components/InvioSingoloRetta';
import { VerificaBonifico } from '@/components/VerificaBonifico';
import {
  annullaComunicazioneRetta,
  inviaComunicazioneRettaSingola,
  inviaComunicazioniRetta,
  marcaBonificoCorretto,
  marcaBonificoImportoErrato,
  resettaVerificaBonifico,
} from './actions';

export const dynamic = 'force-dynamic';

// Raggruppa un elenco per sezione (specs/56, "raggruppare per classe,
// con il nome della classe come titolo della tabella"): un gruppo per
// ciascuna sezione che ha almeno un elemento (ordine alfabetico, stesso
// di `sezioni`), più "Senza sezione" in coda se non vuoto — mai un
// gruppo vuoto in mezzo, non aggiunge valore in una pagina già densa.
// Funzione pura, generica sul tipo di elemento (bambini "da inviare" e
// coppie {bambino, comunicazione} già inviate hanno forme diverse ma lo
// stesso bisogno di raggruppamento — CLAUDE.md, jscpd).
function raggruppaPerSezione<T>(
  elementi: T[],
  sezioneIdDi: (elemento: T) => string | null,
  sezioni: { id: string; nome: string }[]
): { titolo: string; elementi: T[] }[] {
  const perSezione = new Map<string, T[]>();
  const senzaSezione: T[] = [];

  for (const elemento of elementi) {
    const sezioneId = sezioneIdDi(elemento);
    if (!sezioneId) {
      senzaSezione.push(elemento);
      continue;
    }
    const lista = perSezione.get(sezioneId) ?? [];
    lista.push(elemento);
    perSezione.set(sezioneId, lista);
  }

  const gruppi = sezioni
    .map((sezione) => ({ titolo: sezione.nome, elementi: perSezione.get(sezione.id) ?? [] }))
    .filter((gruppo) => gruppo.elementi.length > 0);

  if (senzaSezione.length) {
    gruppi.push({ titolo: 'Senza sezione', elementi: senzaSezione });
  }

  return gruppi;
}

// Campo importo modificabile con il simbolo "€" a fianco, fuori dal
// campo compilabile (richiesta dell'utente): condiviso da conguaglio
// pasti/pre-asilo/post-asilo/costi extra, le uniche voci ancora
// modificabili in tabella (specs/56) — evita di ripetere quattro volte
// lo stesso markup input+simbolo (CLAUDE.md, jscpd).
function CampoImportoConEuro({
  name,
  ariaLabel,
  defaultValue,
  min,
  className,
}: {
  name: string;
  ariaLabel: string;
  defaultValue: number;
  min?: number;
  className: string;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <input
        type="number"
        min={min}
        step={0.01}
        defaultValue={defaultValue}
        name={name}
        aria-label={ariaLabel}
        className={className}
      />
      <span className="text-xs text-stone-500">€</span>
    </div>
  );
}

type ComunicazioneRettaRiga = {
  id: string;
  email_destinatario: string;
  retta_mensile: number | string;
  costo_pasti: number | string;
  conguaglio_pasti: number | string;
  marca_da_bollo: number | string;
  costo_pre_asilo: number | string;
  costo_post_asilo: number | string;
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

// Riga di un bambino già comunicato (specs/56): stessa forma sia nella
// vista del mese corrente sia in quella di revisione di un mese passato
// — solo "Annulla invio" cambia (mai disponibile per un mese passato, né
// per un bonifico già verificato — specs/59), fattorizzata qui per non
// duplicare le celle tra le due viste (CLAUDE.md, jscpd). La verifica
// del bonifico (specs/59) resta invece disponibile in entrambe le viste,
// finché è "da verificare".
function RigaComunicazione({
  bambino,
  comunicazione,
  mostraAnnullaInvio,
  mese,
  meseReale,
}: {
  bambino: { id: string; nome: string; cognome: string };
  comunicazione: ComunicazioneRettaRiga;
  mostraAnnullaInvio: boolean;
  mese: string;
  meseReale: string;
}) {
  return (
    <tr className="bg-emerald-50/40">
      <th scope="row" className="whitespace-nowrap px-2 py-1.5 text-left font-normal">
        <Link href={`/admin/bambini/${bambino.id}`} className="hover:underline">
          {bambino.nome} {bambino.cognome}
        </Link>
        <div className="text-xs text-stone-500">({comunicazione.email_destinatario})</div>
      </th>
      <td className="whitespace-nowrap px-2 py-1.5 text-right">
        {formattaImporto(Number(comunicazione.retta_mensile))} €
      </td>
      <td className="whitespace-nowrap px-2 py-1.5 text-right">{formattaImporto(Number(comunicazione.marca_da_bollo))}</td>
      <td className="whitespace-nowrap px-2 py-1.5 text-right">{formattaImporto(Number(comunicazione.costo_pasti))}</td>
      <td className="whitespace-nowrap px-2 py-1.5 text-right">
        {formattaImporto(Number(comunicazione.conguaglio_pasti))} €
      </td>
      <td className="whitespace-nowrap px-2 py-1.5 text-right">
        {formattaImporto(Number(comunicazione.costo_pre_asilo))} €
      </td>
      <td className="whitespace-nowrap px-2 py-1.5 text-right">
        {formattaImporto(Number(comunicazione.costo_post_asilo))} €
      </td>
      <td className="whitespace-nowrap px-2 py-1.5 text-right">
        {formattaImporto(Number(comunicazione.costi_extra))} €
      </td>
      <td className="px-2 py-1.5 text-left text-stone-600">{comunicazione.note_costi_extra ?? ''}</td>
      <td className="px-2 py-1.5 text-right">
        <div>{formattaImporto(Number(comunicazione.credito_debito))}</div>
        {comunicazione.nota_credito_debito && (
          <div className="text-left text-xs text-stone-500">{comunicazione.nota_credito_debito}</div>
        )}
      </td>
      <td className="whitespace-nowrap px-2 py-1.5 text-right font-medium">{formattaImporto(Number(comunicazione.totale))}</td>
      <td className="whitespace-nowrap px-2 py-1.5 text-left text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-emerald-800">Inviata il {formattaDataOraItaliana(comunicazione.inviata_il)}</span>
          {mostraAnnullaInvio && comunicazione.bonifico_stato === 'in_attesa' && (
            <PulsanteInvio
              mantieniTesto
              formAction={annullaComunicazioneRetta.bind(null, bambino.id, mese)}
              className="rounded-lg border border-red-300 px-2 py-0.5 font-medium text-red-700 hover:bg-red-50"
            >
              Annulla invio
            </PulsanteInvio>
          )}
        </div>
        <VerificaBonifico
          bambinoId={bambino.id}
          bambinoNome={`${bambino.nome} ${bambino.cognome}`}
          totale={Number(comunicazione.totale)}
          stato={comunicazione.bonifico_stato}
          importoRicevuto={comunicazione.bonifico_importo_ricevuto !== null ? Number(comunicazione.bonifico_importo_ricevuto) : null}
          nota={comunicazione.bonifico_nota}
          verificatoDaNome={comunicazione.bonifico_verificato_da_nome}
          verificatoIl={comunicazione.bonifico_verificato_il}
          meseSuggerito={meseSuccessivo(comunicazione.mese)}
          meseMinimo={meseReale}
          marcaCorretto={marcaBonificoCorretto.bind(null, comunicazione.id)}
          marcaImportoErrato={marcaBonificoImportoErrato.bind(null, comunicazione.id, bambino.id)}
          resettaVerifica={resettaVerificaBonifico.bind(null, comunicazione.id)}
        />
      </td>
    </tr>
  );
}

const INTESTAZIONE_COLONNE = (
  <thead>
    <tr>
      <th scope="col" className="px-2 py-1.5 text-left font-medium text-stone-700">
        Bambino
      </th>
      <th scope="col" className="max-w-[6.5rem] px-2 py-1.5 text-right font-medium text-stone-700">
        Retta
      </th>
      <th scope="col" className="max-w-[6.5rem] px-2 py-1.5 text-right font-medium text-stone-700">
        Marca da bollo
      </th>
      <th scope="col" className="max-w-[6.5rem] px-2 py-1.5 text-right font-medium text-stone-700">
        Pasti mese corrente
      </th>
      <th scope="col" className="max-w-[6.5rem] px-2 py-1.5 text-right font-medium text-stone-700">
        Conguaglio pasti mese precedente
      </th>
      <th scope="col" className="max-w-[6.5rem] px-2 py-1.5 text-right font-medium text-stone-700">
        Pre-asilo
      </th>
      <th scope="col" className="max-w-[6.5rem] px-2 py-1.5 text-right font-medium text-stone-700">
        Post-asilo
      </th>
      <th scope="col" className="max-w-[6.5rem] px-2 py-1.5 text-right font-medium text-stone-700">
        Costi extra
      </th>
      <th scope="col" className="max-w-[6.5rem] px-2 py-1.5 text-left font-medium text-stone-700">
        Nota costi extra
      </th>
      <th scope="col" className="max-w-[6.5rem] px-2 py-1.5 text-right font-medium text-stone-700">
        Credito/Debito
      </th>
      <th scope="col" className="max-w-[6.5rem] px-2 py-1.5 text-right font-medium text-stone-700">
        Totale
      </th>
      <th scope="col" className="max-w-[6.5rem] px-2 py-1.5 text-left font-medium text-stone-700">
        Stato
      </th>
    </tr>
  </thead>
);

// Una tabella per sezione, col nome della sezione come titolo
// (specs/56): stessa intestazione di colonne per tutte, solo le righe
// cambiano. Nessuna tabella per una sezione senza elementi
// (raggruppaPerSezione le filtra già).
function TabellaSezione({ titolo, righe }: { titolo: string; righe: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-stone-800">{titolo}</h2>
      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-stone-200 text-sm">
          {INTESTAZIONE_COLONNE}
          <tbody className="divide-y divide-stone-100">{righe}</tbody>
        </table>
      </div>
    </div>
  );
}

export default async function RettePage({ searchParams }: { searchParams: { mese?: string } }) {
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

    const [{ data: costi }, { data: presenzeAssenza }, { data: comunicazioni }, { data: creditiDebiti }, { data: template }, chiusure] =
      await Promise.all([
        bambinoIds.length
          ? supabase.from('costi_bambini').select('*').in('bambino_id', bambinoIds)
          : Promise.resolve({ data: [] }),
        bambinoIds.length
          ? supabase
              .from('presenze')
              .select('bambino_id')
              .in('bambino_id', bambinoIds)
              .gte('data', primoGiornoMese(mesePrecedenteValore))
              .lte('data', ultimoGiornoMese(mesePrecedenteValore))
              .in('stato', ['assente', 'malattia'])
          : Promise.resolve({ data: [] }),
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
      ]);
    const oggettoTemplate = template?.oggetto ?? 'Promemoria retta {{mese}}';
    const corpoTemplate = template?.corpo ?? '';

    const giorniApertura = giorniAperturaMese(meseVisualizzato, chiusure);
    const costiPerBambino = new Map((costi ?? []).map((c) => [c.bambino_id, c]));
    const comunicazionePerBambino = new Map((comunicazioni ?? []).map((c) => [c.bambino_id, c]));
    const creditoDebitoPerBambino = new Map(
      (creditiDebiti ?? []).map((c) => [c.bambino_id, { importo: Number(c.importo), nota: c.nota }])
    );
    const assenzePerBambino = new Map<string, number>();
    for (const riga of presenzeAssenza ?? []) {
      assenzePerBambino.set(riga.bambino_id, (assenzePerBambino.get(riga.bambino_id) ?? 0) + 1);
    }

    sottotitolo = (
      <p className="mt-1 text-sm text-stone-600">
        Giorni di apertura stimati questo mese: {giorniApertura}. Conguaglio pasti, pre-asilo, post-asilo, costi
        extra e relative note sono modificabili per una correzione ad-hoc (retta, marca da bollo, costo pasti e
        credito/debito no — questi ultimi due si cambiano dalla scheda del bambino); il totale mostrato per i
        bambini da comunicare resta la stima calcolata al caricamento della pagina, non si aggiorna mentre
        modifichi i campi — quello realmente comunicato è la somma dei valori presenti nel form al momento
        dell&apos;invio.
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
            meseReale={meseReale}
          />
        );
      }

      if (!costiBambino?.email_promemoria) {
        return (
          <tr key={bambino.id}>
            <th scope="row" className="whitespace-nowrap px-2 py-1.5 text-left font-normal">
              <Link href={`/admin/bambini/${bambino.id}`} className="hover:underline">
                {bambino.nome} {bambino.cognome}
              </Link>
            </th>
            <td colSpan={11} className="px-2 py-1.5 text-left text-xs text-amber-700">
              Costi o email non configurati —{' '}
              <Link href={`/admin/bambini/${bambino.id}`} className="underline">
                completa la scheda
              </Link>
            </td>
          </tr>
        );
      }

      const creditoDebito = creditoDebitoPerBambino.get(bambino.id);
      const riepilogo = calcolaRiepilogoRetta({
        prezzoMensile: Number(costiBambino.prezzo_mensile),
        prezzoBuonoPasto: Number(costiBambino.prezzo_buono_pasto),
        giorniAperturaMeseCorrente: giorniApertura,
        giorniAssenzaMesePrecedente: assenzePerBambino.get(bambino.id) ?? 0,
        marcaDaBollo: Number(costiBambino.prezzo_marca_da_bollo),
        preAsiloRichiesto: costiBambino.pre_asilo_richiesto,
        prezzoPreAsilo: Number(costiBambino.prezzo_pre_asilo),
        postAsiloRichiesto: costiBambino.post_asilo_richiesto,
        prezzoPostAsilo: Number(costiBambino.prezzo_post_asilo),
        costiExtra: 0,
        creditoDebito: creditoDebito?.importo ?? 0,
      });

      const nomeCompleto = `${bambino.nome} ${bambino.cognome}`;
      const classeCampoImporto =
        'w-14 rounded-lg border border-stone-300 px-1.5 py-1 text-right text-sm outline-none focus:border-stone-500';

      return (
        <tr key={bambino.id}>
          <th scope="row" className="whitespace-nowrap px-2 py-1.5 text-left font-normal">
            <Link href={`/admin/bambini/${bambino.id}`} className="hover:underline">
              {bambino.nome} {bambino.cognome}
            </Link>
            <div className="text-xs text-stone-500">({costiBambino.email_promemoria})</div>
          </th>
          <td className="whitespace-nowrap px-2 py-1.5 text-right">{formattaImporto(riepilogo.rettaMensile)} €</td>
          <td className="whitespace-nowrap px-2 py-1.5 text-right">{formattaImporto(riepilogo.marcaDaBollo)}</td>
          <td className="whitespace-nowrap px-2 py-1.5 text-right">{formattaImporto(riepilogo.costoPasti)}</td>
          <td className="whitespace-nowrap px-2 py-1.5 text-right">
            <CampoImportoConEuro
              defaultValue={riepilogo.conguaglioPasti}
              name={`conguaglio_pasti_${bambino.id}`}
              ariaLabel={`Conguaglio pasti mese precedente per ${nomeCompleto}`}
              className={classeCampoImporto}
            />
          </td>
          <td className="whitespace-nowrap px-2 py-1.5 text-right">
            <CampoImportoConEuro
              min={0}
              defaultValue={riepilogo.costoPreAsilo}
              name={`pre_asilo_${bambino.id}`}
              ariaLabel={`Pre-asilo per ${nomeCompleto}`}
              className={classeCampoImporto}
            />
          </td>
          <td className="whitespace-nowrap px-2 py-1.5 text-right">
            <CampoImportoConEuro
              min={0}
              defaultValue={riepilogo.costoPostAsilo}
              name={`post_asilo_${bambino.id}`}
              ariaLabel={`Post-asilo per ${nomeCompleto}`}
              className={classeCampoImporto}
            />
          </td>
          <td className="whitespace-nowrap px-2 py-1.5 text-right">
            <CampoImportoConEuro
              min={0}
              defaultValue={0}
              name={`costi_extra_${bambino.id}`}
              ariaLabel={`Costi extra per ${bambino.nome} ${bambino.cognome}`}
              className="w-16 rounded-lg border border-stone-300 px-1.5 py-1 text-right text-sm outline-none focus:border-stone-500"
            />
          </td>
          <td className="px-2 py-1.5 text-left">
            <input
              type="text"
              name={`note_extra_${bambino.id}`}
              placeholder="Nota (opzionale)"
              aria-label={`Nota costi extra per ${bambino.nome} ${bambino.cognome}`}
              className="w-32 rounded-lg border border-stone-300 px-1.5 py-1 text-sm outline-none focus:border-stone-500"
            />
          </td>
          <td className="px-2 py-1.5 text-right">
            <div>{formattaImporto(riepilogo.creditoDebito)}</div>
            {creditoDebito?.nota && <div className="text-left text-xs text-stone-500">{creditoDebito.nota}</div>}
          </td>
          <td className="whitespace-nowrap px-2 py-1.5 text-right font-medium">{formattaImporto(riepilogo.totale)}</td>
          <td className="whitespace-nowrap px-2 py-1.5 text-left text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-stone-500">Da inviare</span>
              <InvioSingoloRetta
                bambinoId={bambino.id}
                nome={bambino.nome}
                cognome={bambino.cognome}
                email={costiBambino.email_promemoria}
                mese={meseVisualizzato}
                rettaMensile={riepilogo.rettaMensile}
                marcaDaBollo={riepilogo.marcaDaBollo}
                costoPasti={riepilogo.costoPasti}
                creditoDebito={riepilogo.creditoDebito}
                notaCreditoDebito={creditoDebito?.nota ?? null}
                oggettoTemplate={oggettoTemplate}
                corpoTemplate={corpoTemplate}
                formAction={inviaComunicazioneRettaSingola.bind(null, bambino.id)}
              />
            </div>
          </td>
        </tr>
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
      <p className="rounded-xl border border-stone-200 bg-white px-4 py-6 text-center text-sm text-stone-600 shadow-sm">
        Nessun bambino attivo.
      </p>
    );

    piePagina = (
      <PulsanteInvio
        confermaMessaggio="Sei sicuro di voler inviare le comunicazioni? Verrà inviata un'email a ogni bambino con email configurata non ancora comunicato questo mese."
        className="mt-4 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
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
                meseReale={meseReale}
              />
            ))}
          />
        ))}
      </div>
    ) : (
      <p className="rounded-xl border border-stone-200 bg-white px-4 py-6 text-center text-sm text-stone-600 shadow-sm">
        Nessuna comunicazione inviata in questo mese.
      </p>
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
              <Link
                href={`/admin/rette?mese=${mesePrecedente(meseVisualizzato)}`}
                aria-label="Mese precedente"
                className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-100"
              >
                ←
              </Link>
              <h1 className="text-lg font-medium">Rette — {formattaMeseItaliano(meseVisualizzato)}</h1>
              {!eMeseCorrente && (
                <Link
                  href={`/admin/rette?mese=${meseSuccessivo(meseVisualizzato)}`}
                  aria-label="Mese successivo"
                  className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-100"
                >
                  →
                </Link>
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
