import { PulsanteInvio } from '@/components/PulsanteInvio';
import { IconaSalva } from '@/components/icone';

// Pulsante "Salva nota" condiviso dalle colonne Presenza e Pasto della
// schermata "Presenze e pasti" (specs/10, 13, 14): largo quanto la
// sezione e alto almeno 44px come gli altri pulsanti (issue #106);
// salva la nota senza richiedere di ripremere lo stato già segnato.
// Disabilitato (formAction assente) quando per il bambino non esiste
// ancora uno stato per la data: il record richiede sempre uno stato
// (colonna non nulla), quindi non si può salvare una nota "orfana".
export function BottoneSalvaNota({
  formAction,
}: {
  formAction: ((formData: FormData) => void | Promise<void>) | null;
}) {
  if (!formAction) {
    return (
      <button
        type="button"
        disabled
        title="Segna prima uno stato per poter salvare una nota"
        className="inline-flex min-h-11 w-full cursor-not-allowed items-center justify-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-sm font-medium text-stone-400"
      >
        <IconaSalva />
        Salva nota
      </button>
    );
  }

  return (
    <PulsanteInvio
      mantieniTesto
      formAction={formAction}
      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-sky-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-800"
    >
      <IconaSalva />
      Salva nota
    </PulsanteInvio>
  );
}
