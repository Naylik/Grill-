// Liste des mini-jeux disponibles.
import type { MiniJeu } from './interface';
import { combien } from './combien';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const JEUX: MiniJeu<any>[] = [combien];

export const jeuParId = (id?: string) => JEUX.find((j) => j.id === id);

/** Jeux possibles pour ce numéro de jeu : on évite de rejouer un jeu, et de jouer deux fois le même d'affilée. */
export function jeuxPossibles(numeroJeu: number, nbJoueurs: number, dejaJoues: string[]): MiniJeu[] {
  const autorises = JEUX.filter((j) => j.autorise(numeroJeu, nbJoueurs));
  const fois = (id: string) => dejaJoues.filter((x) => x === id).length;
  const minimum = Math.min(...autorises.map((j) => fois(j.id)));
  const moinsJoues = autorises.filter((j) => fois(j.id) === minimum);
  const sansRepetition = moinsJoues.filter((j) => j.id !== dejaJoues[dejaJoues.length - 1]);
  return sansRepetition.length ? sansRepetition : moinsJoues.length ? moinsJoues : autorises;
}
