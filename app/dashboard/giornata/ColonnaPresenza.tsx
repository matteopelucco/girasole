import { IconaPersona } from '@/components/icone';
import { classePulsanteStato, classePulsanteToggle } from '@/lib/classiStato';
import type { RigaPresenza, StatoPresenza } from '@/lib/presenza';
import { segnaPresenza, segnaPreAsilo, segnaPostAsilo } from '../presenze/actions';
import { ETICHETTE_PRESENZA, IntestazioneSezione, PulsanteStato } from './comune';

export type PresenzaGiorno = {
  stato: StatoPresenza;
  note: string | null;
  pre_asilo: boolean;
  post_asilo: boolean;
};

// Riga attuale di presenza nel formato di lib/presenza.ts, o null se
// per la data non è ancora segnato nulla.
export function rigaPresenzaAttuale(presenza: PresenzaGiorno | undefined): RigaPresenza | null {
  return presenza ? { stato: presenza.stato, preAsilo: presenza.pre_asilo, postAsilo: presenza.post_asilo } : null;
}

// Sezione "Presenza" della card bambino (specs/10, regole in specs/13):
// pulsanti grandi — Presente, Assente, Malattia su una riga, un
// separatore, poi Pre-asilo e Post-asilo affiancati. La nota è nella sezione "Nota" in fondo alla card
// (SezioneNota, issue #110), nello stesso <form> della card: premendo
// uno stato si salva anche la nota scritta. Dopo la comunicazione dei
// pasti a Rojac, per un bambino con pasto "sì" Assente/Malattia sono
// disabilitati con una breve spiegazione (specs/16, `assenzaBloccata`
// calcolata dalla pagina con lib/presenza.ts:assenzaBloccataDaComunicazione;
// il trigger di 0052 resta la difesa reale).
export function ColonnaPresenza({
  bambinoId,
  data,
  presenza,
  editable,
  assenzaBloccata,
}: {
  bambinoId: string;
  data: string;
  presenza: PresenzaGiorno | undefined;
  editable: boolean;
  assenzaBloccata: boolean;
}) {
  const idTitolo = `presenza-${bambinoId}`;
  const idBlocco = `blocco-assenza-${bambinoId}`;
  const rigaAttuale = rigaPresenzaAttuale(presenza);
  const preAsilo = !!presenza?.pre_asilo;
  const postAsilo = !!presenza?.post_asilo;

  return (
    <div role="group" aria-labelledby={idTitolo} className="min-w-0">
      <IntestazioneSezione id={idTitolo} icona={<IconaPersona className="h-5 w-5" />}>
        Presenza
      </IntestazioneSezione>

      {editable ? (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <PulsanteStato
              formAction={segnaPresenza.bind(null, bambinoId, 'presente', data)}
              selezionato={presenza?.stato === 'presente'}
              className={classePulsanteStato('presente', presenza?.stato === 'presente')}
            >
              {ETICHETTE_PRESENZA.presente}
            </PulsanteStato>
            {(['assente', 'malattia'] as const).map((stato) =>
              assenzaBloccata ? (
                <button
                  key={stato}
                  type="button"
                  disabled
                  aria-describedby={idBlocco}
                  className={`${classePulsanteStato(stato, false)} cursor-not-allowed opacity-60`}
                >
                  {ETICHETTE_PRESENZA[stato]}
                </button>
              ) : (
                <PulsanteStato
                  key={stato}
                  formAction={segnaPresenza.bind(null, bambinoId, stato, data)}
                  selezionato={presenza?.stato === stato}
                  className={classePulsanteStato(stato, presenza?.stato === stato)}
                >
                  {ETICHETTE_PRESENZA[stato]}
                </PulsanteStato>
              )
            )}
            {assenzaBloccata && (
              <p id={idBlocco} className="col-span-3 text-xs text-amber-800">
                <span aria-hidden="true">🔒</span> Pasto già comunicato a Rojac
              </p>
            )}
          </div>
          <hr className="border-stone-200" />
          <div className="grid grid-cols-2 gap-2">
            <PulsanteStato
              formAction={segnaPreAsilo.bind(null, bambinoId, rigaAttuale, data)}
              selezionato={preAsilo}
              className={classePulsanteToggle(preAsilo)}
            >
              Pre-asilo
            </PulsanteStato>
            <PulsanteStato
              formAction={segnaPostAsilo.bind(null, bambinoId, rigaAttuale, data)}
              selezionato={postAsilo}
              className={classePulsanteToggle(postAsilo)}
            >
              Post-asilo
            </PulsanteStato>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-sm text-stone-600 [overflow-wrap:anywhere]">
          <span>{presenza ? ETICHETTE_PRESENZA[presenza.stato] : 'Non ancora segnato'}</span>
          {presenza?.pre_asilo && <span className="text-sky-700">Pre-asilo</span>}
          {presenza?.post_asilo && <span className="text-sky-700">Post-asilo</span>}
        </div>
      )}
    </div>
  );
}
