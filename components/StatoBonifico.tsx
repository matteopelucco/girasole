import { formattaImporto } from '@/lib/comunicazioneRetta';
import { formattaDataOraItaliana } from '@/lib/date';

// Stato del bonifico di una comunicazione retta (specs/59), solo testo: lo usa
// sia "Pagamenti bambino" (dentro VerificaBonifico, con le azioni) sia "Rette"
// (da solo, in sola lettura, con il link "Verifica"). Niente 'use client':
// resta un Server Component dove lo usa un Server Component.
export function StatoBonifico({
  stato,
  totale,
  importoRicevuto,
  nota,
  verificatoDaNome,
  verificatoIl,
}: {
  stato: 'in_attesa' | 'corretto' | 'importo_errato';
  totale: number;
  importoRicevuto: number | null;
  nota: string | null;
  verificatoDaNome: string | null;
  verificatoIl: string | null;
}) {
  // "gg/mm/aaaa alle hh:mm" (il formato base usa "_", pensato per i log).
  const quando = verificatoIl ? formattaDataOraItaliana(verificatoIl).replace('_', ' alle ') : '';
  if (stato === 'in_attesa') return <span className="text-stone-500">Bonifico da verificare</span>;
  if (stato === 'corretto') {
    return (
      <p className="text-xs text-emerald-700">
        Bonifico ricevuto (importo corretto) — verificato da {verificatoDaNome} il {quando}
      </p>
    );
  }
  return (
    <p className="text-xs text-amber-700">
      Bonifico ricevuto (importo diverso): {formattaImporto(importoRicevuto ?? 0)} invece di {formattaImporto(totale)} —{' '}
      {nota} — verificato da {verificatoDaNome} il {quando}
    </p>
  );
}
