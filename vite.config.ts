/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// base './' : le site marche quel que soit le nom du dépôt GitHub Pages.
export default defineConfig({
  base: './',
  // Version de l'appli = heure de construction : sert à repérer un téléphone resté sur une ancienne version.
  define: { __VERSION__: JSON.stringify(Date.now()) },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icone.svg'],
      manifest: {
        name: 'Grillé !',
        short_name: 'Grillé !',
        description: 'Jeu de soirée : mini-jeux et missions secrètes, chacun sur son téléphone.',
        lang: 'fr',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0D0A1E',
        theme_color: '#0D0A1E',
        icons: [
          { src: 'icone-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icone-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
    }),
  ],
  // Deux pages : le jeu, et la table virtuelle (plusieurs téléphones de test dans une page).
  build: { rollupOptions: { input: { main: 'index.html', table: 'table.html' } } },
  test: { include: ['tests/**/*.test.ts'] },
});
