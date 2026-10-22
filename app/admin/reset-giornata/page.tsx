import { NavHeader } from '@/components/NavHeader';
import { SelettoreData } from '@/components/SelettoreData';
import { ConfermaAzione } from '@/components/ConfermaAzione';
import { Avviso } from '@/components/ui/avviso';
import { EtichettaPillola } from '@/components/ui/etichetta-pillola';
import { Pulsante } from '@/components/ui/pulsante';
import { Riquadro } from '@/components/ui/riquadro';
import { requireAdmin } from '@/lib/auth';
import { oggi, formattaDataItaliana, formattaDataOraItaliana } from '@/lib/date';
import { resettaGiornata } from './actions';

export const dynamic = 'force-dynamic';

// specs/57 - reset-giornata.md: strumento di emergenza per l'admin,
// pensato per ripulire dati di prova che hanno "sporcato" una giornata
// in produzione (capitato ad agosto 2026) — elimina presenze e pasti di
// una data, tutte le classi insieme, mai una singola sezione/bambino
// (CLAUDE.md, tenere lo strumento semplice per il caso d'uso reale).
export default async function ResetGiornataPage(props: { searchParams: Promise<{ data?: string }> }) {
  const searchParams = await props.searchParams;
  const { supabase, user, profilo } = await requireAdmin();
  const data = searchParams.data || oggi();

  const [{ count: numPresenze }, { count: numPasti }, { data: comunicazionePasti }] = await Promise.all([
    supabase.from('presenze').select('id', { count: 'exact', head: true }).eq('data', data),
    supabase.from('pasti').select('id', { count: 'exact', head: true }).eq('data', data),
    supabase
      .from('pasti_comunicati')
      .select('numero_pasti, comunicato_da_nome, comunicato_at')
      .eq('data', data)
      .maybeSingle(),
  ]);

  const totaleRighe = (numPresenze ?? 0) + (numPasti ?? 0);

  return (
    <NavHeader nome={profilo?.nome || user.email || ''} ruolo={profilo?.ruolo ?? null}>
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-lg font-medium">Reset presenze e pasti di una giornata</h1>
          <p className="mt-1 text-sm text-stone-600">
            Elimina tutte le presenze e i pasti registrati per una data, di tutte le classi — pensato per ripulire
            dati di prova inseriti per errore. Funziona anche su date passate. Azione irreversibile, riservata
            all&apos;admin.
          </p>
        </div>

        <SelettoreData basePath="/admin/reset-giornata" data={data} />

        <Riquadro className="space-y-3 p-4">
          <h2 className="text-sm font-medium text-stone-700">
            Dati registrati per {formattaDataItaliana(data)}
          </h2>
          <div className="flex flex-wrap gap-3 text-sm">
            <EtichettaPillola className="rounded-lg px-3 py-1.5 text-sm font-medium">
              {numPresenze ?? 0} presenze
            </EtichettaPillola>
            <EtichettaPillola className="rounded-lg px-3 py-1.5 text-sm font-medium">
              {numPasti ?? 0} pasti
            </EtichettaPillola>
          </div>

          {comunicazionePasti && (
            <Avviso tono="attenzione" className="p-3">
              ⚠️ I pasti di questa data sono già stati comunicati a Rojac il{' '}
              {formattaDataOraItaliana(comunicazionePasti.comunicato_at).replace('_', ' alle ')} da{' '}
              {comunicazionePasti.comunicato_da_nome} ({comunicazionePasti.numero_pasti} pasti totali): resettando,
              quella comunicazione resta invariata e non corrisponderà più ai dati azzerati.
            </Avviso>
          )}

          {totaleRighe > 0 ? (
            <ConfermaAzione
              azione={resettaGiornata}
              campiNascosti={{ data }}
              etichetta="Resetta giornata"
              etichettaConferma="Sì, elimina tutto"
              tono="distruttivo"
              messaggioConferma={
                <>
                  Sei sicuro di voler eliminare <strong>tutte</strong> le {numPresenze ?? 0} presenze e i{' '}
                  {numPasti ?? 0} pasti di {formattaDataItaliana(data)}? L&apos;operazione è irreversibile.
                  <br />
                  <strong>Attenzione:</strong> se questa data rientra in una comunicazione già inviata (pasti a
                  Rojac, o il mese di una comunicazione retta), quella comunicazione NON viene corretta e potrebbe
                  risultare non più coerente con i dati, ora azzerati.
                </>
              }
            />
          ) : (
            <Pulsante
              variante="secondario"
              misura="normale"
              disabled
              title="Nessuna presenza o pasto registrato per questa data"
            >
              Resetta giornata
            </Pulsante>
          )}
        </Riquadro>
      </main>
    </NavHeader>
  );
}
