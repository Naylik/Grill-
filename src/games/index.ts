// Liste des mini-jeux disponibles.
import type { MiniJeu } from './interface';
import { combien } from './combien';
import { justePrix } from './justePrix';
import { parieur } from './parieur';
import { imposteur } from './imposteur';
import { reflexe } from './reflexe';
import { timing } from './timing';
import { patate } from './patate';
import { quitteOuDouble } from './quitteOuDouble';
import { telephone } from './telephone';
import { champDeMines } from './mines';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const JEUX: MiniJeu<any>[] = [combien, justePrix, parieur, imposteur, reflexe, timing, patate, quitteOuDouble, telephone, champDeMines];

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

/** Mode vote : 2 jeux différents, en privilégiant les moins joués, jamais celui qu'on vient de jouer. */
export function jeuxPourVote(numeroJeu: number, nbJoueurs: number, dejaJoues: string[], hasard = Math.random): MiniJeu[] {
  const fois = (id: string) => dejaJoues.filter((x) => x === id).length;
  const autorises = JEUX.filter((j) => j.autorise(numeroJeu, nbJoueurs));
  const sansDernier = autorises.filter((j) => j.id !== dejaJoues[dejaJoues.length - 1]);
  const liste = (sansDernier.length >= 2 ? sansDernier : autorises)
    .map((j) => ({ j, tri: fois(j.id) + hasard() * 0.5 }))
    .sort((a, b) => a.tri - b.tri)
    .map((x) => x.j);
  return liste.slice(0, 2);
}
