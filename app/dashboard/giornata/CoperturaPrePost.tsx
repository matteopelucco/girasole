import { Avviso } from '@/components/ui/avviso';
import { gettoneFuoriRetta, statoGettone } from '@/lib/prezzi';
import { Gettone } from './Gettone';

// Esito sì/no della funzione `copertura_pre_post_asilo` per un bambino
// (specs/13): mai importi, solo se la voce è coperta dall'abbonamento.
export type CoperturaBambino = {
  preCoperto: boolean;
  postCoperto: boolean;
  rettaSuccessivaInviata: boolean;
};

export const TESTO_COPERTO = "Già pagato con l'abbonamento";
export const TESTO_DA_ADDEBITARE = 'Da addebitare nella prossima retta';
export const TESTO_AVVISO_FUORI_RETTA =
  "Questo gettone non entrerà più in retta: l'admin lo gestirà con crediti e debiti.";

const VOCI = [
  { voce: 'pre', etichetta: 'Pre-asilo', suffisso: 'pre-asilo' },
  { voce: 'post', etichetta: 'Post-asilo', suffisso: 'post-asilo' },
] as const;

// Una riga per ogni voce (pre/post-asilo) ATTIVA: scritta «Già pagato con
// l'abbonamento» oppure gettone + «Da addebitare nella prossima retta»;
// più, se serve, l'avviso di GET-12 (non bloccante). Nessun importo.
export function CoperturaPrePost({
  copertura,
  preAsilo,
  postAsilo,
}: {
  copertura: CoperturaBambino | undefined;
  preAsilo: boolean;
  postAsilo: boolean;
}) {
  if (!copertura) return null;
  const attive = { pre: preAsilo, post: postAsilo };
  const coperte = { pre: copertura.preCoperto, post: copertura.postCoperto };
  const righe = VOCI.filter((v) => attive[v.voce]);
  if (righe.length === 0) return null;
  const fuoriRetta = righe.some((v) =>
    gettoneFuoriRetta({
      attivo: attive[v.voce],
      coperto: coperte[v.voce],
      rettaSuccessivaInviata: copertura.rettaSuccessivaInviata,
    })
  );

  return (
    <div className="mt-3 space-y-2">
      {righe.map((v) => {
        const daAddebitare = statoGettone(coperte[v.voce]) === 'da_addebitare';
        return (
          <div key={v.voce} className="flex flex-wrap items-center gap-2 text-sm text-stone-700 wrap-anywhere">
            <span className="font-medium">{v.etichetta}</span>
            {daAddebitare && <Gettone testid={`gettone-${v.suffisso}`} />}
            <span data-testid={`copertura-${v.suffisso}`}>{daAddebitare ? TESTO_DA_ADDEBITARE : TESTO_COPERTO}</span>
          </div>
        );
      })}
      {fuoriRetta && (
        <Avviso tono="attenzione" data-testid="avviso-gettone-fuori-retta">
          {TESTO_AVVISO_FUORI_RETTA}
        </Avviso>
      )}
    </div>
  );
}
