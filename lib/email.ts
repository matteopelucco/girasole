// Invio email via l'API HTTP di Resend (https://resend.com): solo
// `fetch` nativo, nessun pacchetto npm aggiuntivo (CLAUDE.md: niente
// nuove dipendenze senza chiederlo prima). RESEND_API_KEY va impostata
// come variabile d'ambiente (locale: .env.local; produzione: Vercel),
// mai committata — vedi docs/tasks-archivio.md per la procedura di attivazione.
// EMAIL_DRY_RUN (solo test, nella CI e2e): invio simulato, vedi
// `modalitaInvioEmail` più sotto.
export type AllegatoEmail = {
  filename: string;
  content: Uint8Array;
};

const DESTINATARIO_NOTIFICHE_DEFAULT = 'info@asilosartorio.it';

// Indirizzo per tutte le notifiche email automatiche dell'asilo (report
// notturno, specs/52; allarmi, specs/07): stessa variabile d'ambiente e
// stesso default per tutte, un solo posto da cambiare.
export function destinatarioNotifiche(): string {
  return process.env.REPORT_EMAIL_DESTINATARIO || DESTINATARIO_NOTIFICHE_DEFAULT;
}

// Indirizzo di Rojac (la mensa esterna) per la mail mensile dei pasti
// (specs/61): per ora solo da variabile d'ambiente, mai da interfaccia.
// null se non configurato: chi chiama deve avvisare invece di inviare.
export function destinatarioRojac(): string | null {
  return process.env.ROJAC_EMAIL_DESTINATARIO?.trim() || null;
}

export type ParametriEmail = {
  // Uno o più destinatari (specs/55, "più indirizzi email di
  // promemoria, separati da ;"): un solo invio con più "to", non
  // un'email separata per destinatario.
  a: string | string[];
  cc?: string;
  // Header Reply-To: dove arriva una risposta. Solo per le mail a
  // destinatari esterni (genitori, specs/56; Rojac, specs/61): il mittente tecnico (RESEND_MITTENTE) non è
  // una casella letta da nessuno. Le mail interne non lo impostano.
  rispondiA?: string;
  oggetto: string;
  html: string;
  allegati?: AllegatoEmail[];
};

// Corpo della richiesta all'API Resend: pura, senza I/O (testabile).
export function costruisciPayloadEmail({
  mittente,
  a,
  cc,
  rispondiA,
  oggetto,
  html,
  allegati,
}: ParametriEmail & { mittente: string }) {
  return {
    from: mittente,
    to: Array.isArray(a) ? a : [a],
    cc: cc ? [cc] : undefined,
    reply_to: rispondiA || undefined,
    subject: oggetto,
    html,
    attachments: allegati?.map((allegato) => ({
      filename: allegato.filename,
      content: Buffer.from(allegato.content).toString('base64'),
    })),
  };
}

// Valori di EMAIL_DRY_RUN che attivano l'invio simulato (senza distinguere
// maiuscole e spazi attorno).
const VALORI_DRY_RUN_ATTIVI = ['1', 'true', 'yes', 'on'];

export type ModalitaInvioEmail = {
  simulato: boolean;
  // Messaggio da scrivere nei log, senza dati personali; null se non serve.
  avviso: string | null;
};

// Invio simulato (specs/56, "invio email simulato nei test"): con
// EMAIL_DRY_RUN attiva `inviaEmail` non chiama Resend e termina con
// successo, così i test e2e dell'invio girano anche senza chiave. In
// produzione (VERCEL_ENV=production) la variabile è ignorata, con un avviso:
// non deve poter bloccare per errore le mail vere. Pura, senza I/O.
export function modalitaInvioEmail(env: Record<string, string | undefined>): ModalitaInvioEmail {
  const attiva = VALORI_DRY_RUN_ATTIVI.includes((env.EMAIL_DRY_RUN ?? '').trim().toLowerCase());
  if (!attiva) return { simulato: false, avviso: null };
  if (env.VERCEL_ENV === 'production') {
    return {
      simulato: false,
      avviso: 'EMAIL_DRY_RUN è attiva in produzione: ignorata, le email partono davvero. Rimuovere la variabile.',
    };
  }
  return { simulato: true, avviso: null };
}

export async function inviaEmail(parametri: ParametriEmail): Promise<void> {
  const modalita = modalitaInvioEmail(process.env);
  if (modalita.avviso) console.warn(modalita.avviso);
  if (modalita.simulato) {
    // Niente destinatario, oggetto o testo nei log (dati personali).
    console.info('Invio email simulato (EMAIL_DRY_RUN).');
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY non configurata.');

  const mittente = process.env.RESEND_MITTENTE || 'Girasole <onboarding@resend.dev>';

  const risposta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(costruisciPayloadEmail({ mittente, ...parametri })),
  });

  if (!risposta.ok) {
    const dettaglio = await risposta.text();
    throw new Error(`Invio email fallito (${risposta.status}): ${dettaglio}`);
  }
}
