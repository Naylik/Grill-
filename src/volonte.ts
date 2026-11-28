// Mode « À volonté » : on choisit un mini-jeu parmi les 12 et on y rejoue tant qu'on veut, sans points.
// Missions au choix de l'hôte (pour le fun : on les révèle et on les vote à la fin, sans points).
// Futur mode payant : le verrou est prêt mais éteint pendant les tests.
import { S } from './etat';
import { JEUX } from './games';
import type { MiniJeu } from './games/interface';

/** Passe à true le jour où le mode devient payant (achat à brancher, par exemple sur le Play Store). */
export const VOLONTE_PAYANT = false;
export const volonteDebloque = (): boolean => !VOLONTE_PAYANT;

/** Le salon joue en mode À volonté. */
export const enVolonte = (): boolean => S.infos?.mode === 'volonte';
/** Missions secrètes actives : toujours en soirée, au choix de l'hôte en À volonté. */
export const avecMissions = (): boolean => !enVolonte() || S.infos?.missions !== false;

/**
 * Jeux jouables à ce nombre de joueurs. En À volonté, pas de règle « pas dans les 2 premiers jeux » (le Parieur
 * se joue avec ses propres points) : on ne garde que la limite du nombre de joueurs.
 */
export function jouableEnVolonte(jeu: MiniJeu, nbJoueurs: number): boolean {
  return jeu.autorise(99, nbJoueurs);
}
export const jeuxVolonte = (nbJoueurs: number): MiniJeu[] => JEUX.filter((j) => jouableEnVolonte(j, nbJoueurs));

/** Ce qu'on affiche à la place de « Jeu 3/6 ». */
export const LIBELLE_VOLONTE = '∞ À volonté';
