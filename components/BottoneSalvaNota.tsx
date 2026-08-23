import { PulsanteInvio } from '@/components/PulsanteInvio';

// Pulsante "Salva nota" condiviso da Presenze e Pasti (specs/13, 14):
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
        className="cursor-not-allowed rounded-lg border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-medium text-stone-400"
      >
        Salva nota
      </button>
    );
  }

  return (
    <PulsanteInvio
      mantieniTesto
      formAction={formAction}
      className="rounded-lg border border-sky-300 bg-white px-3 py-1 text-xs font-medium text-sky-700 hover:bg-sky-50"
    >
      Salva nota
    </PulsanteInvio>
  );
}
