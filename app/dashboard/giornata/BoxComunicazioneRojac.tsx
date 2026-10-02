import { CardRiepilogo } from '@/components/CardRiepilogo';
import { ConfermaAzione } from '@/components/ConfermaAzione';
import { puoScrivereData } from '@/lib/auth';
import { formattaDataOraItaliana } from '@/lib/date';
import {
  contaPastiSiOggiTuttoAsilo,
  bambiniSenzaPresenzaOggiTuttoAsilo,
  bambiniConIncoerenzeOggiTuttoAsilo,
  TELEFONO_ROJAC,
} from '@/lib/pastiRojac';
import { comunicaPastiRojac } from '../pasti/actions';

export type ComunicazioneGiorno = {
  numero_pasti: number;
  comunicato_at: string;
  comunicato_da_nome: string;
};

const TITOLO = 'Comunicazione pasti a Rojac';

// Messaggio di blocco con l'elenco dei bambini da correggere (presenza
// mancante o dati incoerenti, specs/16): ogni bambino la cui card è in
// questa stessa pagina è un'ancora alla sua card (#bambino-<id>), gli
// altri sono testo semplice. Nomi senza spazi anche molto lunghi (es.
// quelli generati dagli e2e): overflow-wrap:anywhere li spezza invece di
// allargare la pagina oltre lo schermo del telefono (specs/10, 375px).
function BloccoComunicazione({
  messaggio,
  etichettaElenco,
  bambini,
  idBambiniInPagina,
}: {
  messaggio: string;
  etichettaElenco: string;
  bambini: { id: string; nome: string; cognome: string; dettagli: string[] }[];
  idBambiniInPagina: Set<string>;
}) {
  return (
    <div className="rounded-lg border border-stone-300 bg-stone-50 p-3 text-sm text-stone-700">
      <p>{messaggio}</p>
      <ul aria-label={etichettaElenco} className="mt-2 list-disc space-y-1 pl-5 [overflow-wrap:anywhere]">
        {bambini.map((b) => (
          <li key={b.id}>
            {idBambiniInPagina.has(b.id) ? (
              <a href={`#bambino-${b.id}`} className="font-medium underline">
                {b.nome} {b.cognome}
              </a>
            ) : (
              <>
                {b.nome} {b.cognome}
              </>
            )}
            {b.dettagli.length > 0 && <> — {b.dettagli.join(' ')}</>}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Box di comunicazione pasti a Rojac (specs/16), in cima alla schermata
// "Presenze e pasti" dentro la card del riepilogo aggregato (specs/10). Un'unica
// azione al giorno sull'intero asilo, non sulle sole sezioni visibili a
// chi guarda. Solo maestra e admin: la pagina non lo renderizza (né
// legge pasti_comunicati) per l'assistente. Il pulsante "Conferma pasti"
// compare solo se tutti i bambini attivi hanno una presenza e nessuno ha
// dati incoerenti (pasti > presenti, specs/16): altrimenti, al suo posto,
// i messaggi di blocco con l'elenco dei bambini da correggere.
export async function BoxComunicazioneRojac({
  data,
  ruolo,
  comunicazione,
  idBambiniInPagina,
  capitoloDiCard,
}: {
  data: string;
  ruolo: string | null;
  comunicazione: ComunicazioneGiorno | null;
  idBambiniInPagina: Set<string>;
  capitoloDiCard: boolean;
}) {
  let contenuto;
  if (comunicazione) {
    contenuto = (
      <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        <span aria-hidden="true" className="text-green-600">
          ✓
        </span>{' '}
        Pasti comunicati a Rojac il {formattaDataOraItaliana(comunicazione.comunicato_at)}:{' '}
        {comunicazione.numero_pasti} pasti (da {comunicazione.comunicato_da_nome}).
      </p>
    );
  } else if (!puoScrivereData(ruolo, data)) {
    return null;
  } else {
    const [bambiniSenzaPresenza, bambiniIncoerenti] = await Promise.all([
      bambiniSenzaPresenzaOggiTuttoAsilo(data),
      bambiniConIncoerenzeOggiTuttoAsilo(data),
    ]);
    if (bambiniSenzaPresenza.length > 0 || bambiniIncoerenti.length > 0) {
      contenuto = (
        <div className="space-y-3">
          {bambiniSenzaPresenza.length > 0 && (
            <BloccoComunicazione
              messaggio={`Non puoi ancora comunicare i pasti: ${bambiniSenzaPresenza.length} ${bambiniSenzaPresenza.length === 1 ? 'bambino non ha' : 'bambini non hanno'} ancora la presenza segnata per oggi.`}
              etichettaElenco="Bambini senza presenza"
              bambini={bambiniSenzaPresenza.map((b) => ({ ...b, dettagli: [] }))}
              idBambiniInPagina={idBambiniInPagina}
            />
          )}
          {bambiniIncoerenti.length > 0 && (
            <BloccoComunicazione
              messaggio={`Non puoi ancora comunicare i pasti: ${bambiniIncoerenti.length} ${bambiniIncoerenti.length === 1 ? 'bambino ha' : 'bambini hanno'} dati incoerenti (i pasti segnati sono più dei bambini presenti). Correggi presenza o pasto.`}
              etichettaElenco="Bambini con dati incoerenti"
              bambini={bambiniIncoerenti.map((b) => ({ ...b, dettagli: b.problemi }))}
              idBambiniInPagina={idBambiniInPagina}
            />
          )}
        </div>
      );
    } else {
      const numeroPastiOggi = await contaPastiSiOggiTuttoAsilo(data);
      contenuto = (
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
      );
    }
  }

  // Di norma è un capitolo dentro la card "Riepilogo giornaliero"
  // (specs/10); se quella card non c'è (nessun bambino visibile a chi
  // guarda, ma l'asilo ne ha) resta una card a sé.
  if (!capitoloDiCard) {
    return (
      <div id="comunicazione-rojac" className="scroll-mt-4">
        <CardRiepilogo titolo={TITOLO}>{contenuto}</CardRiepilogo>
      </div>
    );
  }
  return (
    <section id="comunicazione-rojac" className="mt-3 scroll-mt-4 border-t border-stone-200 pt-3">
      <h3 className="mb-2 text-sm font-semibold text-stone-800">{TITOLO}</h3>
      {contenuto}
    </section>
  );
}
