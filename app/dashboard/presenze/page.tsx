import { redirect } from 'next/navigation';
import { percorsoGiornata } from '@/lib/giornata';

// Vecchio indirizzo di Presenze: presenze e pasti sono ora nella
// schermata unica "Presenze e pasti" (specs/10). Resta solo come
// reindirizzamento (stessa data) per segnalibri e link già salvati.
export default function PresenzePage({ searchParams }: { searchParams: { data?: string } }) {
  redirect(percorsoGiornata(searchParams.data));
}
