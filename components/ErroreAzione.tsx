'use client';

// Contenuto condiviso dagli error.tsx delle varie route (convenzione
// Next.js: error.tsx cattura gli errori non gestiti puntualmente da
// un'azione — vedi specs/05 - feedback.md, scenario "errore imprevisto
// non gestito puntualmente"). Mostra il messaggio ricevuto (già in
// italiano e senza dati sensibili — vedi lib/erroreAzione.ts) come
// dettaglio tecnico per un troubleshooting rapido, con un modo per
// riprovare o tornare alla dashboard.
export function ErroreAzione({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <h1 className="text-lg font-medium text-red-800">Qualcosa è andato storto</h1>
        <p className="mt-2 text-sm text-red-700">L&apos;azione non è andata a buon fine. Riprova.</p>
        <p className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-white p-2 text-left text-xs text-red-600">
          {error.message || 'Errore sconosciuto.'}
        </p>
        {error.digest && (
          // In produzione Next.js sostituisce il messaggio reale di un
          // errore non gestito in un Server Component con un testo fisso
          // e lascia solo questo digest — l'errore vero è nei log Vercel
          // (Deployments → Functions), cercabile per questo stesso
          // digest.
          <p className="mt-2 text-[11px] text-red-400">Codice errore: {error.digest}</p>
        )}
        <div className="mt-4 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
          >
            Riprova
          </button>
          <a
            href="/dashboard"
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-100"
          >
            Torna alla dashboard
          </a>
        </div>
      </div>
    </main>
  );
}
