import Link from 'next/link';
import { NavHeader } from '@/components/NavHeader';
import { FormConEsito } from '@/components/FormConEsito';
import { PulsanteInvio } from '@/components/PulsanteInvio';
import { EtichettaPillola } from '@/components/ui/etichetta-pillola';
import { Riquadro, riquadroVariants } from '@/components/ui/riquadro';
import { StatoVuoto } from '@/components/ui/stato-vuoto';
import { Campo } from '@/components/ui/campo';
import { Selezione } from '@/components/ui/selezione';
import { requireAdmin } from '@/lib/auth';
import { cn } from '@/lib/utils';
import {
  creaSezione,
  toggleAttivaSezione,
  creaAnnoScolastico,
  creaBambino,
  assegnaSezioneBambino,
} from './actions';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const { supabase, user, profilo } = await requireAdmin();

  const [{ data: anniScolastici }, { data: sezioni }, { data: bambini }] = await Promise.all([
    supabase.from('anni_scolastici').select('id, nome').order('nome'),
    supabase.from('sezioni').select('id, nome, attiva, anno_scolastico_id').order('nome'),
    supabase
      .from('bambini')
      .select('id, nome, cognome, sezione_id, note_allergie, attiva')
      .order('cognome'),
  ]);

  const tuttiBambini = bambini ?? [];
  const bambiniPerSezione = new Map<string, typeof tuttiBambini>();
  for (const bambino of tuttiBambini) {
    if (!bambino.sezione_id || !bambino.attiva) continue;
    const lista = bambiniPerSezione.get(bambino.sezione_id) ?? [];
    lista.push(bambino);
    bambiniPerSezione.set(bambino.sezione_id, lista);
  }
  const bambiniSenzaClasseODisattivati = tuttiBambini.filter(
    (bambino) => !bambino.sezione_id || !bambino.attiva
  );

  return (
    <NavHeader nome={profilo?.nome || user.email || ''} ruolo={profilo?.ruolo ?? null}>
      <main className="mx-auto max-w-3xl space-y-10 px-4 py-8">
        <section>
          <h1 className="text-lg font-medium">Anni scolastici</h1>
          <FormConEsito action={creaAnnoScolastico} className="mt-3 flex gap-2">
            <Campo
              name="nome"
              required
              placeholder="Nome anno scolastico (es. 2026/2027)"
              className="flex-1"
            />
            <PulsanteInvio variante="primario" misura="normale">
              Crea
            </PulsanteInvio>
          </FormConEsito>

          <ul className="mt-4 space-y-1">
            {anniScolastici?.map((anno) => (
              <li key={anno.id} className={cn(riquadroVariants(), 'rounded-lg px-3 py-2 text-sm')}>
                {anno.nome}
              </li>
            ))}
            {!anniScolastici?.length && (
              <li>
                <StatoVuoto>Nessun anno scolastico ancora creato.</StatoVuoto>
              </li>
            )}
          </ul>
        </section>

        <section>
          <h1 className="text-lg font-medium">Sezioni</h1>
          <FormConEsito action={creaSezione} className="mt-3 flex flex-wrap gap-2">
            <Campo
              name="nome"
              required
              placeholder="Nome sezione (es. Girasoli)"
              className="flex-1"
            />
            <Selezione
              name="anno_scolastico_id"
              defaultValue=""
              aria-label="Anno scolastico"
            >
              <option value="">Anno scolastico (opzionale)</option>
              {anniScolastici?.map((anno) => (
                <option key={anno.id} value={anno.id}>
                  {anno.nome}
                </option>
              ))}
            </Selezione>
            <PulsanteInvio variante="primario" misura="normale">
              Crea
            </PulsanteInvio>
          </FormConEsito>

          <ul className="mt-4 space-y-1">
            {sezioni?.map((sezione) => (
              <li
                key={sezione.id}
                className={cn(riquadroVariants(), 'rounded-lg flex items-center justify-between px-3 py-2 text-sm')}
              >
                <span>
                  {sezione.nome}
                  {!sezione.attiva && (
                    <EtichettaPillola className="ml-2 font-normal">non attiva</EtichettaPillola>
                  )}
                </span>
                <FormConEsito action={toggleAttivaSezione}>
                  <input type="hidden" name="sezione_id" value={sezione.id} />
                  <input type="hidden" name="attiva_attuale" value={String(sezione.attiva)} />
                  <PulsanteInvio className="text-xs text-stone-600 underline hover:text-stone-900">
                    {sezione.attiva ? 'Disattiva' : 'Riattiva'}
                  </PulsanteInvio>
                </FormConEsito>
              </li>
            ))}
            {!sezioni?.length && (
              <li>
                <StatoVuoto>Nessuna sezione ancora creata.</StatoVuoto>
              </li>
            )}
          </ul>
        </section>

        <section>
          <h1 className="text-lg font-medium">Bambini</h1>
          <FormConEsito
            action={creaBambino}
            className={cn(riquadroVariants(), 'mt-3 space-y-2 p-4')}
          >
            <div className="flex gap-2">
              <Campo
                name="nome"
                required
                placeholder="Nome"
                className="flex-1"
              />
              <Campo
                name="cognome"
                required
                placeholder="Cognome"
                className="flex-1"
              />
            </div>
            <div className="flex gap-2">
              <Campo
                name="data_nascita"
                type="date"
                required
                aria-label="Data di nascita"
                className="flex-1"
              />
              <Selezione
                name="sesso"
                required
                defaultValue=""
                aria-label="Sesso"
                className="flex-1"
              >
                <option value="" disabled>
                  Sesso
                </option>
                <option value="F">Femmina</option>
                <option value="M">Maschio</option>
              </Selezione>
            </div>
            <Selezione
              name="sezione_id"
              defaultValue=""
              aria-label="Sezione"
              className="w-full"
            >
              <option value="">Nessuna sezione (assegna dopo)</option>
              {sezioni?.map((sezione) => (
                <option key={sezione.id} value={sezione.id}>
                  {sezione.nome}
                </option>
              ))}
            </Selezione>
            <Campo
              name="note_allergie"
              placeholder="Allergie o intolleranze (opzionale)"
              className="w-full"
            />
            <Campo
              name="altre_note"
              placeholder="Altre note (opzionale)"
              className="w-full"
            />
            <PulsanteInvio variante="primario" misura="normale">
              Aggiungi bambino
            </PulsanteInvio>
          </FormConEsito>

          <div id="classi-e-bambini-assegnati" className="mt-6 space-y-4">
            <h2 className="text-sm font-medium text-stone-700">Classi e bambini assegnati</h2>
            {sezioni?.map((sezione) => {
              const lista = bambiniPerSezione.get(sezione.id) ?? [];
              return (
                <Riquadro key={sezione.id} className="rounded-lg p-3">
                  <h3 className="text-sm font-semibold">{sezione.nome}</h3>
                  <ul className="mt-2 space-y-1">
                    {lista.map((bambino) => (
                      <li
                        key={bambino.id}
                        className="flex items-center justify-between rounded-lg border border-stone-100 px-3 py-2 text-sm"
                      >
                        <Link href={`/admin/bambini/${bambino.id}`} className="hover:underline">
                          {bambino.nome} {bambino.cognome}
                        </Link>
                        {bambino.note_allergie && (
                          <EtichettaPillola className="bg-amber-100 font-medium text-amber-800">
                            {bambino.note_allergie}
                          </EtichettaPillola>
                        )}
                      </li>
                    ))}
                    {!lista.length && (
                      <li className="text-xs text-stone-600">Nessun bambino assegnato.</li>
                    )}
                  </ul>
                </Riquadro>
              );
            })}
            {!sezioni?.length && (
              <StatoVuoto>Nessuna sezione ancora creata.</StatoVuoto>
            )}
          </div>

          <Riquadro id="bambini-senza-classe" className="mt-6 rounded-lg p-3">
            <h2 className="text-sm font-medium text-stone-700">Bambini senza classe o disattivati</h2>
            <ul className="mt-2 space-y-2">
              {bambiniSenzaClasseODisattivati.map((bambino) => (
                <li key={bambino.id} className="rounded-lg border border-stone-100 px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link href={`/admin/bambini/${bambino.id}`} className="hover:underline">
                      {bambino.nome} {bambino.cognome}
                    </Link>
                    {!bambino.attiva && (
                      <EtichettaPillola className="font-normal">Disattivato</EtichettaPillola>
                    )}
                  </div>
                  <FormConEsito action={assegnaSezioneBambino} className="mt-2 flex items-center gap-2">
                    <input type="hidden" name="bambino_id" value={bambino.id} />
                    <Selezione
                      name="sezione_id"
                      required
                      defaultValue=""
                      aria-label={`Sezione per ${bambino.nome} ${bambino.cognome}`}
                      misura="piccolo"
                    >
                      <option value="" disabled>
                        Assegna a...
                      </option>
                      {sezioni?.map((sezione) => (
                        <option key={sezione.id} value={sezione.id}>
                          {sezione.nome}
                        </option>
                      ))}
                    </Selezione>
                    <PulsanteInvio variante="secondario" misura="piccolo">
                      Assegna
                    </PulsanteInvio>
                  </FormConEsito>
                </li>
              ))}
              {!bambiniSenzaClasseODisattivati.length && (
                <li className="text-xs text-stone-600">Nessuno.</li>
              )}
            </ul>
          </Riquadro>
        </section>
      </main>
    </NavHeader>
  );
}
