// Verifica server-side di un token Cloudflare Turnstile.
// Se TURNSTILE_SECRET_KEY non è configurata, il captcha è considerato non
// attivo e la verifica passa sempre — così il rollout può avvenire in due
// tempi (prima il deploy del codice, poi la configurazione del secret)
// senza rompere il recupero password nel frattempo.
export async function turnstileValido(
  token: FormDataEntryValue | null,
  ip: string
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (typeof token !== 'string' || !token) return false;

  try {
    const risposta = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!risposta.ok) return false;

    const risultato = await risposta.json();
    return risultato.success === true && risultato.action === 'recupera-password';
  } catch {
    return false;
  }
}
