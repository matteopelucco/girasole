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
