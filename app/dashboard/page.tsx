import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profilo } = await supabase
    .from('profili')
    .select('nome, cognome, ruolo')
    .eq('id', user.id)
    .single();

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-xl font-medium">Ciao {profilo?.nome || user.email}</h1>
      <p className="mt-1 text-sm text-stone-500">Ruolo: {profilo?.ruolo ?? 'non impostato'}</p>

      <div className="mt-8 rounded-xl border border-dashed border-stone-300 p-6 text-sm text-stone-500">
        Qui arriveranno presenze, pasti e promemoria — prossimo passo con Claude Code (vedi TASKS.md).
      </div>
    </main>
  );
}
