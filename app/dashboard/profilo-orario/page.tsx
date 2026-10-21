import { NavHeader } from '@/components/NavHeader';
import { Tabella, TabellaCella, TabellaCorpo, TabellaIntestazione, TabellaPiede, TabellaRiga, TabellaTitolo } from '@/components/ui/tabella';
import { requireStaff, assicuraAccessoOreLavoro } from '@/lib/auth';
import { oreGiorniFeriali, rigaOSollevaErrore, totaleOreSettimanali, type ProfiloOrarioConNome } from '@/lib/profiliOrari';

export const dynamic = 'force-dynamic';

// Pannello di sola lettura "Il mio profilo orario" (specs/54 -
// profili-orari.md, issue #92): il personale abilitato al report ore
// (specs/17, nessun bypass per l'admin) vede il profilo orario che
// l'admin gli ha assegnato — nome, ore per giorno feriale e totale
// settimanale — indipendentemente dal precaricamento del report ore. Solo
// il PROPRIO profilo: nessun parametro per sceglierne un altro, e la RLS
// (0030_profili_orari_self_select.sql) non lascerebbe leggerne altri.
export default async function ProfiloOrarioPage() {
  const { supabase, user, profilo, ruolo } = await requireStaff({});
  assicuraAccessoOreLavoro(profilo?.abilitato_ore_lavoro);

  const nomeVisualizzato = profilo?.nome || user.email || '';

  const profiloOrario = profilo?.profilo_orario_id
    ? rigaOSollevaErrore<ProfiloOrarioConNome>(
        await supabase
          .from('profili_orari')
          .select('nome, ore_lunedi, ore_martedi, ore_mercoledi, ore_giovedi, ore_venerdi')
          .eq('id', profilo.profilo_orario_id)
          .maybeSingle(),
        'lettura profilo orario'
      )
    : null;

  return (
    <NavHeader nome={nomeVisualizzato} ruolo={ruolo}>
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <div>
          <a href="/dashboard/ore-lavoro" className="text-sm text-stone-600 hover:text-stone-900">
            ← Torna a Ore di lavoro
          </a>
          <h1 className="mt-2 text-lg font-medium">Il mio profilo orario</h1>
        </div>

        {profiloOrario ? (
          <section className="rounded-xl border border-border bg-white p-4 shadow-xs">
            <h2 className="text-base font-medium">{profiloOrario.nome}</h2>
            <Tabella className="mt-3">
              <caption className="sr-only">Ore previste per giorno</caption>
              <TabellaIntestazione className="sr-only">
                <TabellaRiga>
                  <TabellaTitolo scope="col">Giorno</TabellaTitolo>
                  <TabellaTitolo scope="col">Ore previste</TabellaTitolo>
                </TabellaRiga>
              </TabellaIntestazione>
              <TabellaCorpo separatori>
                {oreGiorniFeriali(profiloOrario).map((g) => (
                  <TabellaRiga key={g.giorno}>
                    <TabellaTitolo allinea="sinistra" scope="row" className="py-2 font-normal text-stone-700">
                      {g.giorno}
                    </TabellaTitolo>
                    <TabellaCella allinea="destra" className="py-2 font-medium">{g.ore}h</TabellaCella>
                  </TabellaRiga>
                ))}
              </TabellaCorpo>
              <TabellaPiede>
                <TabellaRiga className="border-t border-stone-300">
                  <TabellaTitolo allinea="sinistra" scope="row" className="py-2 font-semibold">
                    Totale settimanale
                  </TabellaTitolo>
                  <TabellaCella allinea="destra" className="py-2 font-semibold">{totaleOreSettimanali(profiloOrario)}h</TabellaCella>
                </TabellaRiga>
              </TabellaPiede>
            </Tabella>
          </section>
        ) : (
          <div className="rounded-xl border border-dashed border-stone-300 p-4 text-sm text-stone-700">
            <p className="font-medium">Nessun profilo orario assegnato</p>
            <p className="mt-1 text-stone-600">
              Le ore previste per i giorni feriali non sono ancora definite per te: chiedi all’admin di assegnarti
              un profilo orario.
            </p>
          </div>
        )}
      </main>
    </NavHeader>
  );
}
