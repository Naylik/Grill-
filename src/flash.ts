// Missions flash : à chaque jeu, 1 joueur (2 à partir de 5 joueurs) reçoit en secret une petite mission liée à CE jeu.
// L'hôte ne choisit pas les missions : il publie seulement une « graine » au début du jeu. Chaque téléphone en déduit
// tout seul s'il est tiré au sort et quelle mission il reçoit, puis l'écrit dans ses secrets (lisibles par lui seul).
// À la fin du jeu, les porteurs révèlent leur mission et le groupe vote : réussie = +3 pts.
// Si quelqu'un la grille avant avec le bouton GRILLÉ !, elle est ratée et l'accuseur vole 2 pts.
import banque from './data/flash.json';
import { fraisDabord } from './outils';

export interface MissionFlash {
  id: string;
  jeu: string; // id du mini-jeu
  texte: string; // avec {cible}
}

/** Ce que le porteur garde dans ses secrets (secrets/{code}/{uid}/flash/{numeroJeu}). */
export interface FlashTiree {
  id: string;
  jeu: string;
  texte: string; // {cible} déjà remplacé
  cible?: string;
}

export const FLASH = banque as MissionFlash[];
export const POINTS_FLASH = 3;
export const VOL_FLASH = 2;
/** Numéro de mission utilisé par le bouton GRILLÉ ! pour une mission flash (1 = la grosse mission). */
export const NUMERO_FLASH = 3;

export const nbPorteurs = (nbJoueurs: number): number => (nbJoueurs >= 5 ? 2 : 1);

/** Petit hachage stable (FNV-1a) : le même texte donne le même nombre sur tous les téléphones. */
export function hacher(texte: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Hasard reproductible à partir d'une graine. */
export function hasardDe(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Les joueurs qui reçoivent une mission flash pour ce jeu (dans l'ordre : rang 0, rang 1). */
export function porteursFlash(graine: number, uids: string[], nb: number): string[] {
  return [...uids].sort((a, b) => hacher(`${graine}:${a}`) - hacher(`${graine}:${b}`) || a.localeCompare(b)).slice(0, nb);
}

/**
 * La mission flash du porteur de rang « rang » : les missions du jeu sont mélangées avec la graine
 * (jamais vues par le groupe d'abord), et chaque rang prend la suivante : deux porteurs n'ont jamais la même.
 * Une mission avec {cible} vise un autre joueur (jamais son coéquipier en jeu d'équipe).
 */
export function tirerFlash(opts: {
  jeu: string;
  graine: number;
  rang: number;
  dejaVus?: Record<string, boolean>;
  cibles: { uid: string; prenom: string }[];
}): FlashTiree | null {
  const hasard = hasardDe(opts.graine);
  const ordre = fraisDabord(FLASH.filter((m) => m.jeu === opts.jeu), opts.dejaVus, hasard);
  const possibles = ordre.filter((m) => !m.texte.includes('{cible}') || opts.cibles.length > 0);
  const m = possibles[opts.rang % Math.max(1, possibles.length)];
  if (!m) return null;
  if (!m.texte.includes('{cible}')) return { id: m.id, jeu: m.jeu, texte: m.texte };
  const cible = opts.cibles[Math.floor(hasardDe(opts.graine + 7919 * (opts.rang + 1))() * opts.cibles.length)];
  return { id: m.id, jeu: m.jeu, texte: m.texte.replaceAll('{cible}', cible.prenom), cible: cible.uid };
}

/** Une mission flash est-elle réussie ? Grillée = ratée ; sinon la majorité des votes (pas de vote = réussie). */
export function flashReussie(votes: boolean[], grillee: boolean): boolean {
  if (grillee) return false;
  if (!votes.length) return true;
  return votes.filter(Boolean).length * 2 > votes.length;
}
