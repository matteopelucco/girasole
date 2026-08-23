// Tag "Assente" mostrato in Pasti al posto dei pulsanti Sì/No
// (specs/14 - segna-pasto.md, scenario "un bambino assente non è
// selezionabile per il pasto").
export function EtichettaAssente() {
  return (
    <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs font-semibold text-stone-800">
      🚫 Assente
    </span>
  );
}
