// Selettore di settimana di "Ore di lavoro" (specs/18, "saltare a una
// settimana qualunque"): un <form method="get"> con un campo data
// nativo (tastiera e telefono, funziona anche senza JavaScript, come
// SelettoreData) che porta a `?settimana=<data scelta>`; la pagina
// normalizza la data al lunedì della sua settimana. `max` = oggi: il
// campo non offre giorni di settimane future. In modalità admin il campo
// nascosto `utente` mantiene la persona durante la navigazione.
// Server Component puro: nessuna interattività lato client necessaria.
export function SelettoreSettimanaOreLavoro({
  basePath,
  lunedi,
  oggiData,
  utenteId,
}: {
  basePath: string;
  lunedi: string;
  oggiData: string;
  utenteId?: string;
}) {
  return (
    <form method="get" action={basePath} className="flex flex-wrap items-center gap-2">
      <label htmlFor="selettore-settimana" className="text-sm text-amber-900">
        Vai alla settimana del
      </label>
      <input
        id="selettore-settimana"
        type="date"
        name="settimana"
        defaultValue={lunedi}
        max={oggiData}
        required
        className="min-h-11 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500"
      />
      {utenteId && <input type="hidden" name="utente" value={utenteId} />}
      <button
        type="submit"
        className="min-h-11 rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
      >
        Vai
      </button>
    </form>
  );
}
