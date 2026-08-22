'use server';

import { revalidatePath } from 'next/cache';
import { requireProfilo, assicuraScrivibile } from '@/lib/auth';

export async function segnaPasto(
  bambinoId: string,
  mangiato: 'si' | 'no' | 'parziale',
  sezioneId: string,
  data: string,
  formData: FormData
) {
  const { supabase, user, profilo } = await requireProfilo();
  assicuraScrivibile(profilo?.ruolo, data);

  const note = (formData.get('nota_pasto') as string)?.trim() || null;

  const { error } = await supabase.from('pasti').upsert(
    {
      bambino_id: bambinoId,
      data,
      mangiato,
      note,
      inserito_da: user.id,
    },
    { onConflict: 'bambino_id,data' }
  );
  if (error) throw new Error(`Impossibile salvare il pasto: ${error.message}`);

  revalidatePath(`/dashboard/pasti/${sezioneId}`);
}
