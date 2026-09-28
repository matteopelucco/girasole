import { EtichettaAssente } from '@/components/EtichettaAssente';
import { EtichettaMalattia } from '@/components/EtichettaMalattia';
import { AvvisoInconsistenza } from '@/components/AvvisoInconsistenza';
import { inconsistenzeGiorno, type StatoPasto, type StatoPresenza } from '@/lib/consistenza';
import { ColonnaPresenza, type PresenzaGiorno } from './ColonnaPresenza';
import { ColonnaPasto, type PastoGiorno } from './ColonnaPasto';
import { IconaFemmina, IconaMaschio } from '@/components/icone';
import { stileSesso } from '@/lib/giornata';

// Card di un bambino nella schermata "Presenze e pasti" (specs/10,
// disegno della issue #106) in tre parti: intestazione (nome come titolo,
// icona e scritta Femmina/Maschio con sfondo rosa/azzurro tenue — neutro
// se il sesso non è compilato —, allergie, Assente/Malattia, warning di
// specs/06), sezione "Presenza" e, solo se `conPasti` (maestra/admin),
// sezione "Pasto". Su telefono le sezioni sono una sotto l'altra; da
// 640px (`sm`) in su sono affiancate. L'id `bambino-<id>` è l'ancora
// usata dal box di comunicazione a Rojac.
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
  const IconaSesso = stile.sesso === 'F' ? IconaFemmina : IconaMaschio;

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
        <div className="min-w-0">
          <h3 className="font-heading text-base font-semibold text-stone-900">
            {bambino.nome} {bambino.cognome}
          </h3>
          {stile.etichetta && (
            <p className={`mt-0.5 flex items-center gap-1 text-xs font-medium ${stile.testoEtichetta}`}>
              <IconaSesso className="h-3.5 w-3.5" />
              {stile.etichetta}
            </p>
          )}
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

      <div className={`grid grid-cols-1 gap-4 p-4 ${conPasti ? 'sm:grid-cols-2' : ''}`}>
        <ColonnaPresenza
          bambinoId={bambino.id}
          data={data}
          presenza={presenza}
          editable={editable}
          assenzaBloccata={assenzaBloccata}
        />
        {conPasti && (
          <div className="border-t border-stone-100 pt-4 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
            <ColonnaPasto
              bambinoId={bambino.id}
              data={data}
              pasto={pasto}
              statoPresenza={presenza?.stato}
              modificabile={pastoModificabile}
            />
          </div>
        )}
      </div>
    </li>
  );
}
