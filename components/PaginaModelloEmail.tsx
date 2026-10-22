import Link from 'next/link';
import { NavHeader } from '@/components/NavHeader';
import { FormConEsito, type EsitoAzione } from '@/components/FormConEsito';
import { PulsanteInvio } from '@/components/PulsanteInvio';
import { riquadroVariants } from '@/components/ui/riquadro';
import { Campo } from '@/components/ui/campo';
import { TestoLungo } from '@/components/ui/testo-lungo';
import { formattaDataOraItaliana } from '@/lib/date';
import { cn } from '@/lib/utils';

function FormModelloEmail({
  action,
  oggetto,
  corpo,
  updatedAt,
}: {
  action: (statoPrecedente: EsitoAzione, formData: FormData) => Promise<EsitoAzione>;
  oggetto: string;
  corpo: string;
  updatedAt: string | null | undefined;
}) {
  return (
    <FormConEsito action={action} className={cn(riquadroVariants(), 'space-y-3 p-4')}>
      <label className="block text-xs text-stone-600">
        Oggetto
        <Campo
          name="oggetto"
          required
          defaultValue={oggetto}
          aria-label="Oggetto"
          className="mt-1 w-full"
        />
      </label>
      <label className="block text-xs text-stone-600">
        Corpo
        <TestoLungo
          name="corpo"
          required
          rows={14}
          defaultValue={corpo}
          aria-label="Corpo"
          className="mt-1 w-full"
        />
      </label>
      <PulsanteInvio variante="primario" misura="normale">
        Salva modello
      </PulsanteInvio>
      {updatedAt && (
        <p className="text-xs text-stone-500">
          Ultimo salvataggio: {formattaDataOraItaliana(updatedAt).replace('_', ' alle ')}
        </p>
      )}
    </FormConEsito>
  );
}

// Pagina di modifica di un modello email (oggetto + corpo), condivisa tra
// "Modello email retta" (specs/56) e "Modello email Rojac" (specs/61):
// stesso layout, stessi segnaposto elencati, stesso feedback e stessa data
// dell'ultimo salvataggio (specs/05). Chi la usa ha già verificato che
// l'utente sia admin e letto il modello.
export function PaginaModelloEmail({
  nome,
  ruolo,
  hrefIndietro,
  etichettaIndietro,
  titolo,
  descrizione,
  placeholder,
  action,
  modello,
}: {
  nome: string;
  ruolo: string | null;
  hrefIndietro: string;
  etichettaIndietro: string;
  titolo: string;
  descrizione: string;
  placeholder: string[];
  action: (statoPrecedente: EsitoAzione, formData: FormData) => Promise<EsitoAzione>;
  modello: { oggetto: string; corpo: string; updated_at: string | null } | null;
}) {
  return (
    <NavHeader nome={nome} ruolo={ruolo}>
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <Link href={hrefIndietro} className="text-sm text-stone-600 hover:text-stone-900">
          ← {etichettaIndietro}
        </Link>

        <div>
          <h1 className="text-lg font-medium">{titolo}</h1>
          <p className="mt-1 text-sm text-stone-600">{descrizione}</p>
          <p className="mt-1 font-mono text-xs text-stone-600">{placeholder.join('  ')}</p>
        </div>

        <FormModelloEmail
          action={action}
          oggetto={modello?.oggetto ?? ''}
          corpo={modello?.corpo ?? ''}
          updatedAt={modello?.updated_at}
        />
      </main>
    </NavHeader>
  );
}
