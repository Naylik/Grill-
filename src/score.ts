// Barème de la partie (section « Score et classement » du cahier des charges). Fonctions pures, testées.
import type { Difficulte, Score } from './types';

/** Points de place : 1er 5, 2e 3, 3e 2, au-delà 1. Les ex aequo reçoivent les mêmes points. */
export const POINTS_PLACE = [5, 3, 2];
/** Grosse mission (format normal, 6 jeux). Court ×4/6, long ×8/6 : une mission longue ≈ gagner la moitié des jeux. */
export const POINTS_MISSION: Record<Difficulte, number> = { facile: 6, difficile: 10, longue: 15 };
/** Vol du bouton GRILLÉ ! (ou du pari détective) : à peu près la moitié de la mission. */
export const VOL_DETECTIVE: Record<Difficulte, number> = { facile: 3, difficile: 5, longue: 8 };
export const BONUS_VENGEANCE = 1.5;
/** Points d'une grosse mission selon le format de la soirée (4, 6 ou 8 jeux). */
export const pointsGrosse = (d: Difficulte, duree = 6, vengeance = false): number =>
  Math.round(POINTS_MISSION[d] * (duree / 6) * (vengeance ? BONUS_VENGEANCE : 1));
/** Au Parieur (vrais points), un joueur ne peut ni gagner ni perdre plus que ça sur le jeu entier. */
export const PARIEUR_MAX = 8;
export const PARIEUR_MIN = -6;
export const borneParieur = (n: number): number => Math.max(PARIEUR_MIN, Math.min(PARIEUR_MAX, n));
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

export const pointsMission = (m: ResultatMission, duree = 6): number => (m.reussie ? pointsGrosse(m.difficulte, duree, m.vengeance) : 0);
export interface ResultatPari {
  de: string; // le détective
  cible: string;
  /** Mission trouvée (selon le vote du groupe), ou null si raté. */
  trouvee: Difficulte | null;
}

/** Points de mission et de détective pour tout le monde, à partir des votes de la révélation. */
export function pointsDeFin(missions: Record<string, ResultatMission[]>, paris: ResultatPari[], duree = 6) {
  const missionsPts: Record<string, number> = {};
  const detective: Record<string, number> = {};
  for (const [uid, liste] of Object.entries(missions)) {
    missionsPts[uid] = liste.reduce((t, m) => t + pointsMission(m, duree), 0);
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

/** Un titre possible pour un joueur, avec sa « force » (le meilleur dans la catégorie l'emporte). */
export interface CandidatTitre extends Titre {
  force: number;
}

/** Ordre de priorité des titres : un joueur reçoit le premier titre qu'il mérite le plus. */
export const ORDRE_TITRES = ['Agent secret', 'Vengeur', 'Champion des mini-jeux', 'Sherlock', 'Éclair', 'Menteur démasqué', 'Grillé', 'Le Parano', 'L’Intouchable', 'La Poisse'];

/**
 * Titres de l'écran final : chaque titre va à UN seul joueur (le meilleur de sa catégorie), et chaque joueur en a
 * au plus un. Si le meilleur d'une catégorie a déjà un titre, la catégorie passe (on ne la donne pas au 2e).
 * Ceux qui n'ont rien reçu deviennent « Le Mystérieux ».
 */
export function attribuerTitres(candidats: CandidatTitre[], uids: string[]): Titre[] {
  const res: Titre[] = [];
  const pris = new Set<string>();
  for (const titre of ORDRE_TITRES) {
    const liste = candidats.filter((c) => c.titre === titre && uids.includes(c.uid));
    if (!liste.length) continue;
    const max = Math.max(...liste.map((c) => c.force));
    const gagnant = liste.find((c) => c.force === max && !pris.has(c.uid));
    if (!gagnant) continue;
    pris.add(gagnant.uid);
    res.push({ uid: gagnant.uid, titre: gagnant.titre, pourquoi: gagnant.pourquoi });
  }
  for (const u of uids) if (!pris.has(u)) res.push({ uid: u, titre: 'Le Mystérieux', pourquoi: 'personne n’a rien vu venir…' });
  return res;
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
