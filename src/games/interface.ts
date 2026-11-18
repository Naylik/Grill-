// Interface commune à tous les mini-jeux. Pour ajouter un jeu : un nouveau fichier ici + une ligne dans index.ts.
import type { Joueur } from '../types';

/** Ce que l'hôte connaît quand il fait avancer un jeu. */
export interface ContexteHote {
  joueurs: Record<string, Joueur>;
  uids: string[]; // tous les joueurs de la partie
  connectes: string[]; // ceux qui sont là en ce moment
  maintenant: number;
  numeroJeu: number;
  /** Format choisi dans le salon (4, 6 ou 8 jeux) : il fixe aussi le nombre de tours de chaque jeu. */
  duree?: number;
  /** Mémoire du groupe : identifiants des contenus déjà joués (questions, paires, défis), à éviter. */
  dejaVus?: Record<string, boolean>;
  /** Réponses des joueurs (lisibles par l'hôte seulement), clé = uid. */
  reponses: Record<string, Reponse | undefined>;
  compteurs: Record<string, number>;
  /** Points de la partie avant ce jeu (utile au Parieur, qui mise de vrais points). */
  totaux: Record<string, number>;
  /** Données que seul l'hôte peut lire (ex. qui est l'imposteur). Écrire via ecritures['prive/…']. */
  prive: Record<string, unknown>;
  hasard: () => number;
}

/** Une réponse porte toujours l'étape à laquelle elle répond, pour ignorer les réponses en retard. */
export interface Reponse {
  etape: string;
  [cle: string]: unknown;
}

export interface Fin {
  /** Points ajoutés à la partie, par joueur. */
  points: Record<string, number>;
  /** 'place' = points de place (jeux), 'reels' = vrais points (Le Parieur). */
  sorte: 'place' | 'reels';
  /** Phrase de résumé affichée au classement (facultatif). */
  resume?: string;
}

/** Ce que l'hôte doit écrire : nouvel état public du jeu, écritures annexes, et éventuellement la fin. */
export interface Avancee<E> {
  etat: E;
  /** Écritures supplémentaires, chemins relatifs au salon (ex. « motsImposteur/uid »). */
  ecritures?: Record<string, unknown>;
  fin?: Fin;
}

/** Ce qu'un téléphone voit pour afficher le jeu. */
export interface VueJeu<E> {
  etat: E;
  uid: string;
  estHote: boolean;
  joueurs: Record<string, Joueur>;
  uids: string[];
  maReponse: Reponse | null;
  monMot: string | null;
  compteurs: Record<string, number>;
  totaux: Record<string, number>;
  /** Qui a déjà répondu à l'étape en cours (publié par l'hôte). */
  ontRepondu: string[];
  /** Mémoire locale à ce téléphone (ex. « j'ai répondu oui »), par étape. */
  local: Record<string, unknown>;
}

/** Outils donnés aux actions d'un jeu (côté joueur). */
export interface OutilsJoueur {
  repondre(valeurs: Record<string, unknown>): Promise<void>;
  incrementer(compteur: string): Promise<void>;
  local: Record<string, unknown>;
  rafraichir(): void;
}

export interface EtatDeBase {
  etape: string;
  fin?: number; // fin du chrono (horodatage serveur)
}

export interface MiniJeu<E extends EtatDeBase = EtatDeBase> {
  id: string;
  nom: string;
  accroche: string; // la règle en une phrase
  /** Pour l'écran « Liste des jeux » de l'accueil. */
  explication: { comment: string; gagner: string; note?: string };
  /** Icône (contenu d'un SVG 24 × 24). */
  icone: string;
  couleur: string;
  /** Le jeu peut-il être tiré pour ce numéro de jeu et ce nombre de joueurs ? */
  autorise(numeroJeu: number, nbJoueurs: number): boolean;
  demarrer(ctx: ContexteHote): Avancee<E>;
  /** Appelé souvent chez l'hôte : renvoie une avancée si le jeu doit changer d'étape, sinon null. */
  piloter(ctx: ContexteHote, etat: E): Avancee<E> | null;
  /** Bouton de l'hôte dans le jeu (« Question suivante »…). */
  commande?(ctx: ContexteHote, etat: E, valeur: string): Avancee<E> | null;
  ecran(vue: VueJeu<E>): string;
  /** Écran de règles (avant le jeu, chacun appuie sur « Je suis prêt »). Par défaut : l'explication du jeu. */
  regles?(vue: { uids: string[]; duree: number }): string;
  /** Nombre de tours selon le format, en clair (« 6 questions »), affiché avec les règles. */
  tours?(duree: number): string;
  /** Identifiants des contenus joués (mémoire du groupe : ils ne reviendront pas aux parties suivantes). */
  contenus?(etat: E): string[];
  /** Actions des boutons du jeu (data-action="jeu" data-geste="…"). */
  gestes?: Record<string, (el: HTMLElement, outils: OutilsJoueur, vue: VueJeu<E>) => Promise<void> | void>;
}

/** Nombre de tours selon le format : [Courte, Normale, Longue]. */
export const selonFormat = (duree: number | undefined, [courte, normale, longue]: [number, number, number]): number =>
  duree === 8 ? longue : duree === 6 ? normale : courte;

/** Les réponses valides pour l'étape en cours. */
export function reponsesDe<T = Reponse>(ctx: ContexteHote, etape: string): Record<string, T> {
  const res: Record<string, T> = {};
  for (const uid of ctx.uids) {
    const r = ctx.reponses[uid];
    if (r && r.etape === etape) res[uid] = r as T;
  }
  return res;
}

/** Tout le monde (connecté) a répondu, ou le chrono est fini. */
export function etapeTerminee(ctx: ContexteHote, etape: string, fin?: number, qui: string[] = ctx.uids): boolean {
  const recues = reponsesDe(ctx, etape);
  const attendus = qui.filter((u) => ctx.connectes.includes(u));
  return attendus.every((u) => recues[u]) || (fin !== undefined && ctx.maintenant >= fin);
}
