import { EtichettaPillola } from '@/components/ui/etichetta-pillola';

// Tag "malattia" mostrato nell'intestazione della card bambino e nella
// colonna Pasto di "Presenze e pasti" (specs/10, specs/13 -
// segna-presenza.md, scenario "correggere uno stato già segnato in
// malattia").
export function EtichettaMalattia() {
  return <EtichettaPillola tono="malattia">🤒 Malattia</EtichettaPillola>;
}
