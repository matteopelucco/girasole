// Invio email via l'API HTTP di Resend (https://resend.com): solo
// `fetch` nativo, nessun pacchetto npm aggiuntivo (CLAUDE.md: niente
// nuove dipendenze senza chiederlo prima). RESEND_API_KEY va impostata
// come variabile d'ambiente (locale: .env.local; produzione: Vercel),
// mai committata — vedi TASKS.md per la procedura di attivazione.
export async function inviaEmail({
  a,
  oggetto,
  html,
}: {
  a: string;
  oggetto: string;
  html: string;
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
    body: JSON.stringify({ from: mittente, to: [a], subject: oggetto, html }),
  });

  if (!risposta.ok) {
    const dettaglio = await risposta.text();
    throw new Error(`Invio email fallito (${risposta.status}): ${dettaglio}`);
  }
}
