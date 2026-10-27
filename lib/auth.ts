import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { oggi } from '@/lib/date';
import { chiusuraPerData, isGiornoChiuso, messaggioChiusura } from '@/lib/calendarioScolastico';
import { decidiAutorizzazioneCron } from '@/lib/autorizzazioneCron';

// Vero se una richiesta a una route di cron (specs/52 -
// report-email-automatico.md; specs/07 - allarmi.md) porta il secret
// giusto in Authorization: Bearer $CRON_SECRET (inviato in automatico da
// Vercel Cron quando la variabile d'ambiente CRON_SECRET è configurata
// sul progetto). Senza quella variabile, su Vercel (produzione e
// anteprime) non passa nulla; solo in locale e nella CI la route resta
// aperta (issue #300). La decisione, confronto a tempo costante incluso,
// è in lib/autorizzazioneCron.ts (logica pura, con test unit): qui si
// leggono solo l'ambiente e l'header. Condivisa tra le route di cron
// per non duplicare lo stesso controllo in ciascuna (CLAUDE.md, jscpd).
export function autorizzaCron(request: Request): boolean {
  return decidiAutorizzazioneCron({
    secret: process.env.CRON_SECRET,
    authorization: request.headers.get('authorization'),
    ambiente: { vercelEnv: process.env.VERCEL_ENV, vercel: process.env.VERCEL },
  });
}

export type Profilo = {
  nome: string;
  cognome: string;
  ruolo: string;
  abilitato_ore_lavoro: boolean;
  // Se falsa, gli allarmi saltano la conferma settimana ore dell'utente
  // (specs/03, specs/07).
  richiedi_conferma_settimana: boolean;
  profilo_orario_id: string | null;
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
// verificano il ruolo. Una sola volta per richiesta (`cache` di React,
// issue #367): pagina, campanella e allarmi della stessa richiesta la
// chiamano ciascuno, ma getUser() e la lettura di `profili` partono una
// volta sola. La cache vale solo durante il render dei Server Components
// (fuori, ad esempio in una server action, la funzione gira ogni volta) e
// non sopravvive alla richiesta: nessun dato passa da un utente all'altro.
export const requireProfilo = cache(async () => {
  const { supabase, user } = await requireUser();

  const { data: profilo, error } = await supabase
    .from('profili')
    .select('nome, cognome, ruolo, abilitato_ore_lavoro, richiedi_conferma_settimana, profilo_orario_id')
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
});

// Come requireProfilo(), ma reindirizza a /dashboard se il ruolo non è
// admin — usato dalle pagine e server action sotto /admin.
export async function requireAdmin() {
  const { supabase, user, profilo } = await requireProfilo();
  if (profilo?.ruolo !== 'admin') redirect('/dashboard');
  return { supabase, user, profilo };
}

// Vero per i ruoli di staff (admin, maestra, assistente). Logica pura,
// condivisa da requireStaff() e dalle server action che devono rifiutare
// con un esito d'errore (senza redirect) chi non è staff — es. le azioni
// sugli avvisi (specs/15 - memo.md, issue #312).
export function isRuoloStaff(ruolo: string | null | undefined): boolean {
  return ruolo === 'admin' || ruolo === 'maestra' || ruolo === 'assistente';
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
  if (!isRuoloStaff(ruolo)) redirect('/dashboard');
  const data = searchParams.data || oggi();
  return { supabase, user, profilo, ruolo, data };
}

// L'assistente non ha alcun accesso al registro pasti, né in lettura né
// in scrittura (specs/14 - segna-pasto.md): da chiamare, dopo
// requireStaff(), su ogni pagina/azione di Pasti.
export function assicuraAccessoPasti(ruolo: string | null | undefined): void {
  if (ruolo === 'assistente') redirect('/dashboard');
}

// L'accesso alla sezione "Ore di lavoro" (specs/17 -
// ore-di-lavoro.md) dipende da un'abilitazione per singolo utente
// decisa dall'admin (profili.abilitato_ore_lavoro), non dal ruolo —
// nessun bypass nemmeno per l'admin: da chiamare, dopo requireStaff(),
// sulla pagina di quella sezione.
export function assicuraAccessoOreLavoro(abilitato: boolean | null | undefined): void {
  if (!abilitato) redirect('/dashboard');
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

// Se la pagina Presenze/Pasti è scrivibile per questo ruolo e questa
// data, e l'eventuale messaggio da mostrare se è un giorno di chiusura
// scolastica (specs/53): combina la chiusura del giorno (fa I/O) con la
// regola "sola data odierna per maestra/assistente" sopra — stesso
// calcolo ripetuto identico nelle vecchie pagine Presenze e Pasti prima
// di questa estrazione, ora in app/dashboard/giornata/page.tsx (CLAUDE.md,
// jscpd). Vive qui (non in lib/calendarioScolastico.ts, dove è nato) e
// non lì perché quel modulo è importato anche da componenti client
// (components/VerificaBonifico.tsx, via lib/comunicazioneRetta.ts): un
// suo import da lib/auth.ts (che porta con sé next/headers tramite
// lib/supabase/server.ts) rompeva la build ("You're importing a
// component that needs next/headers") — lib/auth.ts invece non è mai
// importato da codice client, quindi può tranquillamente dipendere da
// calendarioScolastico.ts (direzione sicura: mai il contrario).
export async function editabilitaGiorno(
  supabase: SupabaseClient,
  data: string,
  ruolo: string | null | undefined
): Promise<{ editable: boolean; messaggioChiuso: string | null }> {
  const chiusura = await chiusuraPerData(supabase, data);
  const chiusure = chiusura ? [chiusura] : [];
  return {
    // Un giorno di chiusura scolastica non è scrivibile da nessuno,
    // admin incluso — a differenza della regola "sola data odierna"
    // sopra, che esenta l'admin.
    editable: puoScrivereData(ruolo, data) && !isGiornoChiuso(data, chiusure),
    messaggioChiuso: messaggioChiusura(data, chiusure),
  };
}
