const GIORNI: { campo: string; etichetta: string }[] = [
  { campo: 'ore_lunedi', etichetta: 'Lunedì' },
  { campo: 'ore_martedi', etichetta: 'Martedì' },
  { campo: 'ore_mercoledi', etichetta: 'Mercoledì' },
  { campo: 'ore_giovedi', etichetta: 'Giovedì' },
  { campo: 'ore_venerdi', etichetta: 'Venerdì' },
];

// I 5 campi "ore previste" (lunedì-venerdì) di un profilo orario
// (specs/54 - profili-orari.md), condivisi da creazione
// (app/admin/profili-orari/page.tsx) e modifica
// (app/admin/profili-orari/[id]/page.tsx) per non duplicare gli stessi 5
// input in due posti (CLAUDE.md, sezione jscpd). `valori` assente (form
// di creazione) parte da 0 su ogni giorno.
export function CampiOreSettimana({ valori }: { valori?: Partial<Record<string, number | string>> }) {
  return (
    <div className="flex flex-wrap gap-2">
      {GIORNI.map((g) => (
        <label key={g.campo} className="flex flex-col text-xs text-stone-600">
          {g.etichetta}
          <input
            name={g.campo}
            type="number"
            min={0}
            step={0.5}
            defaultValue={valori?.[g.campo] ?? 0}
            aria-label={g.etichetta}
            className="mt-1 w-16 rounded-lg border border-stone-300 px-2 py-1 text-sm outline-none focus:border-stone-500"
          />
        </label>
      ))}
    </div>
  );
}
