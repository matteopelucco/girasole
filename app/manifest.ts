import type { MetadataRoute } from 'next';

// Web App Manifest (convenzione Next.js: servito automaticamente su
// /manifest.webmanifest). `short_name` è quello che Android/Chrome
// mostra sotto l'icona quando l'app viene aggiunta alla schermata Home
// ("Aggiungi a schermata Home"/installazione PWA) — senza un manifest,
// Chrome ripiega su un'icona generica e sul titolo pagina per intero,
// troppo lungo per stare sotto l'icona.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Girasole — Asilo Sartorio',
    short_name: 'Girasole',
    description: 'Gestione presenze, pasti e comunicazioni',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#f9b51a',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
