// Invio email via l'API HTTP di Resend (https://resend.com): solo
// `fetch` nativo, nessun pacchetto npm aggiuntivo (CLAUDE.md: niente
// nuove dipendenze senza chiederlo prima). RESEND_API_KEY va impostata
// come variabile d'ambiente (locale: .env.local; produzione: Vercel),
// mai committata — vedi TASKS.md per la procedura di attivazione.
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

export async function inviaEmail({
  a,
  oggetto,
  html,
  allegati,
}: {
  a: string;
  oggetto: string;
  html: string;
  allegati?: AllegatoEmail[];
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY non configurata.');

  const mittente = process.env.RESEND_MITTENTE || 'Girasole <onboarding@resend.dev>';

  const risposta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: mittente,
      to: [a],
      subject: oggetto,
      html,
      attachments: allegati?.map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.content).toString('base64'),
      })),
    }),
  });

  if (!risposta.ok) {
    const dettaglio = await risposta.text();
    throw new Error(`Invio email fallito (${risposta.status}): ${dettaglio}`);
  }
}
