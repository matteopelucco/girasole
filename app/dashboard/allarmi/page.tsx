import Link from 'next/link';
import { NavHeader } from '@/components/NavHeader';
import { Avviso, avvisoVariants } from '@/components/ui/avviso';
import { testoConfermaSettimanaNonRichiesta } from '@/lib/allarmi';
import { requireStaff } from '@/lib/auth';
import { caricaAllarmiCorrenti, caricaDatiAllarmiCorrenti } from './dati';
import type { Allarme } from '@/lib/elencoAllarmi';

export const dynamic = 'force-dynamic';

function ElencoAllarmi({ allarmi, etichetta }: { allarmi: Allarme[]; etichetta: string }) {
  return (
    <ul aria-label={etichetta} className="space-y-3">
      {allarmi.map((allarme) => (
        <li key={allarme.id} className={avvisoVariants({ tono: 'errore' })}>
          <h3 className="font-semibold">{allarme.titolo}</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {allarme.voci.map((voce, indice) => (
              <li key={`${indice}-${voce.testo}`}>
                {voce.href ? (
                  <Link href={voce.href} className="underline">
                    {voce.testo}
                  </Link>
                ) : (
                  voce.testo
                )}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

// Pagina "Allarmi" (specs/07 - allarmi.md): tutti gli allarmi attivi di
// chi guarda, con un link per sistemarli. L'admin vede in più una riga
// per ogni collega in allarme, in sola lettura. Stessa fonte dati della
// campanella (caricaAllarmiCorrenti), quindi il numero coincide.
export default async function AllarmiPage() {
  const { profilo, user } = await requireStaff({});
  const [elenco, dati] = await Promise.all([caricaAllarmiCorrenti(), caricaDatiAllarmiCorrenti()]);
  const allarmi = elenco ?? [];
  // Controlli che il sistema ha saltato per scelta dell'admin: informativi,
  // non sono allarmi e non contano nella campanella (specs/07).
  const saltati = dati?.confermaSettimanaNonRichiesta ?? [];
  const propri = allarmi.filter((a) => a.tipo === 'proprio');
  const personale = allarmi.filter((a) => a.tipo === 'personale');

  return (
    <NavHeader nome={profilo?.nome || user.email || ''} ruolo={profilo?.ruolo ?? null}>
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <h1 className="text-xl font-medium">Allarmi</h1>

        {allarmi.length === 0 && <p className="text-sm text-stone-600">Non ci sono allarmi attivi.</p>}

        {propri.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-medium">I miei allarmi</h2>
            <ElencoAllarmi allarmi={propri} etichetta="I miei allarmi" />
          </section>
        )}

        {personale.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-medium">Situazione del personale</h2>
            <ElencoAllarmi allarmi={personale} etichetta="Allarmi del personale" />
          </section>
        )}

        {saltati.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-medium">Controlli saltati</h2>
            <Avviso tono="informazione">
              <ul aria-label="Controlli saltati" className="list-disc space-y-1 pl-5">
                {saltati.map((utente, indice) => (
                  <li key={`${indice}-${utente.cognome}-${utente.nome}`}>
                    {testoConfermaSettimanaNonRichiesta(utente)}
                  </li>
                ))}
              </ul>
            </Avviso>
          </section>
        )}
      </main>
    </NavHeader>
  );
}
