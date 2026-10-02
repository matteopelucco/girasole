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

// Cosa va azzerato quando un bambino viene segnato Assente/Malattia
// (specs/13 - segna-presenza.md, issue #186): un bambino assente non
// mangia e non fa pre/post-asilo, e un pasto "sì" rimasto sul suo nome
// verrebbe contato nel totale comunicato a Rojac (e nella retta). Serve
// alla UI per decidere se chiedere conferma; l'azzeramento vero lo fa la
// server action. Se il bambino è già assente/malato non c'è nulla da
// azzerare: passare dall'uno all'altro non cambia i pasti (e il trigger
// di 0012/0017 non permette comunque di scrivere un pasto in quel caso).
// `mangiato` è undefined per chi non legge i pasti (l'assistente).
export type DatiDaAzzerare = { pasto: boolean; preAsilo: boolean; postAsilo: boolean };

export function datiDaAzzerarePerAssenza({
  statoAttuale,
  mangiato,
  preAsilo,
  postAsilo,
}: {
  statoAttuale: StatoPresenza | null | undefined;
  mangiato?: string | null;
  preAsilo?: boolean | null;
  postAsilo?: boolean | null;
}): DatiDaAzzerare {
  if (statoAttuale === 'assente' || statoAttuale === 'malattia') {
    return { pasto: false, preAsilo: false, postAsilo: false };
  }
  return { pasto: mangiato === 'si', preAsilo: !!preAsilo, postAsilo: !!postAsilo };
}

// Testo dell'avviso mostrato prima della conferma; null se non c'è nulla
// da azzerare (nessuna conferma da chiedere).
export function avvisoAzzeramentoPerAssenza(da: DatiDaAzzerare): string | null {
  const voci = [da.pasto && 'il pasto', da.preAsilo && 'il pre-asilo', da.postAsilo && 'il post-asilo'].filter(
    (voce): voce is string => !!voce
  );
  if (!voci.length) return null;

  const elenco = voci.length === 1 ? voci[0] : `${voci.slice(0, -1).join(', ')} e ${voci[voci.length - 1]}`;
  const singolare = voci.length === 1;
  return `Attenzione: per questo bambino ${singolare ? 'risulta già segnato' : 'risultano già segnati'} ${elenco}. Se confermi, ${singolare ? 'verrà azzerato' : 'verranno azzerati'}.`;
}

// Blocco di Assente/Malattia dopo la comunicazione dei pasti a Rojac
// (specs/16 - comunicazione-pasti-rojac.md, issue #100): vero se, per
// questo bambino e questa data, i pulsanti Assente/Malattia vanno
// disabilitati. Specchio lato UI del trigger
// presenze_blocca_assenza_se_pasto_comunicato
// (supabase/migrations/0052_presenza_blocca_assenza_se_pasto_comunicato.sql),
// che resta la difesa reale: stesse condizioni, stessa esenzione admin.
// Il trigger è AFTER INSERT OR UPDATE: scatta solo su righe che la RLS
// ha già accettato (sezione propria, data scrivibile), quindi non rivela
// nulla su bambini o date che chi scrive non potrebbe modificare.
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

// --- Rilettura della riga dal database (issue #124) ---------------------
// Le azioni di scrittura non si fidano della riga di presenza ricevuta dal
// browser (gli argomenti legati con `.bind()` alle Server Actions viaggiano
// nella richiesta e si possono falsificare): la rileggono dal database con
// la sessione dell'utente (quindi sotto RLS) e decidono su quella. La riga
// del browser resta solo come controllo di concorrenza ottimistica.

export const MESSAGGIO_DATI_CAMBIATI =
  'I dati di questo bambino sono cambiati: ricarica la pagina e riprova.';

export const MESSAGGIO_RIGA_NON_VALIDA = 'Impossibile leggere la presenza di questo bambino. Riprova.';

export const MESSAGGIO_PRESENZA_NON_TROVATA =
  'Segna prima uno stato di presenza per poter salvare una nota.';

const STATI_PRESENZA: readonly string[] = ['presente', 'assente', 'malattia'];

// Colonne di `presenze` lette dal database (select 'stato, pre_asilo, post_asilo').
export type RigaPresenzaDb = { stato: string; pre_asilo: boolean; post_asilo: boolean };

// Converte la riga letta dal database nel formato dell'applicazione, dopo
// averne verificato la coerenza (stato noto; pre/post-asilo solo se
// presente, come il vincolo del database). null = nessuna riga: non
// esiste, oppure la RLS non la rende visibile a chi legge (le due cose
// non si distinguono, e va bene così: niente informazioni in più).
export function rigaPresenzaDaDb(riga: RigaPresenzaDb | null | undefined): RigaPresenza | null {
  if (!riga) return null;
  const statoValido = STATI_PRESENZA.includes(riga.stato);
  const indicatoriCoerenti = riga.stato === 'presente' || (!riga.pre_asilo && !riga.post_asilo);
  if (!statoValido || !indicatoriCoerenti) throw new Error(MESSAGGIO_RIGA_NON_VALIDA);
  return { stato: riga.stato as StatoPresenza, preAsilo: riga.pre_asilo, postAsilo: riga.post_asilo };
}

// Controllo di concorrenza ottimistica: la riga dichiarata dal browser
// deve coincidere con quella appena letta dal database. Confronto stretto
// campo per campo (valori malformati non coincidono mai); il messaggio
// d'errore è generico e non rivela la riga letta.
export function assicuraRigaAttesa(
  letta: RigaPresenza | null,
  attesaDalClient: RigaPresenza | null | undefined
): void {
  const attesa = attesaDalClient ?? null;
  if (letta === null || attesa === null) {
    if (letta === attesa) return;
    throw new Error(MESSAGGIO_DATI_CAMBIATI);
  }
  const uguali =
    letta.stato === attesa.stato && letta.preAsilo === attesa.preAsilo && letta.postAsilo === attesa.postAsilo;
  if (!uguali) throw new Error(MESSAGGIO_DATI_CAMBIATI);
}
