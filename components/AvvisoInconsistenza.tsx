import { EtichettaPillola } from '@/components/ui/etichetta-pillola';

// Warning di incoerenza dati (specs/06 - controllo-consistenza.md),
// mostrato accanto al nome del bambino in Presenze, Pasti e nel report
// (tabella aggregata e drill-down) quando `inconsistenzeGiorno`
// (lib/consistenza.ts) rileva un problema. Silenzioso (non renderizza
// nulla) quando l'elenco messaggi è vuoto.
export function AvvisoInconsistenza({ messaggi }: { messaggi: string[] }) {
  if (!messaggi.length) return null;

  return (
    <EtichettaPillola tono="inconsistenza" title={messaggi.join(' ')}>
      ⚠️ Inconsistenza
    </EtichettaPillola>
  );
}
