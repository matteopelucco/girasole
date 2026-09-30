import type { SupabaseClient } from '@supabase/supabase-js';
import { chiusurePerPeriodo } from '@/lib/calendarioScolastico';
import { meseDaData, ultimoGiornoMese, primoGiornoMese, meseSuccessivo } from '@/lib/date';
import { calcoloMensileMonteOre, meseDiMovimento, type RigaCalcoloMensileMonteOre } from '@/lib/monteOreMensile';
import { righeMeseOreLavoro, riepilogoMeseOreLavoro, type GiornoSalvatoOreLavoro } from '@/lib/oreLavoroMese';
import type { ProfiloOrario } from '@/lib/profiliOrari';

export type MovimentoPerCalcolo = { variazione: number | string; created_at: string };

// Calcolo completo mese per mese del monte ore di una persona (specs/19):
// legge tutti i giorni di ore di lavoro salvati e le chiusure del periodo,
// poi riusa le funzioni pure (righeMeseOreLavoro/riepilogoMeseOreLavoro e
// calcoloMensileMonteOre) — lo stesso calcolo della vista mensile
// (specs/18). `movimenti` è già letto da chi chiama (serve anche a
// mostrare il saldo e lo storico). Usato dalla scheda ore e dal PDF
// mensile dei report (specs/52), con il client giusto per ciascuno.
export async function calcoloMensilePerUtente(
  supabase: SupabaseClient,
  {
    utenteId,
    profiloOrario,
    oggiData,
    movimenti,
  }: {
    utenteId: string;
    profiloOrario: ProfiloOrario | null | undefined;
    oggiData: string;
    movimenti: MovimentoPerCalcolo[];
  }
): Promise<RigaCalcoloMensileMonteOre[]> {
  const { data: salvati } = await supabase
    .from('ore_lavoro_giorni')
    .select('data, stato, ore_ordinarie, ore_straordinarie, motivo_straordinario, codice_malattia, nota_assenza')
    .eq('utente_id', utenteId)
    .order('data', { ascending: true });
  const giorni = (salvati ?? []) as GiornoSalvatoOreLavoro[];

  const meseCorrente = meseDaData(oggiData);
  const mesiConOre = giorni.length ? [meseDaData(giorni[0].data)] : [];
  const mesiConMovimenti = movimenti.map((m) => meseDiMovimento(m.created_at));
  const primo = [...mesiConOre, ...mesiConMovimenti].sort()[0];
  if (!primo) return [];

  // Un mese dopo l'altro, dal primo fino a quello corrente.
  const mesi: string[] = [];
  for (let mese = primo; mese <= meseCorrente; mese = meseSuccessivo(mese)) mesi.push(mese);

  const chiusure = await chiusurePerPeriodo(supabase, primoGiornoMese(mesi[0]), ultimoGiornoMese(meseCorrente));

  const perMese = mesi.map((mese) => {
    const righe = righeMeseOreLavoro({
      mese,
      oggiData,
      salvati: giorni.filter((g) => meseDaData(g.data) === mese),
      profiloOrario,
      chiusure,
    });
    const riepilogo = riepilogoMeseOreLavoro(righe);
    return { mese, orePreviste: riepilogo.orePreviste, differenza: riepilogo.differenza };
  });

  // I mesi senza giorni salvati non hanno differenza (nessun dato): restano
  // con le sole ore previste dal profilo, coerenti con la vista mensile.
  return calcoloMensileMonteOre({ mesi: perMese, movimenti, meseCorrente });
}
