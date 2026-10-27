import { TestoAiuto } from '@/components/ui/etichetta';
import { cn } from '@/lib/utils';

// Abilitazione a "Ore di lavoro" e, subito sotto, l'opzione "Richiedi
// conferma settimana" (specs/03 - utenti-e-ruoli.md, specs/07 - allarmi.md).
// L'opzione si vede solo con "Ore di lavoro" spuntato, senza JavaScript e
// senza stato: il blocco è nascosto con CSS (`has` sul gruppo, che guarda
// la classe `spunta-ore-lavoro` della casella "Ore di lavoro"). Resta nel
// DOM, quindi il suo valore viene inviato anche quando è nascosto: l'azione
// lo ignora se "Ore di lavoro" è spento (il valore salvato non si perde,
// alla riabilitazione torna quello di prima).
//
// Usato dal form di creazione (`compatta` falso) e da ogni riga dell'elenco
// (`compatta` vero, caratteri più piccoli).
type Props = {
  // Etichetta della casella "Ore di lavoro".
  etichettaOre: string;
  abilitatoIniziale: boolean;
  richiediConfermaIniziale: boolean;
  // Per rendere unici gli id (più righe nella stessa pagina).
  idBase: string;
  compatta?: boolean;
  className?: string;
};

export function OpzioniOreLavoro({
  etichettaOre,
  abilitatoIniziale,
  richiediConfermaIniziale,
  idBase,
  compatta = false,
  className,
}: Props) {
  const idAiuto = `${idBase}-conferma-aiuto`;
  const casella = compatta ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const etichetta = compatta ? 'text-xs' : 'text-sm';

  return (
    <div className={cn('group flex flex-col gap-1 text-stone-700', className)}>
      <label className={cn('flex items-center gap-1', etichetta)}>
        <input
          type="checkbox"
          name="abilitato_ore_lavoro"
          defaultChecked={abilitatoIniziale}
          className={cn('spunta-ore-lavoro', casella)}
        />
        {etichettaOre}
      </label>
      <div className="hidden pl-5 group-has-[.spunta-ore-lavoro:checked]:block">
        <label className={cn('flex items-center gap-1', etichetta)}>
          <input
            type="checkbox"
            name="richiedi_conferma_settimana"
            defaultChecked={richiediConfermaIniziale}
            aria-describedby={idAiuto}
            className={casella}
          />
          Richiedi conferma settimana
        </label>
        <TestoAiuto id={idAiuto} className="mt-0.5 max-w-64">
          Se la togli, questo utente non genera allarmi per la settimana di ore non confermata; potrà comunque
          inserirla e confermarla.
        </TestoAiuto>
      </div>
    </div>
  );
}
