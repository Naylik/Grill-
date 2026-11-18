// Écran « Liste des jeux » : le principe de Grillé ! et les règles de chaque mini-jeu.
import { JEUX } from '../games';
import { esc } from '../outils';
import { mallow } from '../mallow';

export function ecranListeJeux(): string {
  const jeux = JEUX.map(
    (j) => `<article class="fiche-jeu" style="--c:${j.couleur}">
      <div class="fiche-tete"><span class="fiche-icone"><svg viewBox="0 0 24 24" aria-hidden="true">${j.icone}</svg></span><h3>${esc(j.nom)}</h3>${j.categorie === 'equipe' ? '<span class="equipe-chip">Jeu d’équipe</span>' : ''}</div>
      <p>${esc(j.explication.comment)}</p>
      <p class="fiche-gagner"><strong>Pour gagner :</strong> ${esc(j.explication.gagner)}</p>
      ${j.explication.note ? `<p class="fiche-note">${esc(j.explication.note)}</p>` : ''}
    </article>`,
  ).join('');
  return `<section class="ecran liste-jeux">
    <button class="bouton discret retour" data-action="vueAccueil" data-valeur="accueil" aria-label="Retour à l’accueil">← Retour</button>
    <div class="principe">
      <div>${mallow({ taille: 70 })}</div>
      <div>
        <h2>Le principe</h2>
        <p>Des mini-jeux s’enchaînent pendant que chacun essaie d’accomplir ses <strong>missions secrètes</strong>. À la fin, on révèle les missions, le groupe vote, et le classement tombe. On peut gagner les mini-jeux et rater sa mission… ou l’inverse.</p>
      </div>
    </div>
    <div class="boite resume-regles">
      <p><strong>Grosse mission :</strong> une par joueur pour toute la soirée, au choix entre une mission longue durée (15 pts) et une plus courte (facile 6 pts, difficile 10 pts), pour une soirée de 6 jeux (×4/6 en court, ×8/6 en long). <strong>Missions flash :</strong> à chaque jeu, 1 ou 2 joueurs reçoivent en secret une petite mission liée au jeu (+3 pts), révélée et votée juste après.</p>
      <p><strong>Mini-jeux :</strong> 1er 5 pts, 2e 3 pts, 3e 2 pts, les autres 1 pt.</p>
      <p><strong>Pari détective :</strong> avant la révélation, devine la mission d’un joueur. Juste : tu lui voles 4 ou 6 pts. Raté : −2 pts.</p>
    </div>
    <h2>Les mini-jeux</h2>
    ${jeux}
    <p class="aide">D’autres jeux arrivent bientôt.</p>
    <button class="bouton jaune" data-action="vueAccueil" data-valeur="accueil">C’est parti</button>
  </section>`;
}
