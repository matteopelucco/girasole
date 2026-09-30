import { formattaDataItaliana, formattaDataOraItaliana } from '@/lib/date';
import { descrizioneSaldoMonteOre, LEGENDA_MONTE_ORE, saldoMonteOreBreve } from '@/lib/monteOre';
import { FormConEsito, type EsitoAzione } from '@/components/FormConEsito';
import { PulsanteInvio } from '@/components/PulsanteInvio';

type MovimentoMonteOre = {
  id: string;
  tipo: string;
  settimana_inizio: string | null;
  variazione: number | string;
  nota: string | null;
  created_at: string;
};

// Monte ore (specs/19 - monte-ore.md): il saldo è sempre visibile, al
// diretto interessato e all'admin; solo l'admin vede lo storico dei
// movimenti e li gestisce a mano: ne inserisce uno (sempre motivato da
// una nota), ne modifica o ne elimina uno qualunque, anche storico. Condiviso fra la vista personale e quella
// admin di /dashboard/ore-lavoro (stessa pagina, cambia solo
// `modalitaAdmin` — CLAUDE.md/jscpd, stesso principio già in uso per il
// resto della pagina).
export function MonteOre({
  saldo,
  movimenti,
  modalitaAdmin,
  utenteId,
  aggiungiMovimento,
  modificaMovimento,
  eliminaMovimento,
}: {
  saldo: number;
  movimenti: MovimentoMonteOre[];
  modalitaAdmin: boolean;
  utenteId: string;
  aggiungiMovimento: (statoPrecedente: EsitoAzione, formData: FormData) => Promise<EsitoAzione>;
  modificaMovimento: (statoPrecedente: EsitoAzione, formData: FormData) => Promise<EsitoAzione>;
  eliminaMovimento: (statoPrecedente: EsitoAzione, formData: FormData) => Promise<EsitoAzione>;
}) {
  return (
    <div className="rounded-xl border border-purple-200 bg-purple-50 p-3 text-sm text-purple-900">
      <p>
        Monte ore attuale: <strong>{descrizioneSaldoMonteOre(saldo)}</strong>
      </p>
      <p className="mt-1 text-xs text-purple-800">{LEGENDA_MONTE_ORE}</p>

      {modalitaAdmin && (
        <div className="mt-3 space-y-3">
          <FormConEsito action={aggiungiMovimento} resetSuOk className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="utente_id" value={utenteId} />
            <label className="text-xs font-medium text-purple-900">
              Ore
              <input
                type="number"
                name="ore"
                min="0.01"
                step="0.01"
                className="mt-1 block w-24 rounded-lg border border-purple-300 px-2 py-1.5 text-sm outline-none focus:border-purple-500"
              />
            </label>
            <label className="text-xs font-medium text-purple-900">
              Verso del movimento
              <select
                name="verso"
                defaultValue=""
                className="mt-1 block rounded-lg border border-purple-300 px-2 py-1.5 text-sm outline-none focus:border-purple-500"
              >
                <option value="">Scegli…</option>
                <option value="credito">Il dipendente ha erogato ore in più (+)</option>
                <option value="debito">Il dipendente deve ancora erogare ore (−)</option>
              </select>
            </label>
            <label className="min-w-[12rem] flex-1 text-xs font-medium text-purple-900">
              Nota
              <input
                type="text"
                name="nota"
                placeholder="Motivo del movimento"
                className="mt-1 block w-full rounded-lg border border-purple-300 px-2 py-1.5 text-sm outline-none focus:border-purple-500"
              />
            </label>
            <PulsanteInvio className="rounded-lg bg-purple-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-800">
              Registra movimento
            </PulsanteInvio>
          </FormConEsito>

          {movimenti.length > 0 && (
            <ul className="space-y-1 border-t border-purple-200 pt-2">
              {movimenti.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-2 text-xs text-purple-900">
                  <span>
                    {formattaDataOraItaliana(m.created_at)} —{' '}
                    <strong>{saldoMonteOreBreve(Number(m.variazione))}</strong>
                    {m.tipo === 'precarico'
                      ? ' (manuale)'
                      : m.settimana_inizio
                        ? ` (storico, settimana ${formattaDataItaliana(m.settimana_inizio)})`
                        : ' (storico)'}
                    {m.nota ? ` — ${m.nota}` : ''}
                  </span>
                  <details className="w-full">
                    <summary className="cursor-pointer text-xs font-medium text-purple-900 underline">Modifica</summary>
                    <FormConEsito action={modificaMovimento} className="mt-2 flex flex-wrap items-end gap-2">
                      <input type="hidden" name="id" value={m.id} />
                      <label className="text-xs font-medium text-purple-900">
                        Ore
                        <input
                          type="number"
                          name="ore"
                          min="0.01"
                          step="0.01"
                          defaultValue={Math.abs(Number(m.variazione))}
                          aria-label={`Ore movimento ${m.id}`}
                          className="mt-1 block w-24 rounded-lg border border-purple-300 px-2 py-1.5 text-sm outline-none focus:border-purple-500"
                        />
                      </label>
                      <label className="text-xs font-medium text-purple-900">
                        Verso del movimento
                        <select
                          name="verso"
                          defaultValue={Number(m.variazione) < 0 ? 'debito' : 'credito'}
                          aria-label={`Verso movimento ${m.id}`}
                          className="mt-1 block rounded-lg border border-purple-300 px-2 py-1.5 text-sm outline-none focus:border-purple-500"
                        >
                          <option value="credito">Il dipendente ha erogato ore in più (+)</option>
                          <option value="debito">Il dipendente deve ancora erogare ore (−)</option>
                        </select>
                      </label>
                      <label className="min-w-[12rem] flex-1 text-xs font-medium text-purple-900">
                        Nota
                        <input
                          type="text"
                          name="nota"
                          defaultValue={m.nota ?? ''}
                          aria-label={`Nota movimento ${m.id}`}
                          className="mt-1 block w-full rounded-lg border border-purple-300 px-2 py-1.5 text-sm outline-none focus:border-purple-500"
                        />
                      </label>
                      <PulsanteInvio className="rounded-lg bg-purple-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-800">
                        Salva modifica
                      </PulsanteInvio>
                    </FormConEsito>
                  </details>
                  <FormConEsito action={eliminaMovimento}>
                    <input type="hidden" name="id" value={m.id} />
                    <PulsanteInvio
                      confermaMessaggio="Eliminare questo movimento di monte ore?"
                      className="rounded border border-red-300 px-1.5 py-0.5 text-xs font-medium text-red-700 hover:bg-red-50"
                    >
                      Elimina
                    </PulsanteInvio>
                  </FormConEsito>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
