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

/** Le résumé des règles de la soirée (paragraphe de l'ancienne liste des jeux, remis à la demande de Kilyan),
 *  avec les chiffres du barème. */
export function resumeRegles(): string {
  const v = VOL_DETECTIVE;
  return `<div class="boite resume-regles">
    <p><strong>Mission principale :</strong> une par joueur pour toute la soirée, au choix entre une mission longue durée (${POINTS_MISSION.longue} pts) et une plus courte (facile ${POINTS_MISSION.facile} pts, difficile ${POINTS_MISSION.difficile} pts), pour une soirée de 6 jeux (×4/6 en court, ×8/6 en long). <strong>Missions flash :</strong> à chaque jeu, 1 ou 2 joueurs reçoivent en secret une petite mission liée au jeu (+${POINTS_FLASH} pts), révélée et votée juste après.</p>
    <p><strong>Mini-jeux :</strong> 1er ${POINTS_PLACE[0]} pts, 2e ${POINTS_PLACE[1]} pts, 3e ${POINTS_PLACE[2]} pts, les autres 1 pt.</p>
    <p><strong>Pari détective :</strong> avant la révélation, devine la mission principale d’un joueur. Juste : tu lui voles ${v.facile}, ${v.difficile} ou ${v.longue} pts (mission facile, difficile ou longue). Raté : −${-PARI_RATE} pts.</p>
  </div>`;
}
