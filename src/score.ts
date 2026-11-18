// Barème de la partie (section « Score et classement » du cahier des charges). Fonctions pures, testées.
import type { Difficulte, Score } from './types';

/** Points de place : 1er 5, 2e 3, 3e 2, au-delà 1. Les ex aequo reçoivent les mêmes points. */
export const POINTS_PLACE = [5, 3, 2];
export const POINTS_MISSION: Record<Difficulte, number> = { facile: 8, difficile: 12 };
export const VOL_DETECTIVE: Record<Difficulte, number> = { facile: 4, difficile: 6 };
export const PARI_RATE = -2;

/**
 * Transforme le score interne d'un mini-jeu en places (1 = premier) puis en points de place.
 * plusGrandGagne = false pour les jeux où le plus petit score gagne (ex. écart au juste prix).
 */
export function places(internes: Record<string, number>, plusGrandGagne = true): Record<string, number> {
  const tri = Object.entries(internes).sort((a, b) => (plusGrandGagne ? b[1] - a[1] : a[1] - b[1]));
  const res: Record<string, number> = {};
  tri.forEach(([uid, v], i) => {
    const precedent = tri[i - 1];
    res[uid] = precedent && precedent[1] === v ? res[precedent[0]] : i + 1;
  });
  return res;
}

export function pointsDePlace(internes: Record<string, number>, plusGrandGagne = true): Record<string, number> {
  const p = places(internes, plusGrandGagne);
  return Object.fromEntries(Object.entries(p).map(([uid, place]) => [uid, POINTS_PLACE[place - 1] ?? 1]));
}

/** Vote de validation : réussi si plus de la moitié des votants dit oui. Égalité = raté. */
export function majoriteOui(votes: boolean[]): boolean {
  const oui = votes.filter(Boolean).length;
  return oui * 2 > votes.length;
}

export const scoreVide = (): Score => ({ jeux: 0, parieur: 0, missions: 0, detective: 0 });

/** Classement provisoire : sans les points de mission (révélés à la fin seulement). */
// Les points du bouton GRILLÉ ! sont publics dès le verdict : ils comptent tout de suite.
// (Un score peut être incomplet : un joueur accusé avant le 1er jeu n'a que « grille ».)
export const totalProvisoire = (s?: Partial<Score>): number => (s ? (s.jeux ?? 0) + (s.parieur ?? 0) + (s.grille ?? 0) + (s.flash ?? 0) : 0);
export const totalFinal = (s?: Partial<Score>): number => (s ? totalProvisoire(s) + (s.missions ?? 0) + (s.detective ?? 0) : 0);

/** Combien ont dit oui ? : 3 pts si chiffre exact, 1 pt à un près. */
export function pointsCombien(estimation: number, vrai: number): number {
  const ecart = Math.abs(estimation - vrai);
  return ecart === 0 ? 3 : ecart === 1 ? 1 : 0;
}

export interface ResultatMission {
  difficulte: Difficulte;
  reussie: boolean;
  /** Mission de vengeance (saisons) : points doublés. */
  vengeance?: boolean;
}

export const pointsMission = (m: ResultatMission): number => (m.reussie ? POINTS_MISSION[m.difficulte] * (m.vengeance ? 2 : 1) : 0);
export interface ResultatPari {
  de: string; // le détective
  cible: string;
  /** Mission trouvée (selon le vote du groupe), ou null si raté. */
  trouvee: Difficulte | null;
}

/** Points de mission et de détective pour tout le monde, à partir des votes de la révélation. */
export function pointsDeFin(missions: Record<string, ResultatMission[]>, paris: ResultatPari[]) {
  const missionsPts: Record<string, number> = {};
  const detective: Record<string, number> = {};
  for (const [uid, liste] of Object.entries(missions)) {
    missionsPts[uid] = liste.reduce((t, m) => t + pointsMission(m), 0);
    detective[uid] ??= 0;
  }
  for (const p of paris) {
    detective[p.de] ??= 0;
    detective[p.cible] ??= 0;
    if (p.trouvee) {
      const vol = VOL_DETECTIVE[p.trouvee];
      detective[p.de] += vol;
      detective[p.cible] -= vol; // le joueur grillé garde sa mission si elle est validée : il perd seulement le vol
    } else {
      detective[p.de] += PARI_RATE;
    }
  }
  return { missions: missionsPts, detective };
}

export interface Titre {
  uid: string;
  titre: string;
  pourquoi: string;
}

/** Titres fun de l'écran final. */
export function titres(
  scores: Record<string, Score>,
  missions: Record<string, ResultatMission[]>,
  paris: ResultatPari[],
): Titre[] {
  const res: Titre[] = [];
  for (const [uid, liste] of Object.entries(missions)) {
    if (liste.some((m) => m.reussie && m.difficulte === 'difficile')) res.push({ uid, titre: 'Agent secret', pourquoi: 'grosse mission difficile réussie' });
  }
  for (const p of paris) {
    if (p.trouvee) {
      res.push({ uid: p.de, titre: 'Sherlock', pourquoi: 'pari détective juste' });
      res.push({ uid: p.cible, titre: 'Grillé', pourquoi: 'mission devinée' });
    }
  }
  const meilleurJeux = Math.max(...Object.values(scores).map((s) => s.jeux));
  for (const [uid, s] of Object.entries(scores)) {
    if (s.jeux === meilleurJeux && meilleurJeux > 0) res.push({ uid, titre: 'Champion des mini-jeux', pourquoi: `${s.jeux} pts de place` });
  }
  // Pas de doublon (deux paris justes contre la même personne → un seul « Grillé »).
  return res.filter((t, i) => res.findIndex((u) => u.uid === t.uid && u.titre === t.titre) === i);
}

/** Résultat d'un pari détective selon le vote du groupe : 1 ou 2 = mission trouvée, 0 = raté. */
export function missionTrouvee(votes: number[]): 0 | 1 | 2 {
  const justes = votes.filter((v) => v === 1 || v === 2);
  if (justes.length * 2 <= votes.length) return 0;
  const un = justes.filter((v) => v === 1).length;
  return un >= justes.length - un ? 1 : 2;
}

// ——— Le Parieur : pari mutuel ———

export interface Mise {
  uid: string;
  mise: number; // 1 à 3
  cote: 'reussite' | 'echec';
}

/**
 * Gains et pertes d'un tour du Parieur (vrais points).
 * Les gagnants récupèrent leur mise et se partagent les mises des perdants au prorata de leur mise (arrondi),
 * avec un gain plafonné au double de la mise ; le surplus est rendu aux perdants.
 * Si tout le monde a parié du même côté, personne ne gagne ni ne perd.
 * Le joueur défié gagne 1 pt par joueur qui a parié sur sa réussite (5 max) s'il réussit.
 */
export function pariMutuel(mises: Mise[], reussi: boolean, defie: string): Record<string, number> {
  const res: Record<string, number> = { [defie]: 0 };
  for (const m of mises) res[m.uid] = 0;
  const cote = reussi ? 'reussite' : 'echec';
  const gagnants = mises.filter((m) => m.cote === cote);
  const perdants = mises.filter((m) => m.cote !== cote);
  if (reussi) res[defie] = Math.min(5, mises.filter((m) => m.cote === 'reussite').length);
  if (!gagnants.length || !perdants.length) return res;
  const pot = perdants.reduce((t, m) => t + m.mise, 0);
  const totalGagnants = gagnants.reduce((t, m) => t + m.mise, 0);
  let distribue = 0;
  for (const g of gagnants) {
    const gain = Math.min(2 * g.mise, Math.round((pot * g.mise) / totalGagnants));
    res[g.uid] = gain;
    distribue += gain;
  }
  // Les perdants ne paient que ce qui a été distribué, au prorata de leur mise.
  for (const p of perdants) res[p.uid] = -Math.round((distribue * p.mise) / pot);
  return res;
}

/** Le Juste Prix : le ou les plus proches gagnent la manche. */
export function plusProches(estimations: Record<string, number>, vrai: number): string[] {
  const ecarts = Object.entries(estimations).map(([u, e]) => [u, Math.abs(e - vrai)] as const);
  if (!ecarts.length) return [];
  const min = Math.min(...ecarts.map(([, e]) => e));
  return ecarts.filter(([, e]) => e === min).map(([u]) => u);
}

/** L'Imposteur : démasqué s'il a strictement le plus de votes. */
export function resultatImposteur(votes: Record<string, string>, imposteur: string, uids: string[]): Record<string, number> {
  const compte: Record<string, number> = {};
  for (const cible of Object.values(votes)) compte[cible] = (compte[cible] ?? 0) + 1;
  const max = Math.max(0, ...Object.values(compte));
  const demasque = (compte[imposteur] ?? 0) === max && max > 0 && Object.values(compte).filter((n) => n === max).length === 1;
  const pts: Record<string, number> = Object.fromEntries(uids.map((u) => [u, 0]));
  if (!demasque) pts[imposteur] = 3;
  else for (const [u, cible] of Object.entries(votes)) if (cible === imposteur && u !== imposteur) pts[u] = 1;
  return pts;
}
