// specs/62 - parametri-di-funzionamento.md: sezione "Parametri delle funzionalità".
// Per ora nessun parametro è configurato: solo il messaggio di cortesia. Quando
// arriveranno, saranno elencati qui in tabella (nome + valore modificabile).
export function ParametriFunzionalita() {
  return (
    <section
      aria-labelledby="parametri-funzionalita-titolo"
      className="space-y-2 rounded-lg border border-stone-200 bg-white p-4"
    >
      <h2 id="parametri-funzionalita-titolo" className="text-base font-medium">
        Parametri delle funzionalità
      </h2>
      <p data-testid="descrizione-funzionalita" className="text-sm text-stone-600">
        I valori che regolano le funzionalità dell&apos;app, con il loro nome e un campo per
        modificarli. L&apos;elenco è fisso: non si possono aggiungere nuovi parametri.
      </p>
      <p data-testid="funzionalita-in-costruzione" className="text-sm text-stone-700">
        Questa funzionalità è in corso di costruzione: le prossime storie porteranno qui i parametri
        che oggi sono nel codice.
      </p>
    </section>
  );
}
