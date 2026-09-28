import { PulsanteInvio } from '@/components/PulsanteInvio';
import { BottoneSalvaNota } from '@/components/BottoneSalvaNota';
import { EtichettaAssente } from '@/components/EtichettaAssente';
import { EtichettaMalattia } from '@/components/EtichettaMalattia';
import { classePulsanteStato } from '@/lib/classiStato';
import { segnaPasto, salvaNotaPasto } from '../pasti/actions';
import { ALTEZZA_TAP, ETICHETTE_PASTO, IntestazioneColonna } from './comune';

export type PastoGiorno = { mangiato: 'si' | 'no'; note: string | null };

// Colonna "Pasto" della card bambino (specs/10, regole in specs/14),
// renderizzata solo per maestra e admin: la pagina non la crea (e non
// legge i pasti) per l'assistente. Per un bambino assente o malato
// mostra l'etichetta al posto dei pulsanti; `modificabile` è falso nei
// giorni non scrivibili e, per la maestra, dopo la comunicazione a Rojac
// (specs/16).
export function ColonnaPasto({
  bambinoId,
  data,
  pasto,
  statoPresenza,
  modificabile,
}: {
  bambinoId: string;
  data: string;
  pasto: PastoGiorno | undefined;
  statoPresenza: string | undefined;
  modificabile: boolean;
}) {
  const idTitolo = `pasto-${bambinoId}`;
  const assente = statoPresenza === 'assente';
  const malato = statoPresenza === 'malattia';

  let contenuto;
  if (assente || malato) {
    contenuto = (
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-stone-600">
        {assente ? <EtichettaAssente /> : <EtichettaMalattia />}
        <span>pasto non applicabile</span>
      </div>
    );
  } else if (modificabile) {
    contenuto = (
      <form className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {(['si', 'no'] as const).map((mangiato) => (
            <PulsanteInvio
              key={mangiato}
              mantieniTesto
              formAction={segnaPasto.bind(null, bambinoId, mangiato, data)}
              className={`${classePulsanteStato(mangiato, pasto?.mangiato === mangiato)} ${ALTEZZA_TAP}`}
            >
              {ETICHETTE_PASTO[mangiato]}
            </PulsanteInvio>
          ))}
        </div>
        <input
          name="nota_pasto"
          defaultValue={pasto?.note ?? ''}
          placeholder="Nota (opzionale)"
          aria-label="Nota pasto"
          className="block w-full min-w-0 rounded-lg border border-stone-300 px-2 py-1 text-xs outline-none focus:border-stone-500"
        />
        <BottoneSalvaNota formAction={pasto ? salvaNotaPasto.bind(null, bambinoId, data, pasto.mangiato) : null} />
      </form>
    );
  } else {
    contenuto = (
      <div className="flex flex-wrap items-center gap-2 text-sm text-stone-600 [overflow-wrap:anywhere]">
        <span>{pasto ? ETICHETTE_PASTO[pasto.mangiato] : 'Non ancora segnato'}</span>
        {pasto?.note && <span>— {pasto.note}</span>}
      </div>
    );
  }

  return (
    <div role="group" aria-labelledby={idTitolo} className="min-w-0">
      <IntestazioneColonna id={idTitolo}>Pasto</IntestazioneColonna>
      {contenuto}
    </div>
  );
}
