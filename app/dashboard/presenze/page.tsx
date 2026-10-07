import { redirect } from 'next/navigation';
import { percorsoGiornata } from '@/lib/giornata';

// Vecchio indirizzo di Presenze: presenze e pasti sono ora nella
// schermata unica "Presenze e pasti" (specs/10). Resta solo come
// reindirizzamento (stessa data) per segnalibri e link già salvati.
export default async function PresenzePage(props: { searchParams: Promise<{ data?: string }> }) {
  const searchParams = await props.searchParams;
  redirect(percorsoGiornata(searchParams.data));
}
