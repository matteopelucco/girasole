import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { oggi } from '@/lib/date';

export type Profilo = {
  nome: string;
  cognome: string;
  ruolo: string;
};

// Richiede una sessione autenticata, senza requisiti di ruolo — usato
// dalle server action che non hanno bisogno del profilo (es.
// creaPromemoria in app/dashboard/actions.ts).
export async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { supabase, user };
}

// Richiede una sessione autenticata con il profilo (nome/cognome/ruolo)
// già caricato — usato dalle pagine che lo mostrano (NavHeader) e/o ne
// verificano il ruolo.
export async function requireProfilo() {
  const { supabase, user } = await requireUser();

  const { data: profilo, error } = await supabase
    .from('profili')
    .select('nome, cognome, ruolo')
    .eq('id', user.id)
    .single();

  // Se questa query fallisce (es. permission denied per GRANT mancanti su
  // `profili`, già capitato due volte — vedi 0004/0008_fix_grant_tabelle*.sql)
  // profilo resta null e l'utente vede "Ruolo: non impostato" senza indizi:
  // logghiamo l'errore reale per renderlo diagnosticabile dai log Vercel.
  if (error) {
    console.error(`requireProfilo: impossibile leggere il profilo di ${user.id}`, error);
  }

  return { supabase, user, profilo: profilo as Profilo | null };
}

// Come requireProfilo(), ma reindirizza a /dashboard se il ruolo non è
// admin — usato dalle pagine e server action sotto /admin.
export async function requireAdmin() {
  const { supabase, user, profilo } = await requireProfilo();
  if (profilo?.ruolo !== 'admin') redirect('/dashboard');
  return { supabase, user, profilo };
}

// Come requireProfilo(), ma reindirizza a /dashboard se il ruolo non è
// admin né maestra, e legge subito la data selezionata (query string
// ?data=, di default oggi) — usato dalle pagine di Presenze/Pasti
// (specs/12 - dashboard-maestre.md), che condividono esattamente questo
// bootstrap.
export async function requireStaff(searchParams: { data?: string }) {
  const { supabase, user, profilo } = await requireProfilo();
  const ruolo = profilo?.ruolo ?? null;
  if (ruolo !== 'admin' && ruolo !== 'maestra') redirect('/dashboard');
  const data = searchParams.data || oggi();
  return { supabase, user, profilo, ruolo, data };
}

// La maestra può scrivere (inserire/modificare) presenze e pasti solo
// per la data odierna; l'admin su qualunque data (specs/13 - segna-presenza.md,
// specs/14 - segna-pasto.md). Rispecchia il vincolo imposto anche a
// livello di RLS in supabase/migrations/0009_scrittura_solo_oggi_maestra.sql
// — usata sia per decidere se mostrare i pulsanti (pagine) sia come
// controllo esplicito prima della scrittura (server action), per un
// messaggio d'errore chiaro invece del solo rifiuto della RLS.
export function puoScrivereData(ruolo: string | null | undefined, data: string): boolean {
  return ruolo === 'admin' || (ruolo === 'maestra' && data === oggi());
}

export function assicuraScrivibile(ruolo: string | null | undefined, data: string): void {
  if (!puoScrivereData(ruolo, data)) {
    throw new Error('Le maestre possono modificare solo i dati della giornata odierna.');
  }
}
