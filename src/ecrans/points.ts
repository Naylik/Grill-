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

/** Le tableau « Les points » de la liste des jeux. */
export function tableauPoints(): string {
  const v = VOL_DETECTIVE;
  const lignes: [string, string][] = [
    ['Mini-jeu', `${PLACES} (au Parieur : les points misés)`],
    ['Mission principale réussie', `facile ${POINTS_MISSION.facile} · difficile ${POINTS_MISSION.difficile} · longue durée ${POINTS_MISSION.longue} (soirée de 6 jeux)`],
    ['Mission flash réussie', `+${POINTS_FLASH}`],
    ['GRILLÉ ! vu juste', `tu voles ${VOL_FLASH} (flash) ou ${v.facile} à ${v.longue} (principale) · raté : −${PENALITE_ACCUSATION}`],
    ['Pari détective juste', `tu voles ${v.facile}, ${v.difficile} ou ${v.longue} selon la mission · raté : −${-PARI_RATE}`],
    ['Menteur démasqué', `−${PENALITE_MENSONGE}`],
    ['Vengeance (saisons)', `mission principale ×${String(BONUS_VENGEANCE).replace('.', ',')}`],
  ];
  return `<div class="tableau-points">
    <h2>Les points</h2>
    <dl>${lignes.map(([quoi, combien]) => `<div><dt>${quoi}</dt><dd>${combien}</dd></div>`).join('')}</dl>
  </div>`;
}
