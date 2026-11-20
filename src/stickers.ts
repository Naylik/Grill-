// Boutons « sticker » (validés le 20/11) : formes simples, gros contour, couleurs franches, comme un emoji.
const TRAIT = '#1A1033';
const OCTOGONE = 'M58 6 H122 L174 58 V122 L122 174 H58 L6 122 V58 Z';

/** Panneau STOP du Bon timing : octogone rouge, bord blanc, reflet, texte détouré. */
export const panneauStop = (): string => `<svg viewBox="0 0 180 188" aria-hidden="true">
  <path d="${OCTOGONE}" fill="${TRAIT}" transform="translate(0 7)"/>
  <path d="${OCTOGONE}" fill="#fff" stroke="${TRAIT}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M62 18 H118 L162 62 V118 L118 162 H62 L18 118 V62 Z" fill="#FF3B5C"/>
  <path d="M62 18 H118 L132 32 C100 26 60 40 30 74 L18 62 Z" fill="#fff" opacity=".35"/>
  <text x="90" y="102" text-anchor="middle" font-family="Unbounded, 'Arial Black', sans-serif" font-weight="900" font-size="32" letter-spacing="-1" fill="#fff" stroke="${TRAIT}" stroke-width="7" paint-order="stroke">STOP</text>
</svg>`;

/** Flamme du bouton GRILLÉ (le mot est posé par-dessus en HTML). */
export const flammeGrille = (): string => `<svg viewBox="0 0 96 112" aria-hidden="true">
  <defs><linearGradient id="degrade-flamme" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FF3D2E"/><stop offset=".55" stop-color="#FF8A3D"/><stop offset="1" stop-color="#FFD84A"/></linearGradient></defs>
  <path d="M48 2 C56 22 78 30 82 56 C86 84 70 108 48 108 C26 108 10 88 14 62 C17 44 30 38 32 22 C40 30 42 38 42 44 C46 34 50 20 48 2 Z" fill="url(#degrade-flamme)" stroke="#FFE97A" stroke-width="3"/>
</svg>`;
