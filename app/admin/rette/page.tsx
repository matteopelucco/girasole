import Link from 'next/link';
import { NavHeader } from '@/components/NavHeader';
import { FormConEsito } from '@/components/FormConEsito';
import { PulsanteInvio } from '@/components/PulsanteInvio';
import { requireAdmin } from '@/lib/auth';
import { chiusurePerPeriodo } from '@/lib/calendarioScolastico';
import { calcolaRiepilogoRetta, formattaImporto, giorniAperturaMese } from '@/lib/comunicazioneRetta';
import {
  formattaDataOraItaliana,
  formattaMeseItaliano,
  meseDaData,
  mesePrecedente,
  oggi,
  primoGiornoMese,
  ultimoGiornoMese,
} from '@/lib/date';
import { inviaComunicazioniRetta } from './actions';

export const dynamic = 'force-dynamic';

export default async function RettePage() {
  const { supabase, user, profilo } = await requireAdmin();

  const meseCorrente = meseDaData(oggi());
  const mesePrecedenteValore = mesePrecedente(meseCorrente);

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
      ? supabase.from('comunicazioni_retta').select('*').eq('mese', meseCorrente).in('bambino_id', bambinoIds)
      : Promise.resolve({ data: [] }),
    chiusurePerPeriodo(supabase, primoGiornoMese(mesePrecedenteValore), ultimoGiornoMese(meseCorrente)),
  ]);

  const giorniApertura = giorniAperturaMese(meseCorrente, chiusure);
  const costiPerBambino = new Map((costi ?? []).map((c) => [c.bambino_id, c]));
  const comunicazionePerBambino = new Map((comunicazioni ?? []).map((c) => [c.bambino_id, c]));
  const assenzePerBambino = new Map<string, number>();
  for (const riga of presenzeAssenza ?? []) {
    assenzePerBambino.set(riga.bambino_id, (assenzePerBambino.get(riga.bambino_id) ?? 0) + 1);
  }

  return (
    <NavHeader nome={profilo?.nome || user.email || ''} ruolo={profilo?.ruolo ?? null}>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-medium">Rette — {formattaMeseItaliano(meseCorrente)}</h1>
            <p className="mt-1 text-sm text-stone-600">
              Giorni di apertura stimati questo mese: {giorniApertura}. Il totale mostrato per i bambini da
              comunicare non include eventuali costi extra non ancora inviati.
            </p>
          </div>
          <Link href="/admin/rette/template" className="text-sm text-stone-600 underline hover:text-stone-900">
            Modello email
          </Link>
        </div>

        <FormConEsito action={inviaComunicazioniRetta}>
          <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-stone-200 text-sm">
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
              <tbody className="divide-y divide-stone-100">
                {(bambini ?? []).map((bambino) => {
                  const comunicazione = comunicazionePerBambino.get(bambino.id);
                  const costiBambino = costiPerBambino.get(bambino.id);

                  if (comunicazione) {
                    return (
                      <tr key={bambino.id} className="bg-emerald-50/40">
                        <th scope="row" className="whitespace-nowrap px-3 py-2 text-left font-normal">
                          <Link href={`/admin/bambini/${bambino.id}`} className="hover:underline">
                            {bambino.nome} {bambino.cognome}
                          </Link>
                        </th>
                        <td className="whitespace-nowrap px-3 py-2 text-right">
                          {formattaImporto(Number(comunicazione.retta_mensile))}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">
                          {formattaImporto(Number(comunicazione.costo_pasti))}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">
                          {formattaImporto(Number(comunicazione.conguaglio_pasti))}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">
                          {formattaImporto(Number(comunicazione.costo_pre_asilo))}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">
                          {formattaImporto(Number(comunicazione.costo_post_asilo))}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">
                          {formattaImporto(Number(comunicazione.costi_extra))}
                        </td>
                        <td className="px-3 py-2 text-left text-stone-600">{comunicazione.note_costi_extra ?? ''}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right font-medium">
                          {formattaImporto(Number(comunicazione.totale))}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-left text-xs text-emerald-800">
                          Inviata il {formattaDataOraItaliana(comunicazione.inviata_il)}
                        </td>
                      </tr>
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
                        <td colSpan={8} className="px-3 py-2 text-left text-xs text-amber-700">
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
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        {formattaImporto(riepilogo.rettaMensile)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">{formattaImporto(riepilogo.costoPasti)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        {formattaImporto(riepilogo.conguaglioPasti)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        {formattaImporto(riepilogo.costoPreAsilo)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        {formattaImporto(riepilogo.costoPostAsilo)}
                      </td>
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
                      <td className="whitespace-nowrap px-3 py-2 text-right font-medium">
                        {formattaImporto(riepilogo.totale)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-left text-xs text-stone-500">Da inviare</td>
                    </tr>
                  );
                })}
                {!bambini?.length && (
                  <tr>
                    <td colSpan={10} className="px-3 py-4 text-center text-stone-600">
                      Nessun bambino attivo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <PulsanteInvio className="mt-4 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800">
            Invia comunicazioni
          </PulsanteInvio>
        </FormConEsito>
      </main>
    </NavHeader>
  );
}
