import { Suspense } from 'react';
import { CampanellaAllarmi, CampanellaAllarmiCaricamento } from '@/components/CampanellaAllarmi';
import { NavHeaderClient } from '@/components/NavHeaderClient';

// Shell dell'app per ogni pagina autenticata (sidebar, intestazione con
// nome, campanella e "Esci": vedi NavHeaderClient). Componente server:
// aggiunge la campanella degli allarmi (specs/07 - allarmi.md) per admin,
// maestra e assistente — non per il genitore, per cui non si calcola
// nulla. Il numero è dentro un Suspense: la pagina non aspetta il calcolo
// degli allarmi, la campanella si completa appena è pronto.
export function NavHeader({
  nome,
  ruolo,
  children,
}: {
  nome: string;
  ruolo: string | null;
  children: React.ReactNode;
}) {
  const conCampanella = ruolo === 'admin' || ruolo === 'maestra' || ruolo === 'assistente';
  return (
    <NavHeaderClient
      nome={nome}
      ruolo={ruolo}
      campanella={
        conCampanella ? (
          <Suspense fallback={<CampanellaAllarmiCaricamento />}>
            <CampanellaAllarmi />
          </Suspense>
        ) : undefined
      }
    >
      {children}
    </NavHeaderClient>
  );
}
