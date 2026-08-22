// Tag "malattia" mostrato accanto al nome del bambino negli elenchi di
// Presenze e Pasti (specs/13 - segna-presenza.md, scenario "correggere
// uno stato già segnato in malattia").
export function EtichettaMalattia() {
  return (
    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800">
      🤒 Malattia
    </span>
  );
}
