import Link from 'next/link';
import { logout } from '@/app/actions';

export function NavHeader({
  nome,
  ruolo,
}: {
  nome: string;
  ruolo: string | null;
}) {
  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm font-semibold">
            Girasole
          </Link>
          {ruolo === 'admin' && (
            <>
              <Link href="/admin" className="text-sm text-stone-600 hover:text-stone-900">
                Sezioni e bambini
              </Link>
              <Link href="/admin/maestre" className="text-sm text-stone-600 hover:text-stone-900">
                Utenti
              </Link>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-stone-500">{nome}</span>
          <form action={logout}>
            <button type="submit" className="text-sm text-stone-500 hover:text-stone-900">
              Esci
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
