import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { calendarioCollegato } from '@/lib/calendarioImpostazioniDati';
import { costruisciVistaEventi, type EventoRiga } from '@/lib/calendarioEventiVista';
import { sommaGiorni } from '@/lib/date';
import { StatoVuoto } from '@/components/ui/stato-vuoto';
import { ElencoMesi } from './ElencoEventi';

// Quanti giorni indietro si mostrano gli eventi passati (il cron ne salva circa 30).
const GIORNI_PASSATI = 30;

function Messaggio({ children, testid }: { children: React.ReactNode; testid?: string }) {
  return (
    <StatoVuoto data-testid={testid} allineamento="centro">
      {children}
    </StatoVuoto>
  );
}

// Eventi dal Google Calendar (specs/64), letti SOLO dalla tabella
// `calendario_eventi` con la sessione di chi guarda (RLS: admin, maestra,
// assistente): la pagina non chiama mai Google. Una query a sé, separata dai
// giorni di chiusura (vedi la regola di separazione in page.tsx). Non legge né
// mostra l'indirizzo del feed: all'admin dice solo se è stato salvato.
export async function SezioneEventi({ oggi, eAdmin }: { oggi: string; eAdmin: boolean }) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('calendario_eventi')
    .select('id, titolo, descrizione, luogo, inizio, fine, tutto_il_giorno')
    // Fine del giorno a Roma più larga di un giorno: il filtro fine è solo un
    // taglio grossolano, i passati veri li decide costruisciVistaEventi.
    .gte('fine', `${sommaGiorni(oggi, -GIORNI_PASSATI - 1)}T00:00:00Z`)
    .order('inizio', { ascending: true })
    .limit(1000);

  if (error) {
    console.error('Calendario: impossibile leggere gli eventi', error.message);
    return <Messaggio>Non è stato possibile leggere gli eventi. Riprova tra poco.</Messaggio>;
  }

  const righe = (data ?? []) as EventoRiga[];

  if (righe.length === 0) {
    if (!eAdmin) return <Messaggio testid="nessun-evento">Non ci sono eventi a calendario.</Messaggio>;

    // Solo per l'admin: collegato o no (senza leggere l'indirizzo).
    const collegato = await calendarioCollegato(supabase);
    return collegato ? (
      <Messaggio testid="nessun-evento">
        Non ci sono eventi a calendario. Gli eventi di Google si aggiornano ogni notte.
      </Messaggio>
    ) : (
      <Messaggio testid="nessun-evento">
        Il Google Calendar non è ancora collegato. Per mostrare qui gli eventi, inserisci l&apos;indirizzo del calendario in{' '}
        <Link
          href="/admin/parametri-funzionamento"
          className="font-medium text-emerald-800 underline underline-offset-2 hover:text-emerald-900"
        >
          Parametri di funzionamento
        </Link>
        .
      </Messaggio>
    );
  }

  const { prossimi, passati } = costruisciVistaEventi(righe, oggi);

  return (
    <div className="space-y-8">
      <div data-testid="eventi-prossimi" className="space-y-4">
        <h3 className="font-heading text-base font-semibold text-stone-900">Prossimi</h3>
        {prossimi.length > 0 ? (
          <ElencoMesi mesi={prossimi} passato={false} />
        ) : (
          <Messaggio>Nessun evento in programma.</Messaggio>
        )}
      </div>

      {passati.length > 0 && (
        <div data-testid="eventi-passati" className="space-y-4">
          <h3 className="font-heading text-base font-semibold text-stone-700">Passati</h3>
          <ElencoMesi mesi={passati} passato />
        </div>
      )}
    </div>
  );
}
