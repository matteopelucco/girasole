import { Fragment } from 'react';
import { PaginaAttivitaGiornaliera } from '@/components/PaginaAttivitaGiornaliera';
import { CardRiepilogo } from '@/components/CardRiepilogo';
import { RiepilogoConteggio } from '@/components/RiepilogoConteggio';
import { requireStaff, editabilitaGiorno } from '@/lib/auth';
import { sezioniEBambiniVisibili, raggruppaPerSezione, messaggioSezioniVuote } from '@/lib/sezioni';
import { assenzaBloccataDaComunicazione } from '@/lib/presenza';
import {
  PERCORSO_GIORNATA,
  riepilogoGiornata,
  testoVoceRiepilogo,
  titoloRiepilogoSezione,
  vociRiepilogo,
} from '@/lib/giornata';
import { CardBambino } from './CardBambino';
import { BoxComunicazioneRojac, type ComunicazioneGiorno } from './BoxComunicazioneRojac';
import type { PresenzaGiorno } from './ColonnaPresenza';
import type { PastoGiorno } from './ColonnaPasto';

export const dynamic = 'force-dynamic';

type RigaPresenzaDb = PresenzaGiorno & { bambino_id: string };
type RigaPastoDb = PastoGiorno & { bambino_id: string };

// Schermata unica "Presenze e pasti" (specs/10 - presenze-e-pasti.md):
// sostituisce le vecchie /dashboard/presenze e /dashboard/pasti (che ora
// reindirizzano qui). Una card per bambino con intestazione, sezione
// presenza e sezione pasto. L'assistente non ha accesso ai pasti (specs/03,
// specs/14): per lei la pagina non legge né `pasti` né
// `pasti_comunicati` (nessuna query, non solo nessun render) — la RLS
// glielo impedirebbe comunque.
export default async function GiornataPage({ searchParams }: { searchParams: { data?: string } }) {
  const { supabase, user, profilo, ruolo, data } = await requireStaff(searchParams);
  const conPasti = ruolo !== 'assistente';

  const { sezioni, bambini } = await sezioniEBambiniVisibili(supabase, user.id, ruolo);
  const idBambini = bambini.map((b) => b.id);

  const [
    { data: presenzeData },
    { data: pastiData },
    { data: datiBambiniData },
    { data: comunicazione },
    { editable, messaggioChiuso },
  ] = await Promise.all([
    idBambini.length
      ? supabase
          .from('presenze')
          .select('bambino_id, stato, note, pre_asilo, post_asilo')
          .eq('data', data)
          .in('bambino_id', idBambini)
          .returns<RigaPresenzaDb[]>()
      : Promise.resolve({ data: [] as RigaPresenzaDb[] }),
    conPasti && idBambini.length
      ? supabase
          .from('pasti')
          .select('bambino_id, mangiato')
          .eq('data', data)
          .in('bambino_id', idBambini)
          .returns<RigaPastoDb[]>()
      : Promise.resolve({ data: [] as RigaPastoDb[] }),
    // note_allergie e sesso (intestazione della card, issue #106) non
    // arrivano da sezioniEBambiniVisibili (generica tra più pagine): una
    // seconda select mirata sugli stessi id.
    idBambini.length
      ? supabase.from('bambini').select('id, note_allergie, sesso').in('id', idBambini)
      : Promise.resolve({ data: [] as { id: string; note_allergie: string | null; sesso: string | null }[] }),
    conPasti
      ? supabase
          .from('pasti_comunicati')
          .select('numero_pasti, comunicato_at, comunicato_da_nome')
          .eq('data', data)
          .maybeSingle<ComunicazioneGiorno>()
      : Promise.resolve({ data: null }),
    editabilitaGiorno(supabase, data, ruolo),
  ]);

  const presenzaPerBambino = new Map((presenzeData ?? []).map((p) => [p.bambino_id, p]));
  const pastoPerBambino = new Map((pastiData ?? []).map((p) => [p.bambino_id, p]));
  const allergiePerBambino = new Map((datiBambiniData ?? []).map((b) => [b.id, b.note_allergie]));
  const sessoPerBambino = new Map((datiBambiniData ?? []).map((b) => [b.id, b.sesso]));
  const pastiComunicati = !!comunicazione;

  // Dopo la comunicazione (per l'intero asilo, specs/16) la colonna Pasto
  // è in sola lettura per la maestra, in ogni sezione; l'admin può sempre
  // modificare.
  const pastoModificabile = editable && (ruolo === 'admin' || !pastiComunicati);

  function statoGiorno(id: string) {
    const presenza = presenzaPerBambino.get(id);
    return {
      stato: presenza?.stato,
      preAsilo: presenza?.pre_asilo,
      postAsilo: presenza?.post_asilo,
      mangiato: pastoPerBambino.get(id)?.mangiato,
    };
  }

  // Voci di riepilogo di un gruppo di bambini: "Pasti: X/Y" solo per
  // maestra/admin, con denominatore diverso tra aggregato (tutti i
  // bambini, specs/12) e singola sezione (esclusi assenti/malati, specs/14).
  function voci(gruppo: { id: string }[], aggregato: boolean) {
    return vociRiepilogo(riepilogoGiornata(gruppo.map((b) => statoGiorno(b.id))), { conPasti, aggregato });
  }

  const boxRojac = (capitoloDiCard: boolean) =>
    conPasti ? (
      <BoxComunicazioneRojac
        supabase={supabase}
        data={data}
        ruolo={ruolo}
        comunicazione={comunicazione}
        idBambiniInPagina={new Set(idBambini)}
        capitoloDiCard={capitoloDiCard}
      />
    ) : null;

  // Card "Riepilogo giornaliero" (specs/12) con dentro, sotto gli
  // specchietti, il capitolo di comunicazione a Rojac (specs/10, specs/16).
  const riepilogoAggregato = bambini.length ? (
    <CardRiepilogo titolo="Riepilogo giornaliero">
      <div className="flex flex-wrap gap-2">
        {voci(bambini, true).map((v) => (
          <RiepilogoConteggio key={v.etichetta} {...v} />
        ))}
      </div>
      {boxRojac(true)}
    </CardRiepilogo>
  ) : (
    boxRojac(false)
  );

  const gruppi = raggruppaPerSezione(bambini, (b) => b.sezione_id, sezioni);

  let contenuto;
  if (!sezioni.length) {
    contenuto = <p className="text-sm text-stone-600">{messaggioSezioniVuote(ruolo)}</p>;
  } else if (!gruppi.length) {
    contenuto = <p className="text-sm text-stone-600">Nessun bambino attivo in nessuna classe.</p>;
  } else {
    contenuto = (
      <div className="space-y-6">
        {gruppi.map((gruppo) => (
          <div key={gruppo.titolo} className="space-y-3">
            {/* Intestazione di sezione: titolo e riassunto testuale, non
                una card (specs/10). */}
            <div className="px-1 pt-2">
              <h2 className="text-base font-semibold text-stone-800 [overflow-wrap:anywhere]">
                {titoloRiepilogoSezione(gruppo.titolo)}
              </h2>
              <p className="mt-0.5 text-sm text-stone-600">
                {voci(gruppo.elementi, false).map((v, i) => (
                  <Fragment key={v.etichetta}>
                    {i > 0 && <span aria-hidden="true"> · </span>}
                    <span className="whitespace-nowrap">{testoVoceRiepilogo(v)}</span>
                  </Fragment>
                ))}
              </p>
            </div>
            <ul className="space-y-3">
              {gruppo.elementi.map((bambino) => {
                const presenza = presenzaPerBambino.get(bambino.id);
                const pasto = pastoPerBambino.get(bambino.id);
                return (
                  <CardBambino
                    key={bambino.id}
                    bambino={bambino}
                    data={data}
                    noteAllergie={allergiePerBambino.get(bambino.id)}
                    sesso={sessoPerBambino.get(bambino.id)}
                    presenza={presenza}
                    pasto={pasto}
                    conPasti={conPasti}
                    editable={editable}
                    pastoModificabile={pastoModificabile}
                    assenzaBloccata={assenzaBloccataDaComunicazione({
                      ruolo,
                      pastiComunicati,
                      mangiato: pasto?.mangiato,
                      statoAttuale: presenza?.stato,
                    })}
                  />
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    );
  }

  return (
    <PaginaAttivitaGiornaliera
      nome={profilo?.nome || user.email || ''}
      ruolo={ruolo}
      titolo="Presenze e pasti"
      basePath={PERCORSO_GIORNATA}
      data={data}
      riepilogoAggregato={riepilogoAggregato}
      messaggioChiusura={messaggioChiuso}
      editable={editable}
    >
      {contenuto}
    </PaginaAttivitaGiornaliera>
  );
}
