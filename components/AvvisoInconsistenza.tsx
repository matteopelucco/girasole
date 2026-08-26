// Warning di incoerenza dati (specs/06 - controllo-consistenza.md),
// mostrato accanto al nome del bambino in Presenze, Pasti e nel report
// (tabella aggregata e drill-down) quando `inconsistenzeGiorno`
// (lib/consistenza.ts) rileva un problema. Silenzioso (non renderizza
// nulla) quando l'elenco messaggi è vuoto.
export function AvvisoInconsistenza({ messaggi }: { messaggi: string[] }) {
  if (!messaggi.length) return null;

  return (
    <span
      className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800"
      title={messaggi.join(' ')}
    >
      ⚠️ Inconsistenza
    </span>
  );
}
