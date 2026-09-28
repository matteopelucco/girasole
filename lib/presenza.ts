// Logica pura dello stato di presenza giornaliero, incluse le presenze
// a pre-asilo/post-asilo (specs/13 - segna-presenza.md). Isolata qui
// (nessun I/O) perché le regole di reset/toggle sono le uniche
// abbastanza intricate da meritare unit test dedicati, invece di essere
// verificabili solo end-to-end — vedi CLAUDE.md, criterio di ammissione
// per gli unit test.

export type StatoPresenza = 'presente' | 'assente' | 'malattia';

export type RigaPresenza = {
  stato: StatoPresenza;
  preAsilo: boolean;
  postAsilo: boolean;
};

// Le azioni disponibili sui pulsanti di Presenze: i tre stati primari
// più i due toggle pre-asilo/post-asilo.
export type AzionePresenza = StatoPresenza | 'pre_asilo' | 'post_asilo';

// Calcola la riga di presenza risultante da un'azione, a partire dallo
// stato attuale (null se il bambino non ha ancora nessun record per la
// data in questione).
//
// Regole (specs/13):
// - Presente/Assente/Malattia azzerano sempre pre-asilo e post-asilo:
//   ha senso solo "presente" avere un orario esteso.
// - Pre-asilo/Post-asilo sono toggle indipendenti: forzano lo stato a
//   "presente" (se non lo era già) e attivano il proprio indicatore;
//   ripremuti quando già attivi lo disattivano, senza toccare l'altro
//   indicatore né retrocedere lo stato ad "assente"/"malattia".
export function prossimaPresenza(attuale: RigaPresenza | null, azione: AzionePresenza): RigaPresenza {
  if (azione === 'presente' || azione === 'assente' || azione === 'malattia') {
    return { stato: azione, preAsilo: false, postAsilo: false };
  }

  const eraPresente = attuale?.stato === 'presente';
  const preAsiloAttuale = eraPresente ? attuale!.preAsilo : false;
  const postAsiloAttuale = eraPresente ? attuale!.postAsilo : false;

  if (azione === 'pre_asilo') {
    return { stato: 'presente', preAsilo: !preAsiloAttuale, postAsilo: postAsiloAttuale };
  }
  return { stato: 'presente', preAsilo: preAsiloAttuale, postAsilo: !postAsiloAttuale };
}

// Blocco di Assente/Malattia dopo la comunicazione dei pasti a Rojac
// (specs/16 - comunicazione-pasti-rojac.md, issue #100): vero se, per
// questo bambino e questa data, i pulsanti Assente/Malattia vanno
// disabilitati. Specchio lato UI del trigger
// presenze_blocca_assenza_se_pasto_comunicato
// (supabase/migrations/0052_presenza_blocca_assenza_se_pasto_comunicato.sql),
// che resta la difesa reale: stesse condizioni, stessa esenzione admin.
// - Solo dopo una comunicazione per la data, e solo se il pasto attuale
//   del bambino è "si" (un pasto "no" o non segnato non è nel conteggio).
// - Bloccato solo il PASSAGGIO a assente/malattia: se il bambino è già
//   assente/malattia, cambiare nota o passare dall'uno all'altro non
//   tocca il conteggio dei pasti.
// - L'admin è esentato (può comunque correggere prima il pasto).
export function assenzaBloccataDaComunicazione({
  ruolo,
  pastiComunicati,
  mangiato,
  statoAttuale,
}: {
  ruolo: string | null | undefined;
  pastiComunicati: boolean;
  mangiato: string | null | undefined;
  statoAttuale: StatoPresenza | null | undefined;
}): boolean {
  if (ruolo === 'admin') return false;
  if (!pastiComunicati || mangiato !== 'si') return false;
  return statoAttuale !== 'assente' && statoAttuale !== 'malattia';
}

// Frammento del messaggio sollevato dal trigger di 0052: serve a
// riconoscere quel rifiuto tra gli errori del salvataggio presenza.
const FRAMMENTO_ERRORE_PASTO_COMUNICATO = 'già stato comunicato a Rojac';

export const MESSAGGIO_ASSENZA_BLOCCATA =
  'Non puoi segnare Assente o Malattia per questo bambino: il suo pasto è già stato comunicato a Rojac. Se serve una correzione, chiedi all’amministrazione.';

// Traduce l'errore del database in un messaggio comprensibile per chi usa
// l'app (mostrato da ErroreAzione): il rifiuto del trigger di 0052 diventa
// una spiegazione in italiano semplice; ogni altro errore resta quello di
// sempre, con il dettaglio tecnico per il troubleshooting.
export function messaggioErroreSalvataggioPresenza(messaggioDatabase: string): string {
  if (messaggioDatabase.includes(FRAMMENTO_ERRORE_PASTO_COMUNICATO)) {
    return MESSAGGIO_ASSENZA_BLOCCATA;
  }
  return `Impossibile salvare la presenza: ${messaggioDatabase}`;
}
