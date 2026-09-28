import { EtichettaAssente } from '@/components/EtichettaAssente';
import { EtichettaMalattia } from '@/components/EtichettaMalattia';
import { AvvisoInconsistenza } from '@/components/AvvisoInconsistenza';
import { inconsistenzeGiorno, type StatoPasto, type StatoPresenza } from '@/lib/consistenza';
import { ColonnaPresenza, type PresenzaGiorno } from './ColonnaPresenza';
import { ColonnaPasto, type PastoGiorno } from './ColonnaPasto';

// Card di un bambino nella schermata "Presenze e pasti" (specs/10):
// intestazione (nome, allergie, Assente/Malattia, warning di specs/06),
// colonna "Presenza" a sinistra e, solo se `conPasti` (maestra/admin),
// colonna "Pasto" a destra. Da 360px di larghezza dello schermo in su le
// colonne sono affiancate; sotto, il pasto va sotto la presenza. L'id
// `bambino-<id>` è l'ancora usata dal box di comunicazione a Rojac.
export function CardBambino({
  bambino,
  data,
  noteAllergie,
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

  return (
    <li
      id={`bambino-${bambino.id}`}
      className="scroll-mt-4 rounded-xl border border-stone-200 bg-white p-3 shadow-sm sm:p-4"
    >
      {/* overflow-wrap:anywhere + min-w-0: un nome (o un'allergia) senza
          spazi più largo della card va a capo invece di far scorrere la
          pagina in orizzontale su telefono (specs/10). */}
      <div className="flex flex-wrap items-center justify-between gap-2 [overflow-wrap:anywhere]">
        <span className="min-w-0 font-medium">
          {bambino.nome} {bambino.cognome}
        </span>
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
      </div>

      <div className={`mt-3 grid grid-cols-1 gap-3 ${conPasti ? 'min-[360px]:grid-cols-2' : ''}`}>
        <ColonnaPresenza
          bambinoId={bambino.id}
          data={data}
          presenza={presenza}
          editable={editable}
          assenzaBloccata={assenzaBloccata}
        />
        {conPasti && (
          <ColonnaPasto
            bambinoId={bambino.id}
            data={data}
            pasto={pasto}
            statoPresenza={presenza?.stato}
            modificabile={pastoModificabile}
          />
        )}
      </div>
    </li>
  );
}
