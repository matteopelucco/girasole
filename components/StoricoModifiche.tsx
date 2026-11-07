import { formattaDataOraItaliana } from '@/lib/date';
import { formattaImporto } from '@/lib/comunicazioneRetta';
import { vociDelloStorico, type ModificaStorico } from '@/lib/modificaImporti';

// Storico delle modifiche degli importi di un mese (specs/60, PAG-08): dalla
// più recente, con data, chi, motivo e le sole voci cambiate (valore prima e
// dopo) più il totale. Sola lettura: l'app non scrive né cancella lo storico.
// Un mese mai modificato non mostra nulla.
export function StoricoModifiche({ modifiche }: { modifiche: ModificaStorico[] }) {
  if (modifiche.length === 0) return null;
  return (
    <details className="mt-1 whitespace-normal">
      <summary className="cursor-pointer text-xs font-medium text-stone-700 underline">Storico modifiche</summary>
      <ol className="mt-1 max-w-72 space-y-2">
        {modifiche.map((m) => (
          <li key={m.id} className="rounded-base border border-stone-200 bg-white p-2 text-xs text-stone-700">
            <p className="font-medium">
              {formattaDataOraItaliana(m.modificata_il)} — {m.modificata_da_nome}
            </p>
            <p>Motivo: {m.motivo}</p>
            <ul className="mt-1 space-y-0.5">
              {vociDelloStorico(m.modifiche).map((voce) => (
                <li key={voce.chiave}>
                  {voce.etichetta}: {voce.prima} → {voce.dopo}
                </li>
              ))}
              <li className="font-medium">
                Totale: {formattaImporto(Number(m.totale_prima))} € → {formattaImporto(Number(m.totale_dopo))} €
              </li>
            </ul>
          </li>
        ))}
      </ol>
    </details>
  );
}
