'use client';

import { useState } from 'react';
import { CampoPassword } from './CampoPassword';

// Password + conferma con riscontro in tempo reale (specs/03 -
// utenti-e-ruoli.md, scenario "conferma password in tempo reale"): un
// errore di battitura nella password si scopre subito, non al primo
// login mancato. Il controllo server-side in creaUtente resta
// l'unica difesa reale — questo è solo un aiuto immediato.
export function CampiPasswordConferma() {
  const [password, setPassword] = useState('');
  const [conferma, setConferma] = useState('');
  const coincidono = conferma === '' || password === conferma;

  return (
    <>
      <CampoPassword
        name="password"
        required
        minLength={8}
        placeholder="Password"
        ariaLabel="Password"
        autoComplete="new-password"
        onChange={setPassword}
      />
      <div>
        <CampoPassword
          name="conferma_password"
          required
          minLength={8}
          placeholder="Conferma password"
          ariaLabel="Conferma password"
          autoComplete="new-password"
          onChange={setConferma}
        />
        {conferma !== '' && (
          <p className={`mt-1 text-xs ${coincidono ? 'text-green-700' : 'text-red-600'}`}>
            {coincidono ? 'Le password coincidono.' : 'Le password non coincidono.'}
          </p>
        )}
      </div>
    </>
  );
}
