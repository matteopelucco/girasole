import { PulsanteInvio } from '@/components/PulsanteInvio';
import { BottoneSalvaNota } from '@/components/BottoneSalvaNota';
import { classePulsanteStato, classePulsanteToggle } from '@/lib/classiStato';
import type { RigaPresenza, StatoPresenza } from '@/lib/presenza';
import { segnaPresenza, segnaPreAsilo, segnaPostAsilo, salvaNotaPresenza } from '../presenze/actions';
import { ALTEZZA_TAP, ETICHETTE_PRESENZA, IntestazioneColonna } from './comune';

export type PresenzaGiorno = {
  stato: StatoPresenza;
  note: string | null;
  pre_asilo: boolean;
  post_asilo: boolean;
};

// Colonna "Presenza" della card bambino (specs/10, regole in specs/13):
// riga Presente/Pre-asilo/Post-asilo, riga Assente/Malattia, nota +
// "Salva nota". Dopo la comunicazione dei pasti a Rojac, per un bambino
// con pasto "sì" Assente/Malattia sono disabilitati con una breve
// spiegazione (specs/16, `assenzaBloccata` calcolata dalla pagina con
// lib/presenza.ts:assenzaBloccataDaComunicazione; il trigger di 0052
// resta la difesa reale).
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
  const rigaAttuale: RigaPresenza | null = presenza
    ? { stato: presenza.stato, preAsilo: presenza.pre_asilo, postAsilo: presenza.post_asilo }
    : null;

  return (
    <div role="group" aria-labelledby={idTitolo} className="min-w-0">
      <IntestazioneColonna id={idTitolo}>Presenza</IntestazioneColonna>

      {editable ? (
        <form className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <PulsanteInvio
              mantieniTesto
              formAction={segnaPresenza.bind(null, bambinoId, 'presente', data)}
              className={`${classePulsanteStato('presente', presenza?.stato === 'presente')} ${ALTEZZA_TAP}`}
            >
              {ETICHETTE_PRESENZA.presente}
            </PulsanteInvio>
            <PulsanteInvio
              mantieniTesto
              formAction={segnaPreAsilo.bind(null, bambinoId, rigaAttuale, data)}
              className={`${classePulsanteToggle(!!presenza?.pre_asilo)} ${ALTEZZA_TAP}`}
            >
              Pre-asilo
            </PulsanteInvio>
            <PulsanteInvio
              mantieniTesto
              formAction={segnaPostAsilo.bind(null, bambinoId, rigaAttuale, data)}
              className={`${classePulsanteToggle(!!presenza?.post_asilo)} ${ALTEZZA_TAP}`}
            >
              Post-asilo
            </PulsanteInvio>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {(['assente', 'malattia'] as const).map((stato) =>
              assenzaBloccata ? (
                <button
                  key={stato}
                  type="button"
                  disabled
                  aria-describedby={idBlocco}
                  className={`${classePulsanteStato(stato, false)} ${ALTEZZA_TAP} cursor-not-allowed opacity-60`}
                >
                  {ETICHETTE_PRESENZA[stato]}
                </button>
              ) : (
                <PulsanteInvio
                  key={stato}
                  mantieniTesto
                  formAction={segnaPresenza.bind(null, bambinoId, stato, data)}
                  className={`${classePulsanteStato(stato, presenza?.stato === stato)} ${ALTEZZA_TAP}`}
                >
                  {ETICHETTE_PRESENZA[stato]}
                </PulsanteInvio>
              )
            )}
            {assenzaBloccata && (
              <p id={idBlocco} className="w-full text-xs text-amber-800">
                <span aria-hidden="true">🔒</span> Pasto già comunicato a Rojac
              </p>
            )}
          </div>
          <textarea
            name="nota_presenza"
            rows={2}
            defaultValue={presenza?.note ?? ''}
            placeholder="Nota (opzionale)"
            aria-label="Nota presenza"
            className="block w-full min-w-0 rounded-lg border border-stone-300 px-2 py-1 text-xs outline-none focus:border-stone-500"
          />
          <BottoneSalvaNota
            formAction={rigaAttuale ? salvaNotaPresenza.bind(null, bambinoId, data, rigaAttuale) : null}
          />
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
          <span>{presenza ? ETICHETTE_PRESENZA[presenza.stato] : 'Non ancora segnato'}</span>
          {presenza?.pre_asilo && <span className="text-sky-700">Pre-asilo</span>}
          {presenza?.post_asilo && <span className="text-sky-700">Post-asilo</span>}
          {presenza?.note && <span>— {presenza.note}</span>}
        </div>
      )}
    </div>
  );
}
