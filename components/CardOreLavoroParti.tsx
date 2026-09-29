import { descrizioneDifferenzaOre } from '@/lib/oreLavoro';

// Parti di presentazione della card di un giorno lavorativo di "Ore di
// lavoro" (specs/18), condivise dalla card modificabile
// (RigaOreLavoro, client) e dalla vista di sola lettura della settimana
// confermata (Server Component): stesso linguaggio, niente duplicazione
// (jscpd). Volutamente senza 'use client' né stato: importabili da
// entrambi i lati.

// Classe della card di un giorno lavorativo: verde con differenza 0,
// rossa altrimenti, neutra se la differenza non è valutabile (null).
export function classeCardOreLavoro(differenza: number | null): string {
  if (differenza === null) return 'border-stone-200 bg-white';
  return differenza === 0 ? 'border-emerald-400 bg-emerald-50' : 'border-red-400 bg-red-50';
}

// Ore ordinarie (= previste) come solo testo, più il riferimento
// "Previsto" statico (o l'avviso senza profilo orario).
export function OrePreviste({ orePreviste }: { orePreviste: number | null }) {
  return (
    <div className="text-xs text-stone-600">
      Ore ordinarie
      <p className="text-base font-medium text-stone-900" data-ore-ordinarie>
        {orePreviste ?? 0}h
      </p>
      <p className="text-xs text-stone-700">
        {orePreviste === null
          ? "Nessun profilo orario assegnato: chiedi all'admin di assegnarlo. Le ore fatte vanno scritte come differenza."
          : `Previsto: ${orePreviste}h`}
      </p>
    </div>
  );
}

// "Totale ore erogate" in grande più il testo di stato (non solo colore).
// `totale`/`differenza` null = valore non valido (mostra "—").
export function TotaleOreErogate({
  etichettaGiorno,
  totale,
  differenza,
}: {
  etichettaGiorno: string;
  totale: number | null;
  differenza: number | null;
}) {
  const stato = differenza === null ? null : descrizioneDifferenzaOre(differenza);
  return (
    <div role="status" aria-label={`Totale ore erogate ${etichettaGiorno}`} className="flex flex-wrap items-baseline gap-x-3">
      <span className="text-xs text-stone-600">Totale ore erogate</span>
      <span className="text-3xl font-semibold text-stone-900">{totale === null ? '—' : `${totale}h`}</span>
      {stato && (
        <span className={`text-sm font-medium ${stato.inRegola ? 'text-emerald-800' : 'text-red-800'}`}>{stato.testo}</span>
      )}
    </div>
  );
}
