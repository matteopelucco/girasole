import type { EventoVista, GiornoVista, MeseVista } from '@/lib/calendarioEventiVista';
import { formattaDataItaliana } from '@/lib/date';

// Elenco degli eventi della pagina "Calendario" (specs/64): mesi, giorni,
// schede. Solo presentazione. Titolo, descrizione e luogo arrivano da un feed
// non fidato: sono resi SOLO come testo (React li escapa), mai come HTML e mai
// come link; nessun `dangerouslySetInnerHTML`, nessun URL del feed in un href.

function SchedaEvento({ evento, passato }: { evento: EventoVista; passato: boolean }) {
  return (
    <li
      data-testid="evento"
      className={`rounded-xl border border-l-4 p-3 shadow-sm ${
        passato ? 'border-stone-200 border-l-stone-300 bg-stone-50' : 'border-stone-200 border-l-amber-400 bg-white'
      }`}
    >
      <p
        data-testid="titolo-evento"
        className={`font-medium [overflow-wrap:anywhere] ${passato ? 'text-stone-600' : 'text-stone-900'}`}
      >
        {evento.titolo}
      </p>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs font-medium">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 ${
            evento.orario.tutto ? 'bg-amber-100 text-amber-900' : 'bg-sky-100 text-sky-900'
          }`}
        >
          <span aria-hidden>{evento.orario.tutto ? '☀️' : '🕒'}</span>
          <span data-testid="orario-evento">{evento.orario.testo}</span>
        </span>
        {evento.orario.intervallo && (
          <span data-testid="intervallo-evento" className="rounded-full bg-stone-100 px-2.5 py-0.5 text-stone-700">
            {evento.orario.intervallo}
          </span>
        )}
        {evento.inCorso && (
          <span data-testid="in-corso" className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-emerald-900">
            In corso
          </span>
        )}
      </div>

      {evento.luogo && (
        <p data-testid="luogo-evento" className="mt-2 text-sm text-stone-700 [overflow-wrap:anywhere]">
          <span aria-hidden>📍 </span>
          <span className="sr-only">Luogo: </span>
          {evento.luogo}
        </p>
      )}
      {evento.descrizione && (
        <p
          data-testid="descrizione-evento"
          className="mt-2 whitespace-pre-line text-sm text-stone-700 [overflow-wrap:anywhere]"
        >
          {evento.descrizione}
        </p>
      )}
    </li>
  );
}

function BloccoGiorno({ giorno, passato }: { giorno: GiornoVista; passato: boolean }) {
  return (
    <li data-testid={`giorno-${giorno.data}`} className="flex items-start gap-3">
      <time
        dateTime={giorno.data}
        className={`flex w-12 shrink-0 flex-col items-center rounded-xl border py-1.5 text-center ${
          giorno.eOggi
            ? 'border-emerald-700 bg-emerald-700 text-white'
            : passato
              ? 'border-stone-200 bg-stone-100 text-stone-700'
              : 'border-amber-200 bg-amber-50 text-stone-900'
        }`}
      >
        <span className="sr-only">{formattaDataItaliana(giorno.data)}</span>
        <span aria-hidden className="text-[11px] font-medium uppercase leading-none tracking-wide">
          {giorno.nomeGiorno}
        </span>
        <span aria-hidden data-testid="numero-giorno" className="mt-0.5 font-heading text-xl font-semibold leading-none">
          {giorno.numero}
        </span>
        {giorno.eOggi && (
          <span aria-hidden className="mt-0.5 text-[10px] font-semibold uppercase leading-none">
            Oggi
          </span>
        )}
      </time>
      <ul className="min-w-0 flex-1 space-y-2">
        {giorno.eventi.map((evento) => (
          <SchedaEvento key={evento.id} evento={evento} passato={passato} />
        ))}
      </ul>
    </li>
  );
}

export function ElencoMesi({ mesi, passato }: { mesi: MeseVista[]; passato: boolean }) {
  return (
    <div className="space-y-6">
      {mesi.map((mese) => (
        <div key={mese.chiave} className="space-y-3">
          <h4 className="border-b border-stone-200 pb-1 font-heading text-sm font-semibold capitalize text-stone-700">
            {mese.titolo}
          </h4>
          <ul className="space-y-3">
            {mese.giorni.map((giorno) => (
              <BloccoGiorno key={giorno.data} giorno={giorno} passato={passato} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
