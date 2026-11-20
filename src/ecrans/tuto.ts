// Tutoriel « Comment jouer » : 3 écrans, montré une fois sur chaque téléphone à l'arrivée sur le site.
import { S } from '../etat';
import { mallow } from '../mallow';
import { flammeGrille } from '../stickers';
import { JEUX } from '../games';

const CLE_TUTO = 'grille:tuto-vu';

export function tutoDejaVu(): boolean {
  try {
    return localStorage.getItem(CLE_TUTO) === '1';
  } catch {
    return true; // stockage bloqué : on ne l'impose pas à chaque visite
  }
}

export function marquerTutoVu(): void {
  try {
    localStorage.setItem(CLE_TUTO, '1');
  } catch {
    /* tant pis : il reviendra à la prochaine visite */
  }
}

const icones = () =>
  `<div class="icones-tuto">${JEUX.slice(0, 6).map((j) => `<span style="--c:${j.couleur}"><svg viewBox="0 0 24 24" aria-hidden="true">${j.icone}</svg></span>`).join('')}</div>`;

const ETAPES: { titre: string; texte: string; illustration: () => string }[] = [
  {
    titre: 'Ta mission secrète',
    texte: 'Au début, tu reçois une mission que toi seul connais. Accomplis-la pendant la soirée… sans te faire repérer.',
    illustration: () => `<div class="illu-mission">${mallow({ taille: 150 })}<div class="carte-tuto">🔒 TOP<br>SECRET</div></div>`,
  },
  {
    titre: 'Des mini-jeux',
    texte: 'Entre-temps, enchaînez des mini-jeux sur vos téléphones. Gagner rapporte des points, et c’est le moment idéal pour glisser ta mission.',
    illustration: icones,
  },
  {
    titre: 'Grille les autres !',
    texte: 'Tu as repéré la mission de quelqu’un ? Appuie sur la flamme et accuse-le. Bien vu : tu lui voles des points.',
    illustration: () => `<div class="flamme-tuto">${flammeGrille()}<span>GRILLÉ</span><i aria-hidden="true">👆</i></div>`,
  },
];

export function ecranTuto(): string {
  const n = Math.min(ETAPES.length - 1, Math.max(0, S.etapeTuto));
  const e = ETAPES[n];
  const dernier = n === ETAPES.length - 1;
  return `<section class="ecran tuto">
    <span class="etape-tuto">COMMENT JOUER · ${n + 1}/${ETAPES.length}</span>
    <div class="illu-tuto">${e.illustration()}</div>
    <h2>${e.titre}</h2>
    <p>${e.texte}</p>
    <div class="points-tuto" aria-hidden="true">${ETAPES.map((_, i) => `<i class="${i === n ? 'on' : ''}"></i>`).join('')}</div>
    <div class="pile bas">
      <button class="bouton jaune" data-action="tuto" data-valeur="${dernier ? 'fin' : 'suivant'}">${dernier ? 'C’est parti !' : 'Suivant'}</button>
      ${dernier ? '' : '<button class="bouton discret" data-action="tuto" data-valeur="fin">Passer</button>'}
    </div>
  </section>`;
}
