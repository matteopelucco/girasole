import { BottoneSalvaNota } from '@/components/BottoneSalvaNota';
import { EtichettaAssente } from '@/components/EtichettaAssente';
import { EtichettaMalattia } from '@/components/EtichettaMalattia';
import { IconaPosate } from '@/components/icone';
import { classePulsanteStato } from '@/lib/classiStato';
import { segnaPasto, salvaNotaPasto } from '../pasti/actions';
import { CampoNota, ETICHETTE_PASTO, IntestazioneSezione, PulsanteStato } from './comune';

export type PastoGiorno = { mangiato: 'si' | 'no'; note: string | null };

// Sezione "Pasto" della card bambino (specs/10, regole in specs/14):
// pulsanti grandi Sì/No affiancati, poi nota + "Salva nota";
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
      <form className="space-y-3">
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
        <CampoNota id={`nota-pasto-${bambinoId}`} name="nota_pasto" valore={pasto?.note} />
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
      <IntestazioneSezione id={idTitolo} icona={<IconaPosate />}>
        Pasto
      </IntestazioneSezione>
      {contenuto}
    </div>
  );
}
