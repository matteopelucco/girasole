// Lista dei parametri visibili (whitelist) — specs/62 - parametri-di-funzionamento.md,
// sezione "Variabili d'ambiente" (issue #287).
//
// Qui ci sono SOLO i NOMI delle variabili d'ambiente che l'admin può vedere
// nella pagina "Parametri di funzionamento". Nessun valore: i valori si
// leggono dall'ambiente del server (Vercel, .env.local) al momento della
// richiesta. Tutte le variabili che NON sono in questa lista non vengono mai
// lette dalla pagina né inviate al browser.
//
// Per rendere visibile una variabile: aggiungi il suo nome qui sotto, in
// maiuscolo, tra apici. Se la variabile non è configurata nell'ambiente, non
// compare (nessun errore).
//
// Segreti critici volutamente ESCLUSI (decisione di Matteo, issue #287): non
// aggiungerli senza una decisione esplicita, perché chi li legge può aggirare
// la RLS, chiamare i cron, inviare mail o disattivare il captcha:
//   - SUPABASE_SERVICE_ROLE_KEY  (bypassa la RLS; in più il controllo
//     `npm run check:service-role`, dentro `npm run lint`, fa fallire la CI
//     se compare qui come stringa)
//   - CRON_SECRET
//   - RESEND_API_KEY
//   - TURNSTILE_SECRET_KEY
// Il test lib/parametriAmbiente.test.ts fallisce se uno di questi compare
// nella lista: abilitarli vuol dire anche aggiornare quel test, di proposito.
export const PARAMETRI_VISIBILI: readonly string[] = [
  // Supabase: indirizzo del progetto e chiave anon (pubblica per design).
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  // Captcha Turnstile: chiave pubblica del sito (non il secret).
  'NEXT_PUBLIC_TURNSTILE_SITE_KEY',
  // Email: mittente e destinatari (specs/52, specs/61).
  'RESEND_MITTENTE',
  'REPORT_EMAIL_DESTINATARIO',
  'REPORT_EMAIL_MODALITA_PERIODICI',
  'ROJAC_EMAIL_DESTINATARIO',
];
