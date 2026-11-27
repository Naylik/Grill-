// Écran « Liste des jeux » : une vitrine simple (le principe en une phrase, puis les 12 mini-jeux avec leur accroche).
// Les règles détaillées sont sur l'écran des règles de chaque jeu ; les points, ici et avant chaque jeu (points.ts).
import { JEUX } from '../games';
import { esc } from '../outils';
import { mallow } from '../mallow';
import { resumeRegles, tableauPoints } from './points';

export function ecranListeJeux(): string {
  const tuiles = JEUX.map(
    (j, i) => `<article class="tuile-jeu" style="--c:${j.couleur};--i:${i}">
      <span class="tuile-icone"><svg viewBox="0 0 24 24" aria-hidden="true">${j.icone}</svg></span>
      <h3>${esc(j.nom)}</h3>
      <p>${esc(j.accroche)}</p>
    </article>`,
  ).join('');
  return `<section class="ecran liste-jeux">
    <button class="bouton discret retour" data-action="vueAccueil" data-valeur="accueil" aria-label="Retour à l’accueil">← Retour</button>
    <div class="principe">
      <div>${mallow({ taille: 64 })}</div>
      <div>
        <h2>Comment ça marche ?</h2>
        <p>Chacun a une <strong>mission secrète</strong> pour la soirée. Entre deux, des <strong>mini-jeux</strong> s’enchaînent (jusqu’à 8, parmi ${JEUX.length}). À la fin, on révèle tout.</p>
      </div>
    </div>
    <div class="grille-jeux">${tuiles}</div>
    ${resumeRegles()}
    ${tableauPoints()}
    <button class="bouton jaune" data-action="vueAccueil" data-valeur="accueil">C’est parti</button>
  </section>`;
}
