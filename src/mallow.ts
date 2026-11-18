// Mallow, la mascotte : un chamallow sur une pique, en 2D.
// mallow() = normal (doré, regard malin) ; mallowGrille() = trop grillé : le corps reste clair,
// seul le dessus est carbonisé et fume (choix du 16/11 : jamais de « visage noir »).

interface Options {
  taille?: number;
  /** 'entier' (avec la pique) ou 'tete' (recadré, pour les bulles du narrateur). */
  vue?: 'entier' | 'tete';
  trait?: string;
  /** Couronne du « Roi de la soirée ». */
  couronne?: boolean;
  /** Expression : normale, surprise (il prend feu), yeux fermés (il éternue ou il compte). */
  expression?: 'normale' | 'surprise' | 'yeuxFermes';
}

const TRAIT = '#24123A';
const viewBox = (o: Options) => (o.vue === 'tete' ? (o.couronne ? '32 4 136 176' : '32 30 136 150') : o.couronne ? '0 -14 200 264' : '0 0 200 250');
const COURONNE = (t: string) =>
  `<path d="M64 34 L70 4 L86 20 L100 -8 L114 20 L130 4 L136 34 Z" fill="#FFD84A" stroke="${t}" stroke-width="4" stroke-linejoin="round"/><circle cx="100" cy="22" r="5" fill="#FF5A6E"/>`;

export function mallow(o: Options = {}): string {
  const t = o.trait ?? TRAIT;
  const etiquette = o.vue === 'tete' ? 'aria-hidden="true"' : 'role="img" aria-label="Mallow, la mascotte chamallow"';
  return `<svg xmlns="http://www.w3.org/2000/svg" class="mallow" viewBox="${viewBox(o)}" width="${o.taille ?? 160}" ${etiquette}>
    ${o.vue === 'tete' ? '' : `<ellipse cx="100" cy="242" rx="42" ry="6" fill="#000" opacity=".22"/>
    <rect x="94" y="150" width="12" height="92" rx="6" fill="#E9C08C" stroke="${t}" stroke-width="4"/>`}
    <path d="M40 66 Q40 46 62 44 L138 44 Q160 46 160 66 L160 150 Q160 174 100 176 Q40 174 40 150 Z" fill="#FFF7F0" stroke="${t}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M140 80 L152 80 L152 150 Q150 166 116 170 Q140 160 140 146 Z" fill="#F0DCCF"/>
    <path d="M40 64 Q40 38 100 38 Q160 38 160 64 L160 74 Q152 88 140 78 Q130 94 118 81 Q106 96 94 82 Q82 95 71 80 Q58 92 49 78 Q44 84 40 76 Z" fill="#E0873E" stroke="${t}" stroke-width="5" stroke-linejoin="round"/>
    <ellipse cx="100" cy="52" rx="50" ry="10" fill="#F7C58A"/>
    <path d="M66 50 Q84 44 104 46" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none" opacity=".75"/>
    ${o.couronne ? COURONNE(t) : ''}
    <path d="M52 98 L52 140" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".8"/>
    <path d="M66 92 Q78 85 90 91" stroke="${t}" stroke-width="5" stroke-linecap="round" fill="none"/>
    <path d="M110 88 Q122 81 134 86" stroke="${t}" stroke-width="5" stroke-linecap="round" fill="none"/>
    ${o.expression === 'yeuxFermes'
      ? `<path d="M68 112 Q78 104 88 112 M112 112 Q122 104 132 112" stroke="${t}" stroke-width="6" stroke-linecap="round" fill="none"/>`
      : `<g class="yeux"><ellipse cx="78" cy="112" rx="9" ry="12" fill="${t}"/><ellipse cx="122" cy="112" rx="9" ry="12" fill="${t}"/>
      <circle cx="81" cy="107" r="3.6" fill="#fff"/><circle cx="125" cy="107" r="3.6" fill="#fff"/><circle cx="75" cy="117" r="1.6" fill="#fff"/><circle cx="119" cy="117" r="1.6" fill="#fff"/></g>`}
    <ellipse cx="62" cy="130" rx="9" ry="5" fill="#FF8FA8" opacity=".75"/><ellipse cx="138" cy="130" rx="9" ry="5" fill="#FF8FA8" opacity=".75"/>
    ${o.expression === 'surprise'
      ? `<ellipse cx="100" cy="140" rx="10" ry="12" fill="#4A1430" stroke="${t}" stroke-width="4"/><path d="M150 92 Q156 104 150 110 Q144 104 150 92Z" fill="#7FD3FF"/>`
      : o.expression === 'yeuxFermes'
        ? `<ellipse cx="100" cy="140" rx="11" ry="8" fill="#4A1430" stroke="${t}" stroke-width="4"/>`
        : `<path d="M86 130 Q100 147 116 130 Z" fill="#4A1430" stroke="${t}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M94 137 Q101 133 108 137 Q101 143 94 137 Z" fill="#FF6B8A"/>`}
  </svg>`;
}

const spirale = (x: number, y: number, t: string) =>
  `<path d="M${x} ${y} m-2 0 a2 2 0 1 1 4 0 a4 4 0 1 1 -8 0 a6 6 0 1 1 12 0 a8 8 0 1 1 -16 0" stroke="${t}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`;

export function mallowGrille(o: Options = {}): string {
  const t = o.trait ?? TRAIT;
  return `<svg xmlns="http://www.w3.org/2000/svg" class="mallow" viewBox="0 0 200 250" width="${o.taille ?? 160}" role="img" aria-label="Mallow, le chamallow, trop grillé et fumant">
    <g class="fumee" fill="#B9B3C7"><circle cx="76" cy="26" r="12"/><circle cx="104" cy="18" r="15"/><circle cx="130" cy="28" r="11"/></g>
    <ellipse cx="100" cy="242" rx="42" ry="6" fill="#000" opacity=".22"/>
    <rect x="94" y="150" width="12" height="92" rx="6" fill="#C9935F" stroke="${t}" stroke-width="4"/>
    <path d="M40 66 Q40 46 62 44 L138 44 Q160 46 160 66 L160 150 Q160 174 100 176 Q40 174 40 150 Z" fill="#F2DCC6" stroke="${t}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M140 80 L152 80 L152 150 Q150 166 116 170 Q140 160 140 146 Z" fill="#E2C2A4"/>
    <path d="M44 150 Q60 168 100 170 Q140 168 156 150 L156 160 Q140 174 100 175 Q60 174 44 160 Z" fill="#D9A774" opacity=".8"/>
    <path d="M40 64 Q40 38 100 38 Q160 38 160 64 L160 84 Q154 100 144 88 Q136 104 124 90 Q112 106 100 92 Q88 106 76 90 Q64 104 56 88 Q46 100 40 86 Z" fill="#2B1A14" stroke="${t}" stroke-width="5" stroke-linejoin="round"/>
    <ellipse cx="100" cy="52" rx="50" ry="10" fill="#3D2820"/>
    <g class="braise" stroke="#FF7A3D" stroke-width="3" stroke-linecap="round" fill="none"><path d="M58 70 L68 62 L76 70"/><path d="M110 60 L120 70 L130 64"/><path d="M90 78 L96 72"/><path d="M140 76 L148 70"/></g>
    <g class="flammes-dessus"><path d="M52 50 C46 38 56 34 54 22 C64 30 70 36 68 46 C74 40 74 32 80 28 C84 38 88 44 84 52 Z" fill="#FF6A2B"/><path d="M58 50 C56 42 62 38 62 32 C68 38 70 42 68 50 Z" fill="#FFB02E"/>
      <path d="M118 50 C112 40 120 34 120 26 C128 32 132 38 130 46 C136 40 138 34 144 32 C148 40 150 46 144 52 Z" fill="#FF6A2B"/><path d="M126 50 C124 44 128 40 130 34 C134 40 136 44 134 50 Z" fill="#FFB02E"/></g>
    <ellipse cx="62" cy="134" rx="10" ry="5" fill="#8C7A74" opacity=".35"/><ellipse cx="140" cy="128" rx="7" ry="4" fill="#8C7A74" opacity=".35"/>
    ${spirale(78, 116, t)}${spirale(122, 116, t)}
    <ellipse cx="102" cy="146" rx="7" ry="8" fill="${t}"/>
    <circle cx="116" cy="138" r="4" fill="#B9B3C7" opacity=".8"/><circle cx="124" cy="130" r="3" fill="#B9B3C7" opacity=".6"/>
  </svg>`;
}

/** Les flammes qui montent pendant que Mallow grille. */
export function flammes(): string {
  return `<svg class="flammes" viewBox="0 0 200 120" width="190" aria-hidden="true">
    <path d="M40 120 C20 90 44 70 40 40 C62 62 70 88 66 120 Z" fill="#FF7A3D"/>
    <path d="M80 120 C58 80 96 50 100 10 C118 50 140 80 120 120 Z" fill="#FFD84A"/>
    <path d="M134 120 C130 90 144 70 160 46 C170 76 182 96 162 120 Z" fill="#FF7A3D"/>
  </svg>`;
}

/** La séquence « grillé » : Mallow tremble, prend feu, puis apparaît trop grillé. */
export function sequenceGrille(taille = 150): string {
  return `<div class="seq-grille" style="height:${Math.round(taille * 1.35)}px">
    <div class="ok">${mallow({ taille })}</div>
    <div class="cuit">${mallowGrille({ taille })}</div>
    <div class="flammes-zone">${flammes()}</div>
  </div>`;
}

/** Le logo : chaque lettre tombe à son tour. */
export function logo(texte = 'GRILLÉ !', depart = 0.1): string {
  return `<h1 class="logo" aria-label="${texte}">${[...texte]
    .map((l, i) => (l === ' ' ? ' ' : `<span class="lettre" aria-hidden="true" style="animation-delay:${(depart + i * 0.06).toFixed(2)}s">${l}</span>`))
    .join('')}</h1>`;
}
