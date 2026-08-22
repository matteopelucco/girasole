import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export type Profilo = {
  nome: string;
  cognome: string;
  ruolo: string;
};

// Richiede una sessione autenticata, senza requisiti di ruolo — usato
// dalle server action che non hanno bisogno del profilo (es.
// segnaPresenza/segnaPasto in app/dashboard/actions.ts).
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

  const { data: profilo } = await supabase
    .from('profili')
    .select('nome, cognome, ruolo')
    .eq('id', user.id)
    .single();

  return { supabase, user, profilo: profilo as Profilo | null };
}

// Come requireProfilo(), ma reindirizza a /dashboard se il ruolo non è
// admin — usato dalle pagine e server action sotto /admin.
export async function requireAdmin() {
  const { supabase, user, profilo } = await requireProfilo();
  if (profilo?.ruolo !== 'admin') redirect('/dashboard');
  return { supabase, user, profilo };
}
