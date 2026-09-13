import type { MeseAnnoScolastico } from '@/lib/pagamentiRetta';

function formattaEuro(valore: number): string {
  return valore.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Le celle "mese" + il totale di una riga della tabella rette
// (specs/56 - rette.md), condivise dalla tabella riepilogativa
// (app/admin/rette/page.tsx) e dalla scheda di dettaglio bambino
// (app/admin/rette/[id]/page.tsx) per non duplicare lo stesso markup
// in due posti (CLAUDE.md, sezione jscpd). Va dentro una <tr> già
// aperta da chi la usa (le altre celle, es. nome/sezione, cambiano da
// pagina a pagina).
export function CelleImportiRetta({
  mesi,
  importiPerMese,
  totale,
}: {
  mesi: MeseAnnoScolastico[];
  importiPerMese: Map<string, number>;
  totale: number;
}) {
  return (
    <>
      {mesi.map((mese) => (
        <td key={mese.mese} className="whitespace-nowrap px-3 py-2 text-right text-sm">
          {formattaEuro(importiPerMese.get(mese.mese) ?? 0)}
        </td>
      ))}
      <td className="whitespace-nowrap px-3 py-2 text-right text-sm font-medium">{formattaEuro(totale)}</td>
    </>
  );
}
