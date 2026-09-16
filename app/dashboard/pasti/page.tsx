import type { ReactNode } from 'react';
import { PaginaAttivitaGiornaliera } from '@/components/PaginaAttivitaGiornaliera';
import { EtichettaMalattia } from '@/components/EtichettaMalattia';
import { EtichettaAssente } from '@/components/EtichettaAssente';
import { AvvisoInconsistenza } from '@/components/AvvisoInconsistenza';
import { RiepilogoConteggio } from '@/components/RiepilogoConteggio';
import { CardRiepilogo } from '@/components/CardRiepilogo';
import { PulsanteInvio } from '@/components/PulsanteInvio';
import { BottoneSalvaNota } from '@/components/BottoneSalvaNota';
import { ConfermaAzione } from '@/components/ConfermaAzione';
import { requireStaff, puoScrivereData, assicuraAccessoPasti } from '@/lib/auth';
import { sezioniEBambiniVisibili, raggruppaPerSezione, messaggioSezioniVuote } from '@/lib/sezioni';
import { classePulsanteStato } from '@/lib/classiStato';
import { inconsistenzeGiorno, type StatoPasto, type StatoPresenza } from '@/lib/consistenza';
import { formattaDataOraItaliana } from '@/lib/date';
import { editabilitaGiorno } from '@/lib/calendarioScolastico';
import { contaPastiSiOggiTuttoAsilo, contaBambiniSenzaPresenzaOggiTuttoAsilo, TELEFONO_ROJAC } from '@/lib/pastiRojac';
import { segnaPasto, salvaNotaPasto, comunicaPastiRojac } from './actions';

export const dynamic = 'force-dynamic';

const ETICHETTE: Record<string, string> = { si: 'Sì', no: 'No' };

// "Pasti giornalieri - Sezione {nome}" per una sezione vera, senza il
// prefisso "Sezione" per il gruppo "Senza sezione" (specs/12).
function titoloRiepilogoSezione(titoloGruppo: string): string {
  return titoloGruppo === 'Senza sezione' ? 'Pasti giornalieri - Senza sezione' : `Pasti giornalieri - Sezione ${titoloGruppo}`;
}

export default async function PastiPage({ searchParams }: { searchParams: { data?: string } }) {
  const { supabase, user, profilo, ruolo, data } = await requireStaff(searchParams);
  assicuraAccessoPasti(ruolo);

  const { sezioni, bambini } = await sezioniEBambiniVisibili(supabase, user.id, ruolo);
  const idBambini = bambini.map((b) => b.id);

  // note_allergie non arriva da sezioniEBambiniVisibili (pensata per
  // essere generica tra Presenze/Pasti/Rette): una seconda select mirata
  // sugli stessi id, senza ripetere la logica di visibilità per ruolo.
  const [
    { data: allergieData },
    { data: pastiData },
    { data: presenzeData },
    { data: comunicazione },
    { editable, messaggioChiuso },
  ] = await Promise.all([
    idBambini.length
      ? supabase.from('bambini').select('id, note_allergie').in('id', idBambini)
      : Promise.resolve({ data: [] as { id: string; note_allergie: string | null }[] }),
    idBambini.length
      ? supabase.from('pasti').select('bambino_id, mangiato, note').eq('data', data).in('bambino_id', idBambini)
      : Promise.resolve({ data: [] as { bambino_id: string; mangiato: string; note: string | null }[] }),
    idBambini.length
      ? supabase.from('presenze').select('bambino_id, stato').eq('data', data).in('bambino_id', idBambini)
      : Promise.resolve({ data: [] as { bambino_id: string; stato: string }[] }),
    supabase
      .from('pasti_comunicati')
      .select('numero_pasti, comunicato_at, comunicato_da_nome')
      .eq('data', data)
      .maybeSingle(),
    editabilitaGiorno(supabase, data, ruolo),
  ]);

  const allergiePerBambino = new Map((allergieData ?? []).map((b) => [b.id, b.note_allergie]));
  const pastoPerBambino = new Map((pastiData ?? []).map((p) => [p.bambino_id, p]));
  const presenzaPerBambino = new Map((presenzeData ?? []).map((p) => [p.bambino_id, p.stato]));

  // La comunicazione a Rojac è per l'intero asilo (specs/16), non per
  // una sola classe: blocca comunque la maestra su ogni riga. L'admin
  // può sempre modificare.
  const editabileRiga = editable && (ruolo === 'admin' || !comunicazione);

  const bambiniConPastoApplicabile = bambini.filter((b) => {
    const stato = presenzaPerBambino.get(b.id);
    return stato !== 'assente' && stato !== 'malattia';
  });
  const numeroMangiatoTotale = bambiniConPastoApplicabile.filter(
    (b) => pastoPerBambino.get(b.id)?.mangiato === 'si'
  ).length;

  // Riepilogo aggregato su tutte le sezioni visibili (specs/12): a
  // differenza del riepilogo per sezione sotto, il denominatore qui è
  // TUTTI i bambini visibili, senza escludere assenti/malati (scelta
  // esplicita, vista d'insieme rapida — non un conteggio operativo).
  const riepilogoAggregato = bambini.length ? (
    <CardRiepilogo titolo="Pasti giornalieri">
      <RiepilogoConteggio etichetta="Pasti" numeratore={numeroMangiatoTotale} denominatore={bambini.length} />
    </CardRiepilogo>
  ) : null;

  // Comunicazione pasti a Rojac (specs/16): un'unica azione al giorno
  // sull'intero asilo, non sulle sole sezioni visibili a chi guarda —
  // per questo il riquadro compare in cima alla pagina, prima dei gruppi
  // per sezione.
  let extra: ReactNode = null;
  if (comunicazione) {
    extra = (
      <CardRiepilogo titolo="Comunicazione pasti a Rojac">
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <span aria-hidden="true" className="text-green-600">
            ✓
          </span>{' '}
          Pasti comunicati a Rojac il {formattaDataOraItaliana(comunicazione.comunicato_at)}:{' '}
          {comunicazione.numero_pasti} pasti (da {comunicazione.comunicato_da_nome}).
        </p>
      </CardRiepilogo>
    );
  } else if (puoScrivereData(ruolo, data)) {
    const numeroSenzaPresenza = await contaBambiniSenzaPresenzaOggiTuttoAsilo(data);
    if (numeroSenzaPresenza > 0) {
      extra = (
        <CardRiepilogo titolo="Comunicazione pasti a Rojac">
          <p className="rounded-lg border border-stone-300 bg-stone-50 p-3 text-sm text-stone-700">
            Non puoi ancora comunicare i pasti: {numeroSenzaPresenza}{' '}
            {numeroSenzaPresenza === 1 ? 'bambino non ha' : 'bambini non hanno'} ancora la presenza segnata per oggi.
          </p>
        </CardRiepilogo>
      );
    } else {
      const numeroPastiOggi = await contaPastiSiOggiTuttoAsilo(data);
      extra = (
        <CardRiepilogo titolo="Comunicazione pasti a Rojac">
          <ConfermaAzione
            azione={comunicaPastiRojac}
            campiNascosti={{ data }}
            etichetta="Conferma pasti"
            messaggioConferma={
              <>
                Conferma <strong className="text-2xl font-extrabold">{numeroPastiOggi}</strong> pasti a Rojac (
                {TELEFONO_ROJAC})
              </>
            }
            etichettaConferma="Conferma"
            tono="neutro"
          />
        </CardRiepilogo>
      );
    }
  }

  function rigaBambino(bambino: { id: string; nome: string; cognome: string }) {
    const pasto = pastoPerBambino.get(bambino.id);
    const statoPresenza = presenzaPerBambino.get(bambino.id);
    const assente = statoPresenza === 'assente';
    const malato = statoPresenza === 'malattia';
    const pastoNonApplicabile = assente || malato;
    const noteAllergie = allergiePerBambino.get(bambino.id);
    const problemiConsistenza = inconsistenzeGiorno({
      stato: statoPresenza as StatoPresenza | undefined,
      mangiato: pasto?.mangiato as StatoPasto | undefined,
    });

    return (
      <li key={bambino.id} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium">
            {bambino.nome} {bambino.cognome}
          </span>
          <div className="flex flex-wrap gap-1">
            {assente && <EtichettaAssente />}
            {malato && <EtichettaMalattia />}
            {noteAllergie && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                ⚠ {noteAllergie}
              </span>
            )}
            <AvvisoInconsistenza messaggi={problemiConsistenza} />
          </div>
        </div>

        {pastoNonApplicabile ? (
          <p className="mt-3 text-sm text-stone-600">
            {assente ? 'Bambino assente: il pasto non è applicabile.' : 'Bambino malato: il pasto non è applicabile.'}
          </p>
        ) : editabileRiga ? (
          <form className="mt-3 flex flex-wrap items-center gap-2">
            {(['si', 'no'] as const).map((mangiato) => (
              <PulsanteInvio
                key={mangiato}
                mantieniTesto
                formAction={segnaPasto.bind(null, bambino.id, mangiato, data)}
                className={classePulsanteStato(mangiato, pasto?.mangiato === mangiato)}
              >
                {ETICHETTE[mangiato]}
              </PulsanteInvio>
            ))}
            <input
              name="nota_pasto"
              defaultValue={pasto?.note ?? ''}
              placeholder="Nota (opzionale)"
              className="min-w-[10rem] flex-1 rounded-lg border border-stone-300 px-2 py-1 text-xs outline-none focus:border-stone-500"
            />
            <BottoneSalvaNota
              formAction={pasto ? salvaNotaPasto.bind(null, bambino.id, data, pasto.mangiato as 'si' | 'no') : null}
            />
          </form>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-stone-600">
            <span>{pasto ? ETICHETTE[pasto.mangiato] : 'Non ancora segnato'}</span>
            {pasto?.note && <span className="text-stone-600">— {pasto.note}</span>}
          </div>
        )}
      </li>
    );
  }

  const gruppi = raggruppaPerSezione(bambini, (b) => b.sezione_id, sezioni);

  let contenuto;
  if (!sezioni.length) {
    contenuto = <p className="text-sm text-stone-600">{messaggioSezioniVuote(ruolo)}</p>;
  } else if (!gruppi.length) {
    contenuto = <p className="text-sm text-stone-600">Nessun bambino attivo in nessuna classe.</p>;
  } else {
    contenuto = (
      <div className="space-y-6">
        {gruppi.map((gruppo) => {
          const applicabiliGruppo = gruppo.elementi.filter((b) => {
            const stato = presenzaPerBambino.get(b.id);
            return stato !== 'assente' && stato !== 'malattia';
          });
          const mangiatoGruppo = applicabiliGruppo.filter((b) => pastoPerBambino.get(b.id)?.mangiato === 'si').length;

          return (
            <div key={gruppo.titolo} className="space-y-3">
              <CardRiepilogo titolo={titoloRiepilogoSezione(gruppo.titolo)}>
                <RiepilogoConteggio etichetta="Pasti" numeratore={mangiatoGruppo} denominatore={applicabiliGruppo.length} />
              </CardRiepilogo>
              <ul className="space-y-3">{gruppo.elementi.map(rigaBambino)}</ul>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <PaginaAttivitaGiornaliera
      nome={profilo?.nome || user.email || ''}
      ruolo={ruolo}
      titolo="Pasti"
      basePath="/dashboard/pasti"
      data={data}
      riepilogoAggregato={riepilogoAggregato}
      extra={extra}
      messaggioChiusura={messaggioChiuso}
      editable={editable}
    >
      {contenuto}
    </PaginaAttivitaGiornaliera>
  );
}
