// Ce que rapporte chaque chose pour la soirée. Les chiffres sont lus dans le code du barème (score.ts, flash.ts,
// accusations.ts) : quand le barème change, ces textes suivent tout seuls.
import { BONUS_VENGEANCE, PARI_RATE, PARIEUR_MAX, PARIEUR_MIN, POINTS_MISSION, POINTS_PLACE, VOL_DETECTIVE } from '../score';
import { POINTS_FLASH, VOL_FLASH } from '../flash';
import { PENALITE_ACCUSATION, PENALITE_MENSONGE } from '../accusations';

const PLACES = `1er ${POINTS_PLACE[0]} · 2e ${POINTS_PLACE[1]} · 3e ${POINTS_PLACE[2]} · les autres 1`;

/** Une ligne sur l'écran des règles d'un mini-jeu : ce qu'il rapporte pour la soirée. */
export function lignePointsJeu(idJeu: string): string {
  const texte = idJeu === 'parieur'
    ? `tu gagnes ou perds les points misés (de ${PARIEUR_MIN} à +${PARIEUR_MAX} sur le jeu)`
    : `${PLACES} pts`;
  return `<p class="points-jeu">🏆 Pour la soirée : ${texte}</p>`;
}

/** Le tableau « Les points » de la liste des jeux. Les chiffres sont en gras jaune (classe .pt). */
export function tableauPoints(): string {
  const v = VOL_DETECTIVE;
  const pt = (n: number | string) => `<b class="pt">${n}</b>`;
  const lignes: [string, string][] = [
    ['Mini-jeu', `1er ${pt(POINTS_PLACE[0])} · 2e ${pt(POINTS_PLACE[1])} · 3e ${pt(POINTS_PLACE[2])} · les autres ${pt(1)}<br><small>Au Parieur : les points misés</small>`],
    ['Mission principale réussie', `facile ${pt(POINTS_MISSION.facile)} · difficile ${pt(POINTS_MISSION.difficile)} · longue durée ${pt(POINTS_MISSION.longue)}`],
    ['Mission flash réussie', pt(`+${POINTS_FLASH}`)],
    ['GRILLÉ ! vu juste', `tu lui voles ${pt(VOL_FLASH)} (flash) ou ${pt(`${v.facile} à ${v.longue}`)} (principale)<br><small>Accusation ratée : ${pt(`−${PENALITE_ACCUSATION}`)}</small>`],
    ['Pari détective juste', `tu lui voles ${pt(v.facile)}, ${pt(v.difficile)} ou ${pt(v.longue)} selon sa mission<br><small>Pari raté : ${pt(`−${-PARI_RATE}`)}</small>`],
    ['Mentir quand on te grille', `${pt(`−${PENALITE_MENSONGE}`)}<br><small>Tu as répondu « raté » alors que c’était bien ta mission, et le groupe le découvre à la fin</small>`],
    ['Vengeance', `mission principale ${pt(`×${String(BONUS_VENGEANCE).replace('.', ',')}`)}<br><small>Dans une saison (plusieurs soirées entre les mêmes amis), celui qui s’est fait griller peut se venger à la soirée suivante</small>`],
  ];
  return `<div class="tableau-points">
    <h2>Les points</h2>
    <dl>${lignes.map(([quoi, combien]) => `<div><dt>${quoi}</dt><dd>${combien}</dd></div>`).join('')}</dl>
  </div>`;
}

/** Le principe des missions, sans chiffres (les points sont dans le tableau, juste en dessous). */
export function resumeRegles(): string {
  return `<div class="boite resume-regles">
    <p><strong>Mission principale :</strong> une par joueur pour toute la soirée, à choisir entre une mission longue durée et une plus courte.</p>
    <p><strong>Missions flash :</strong> à chaque mini-jeu, 1 ou 2 joueurs reçoivent en secret une petite mission liée au jeu, révélée et votée juste après.</p>
    <p><strong>Pari détective :</strong> avant la révélation finale, devine la mission principale d’un autre joueur.</p>
  </div>`;
}
