// Le bouton « GRILLÉ ! » : pendant la partie, un joueur peut accuser quelqu'un (1 fois par manche) en écrivant
// ce qu'il croit être sa mission. Seul l'accusé voit sa proposition à côté de ses vraies missions et répond
// « Il m'a eu » ou « Raté » : sa mission ne sort donc jamais de son téléphone si l'accusation est fausse.
//  - « Il m'a eu » : sa mission s'affiche chez tout le monde, le groupe vote pour confirmer. Confirmé = mission
//    grillée (ratée), l'accuseur lui vole des points. Sinon, l'accuseur perd 2 points.
//  - « Raté » : tout le monde voit la proposition (pas la mission), l'accuseur perd 2 points. Si l'accusé a menti,
//    ça se voit à la révélation finale : il perd 3 points et l'accuseur récupère son dû.
// Données : salons/{code}/accusations/{numeroJeu}/{uid de l'accuseur}. Seul l'hôte tranche (statut, points).
import { majoriteOui, VOL_DETECTIVE } from './score';
import { VOL_FLASH } from './flash';
import type { Difficulte, Phase, Score } from './types';

export const DELAI_REPONSE = 45_000; // l'accusé ne répond pas : accusation annulée
export const DUREE_VOTE_GRILLE = 30_000;
export const DUREE_VERDICT = 7_000; // le temps d'afficher « GRILLÉ ! » ou « RATÉ » sur tous les écrans
export const PENALITE_ACCUSATION = 2;
export const PENALITE_MENSONGE = 3;
/** Jeux d'action : le bouton disparaît pendant les manches (on tape vite, on ne doit pas accuser par erreur). */
const JEUX_ACTION: Record<string, string[]> = { reflexe: ['attente'], timing: ['chrono'], patate: ['jeu'], telephone: ['etape'], mines: ['pose', 'tour'], territoires: ['roue'], telepathie: ['decompte', 'mot'] };

export interface MissionDevoilee {
  numero: number; // 1 = la grosse mission ; 100 + numéro du jeu = une mission flash
  texte: string;
  difficulte: Difficulte;
}

export interface Accusation {
  cible: string;
  texte: string;
  le: number;
  reponse?: 'eu' | 'rate';
  mission?: MissionDevoilee; // écrite par l'accusé s'il avoue
  statut?: 'vote' | 'grille' | 'rate' | 'annulee' | 'close';
  /** Verdict gardé une fois l'accusation close. */
  verdict?: 'grille' | 'rate';
  fin?: number;
}

export type Accusations = Record<string, Record<string, Accusation>>;

export interface AccusationListee extends Accusation {
  cle: string; // « numeroJeu-uid » : sert aussi de sujet de vote
  numeroJeu: number;
  de: string;
}

export function liste(accs: Accusations | null | undefined): AccusationListee[] {
  const res: AccusationListee[] = [];
  for (const [n, parAccuseur] of Object.entries(accs ?? {})) {
    for (const [de, a] of Object.entries(parAccuseur ?? {})) {
      if (a?.cible) res.push({ ...a, cle: `${n}-${de}`, numeroJeu: Number(n), de });
    }
  }
  return res.sort((a, b) => a.le - b.le);
}

const terminee = (a: Accusation) => a.statut === 'close' || a.statut === 'annulee';

/** L'accusation en cours (une seule à la fois), y compris pendant l'affichage du verdict. */
export function accusationEnCours(accs: Accusations | null | undefined): AccusationListee | null {
  return liste(accs).find((a) => !terminee(a)) ?? null;
}

/** Missions grillées en direct, par joueur : numéro de mission → uid de celui qui l'a grillée. */
export function missionsGrillees(accs: Accusations | null | undefined, uid: string): Record<number, string> {
  const res: Record<number, string> = {};
  for (const a of liste(accs)) {
    if (a.cible === uid && a.mission && (a.statut === 'grille' || a.verdict === 'grille')) res[a.mission.numero] = a.de;
  }
  return res;
}

/** Accusations « Raté » (réponse de l'accusé) visant ce joueur : à vérifier à la révélation finale. */
export function accusationsADoubler(accs: Accusations | null | undefined, uid: string): AccusationListee[] {
  return liste(accs).filter((a) => a.cible === uid && a.reponse === 'rate');
}

export interface Contexte {
  phase: Phase;
  numeroJeu: number;
  jeuEnCours?: string;
  phaseJeu?: string;
}

/** Une manche de jeu d'action est en cours : rien ne doit couvrir l'écran. */
export const mancheAction = (ctx: Contexte): boolean =>
  ctx.phase === 'jeu' && !!ctx.jeuEnCours && !!JEUX_ACTION[ctx.jeuEnCours]?.includes(ctx.phaseJeu ?? '');

/** Le bouton GRILLÉ ! est-il proposé à ce joueur maintenant ? */
export function peutAccuser(uid: string, ctx: Contexte, accs: Accusations | null | undefined, nbJoueurs: number): boolean {
  if (nbJoueurs < 2 || ctx.numeroJeu < 1) return false;
  if (!['choixJeu', 'regles', 'jeu', 'classement', 'miPartie'].includes(ctx.phase)) return false;
  if (mancheAction(ctx)) return false;
  if (accusationEnCours(accs)) return false;
  return !accs?.[ctx.numeroJeu]?.[uid];
}

/**
 * Ce que l'hôte doit écrire pour faire avancer l'accusation en cours (ou null s'il n'y a rien à faire).
 * Fonction pure : les écritures sont relatives au salon.
 */
export function piloterAccusations(opts: {
  accs: Accusations | null | undefined;
  votes: Record<string, Record<string, unknown>>;
  connectes: string[];
  maintenant: number;
  scores: Record<string, Score>;
  /** Manche de jeu d'action en cours : les délais de réponse et de vote sont repoussés. */
  pause?: boolean;
}): Record<string, unknown> | null {
  const a = accusationEnCours(opts.accs);
  if (!a) return null;
  const chemin = `accusations/${a.numeroJeu}/${a.de}`;
  const grille = (u: string) => opts.scores[u]?.grille ?? 0;
  const now = opts.maintenant;
  if (opts.pause) {
    // Garder au moins 15 s après la manche (on repousse de 25 s quand il en reste moins de 15).
    if (!a.reponse && a.le + DELAI_REPONSE - now < 15_000) return { [`${chemin}/le`]: now + 25_000 - DELAI_REPONSE };
    if (a.statut === 'vote' && (a.fin ?? 0) - now < 15_000) return { [`${chemin}/fin`]: now + 25_000 };
    if (a.statut === 'vote' || !a.reponse) return null;
  }
  if (a.statut === 'grille' || a.statut === 'rate') {
    return now >= (a.fin ?? 0) ? { [`${chemin}/statut`]: 'close', [`${chemin}/verdict`]: a.statut } : null;
  }
  if (!a.reponse) return now >= a.le + DELAI_REPONSE ? { [`${chemin}/statut`]: 'annulee' } : null;
  const rate = () => ({
    [`${chemin}/statut`]: 'rate',
    [`${chemin}/fin`]: now + DUREE_VERDICT,
    [`scores/${a.de}/grille`]: grille(a.de) - PENALITE_ACCUSATION,
  });
  if (a.reponse === 'rate') return rate();
  if (!a.statut) return { [`${chemin}/statut`]: 'vote', [`${chemin}/fin`]: now + DUREE_VOTE_GRILLE };
  // Vote du groupe (sans l'accuseur ni l'accusé).
  const votants = opts.connectes.filter((u) => u !== a.de && u !== a.cible);
  const votes = votants.map((u) => opts.votes[`g-${a.cle}`]?.[u]).filter((v) => v !== undefined);
  if (votes.length < votants.length && now < (a.fin ?? 0)) return null;
  // Personne pour voter (ou personne n'a voté) : l'aveu de l'accusé suffit.
  const confirme = votes.length === 0 || majoriteOui(votes.map((v) => v === true));
  if (!confirme || !a.mission) return rate();
  const vol = a.mission.numero >= 100 ? VOL_FLASH : VOL_DETECTIVE[a.mission.difficulte];
  return {
    [`${chemin}/statut`]: 'grille',
    [`${chemin}/fin`]: now + DUREE_VERDICT,
    [`scores/${a.de}/grille`]: grille(a.de) + vol,
    [`scores/${a.cible}/grille`]: grille(a.cible) - vol,
  };
}
