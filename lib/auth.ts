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
// admin, maestra o assistente, e legge subito la data selezionata
// (query string ?data=, di default oggi) — usato dalle pagine di
// Presenze/Report (specs/12 - dashboard-maestre.md), che condividono
// esattamente questo bootstrap. L'assistente ha lo stesso perimetro
// della maestra ovunque TRANNE che sui pasti: le pagine di Pasti
// chiamano in più assicuraAccessoPasti() (vedi sotto) per escluderla
// esplicitamente (specs/03 - utenti-e-ruoli.md, matrice permessi).
export async function requireStaff(searchParams: { data?: string }) {
  const { supabase, user, profilo } = await requireProfilo();
  const ruolo = profilo?.ruolo ?? null;
  if (ruolo !== 'admin' && ruolo !== 'maestra' && ruolo !== 'assistente') redirect('/dashboard');
  const data = searchParams.data || oggi();
  return { supabase, user, profilo, ruolo, data };
}

// L'assistente non ha alcun accesso al registro pasti, né in lettura né
// in scrittura (specs/14 - segna-pasto.md): da chiamare, dopo
// requireStaff(), su ogni pagina/azione di Pasti.
export function assicuraAccessoPasti(ruolo: string | null | undefined): void {
  if (ruolo === 'assistente') redirect('/dashboard');
}

// La maestra e l'assistente possono scrivere (inserire/modificare)
// presenze solo per la data odierna; l'admin su qualunque data
// (specs/13 - segna-presenza.md). Per i pasti vale la stessa regola,
// ma solo per admin/maestra: l'assistente non vi accede affatto (vedi
// assicuraAccessoPasti sopra), quindi non serve distinguerla qui.
// Rispecchia il vincolo imposto anche a livello di RLS in
// supabase/migrations/0009_scrittura_solo_oggi_maestra.sql e
// 0016_assistente_e_pre_post_asilo.sql — usata sia per decidere se
// mostrare i pulsanti (pagine) sia come controllo esplicito prima della
// scrittura (server action), per un messaggio d'errore chiaro invece
// del solo rifiuto della RLS.
export function puoScrivereData(ruolo: string | null | undefined, data: string): boolean {
  return ruolo === 'admin' || ((ruolo === 'maestra' || ruolo === 'assistente') && data === oggi());
}

export function assicuraScrivibile(ruolo: string | null | undefined, data: string): void {
  if (!puoScrivereData(ruolo, data)) {
    throw new Error('Le maestre possono modificare solo i dati della giornata odierna.');
  }
}
