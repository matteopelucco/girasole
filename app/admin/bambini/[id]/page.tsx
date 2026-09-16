import { redirect } from 'next/navigation';
import { NavHeader } from '@/components/NavHeader';
import { FormConEsito } from '@/components/FormConEsito';
import { PulsanteInvio } from '@/components/PulsanteInvio';
import { requireAdmin } from '@/lib/auth';
import { formattaImporto } from '@/lib/comunicazioneRetta';
import { formattaDataOraItaliana, formattaMeseItaliano, meseDaData, meseSuccessivo, oggi } from '@/lib/date';
import {
  aggiornaBambino,
  aggiornaCostiBambino,
  aggiungiCreditoDebito,
  eliminaCreditoDebito,
  toggleAttivaBambino,
} from '../../actions';

export const dynamic = 'force-dynamic';

export default async function BambinoDettaglioPage({ params }: { params: { id: string } }) {
  const { supabase, user, profilo } = await requireAdmin();

  const [{ data: bambino }, { data: sezioni }, { data: costi }, { data: creditiDebiti }] = await Promise.all([
    supabase
      .from('bambini')
      .select('id, nome, cognome, data_nascita, sesso, sezione_id, note_allergie, altre_note, attiva')
      .eq('id', params.id)
      .maybeSingle(),
    supabase.from('sezioni').select('id, nome').order('nome'),
    supabase
      .from('costi_bambini')
      .select(
        'prezzo_mensile, prezzo_buono_pasto, prezzo_marca_da_bollo, pre_asilo_richiesto, prezzo_pre_asilo, post_asilo_richiesto, prezzo_post_asilo, email_promemoria'
      )
      .eq('bambino_id', params.id)
      .maybeSingle(),
    supabase
      .from('crediti_debiti_bambini')
      .select('id, mese_competenza, importo, nota, origine, creato_da_nome, created_at, applicato_il')
      .eq('bambino_id', params.id)
      .order('created_at', { ascending: false }),
  ]);

  if (!bambino) redirect('/admin');

  // specs/58, "il mese di competenza è precompilato con la prossima
  // retta utile": suggerimento, non un vincolo (min lasciato al mese
  // corrente, mai un mese già trascorso — vedi aggiungiCreditoDebito).
  const meseSuggerito = meseSuccessivo(meseDaData(oggi()));
  const meseMinimo = meseDaData(oggi());

  return (
    <NavHeader nome={profilo?.nome || user.email || ''} ruolo={profilo?.ruolo ?? null}>
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <a href="/admin" className="text-sm text-stone-600 hover:text-stone-900">
          ← Torna a Sezioni e bambini
        </a>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-medium">
            {bambino.nome} {bambino.cognome}
          </h1>
          {!bambino.attiva && (
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-700">
              Disattivato
            </span>
          )}
        </div>

        <FormConEsito
          action={aggiornaBambino}
          className="space-y-2 rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
        >
          <input type="hidden" name="bambino_id" value={bambino.id} />
          <div className="flex gap-2">
            <input
              name="nome"
              required
              defaultValue={bambino.nome}
              placeholder="Nome"
              className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
            />
            <input
              name="cognome"
              required
              defaultValue={bambino.cognome}
              placeholder="Cognome"
              className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
            />
          </div>
          <div className="flex gap-2">
            <input
              name="data_nascita"
              type="date"
              required
              defaultValue={bambino.data_nascita ?? ''}
              aria-label="Data di nascita"
              className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
            />
            <select
              name="sesso"
              required
              defaultValue={bambino.sesso ?? ''}
              aria-label="Sesso"
              className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
            >
              <option value="" disabled>
                Sesso
              </option>
              <option value="F">Femmina</option>
              <option value="M">Maschio</option>
            </select>
          </div>
          <select
            name="sezione_id"
            defaultValue={bambino.sezione_id ?? ''}
            aria-label="Sezione"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
          >
            <option value="">Nessuna sezione</option>
            {sezioni?.map((sezione) => (
              <option key={sezione.id} value={sezione.id}>
                {sezione.nome}
              </option>
            ))}
          </select>
          <input
            name="note_allergie"
            defaultValue={bambino.note_allergie ?? ''}
            placeholder="Allergie o intolleranze (opzionale)"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
          />
          <input
            name="altre_note"
            defaultValue={bambino.altre_note ?? ''}
            placeholder="Altre note (opzionale)"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
          />
          <PulsanteInvio className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800">
            Salva modifiche
          </PulsanteInvio>
        </FormConEsito>

        <FormConEsito action={toggleAttivaBambino}>
          <input type="hidden" name="bambino_id" value={bambino.id} />
          <input type="hidden" name="attiva_attuale" value={String(bambino.attiva)} />
          <PulsanteInvio className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50">
            {bambino.attiva ? 'Disattiva bambino' : 'Riattiva bambino'}
          </PulsanteInvio>
        </FormConEsito>

        <div className="space-y-2">
          <h2 className="text-base font-medium">Costi</h2>
          <FormConEsito
            action={aggiornaCostiBambino}
            className="space-y-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
          >
            <input type="hidden" name="bambino_id" value={bambino.id} />
            <div className="flex flex-wrap gap-2">
              <label className="flex-1 text-xs text-stone-600">
                Prezzo retta mensile (€)
                <input
                  name="prezzo_mensile"
                  type="number"
                  min={0}
                  step={0.01}
                  defaultValue={costi?.prezzo_mensile ?? 0}
                  aria-label="Prezzo retta mensile (€)"
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
                />
              </label>
              <label className="flex-1 text-xs text-stone-600">
                Prezzo buono pasto (€)
                <input
                  name="prezzo_buono_pasto"
                  type="number"
                  min={0}
                  step={0.01}
                  // Come marca da bollo sotto: precompilato all'importo
                  // corrente tipico (6€), non a 0, solo per un bambino
                  // senza ancora nessun costo salvato (specs/55).
                  defaultValue={costi?.prezzo_buono_pasto ?? 6}
                  aria-label="Prezzo buono pasto (€)"
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
                />
              </label>
              <label className="flex-1 text-xs text-stone-600">
                Prezzo marca da bollo (€)
                <input
                  name="prezzo_marca_da_bollo"
                  type="number"
                  min={0}
                  step={0.01}
                  // Precompilato all'importo corrente reale (2€), non a 0
                  // ("nessun importo previsto") — solo per un bambino
                  // senza ancora nessun costo salvato (specs/55).
                  defaultValue={costi?.prezzo_marca_da_bollo ?? 2}
                  aria-label="Prezzo marca da bollo (€)"
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-4">
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-2 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    name="pre_asilo_richiesto"
                    defaultChecked={costi?.pre_asilo_richiesto ?? false}
                    className="h-4 w-4"
                  />
                  Pre-asilo richiesto
                </label>
                <label className="text-xs text-stone-600">
                  Prezzo (€)
                  <input
                    name="prezzo_pre_asilo"
                    type="number"
                    min={0}
                    step={0.01}
                    defaultValue={costi?.prezzo_pre_asilo ?? 70}
                    aria-label="Prezzo pre-asilo (€)"
                    className="mt-1 block w-28 rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
                  />
                </label>
              </div>
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-2 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    name="post_asilo_richiesto"
                    defaultChecked={costi?.post_asilo_richiesto ?? false}
                    className="h-4 w-4"
                  />
                  Post-asilo richiesto
                </label>
                <label className="text-xs text-stone-600">
                  Prezzo (€)
                  <input
                    name="prezzo_post_asilo"
                    type="number"
                    min={0}
                    step={0.01}
                    defaultValue={costi?.prezzo_post_asilo ?? 70}
                    aria-label="Prezzo post-asilo (€)"
                    className="mt-1 block w-28 rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
                  />
                </label>
              </div>
            </div>

            <label className="block text-xs text-stone-600">
              Email promemoria retta
              <input
                name="email_promemoria"
                defaultValue={costi?.email_promemoria ?? ''}
                placeholder="genitore@esempio.it (opzionale, più indirizzi separati da ;)"
                aria-label="Email promemoria retta"
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
              />
            </label>

            <PulsanteInvio className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800">
              Salva costi
            </PulsanteInvio>
          </FormConEsito>
        </div>

        <div className="space-y-2">
          <h2 className="text-base font-medium">Crediti e debiti</h2>
          <p className="text-xs text-stone-600">
            Un credito o debito verso l&apos;asilo non derivante dal calcolo automatico della retta: verrà
            proposto (e resterà modificabile) nella comunicazione del mese di competenza scelto.
          </p>

          {creditiDebiti && creditiDebiti.length > 0 && (
            <ul className="space-y-2">
              {creditiDebiti.map((voce) => {
                const eCredito = Number(voce.importo) < 0;
                return (
                  <li
                    key={voce.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200 bg-white p-3 text-sm shadow-sm"
                  >
                    <div>
                      <span className={eCredito ? 'font-medium text-emerald-700' : 'font-medium text-red-700'}>
                        {eCredito ? 'Credito' : 'Debito'} di {formattaImporto(Math.abs(Number(voce.importo)))}
                      </span>{' '}
                      <span className="text-stone-600">— {voce.nota}</span>
                      <div className="text-xs text-stone-500">
                        {voce.applicato_il
                          ? `Conteggiato nella retta di ${formattaMeseItaliano(voce.mese_competenza)}`
                          : `Da conteggiare su ${formattaMeseItaliano(voce.mese_competenza)}`}
                        {' — '}
                        {voce.origine === 'bonifico' ? 'da verifica bonifico' : 'inserito manualmente'}, da{' '}
                        {voce.creato_da_nome} il {formattaDataOraItaliana(voce.created_at)}
                      </div>
                    </div>
                    {!voce.applicato_il && (
                      <FormConEsito action={eliminaCreditoDebito}>
                        <input type="hidden" name="id" value={voce.id} />
                        <input type="hidden" name="bambino_id" value={bambino.id} />
                        <PulsanteInvio
                          confermaMessaggio="Eliminare questo credito/debito?"
                          className="rounded-lg border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                        >
                          Elimina
                        </PulsanteInvio>
                      </FormConEsito>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <FormConEsito
            action={aggiungiCreditoDebito}
            className="space-y-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
          >
            <input type="hidden" name="bambino_id" value={bambino.id} />
            <div className="flex flex-wrap gap-2">
              <label className="text-xs text-stone-600">
                Tipo
                <select
                  name="tipo"
                  defaultValue="debito"
                  aria-label="Tipo"
                  className="mt-1 block w-28 rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
                >
                  <option value="debito">Debito</option>
                  <option value="credito">Credito</option>
                </select>
              </label>
              <label className="flex-1 text-xs text-stone-600">
                Importo (€)
                <input
                  name="importo"
                  type="number"
                  min={0.01}
                  step={0.01}
                  aria-label="Importo (€)"
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
                />
              </label>
              <label className="text-xs text-stone-600">
                Mese di competenza
                <input
                  name="mese_competenza"
                  type="month"
                  min={meseMinimo}
                  defaultValue={meseSuggerito}
                  aria-label="Mese di competenza"
                  className="mt-1 block rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
                />
              </label>
            </div>
            <label className="block text-xs text-stone-600">
              Nota (obbligatoria)
              <input
                name="nota"
                required
                placeholder="Motivo del credito/debito"
                aria-label="Nota"
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
              />
            </label>
            <PulsanteInvio className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800">
              Aggiungi credito/debito
            </PulsanteInvio>
          </FormConEsito>
        </div>
      </main>
    </NavHeader>
  );
}
