import { EtichettaAssente } from '@/components/EtichettaAssente';
import { EtichettaMalattia } from '@/components/EtichettaMalattia';
import { IconaPosate } from '@/components/icone';
import { classePulsanteStato } from '@/lib/classiStato';
import { segnaPasto } from '../pasti/actions';
import { ETICHETTE_PASTO, IntestazioneSezione, PulsanteStato } from './comune';

export type PastoGiorno = { mangiato: 'si' | 'no' };

// Sezione "Pasto" della card bambino (specs/10, regole in specs/14):
// pulsanti grandi Sì/No affiancati, senza nota (l'unica nota della card
// è quella della presenza, issue #109); renderizzata solo per maestra e admin: la pagina non la crea (e non
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
      <form>
        <div className="grid grid-cols-2 gap-2">
          {(['si', 'no'] as const).map((mangiato) => (
            <PulsanteStato
              key={mangiato}
              formAction={segnaPasto.bind(null, bambinoId, mangiato, data)}
              selezionato={pasto?.mangiato === mangiato}
              className={classePulsanteStato(mangiato, pasto?.mangiato === mangiato)}
            >
              {ETICHETTE_PASTO[mangiato]}
            </PulsanteStato>
          ))}
        </div>
      </form>
    );
  } else {
    contenuto = (
      <p className="text-sm text-stone-600">{pasto ? ETICHETTE_PASTO[pasto.mangiato] : 'Non ancora segnato'}</p>
    );
  }

  return (
    <div role="group" aria-labelledby={idTitolo} className="min-w-0">
      <IntestazioneSezione id={idTitolo} icona={<IconaPosate />}>
        Pasto
      </IntestazioneSezione>
      {contenuto}
    </div>
  );
}
