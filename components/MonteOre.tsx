import { formattaDataItaliana, formattaDataOraItaliana } from '@/lib/date';
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
// movimenti e può aggiungerne uno manuale ("precarico"), sempre
// motivato da una nota. Condiviso fra la vista personale e quella
// admin di /dashboard/ore-lavoro (stessa pagina, cambia solo
// `modalitaAdmin` — CLAUDE.md/jscpd, stesso principio già in uso per il
// resto della pagina).
export function MonteOre({
  saldo,
  movimenti,
  modalitaAdmin,
  utenteId,
  aggiungiMovimento,
}: {
  saldo: number;
  movimenti: MovimentoMonteOre[];
  modalitaAdmin: boolean;
  utenteId: string;
  aggiungiMovimento: (statoPrecedente: EsitoAzione, formData: FormData) => Promise<EsitoAzione>;
}) {
  return (
    <div className="rounded-xl border border-purple-200 bg-purple-50 p-3 text-sm text-purple-900">
      <p>
        Monte ore attuale: <strong>{saldo}h</strong>
      </p>

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
              Movimento
              <select
                name="segno"
                className="mt-1 block rounded-lg border border-purple-300 px-2 py-1.5 text-sm outline-none focus:border-purple-500"
              >
                <option value="aumenta">Aumenta il monte ore</option>
                <option value="riduce">Riduce il monte ore</option>
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
              {movimenti.slice(0, 20).map((m) => (
                <li key={m.id} className="text-xs text-purple-800">
                  {formattaDataOraItaliana(m.created_at)} —{' '}
                  <strong>
                    {Number(m.variazione) > 0 ? '+' : ''}
                    {m.variazione}h
                  </strong>
                  {m.tipo === 'precarico'
                    ? ' (manuale)'
                    : m.settimana_inizio
                      ? ` (settimana ${formattaDataItaliana(m.settimana_inizio)})`
                      : ''}
                  {m.nota ? ` — ${m.nota}` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
