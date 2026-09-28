import { EtichettaAssente } from '@/components/EtichettaAssente';
import { EtichettaMalattia } from '@/components/EtichettaMalattia';
import { AvvisoInconsistenza } from '@/components/AvvisoInconsistenza';
import { inconsistenzeGiorno, type StatoPasto, type StatoPresenza } from '@/lib/consistenza';
import { ColonnaPresenza, type PresenzaGiorno } from './ColonnaPresenza';
import { ColonnaPasto, type PastoGiorno } from './ColonnaPasto';
import { SezioneNota } from './SezioneNota';
import { AvatarBambino } from '@/components/AvatarBambino';
import { stileSesso } from '@/lib/giornata';

// Card di un bambino nella schermata "Presenze e pasti" (specs/10,
// disegno della issue #106) in tre parti: intestazione (avatar
// bambina/bambino su sfondo rosa/azzurro tenue — neutro su grigio se il
// sesso non è compilato, issue #108 —, nome come titolo, allergie,
// Assente/Malattia, warning di
// specs/06), poi, una sotto l'altra a qualunque larghezza (issue #110),
// sezione "Presenza", sezione "Pasto" solo se `conPasti` (maestra/admin)
// e sezione "Nota". Nei giorni modificabili le tre sezioni sono in un
// unico <form>: i pulsanti di stato della Presenza inviano anche la nota
// (specs/13, "segnare un'assenza con nota"). L'id `bambino-<id>` è
// l'ancora usata dal box di comunicazione a Rojac.
export function CardBambino({
  bambino,
  data,
  noteAllergie,
  sesso,
  presenza,
  pasto,
  conPasti,
  editable,
  pastoModificabile,
  assenzaBloccata,
}: {
  bambino: { id: string; nome: string; cognome: string };
  data: string;
  noteAllergie: string | null | undefined;
  sesso: string | null | undefined;
  presenza: PresenzaGiorno | undefined;
  pasto: PastoGiorno | undefined;
  conPasti: boolean;
  editable: boolean;
  pastoModificabile: boolean;
  assenzaBloccata: boolean;
}) {
  const problemiConsistenza = inconsistenzeGiorno({
    stato: presenza?.stato as StatoPresenza | undefined,
    preAsilo: presenza?.pre_asilo,
    postAsilo: presenza?.post_asilo,
    mangiato: pasto?.mangiato as StatoPasto | undefined,
  });
  const stile = stileSesso(sesso);
  const Corpo = editable ? 'form' : 'div';

  return (
    <li
      id={`bambino-${bambino.id}`}
      className={`scroll-mt-4 overflow-hidden rounded-2xl border bg-white shadow-sm ${stile.bordoCard}`}
    >
      {/* overflow-wrap:anywhere + min-w-0: un nome (o un'allergia) senza
          spazi più largo della card va a capo invece di far scorrere la
          pagina in orizzontale su telefono (specs/10). */}
      <header
        className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 [overflow-wrap:anywhere] ${stile.sfondoIntestazione}`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <AvatarBambino sesso={sesso} />
          <h3 className="min-w-0 font-heading text-base font-semibold text-stone-900">
            {bambino.nome} {bambino.cognome}
          </h3>
        </div>
        <div className="flex min-w-0 flex-wrap gap-1">
          {presenza?.stato === 'assente' && <EtichettaAssente />}
          {presenza?.stato === 'malattia' && <EtichettaMalattia />}
          {noteAllergie && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
              ⚠ {noteAllergie}
            </span>
          )}
          <AvvisoInconsistenza messaggi={problemiConsistenza} />
        </div>
      </header>

      <Corpo className="divide-y divide-stone-200 px-4">
        <div className="py-4">
          <ColonnaPresenza
            bambinoId={bambino.id}
            data={data}
            presenza={presenza}
            editable={editable}
            assenzaBloccata={assenzaBloccata}
          />
        </div>
        {conPasti && (
          <div className="py-4">
            <ColonnaPasto
              bambinoId={bambino.id}
              data={data}
              pasto={pasto}
              statoPresenza={presenza?.stato}
              modificabile={pastoModificabile}
            />
          </div>
        )}
        <SezioneNota bambinoId={bambino.id} data={data} presenza={presenza} editable={editable} />
      </Corpo>
    </li>
  );
}
