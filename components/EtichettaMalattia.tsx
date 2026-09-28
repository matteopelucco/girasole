// Tag "malattia" mostrato nell'intestazione della card bambino e nella
// colonna Pasto di "Presenze e pasti" (specs/10, specs/13 -
// segna-presenza.md, scenario "correggere uno stato già segnato in
// malattia").
export function EtichettaMalattia() {
  return (
    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800">
      🤒 Malattia
    </span>
  );
}
