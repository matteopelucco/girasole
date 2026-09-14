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
import { annullaComunicazioneRetta, inviaComunicazioniRetta } from './actions';

export const dynamic = 'force-dynamic';

type ComunicazioneRettaRiga = {
  retta_mensile: number | string;
  costo_pasti: number | string;
  conguaglio_pasti: number | string;
  marca_da_bollo: number | string;
  costo_pre_asilo: number | string;
  costo_post_asilo: number | string;
  costi_extra: number | string;
  note_costi_extra: string | null;
  totale: number | string;
  inviata_il: string;
};

// Riga di un bambino già comunicato (specs/56): stessa forma sia nella
// vista del mese corrente sia in quella di revisione di un mese passato
// — solo "Annulla invio" cambia (mai disponibile per un mese passato,
// "Fuori scope"), fattorizzata qui per non duplicare le 9 celle tra le
// due viste (CLAUDE.md, jscpd).
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
    <tr className="bg-emerald-50/40">
      <th scope="row" className="whitespace-nowrap px-3 py-2 text-left font-normal">
        <Link href={`/admin/bambini/${bambino.id}`} className="hover:underline">
          {bambino.nome} {bambino.cognome}
        </Link>
      </th>
      <td className="whitespace-nowrap px-3 py-2 text-right">{formattaImporto(Number(comunicazione.retta_mensile))}</td>
      <td className="whitespace-nowrap px-3 py-2 text-right">{formattaImporto(Number(comunicazione.costo_pasti))}</td>
      <td className="whitespace-nowrap px-3 py-2 text-right">
        {formattaImporto(Number(comunicazione.conguaglio_pasti))}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right">{formattaImporto(Number(comunicazione.marca_da_bollo))}</td>
      <td className="whitespace-nowrap px-3 py-2 text-right">
        {formattaImporto(Number(comunicazione.costo_pre_asilo))}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right">
        {formattaImporto(Number(comunicazione.costo_post_asilo))}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right">{formattaImporto(Number(comunicazione.costi_extra))}</td>
      <td className="px-3 py-2 text-left text-stone-600">{comunicazione.note_costi_extra ?? ''}</td>
      <td className="whitespace-nowrap px-3 py-2 text-right font-medium">{formattaImporto(Number(comunicazione.totale))}</td>
      <td className="whitespace-nowrap px-3 py-2 text-left text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-emerald-800">Inviata il {formattaDataOraItaliana(comunicazione.inviata_il)}</span>
          {mostraAnnullaInvio && (
            <PulsanteInvio
              mantieniTesto
              formAction={annullaComunicazioneRetta.bind(null, bambino.id, mese)}
              className="rounded-lg border border-red-300 px-2 py-0.5 font-medium text-red-700 hover:bg-red-50"
            >
              Annulla invio
            </PulsanteInvio>
          )}
        </div>
      </td>
    </tr>
  );
}

export default async function RettePage({ searchParams }: { searchParams: { mese?: string } }) {
  const { supabase, user, profilo } = await requireAdmin();

  const meseReale = meseDaData(oggi());
  const meseVisualizzato = meseRettaRichiesto(searchParams.mese, meseReale);
  const eMeseCorrente = meseVisualizzato === meseReale;

  const intestazioneColonne = (
    <thead>
      <tr>
        <th scope="col" className="px-3 py-2 text-left font-medium text-stone-700">
          Bambino
        </th>
        <th scope="col" className="px-3 py-2 text-right font-medium text-stone-700">
          Retta
        </th>
        <th scope="col" className="px-3 py-2 text-right font-medium text-stone-700">
          Costo pasti
        </th>
        <th scope="col" className="px-3 py-2 text-right font-medium text-stone-700">
          Conguaglio pasti
        </th>
        <th scope="col" className="px-3 py-2 text-right font-medium text-stone-700">
          Marca da bollo
        </th>
        <th scope="col" className="px-3 py-2 text-right font-medium text-stone-700">
          Pre-asilo
        </th>
        <th scope="col" className="px-3 py-2 text-right font-medium text-stone-700">
          Post-asilo
        </th>
        <th scope="col" className="px-3 py-2 text-right font-medium text-stone-700">
          Costi extra
        </th>
        <th scope="col" className="px-3 py-2 text-left font-medium text-stone-700">
          Nota
        </th>
        <th scope="col" className="px-3 py-2 text-right font-medium text-stone-700">
          Totale
        </th>
        <th scope="col" className="px-3 py-2 text-left font-medium text-stone-700">
          Stato
        </th>
      </tr>
    </thead>
  );

  let corpoTabella: React.ReactNode;
  let piePagina: React.ReactNode = null;
  let sottotitolo: React.ReactNode;

  if (eMeseCorrente) {
    const mesePrecedenteValore = mesePrecedente(meseVisualizzato);

    const { data: bambini } = await supabase
      .from('bambini')
      .select('id, nome, cognome')
      .eq('attiva', true)
      .order('cognome');
    const bambinoIds = (bambini ?? []).map((b) => b.id);

    const [{ data: costi }, { data: presenzeAssenza }, { data: comunicazioni }, chiusure] = await Promise.all([
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
      chiusurePerPeriodo(supabase, primoGiornoMese(mesePrecedenteValore), ultimoGiornoMese(meseVisualizzato)),
    ]);

    const giorniApertura = giorniAperturaMese(meseVisualizzato, chiusure);
    const costiPerBambino = new Map((costi ?? []).map((c) => [c.bambino_id, c]));
    const comunicazionePerBambino = new Map((comunicazioni ?? []).map((c) => [c.bambino_id, c]));
    const assenzePerBambino = new Map<string, number>();
    for (const riga of presenzeAssenza ?? []) {
      assenzePerBambino.set(riga.bambino_id, (assenzePerBambino.get(riga.bambino_id) ?? 0) + 1);
    }

    sottotitolo = (
      <p className="mt-1 text-sm text-stone-600">
        Giorni di apertura stimati questo mese: {giorniApertura}. Il totale mostrato per i bambini da comunicare non
        include eventuali costi extra non ancora inviati.
      </p>
    );

    corpoTabella = (
      <tbody className="divide-y divide-stone-100">
        {(bambini ?? []).map((bambino) => {
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
              <tr key={bambino.id}>
                <th scope="row" className="whitespace-nowrap px-3 py-2 text-left font-normal">
                  <Link href={`/admin/bambini/${bambino.id}`} className="hover:underline">
                    {bambino.nome} {bambino.cognome}
                  </Link>
                </th>
                <td colSpan={9} className="px-3 py-2 text-left text-xs text-amber-700">
                  Costi o email non configurati —{' '}
                  <Link href={`/admin/bambini/${bambino.id}`} className="underline">
                    completa la scheda
                  </Link>
                </td>
              </tr>
            );
          }

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
          });

          return (
            <tr key={bambino.id}>
              <th scope="row" className="whitespace-nowrap px-3 py-2 text-left font-normal">
                <Link href={`/admin/bambini/${bambino.id}`} className="hover:underline">
                  {bambino.nome} {bambino.cognome}
                </Link>
              </th>
              <td className="whitespace-nowrap px-3 py-2 text-right">{formattaImporto(riepilogo.rettaMensile)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right">{formattaImporto(riepilogo.costoPasti)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right">{formattaImporto(riepilogo.conguaglioPasti)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right">{formattaImporto(riepilogo.marcaDaBollo)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right">{formattaImporto(riepilogo.costoPreAsilo)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right">{formattaImporto(riepilogo.costoPostAsilo)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right">
                <input
                  type="number"
                  step={0.01}
                  defaultValue={0}
                  name={`costi_extra_${bambino.id}`}
                  aria-label={`Costi extra per ${bambino.nome} ${bambino.cognome}`}
                  className="w-24 rounded-lg border border-stone-300 px-2 py-1 text-right text-sm outline-none focus:border-stone-500"
                />
              </td>
              <td className="px-3 py-2 text-left">
                <input
                  type="text"
                  name={`note_extra_${bambino.id}`}
                  placeholder="Nota (opzionale)"
                  aria-label={`Nota costi extra per ${bambino.nome} ${bambino.cognome}`}
                  className="w-40 rounded-lg border border-stone-300 px-2 py-1 text-sm outline-none focus:border-stone-500"
                />
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right font-medium">{formattaImporto(riepilogo.totale)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-left text-xs text-stone-500">Da inviare</td>
            </tr>
          );
        })}
        {!bambini?.length && (
          <tr>
            <td colSpan={11} className="px-3 py-4 text-center text-stone-600">
              Nessun bambino attivo.
            </td>
          </tr>
        )}
      </tbody>
    );

    piePagina = (
      <PulsanteInvio className="mt-4 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800">
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
      ? await supabase.from('bambini').select('id, nome, cognome').in('id', idBambiniComunicati)
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

    corpoTabella = (
      <tbody className="divide-y divide-stone-100">
        {righe.map(({ bambino, comunicazione }) => (
          <RigaComunicazione
            key={bambino.id}
            bambino={bambino}
            comunicazione={comunicazione}
            mostraAnnullaInvio={false}
            mese={meseVisualizzato}
          />
        ))}
        {!righe.length && (
          <tr>
            <td colSpan={11} className="px-3 py-4 text-center text-stone-600">
              Nessuna comunicazione inviata in questo mese.
            </td>
          </tr>
        )}
      </tbody>
    );
  }

  const tabella = (
    <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-stone-200 text-sm">
        {intestazioneColonne}
        {corpoTabella}
      </table>
    </div>
  );

  return (
    <NavHeader nome={profilo?.nome || user.email || ''} ruolo={profilo?.ruolo ?? null}>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
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
            {tabella}
            {piePagina}
          </FormConEsito>
        ) : (
          tabella
        )}
      </main>
    </NavHeader>
  );
}
