import { Campo } from '@/components/ui/campo';
import { Pulsante } from '@/components/ui/pulsante';

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
      <Campo id="selettore-settimana" type="date" name="settimana" defaultValue={lunedi} max={oggiData} required />
      {utenteId && <input type="hidden" name="utente" value={utenteId} />}
      <Pulsante type="submit" variante="primario" misura="normale">
        Vai
      </Pulsante>
    </form>
  );
}
