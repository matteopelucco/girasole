import { NavHeader } from '@/components/NavHeader';
import { FormConEsito } from '@/components/FormConEsito';
import { EliminaUtente } from '@/components/EliminaUtente';
import { PulsanteInvio } from '@/components/PulsanteInvio';
import { Riquadro, riquadroVariants } from '@/components/ui/riquadro';
import { StatoVuoto } from '@/components/ui/stato-vuoto';
import { Campo } from '@/components/ui/campo';
import { Selezione } from '@/components/ui/selezione';
import { CampiPasswordConferma } from '@/components/CampiPasswordConferma';
import { OpzioniOreLavoro } from '@/components/OpzioniOreLavoro';
import { REGOLA_PASSWORD } from '@/lib/password';
import { requireAdmin } from '@/lib/auth';
import { formattaDataOraItaliana } from '@/lib/date';
import { cn } from '@/lib/utils';
import {
  creaUtente,
  aggiornaUtente,
  impostaPassword,
  eliminaUtente,
  assegnaSezione,
  rimuoviSezione,
} from './actions';

const ETICHETTE_RUOLO: Record<string, string> = {
  admin: 'Admin',
  maestra: 'Maestra',
  assistente: 'Assistente',
  genitore: 'Genitore',
};

export const dynamic = 'force-dynamic';

export default async function MaestrePage() {
  const { supabase, user, profilo: profiloCorrente } = await requireAdmin();

  const [{ data: profili }, { data: sezioni }, { data: assegnazioni }, { data: profiliOrari }] = await Promise.all([
    supabase
      .from('profili')
      .select(
        'id, nome, cognome, email, telefono, ruolo, indirizzo_residenza, note, abilitato_ore_lavoro, richiedi_conferma_settimana, profilo_orario_id, updated_at'
      )
      .order('cognome'),
    supabase.from('sezioni').select('id, nome').order('nome'),
    supabase.from('maestre_sezioni').select('maestra_id, sezione_id'),
    supabase.from('profili_orari').select('id, nome').order('nome'),
  ]);

  const staffAssegnabile = profili?.filter((p) => p.ruolo === 'maestra' || p.ruolo === 'assistente') ?? [];
  const sezioniPerMaestra = new Map<string, string[]>();
  for (const a of assegnazioni ?? []) {
    const nomeSezione = sezioni?.find((s) => s.id === a.sezione_id)?.nome ?? a.sezione_id;
    const lista = sezioniPerMaestra.get(a.maestra_id) ?? [];
    lista.push(nomeSezione);
    sezioniPerMaestra.set(a.maestra_id, lista);
  }

  return (
    <NavHeader
      nome={profiloCorrente?.nome || user.email || ''}
      ruolo={profiloCorrente?.ruolo ?? null}
    >
      <main className="mx-auto max-w-3xl space-y-10 px-4 py-8">
        <section>
          <h1 className="text-lg font-medium">Utenti e ruoli</h1>
          <p className="mt-1 text-sm text-stone-600">
            Crea, modifica ed elimina gli account direttamente da qui — email, password,
            nome, cognome, telefono, indirizzo, note e ruolo (admin / maestra / assistente /
            genitore).
          </p>

          <Riquadro className="mt-4 p-4">
            <h2 className="text-sm font-medium">Crea nuovo utente</h2>
            <p className="mt-1 text-xs text-stone-600">{REGOLA_PASSWORD}</p>
            <FormConEsito action={creaUtente} resetSuOk className="mt-3 grid gap-2 sm:grid-cols-2">
              <Campo
                name="nome"
                required
                placeholder="Nome"
              />
              <Campo
                name="cognome"
                required
                placeholder="Cognome"
              />
              <Campo
                name="email"
                type="email"
                required
                placeholder="Email"
              />
              <Campo
                name="telefono"
                type="tel"
                required
                placeholder="Telefono"
              />
              <CampiPasswordConferma />
              <Selezione
                name="ruolo"
                required
                defaultValue="genitore"
                aria-label="Ruolo"
              >
                {Object.entries(ETICHETTE_RUOLO).map(([valore, etichetta]) => (
                  <option key={valore} value={valore}>
                    {etichetta}
                  </option>
                ))}
              </Selezione>
              <Campo
                name="indirizzo_residenza"
                placeholder="Indirizzo di residenza (opzionale)"
                className="sm:col-span-2"
              />
              <Campo
                name="note"
                placeholder="Note (opzionale)"
                className="sm:col-span-2"
              />
              <OpzioniOreLavoro
                idBase="nuovo-utente"
                etichettaOre="Abilita al report ore di lavoro"
                abilitatoIniziale={false}
                richiediConfermaIniziale
                className="sm:col-span-2"
              />
              <label className="flex flex-col text-sm text-stone-700 sm:col-span-2">
                Profilo orario (opzionale)
                <Selezione
                  name="profilo_orario_id"
                  defaultValue=""
                  aria-label="Profilo orario"
                  className="mt-1"
                >
                  <option value="">Nessun profilo orario</option>
                  {profiliOrari?.map((po) => (
                    <option key={po.id} value={po.id}>
                      {po.nome}
                    </option>
                  ))}
                </Selezione>
              </label>
              <PulsanteInvio variante="primario" misura="normale" className="sm:col-span-2">
                Crea utente
              </PulsanteInvio>
            </FormConEsito>
          </Riquadro>

          <ul className="mt-4 space-y-2">
            {profili?.map((p) => (
              <li
                key={p.id}
                className={cn(riquadroVariants(), 'rounded-lg relative px-3 py-2 text-sm')}
              >
                <div className="mb-2 pr-9 text-xs text-stone-600">{p.email}</div>
                <FormConEsito action={aggiornaUtente} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="profilo_id" value={p.id} />
                  <Campo
                    name="nome"
                    defaultValue={p.nome}
                    placeholder="Nome"
                    misura="piccolo"
                    className="w-24"
                  />
                  <Campo
                    name="cognome"
                    defaultValue={p.cognome}
                    placeholder="Cognome"
                    misura="piccolo"
                    className="w-24"
                  />
                  <Campo
                    name="telefono"
                    defaultValue={p.telefono ?? ''}
                    placeholder="Telefono"
                    misura="piccolo"
                    className="w-28"
                  />
                  <Campo
                    name="indirizzo_residenza"
                    defaultValue={p.indirizzo_residenza ?? ''}
                    placeholder="Indirizzo"
                    misura="piccolo"
                    className="w-28"
                  />
                  <Campo
                    name="note"
                    defaultValue={p.note ?? ''}
                    placeholder="Note"
                    misura="piccolo"
                    className="w-24"
                  />
                  <Selezione
                    name="ruolo"
                    defaultValue={p.ruolo}
                    aria-label="Ruolo"
                    misura="piccolo"
                  >
                    {Object.entries(ETICHETTE_RUOLO).map(([valore, etichetta]) => (
                      <option key={valore} value={valore}>
                        {etichetta}
                      </option>
                    ))}
                  </Selezione>
                  <OpzioniOreLavoro
                    idBase={`utente-${p.id}`}
                    etichettaOre="Ore di lavoro"
                    abilitatoIniziale={p.abilitato_ore_lavoro}
                    richiediConfermaIniziale={p.richiedi_conferma_settimana}
                    compatta
                  />
                  <Selezione
                    name="profilo_orario_id"
                    defaultValue={p.profilo_orario_id ?? ''}
                    aria-label="Profilo orario"
                    misura="piccolo"
                  >
                    <option value="">Nessun profilo orario</option>
                    {profiliOrari?.map((po) => (
                      <option key={po.id} value={po.id}>
                        {po.nome}
                      </option>
                    ))}
                  </Selezione>
                  <PulsanteInvio variante="primario" misura="piccolo">
                    Aggiorna
                  </PulsanteInvio>
                  {p.updated_at && (
                    <p className="w-full text-xs text-stone-500">
                      Ultimo salvataggio: {formattaDataOraItaliana(p.updated_at).replace('_', ' alle ')}
                    </p>
                  )}
                </FormConEsito>
                <FormConEsito
                  action={impostaPassword}
                  resetSuOk
                  className="mt-2 flex flex-wrap items-center gap-2"
                >
                  <input type="hidden" name="profilo_id" value={p.id} />
                  <CampiPasswordConferma
                    nomePassword="nuova_password"
                    nomeConferma="conferma_nuova_password"
                    etichettaPassword="Nuova password"
                    etichettaConferma="Conferma nuova password"
                  />
                  <PulsanteInvio variante="primario" misura="piccolo" className="bg-stone-700 hover:bg-stone-800">
                    Imposta password
                  </PulsanteInvio>
                </FormConEsito>
                <EliminaUtente azione={eliminaUtente} profiloId={p.id} email={p.email} />
              </li>
            ))}
            {!profili?.length && (
              <li>
                <StatoVuoto>Nessun utente registrato.</StatoVuoto>
              </li>
            )}
          </ul>
        </section>

        <section>
          <h1 className="text-lg font-medium">Assegna maestre e assistenti alle sezioni</h1>

          <FormConEsito action={assegnaSezione} className="mt-3 flex flex-wrap gap-2">
            <Selezione
              name="maestra_id"
              required
              defaultValue=""
              aria-label="Maestra o assistente"
            >
              <option value="" disabled>
                Maestra o assistente
              </option>
              {staffAssegnabile.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome} {m.cognome} ({ETICHETTE_RUOLO[m.ruolo]})
                </option>
              ))}
            </Selezione>
            <Selezione
              name="sezione_id"
              required
              defaultValue=""
              aria-label="Sezione"
            >
              <option value="" disabled>
                Sezione
              </option>
              {sezioni?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </Selezione>
            <PulsanteInvio variante="primario" misura="normale">
              Assegna
            </PulsanteInvio>
          </FormConEsito>
          {!staffAssegnabile.length && (
            <StatoVuoto className="mt-2">
              Nessun utente ha ancora il ruolo maestra o assistente: creane uno o promuovilo nella
              sezione qui sopra.
            </StatoVuoto>
          )}

          <ul className="mt-4 space-y-1">
            {staffAssegnabile.map((m) => (
              <li key={m.id} className={cn(riquadroVariants(), 'rounded-lg px-3 py-2 text-sm')}>
                <div className="font-medium">
                  {m.nome} {m.cognome}{' '}
                  <span className="font-normal text-stone-600">({ETICHETTE_RUOLO[m.ruolo]})</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-2">
                  {(sezioniPerMaestra.get(m.id) ?? []).length === 0 && (
                    <span className="text-stone-600">Nessuna sezione assegnata.</span>
                  )}
                  {assegnazioni
                    ?.filter((a) => a.maestra_id === m.id)
                    .map((a) => {
                      const nomeSezione = sezioni?.find((s) => s.id === a.sezione_id)?.nome;
                      return (
                        <FormConEsito key={a.sezione_id} action={rimuoviSezione}>
                          <input type="hidden" name="maestra_id" value={a.maestra_id} />
                          <input type="hidden" name="sezione_id" value={a.sezione_id} />
                          <PulsanteInvio
                            variante="secondario"
                            misura="piccolo"
                            className="gap-1 rounded-full border-0 bg-neutral-soft px-2 py-0.5 text-neutral-text hover:bg-stone-200"
                            title="Rimuovi assegnazione"
                          >
                            {nomeSezione} ✕
                          </PulsanteInvio>
                        </FormConEsito>
                      );
                    })}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </NavHeader>
  );
}
