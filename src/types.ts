// Types partagés : la forme des données dans Firebase.

export type Duree = 4 | 6 | 8;
export type ModeChoix = 'roue' | 'vote';
export type Niveau = 'soft' | 'epice' | 'hot';
/** facile : un seul coup simple ; difficile : un coup difficile ; longue : toute la soirée ou plusieurs fois. */
export type Difficulte = 'facile' | 'difficile' | 'longue';
export type TypeMission = 'vie' | 'jeu';

export type Phase =
  | 'salon'
  | 'missions' // choix de la 1re mission
  | 'choixJeu' // roue ou vote
  | 'regles' // règles du jeu tiré : chacun appuie sur « Je suis prêt »
  | 'jeu' // un mini-jeu en cours
  | 'flash' // après chaque jeu : les missions flash sont révélées et votées
  | 'classement' // classement provisoire entre deux jeux
  | 'detective'
  | 'revelation'
  | 'fin';

export interface Infos {
  hote: string; // uid du téléphone qui pilote
  duree: Duree;
  modeChoix: ModeChoix;
  creeLe: number;
  /** Saison choisie par l'hôte (facultatif). */
  saison?: string;
  nomSaison?: string;
  /** Mémoire du groupe sans saison : contenus déjà joués dans ce salon (survit à « Rejouer »). */
  memoire?: Record<string, boolean>;
}

export interface Joueur {
  prenom: string;
  nomCode: string;
  couleur: string;
  rejointLe: number;
  connecte: boolean;
  /** Version de l'appli sur ce téléphone (heure de construction). */
  version?: number;
}

export interface Deroule {
  phase: Phase;
  numeroJeu: number; // 0 avant le premier jeu, puis 1, 2, …
  partieId?: string; // identifiant de la partie (évite de la compter deux fois dans la saison)
  jeuxJoues?: string[];
  jeuEnCours?: string; // id du mini-jeu
  propositions?: string[]; // mode vote : les jeux proposés
  roue?: { gagnant: string; options: string[]; lanceLe: number }; // mode roue
  vanne?: string; // vanne du narrateur affichée au classement
  dernierJeu?: { id: string; points: Record<string, number>; sorte: 'place' | 'reels'; resume?: string };
  finChrono?: number; // horodatage serveur (ms)
  revelation?: EtatRevelation;
  bilan?: Bilan;
  /** Missions flash : graine publiée au début de chaque jeu (chaque téléphone en déduit s'il est porteur). */
  /** `joueurs` : les joueurs présents au tirage (un absent ne peut pas être le seul porteur). */
  flashTirage?: { numero: number; graine: number; nb: number; joueurs?: string[] };
  /** Missions flash : révélation et vote après le jeu. */
  flash?: EtatFlash;
}

export interface EtatFlash {
  numero: number; // numéro du jeu
  etape: 'grillage' | 'collecte' | 'vote' | 'resultat'; // grillage : dernière chance d'appuyer sur GRILLÉ !
  fin?: number;
  porteurs?: string[];
  resultats?: Record<string, boolean>;
}

export interface EtatRevelation {
  ordre: string[]; // uids dans l'ordre de passage
  index: number;
  etape: 'recit' | 'vote' | 'detective' | 'mensonges' | 'resultat';
  fin?: number;
  paris?: { de: string; texte: string }[]; // suppositions visant le joueur en cours
  /** Accusations GRILLÉ ! auxquelles le joueur en cours a répondu « Raté » : a-t-il menti ? */
  mensonges?: { cle: string; de: string; texte: string }[];
}

/** Pari détective, écrit en secret (lisible par son auteur et l'hôte seulement). */
export interface Pari {
  cible?: string;
  texte?: string;
  passe?: boolean;
}

export interface Bilan {
  missions: Record<string, { difficulte: Difficulte; reussie: boolean; texte: string }[]>;
  paris: { de: string; cible: string; texte: string; trouvee: Difficulte | null }[];
  /** Mensonges découverts à la révélation (accusé qui avait répondu « Raté » à tort). */
  mensonges?: { de: string; cible: string; texte: string }[];
  titres: { uid: string; titre: string; pourquoi: string }[];
  /** Qui a découvert la mission de qui (bouton GRILLÉ !, pari détective, mensonge) : la rancune de la saison. */
  grilleurs?: Record<string, string[]>;
}

export interface Mission {
  id: string;
  type: TypeMission;
  difficulte: Difficulte;
  niveau: Niveau;
  categorie: string;
  texte: string; // avec {cible}
}

export interface MissionTiree {
  id: string;
  type: TypeMission;
  difficulte: Difficulte;
  texte: string; // {cible} déjà remplacé
  cible?: string; // uid
  /** Mission de vengeance (saisons) : vaut ×1,5. */
  vengeance?: boolean;
}

/** Ce que seul le joueur peut lire : secrets/{code}/{uid}. */
export interface Secrets {
  propositions1?: MissionTiree[];
  mission1?: MissionTiree;
  /** Missions flash reçues, par jeu (clé « j{numeroJeu} »). */
  flash?: Record<string, { id: string; jeu: string; texte: string; cible?: string }>;
  /** Réponse à l'offre de vengeance : uid de la cible, ou « non ». */
  vengeanceChoix?: string;
}

/** Points de la partie, écrits par l'hôte. */
export interface Score {
  jeux: number; // points de place cumulés
  parieur: number; // vrais points gagnés/perdus au Parieur
  missions: number; // révélés à la fin seulement
  detective: number;
  /** Points du bouton GRILLÉ ! (vols, accusations ratées, mensonges démasqués). */
  grille?: number;
  /** Points des missions flash (publics dès le vote, juste après chaque jeu). */
  flash?: number;
  detail?: Record<string, number>; // points par jeu (clé : numéro du jeu)
}
