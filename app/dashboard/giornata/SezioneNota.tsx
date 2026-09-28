import { BottoneSalvaNota } from '@/components/BottoneSalvaNota';
import { IconaNota } from '@/components/icone';
import { salvaNotaPresenza } from '../presenze/actions';
import { rigaPresenzaAttuale, type PresenzaGiorno } from './ColonnaPresenza';
import { CampoNota, IntestazioneSezione } from './comune';

// Sezione "Nota" in fondo alla card bambino (specs/10, issue #110): la
// nota della presenza (`presenze.note`, regole in specs/13), l'unica
// della card (issue #109). Modificabile: campo "Nota (opzionale)" e
// "Salva nota" a tutta larghezza, dentro il form unico della card (i
// pulsanti di stato della Presenza salvano anche questa nota). In sola
// lettura mostra il testo, e non compare se la nota è vuota.
export function SezioneNota({
  bambinoId,
  data,
  presenza,
  editable,
}: {
  bambinoId: string;
  data: string;
  presenza: PresenzaGiorno | undefined;
  editable: boolean;
}) {
  if (!editable) {
    if (!presenza?.note) return null;
    const idTitolo = `nota-${bambinoId}`;
    return (
      <div role="group" aria-label="Nota" className="min-w-0 py-4">
        <IntestazioneSezione id={idTitolo} icona={<IconaNota className="h-5 w-5" />}>
          Nota
        </IntestazioneSezione>
        <p className="whitespace-pre-line text-sm text-stone-700 [overflow-wrap:anywhere]">{presenza.note}</p>
      </div>
    );
  }

  const rigaAttuale = rigaPresenzaAttuale(presenza);
  return (
    <div role="group" aria-label="Nota" className="min-w-0 space-y-3 py-4">
      <CampoNota id={`nota-presenza-${bambinoId}`} name="nota_presenza" valore={presenza?.note} />
      <BottoneSalvaNota formAction={rigaAttuale ? salvaNotaPresenza.bind(null, bambinoId, data, rigaAttuale) : null} />
    </div>
  );
}
