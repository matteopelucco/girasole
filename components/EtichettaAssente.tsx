import { EtichettaPillola } from '@/components/ui/etichetta-pillola';

// Tag "Assente" mostrato nell'intestazione della card bambino e, nella
// colonna Pasto, al posto dei pulsanti Sì/No (specs/10, specs/14 -
// segna-pasto.md, scenario "un bambino assente non è selezionabile per
// il pasto").
export function EtichettaAssente() {
  return <EtichettaPillola tono="assente">🚫 Assente</EtichettaPillola>;
}
