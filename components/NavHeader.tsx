import Link from 'next/link';
import { PulsanteInvio } from '@/components/PulsanteInvio';
import { logout } from '@/app/actions';

export function NavHeader({
  nome,
  ruolo,
}: {
  nome: string;
  ruolo: string | null;
}) {
  return (
    <header className="border-b-2 border-amber-400 bg-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm font-semibold text-stone-900">
            <span aria-hidden className="text-lg">
              🌻
            </span>
            Girasole
          </Link>
          {ruolo === 'admin' && (
            <>
              <Link href="/admin" className="text-sm text-stone-600 hover:text-emerald-700">
                Sezioni e bambini
              </Link>
              <Link href="/admin/maestre" className="text-sm text-stone-600 hover:text-emerald-700">
                Utenti
              </Link>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-stone-500">{nome}</span>
          <form action={logout}>
            <PulsanteInvio mantieniTesto className="text-sm text-stone-500 hover:text-stone-900">
              Esci
            </PulsanteInvio>
          </form>
        </div>
      </div>
    </header>
  );
}
