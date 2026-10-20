import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Unisce classi CSS (anche condizionali) e risolve i conflitti di Tailwind:
 * vince l'ultima (`cn('p-2', 'p-4')` -> `p-4`). Funzione standard di
 * shadcn/ui, usata dai componenti in `components/ui/` (issue #336).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
