// L'état de l'appli sur ce téléphone : ce qu'on lit dans Firebase + ce qui est propre à l'écran.
import { ref, onValue, type Unsubscribe } from 'firebase/database';
import { db } from './firebase';
import { DELAI_REPRISE_HOTE, quiDoitReprendre, reprendreLaMain, signalerPresence } from './salon';
import type { Deroule, Infos, Joueur, Pari, Score, Secrets } from './types';
import type { Reponse } from './games/interface';
import type { Accusations } from './accusations';
import { retenirSaison, type Saison } from './saison';

export interface Etat {
  uid: string;
  code: string | null;
  infos: Infos | null;
  joueurs: Record<string, Joueur>;
  deroule: Deroule | null;
  jeu: Record<string, unknown> | null;
  scores: Record<string, Score>;
  compteurs: Record<string, number>;
  revelation: Record<string, { missions?: { id?: string; texte: string; difficulte: 'facile' | 'difficile'; type: string; vengeance?: boolean }[]; flash?: Record<string, { id: string; jeu: string; texte: string }> }>;
  votes: Record<string, Record<string, unknown>>;
  attente: { etape: string; uids: string[] } | null;
  maReponse: Reponse | null;
  monPari: Pari | null;
  secrets: Secrets;
  monMot: string | null; // L'Imposteur
  /** Réponses de tous les joueurs : seul l'hôte a le droit de les lire. */
  reponses: Record<string, Reponse>;
  /** Paris détective de tous : seul l'hôte peut les lire. */
  paris: Record<string, Pari>;
  prive: Record<string, unknown>;
  /** Bouton GRILLÉ ! : accusations de la partie (lisibles par tous, sans les missions sauf aveu). */
  accusations: Accusations;
  /** Saison du salon (si l'hôte en a choisi une). */
  saison: Saison | null;
  /** Vengeance : l'offre qui m'est faite (si je suis le tiré au sort), et l'annonce si quelqu'un veut se venger de moi. */
  offreVengeance: { choix: Record<string, boolean> } | null;
  annonceVengeance: { de: string } | null;
  charge: boolean;
  // Propre à ce téléphone
  onglet: 'partie' | 'missions';
  erreur: string | null;
  /** Petit message temporaire en bas de l'écran (« Lien copié »). */
  toast: string | null;
  /** Le joueur a appuyé sur « Quitter » : on lui demande de confirmer. */
  confirmerQuitter: boolean;
  /** Sur l'accueil : l'accueil lui-même ou la liste des jeux. */
  vueAccueil: 'accueil' | 'jeux';
  /** Image du podium affichée quand le téléphone ne sait pas partager directement. */
  apercuImage: string | null;
  /** Le joueur a ouvert la fenêtre « Accuser quelqu'un ». */
  accuser: boolean;
  /** L'hôte ouvre le choix de la saison dans le salon. */
  menuSaison: boolean;
}

export const S: Etat = {
  uid: '', code: null, infos: null, joueurs: {}, deroule: null, jeu: null, scores: {}, compteurs: {},
  revelation: {}, votes: {}, attente: null, maReponse: null, monPari: null, secrets: {}, monMot: null, reponses: {}, paris: {}, prive: {}, accusations: {}, saison: null, offreVengeance: null, annonceVengeance: null, charge: false,
  onglet: 'partie', erreur: null, toast: null, apercuImage: null, confirmerQuitter: false, vueAccueil: 'accueil', accuser: false, menuSaison: false,
};

/**
 * Mémoire du groupe : missions, questions, paires et défis déjà joués.
 * Dans la saison si l'hôte en a choisi une (elle dure d'une soirée à l'autre), sinon dans le salon (parties enchaînées).
 */
export const memoireDuGroupe = (): Record<string, boolean> =>
  (S.infos?.saison ? S.saison?.memoire : S.infos?.memoire) ?? {};

/** Chemin où l'hôte écrit la mémoire du groupe. */
export const cheminMemoire = (): string | null =>
  S.infos?.saison ? `saisons/${S.infos.saison}/memoire` : S.code ? `salons/${S.code}/infos/memoire` : null;

export const estHote = (): boolean => !!S.infos && S.infos.hote === S.uid;
export const moi = (): Joueur | undefined => S.joueurs[S.uid];

let rafraichir: () => void = () => undefined;
let prevu = false;
/** Redessine au prochain affichage (regroupe les mises à jour qui arrivent ensemble). */
export function demanderAffichage(): void {
  if (prevu) return;
  prevu = true;
  requestAnimationFrame(() => {
    prevu = false;
    rafraichir();
  });
}
export function brancherAffichage(f: () => void): void {
  rafraichir = f;
}

/** Abonnés quand l'état change (utilisé par le pilote de l'hôte). */
const surChangement: (() => void)[] = [];
export function quandCaChange(f: () => void): void {
  surChangement.push(f);
}
function changement(): void {
  demanderAffichage();
  surChangement.forEach((f) => f());
}

/** Données déjà reçues au moins une fois (évite d'agir sur un état pas encore chargé). */
export const charges = new Set<string>();

let abonnements: Unsubscribe[] = [];
let abonnementReponses: Unsubscribe[] | null = null;
let minuterieReprise: ReturnType<typeof setTimeout> | null = null;

export function ecouterSalon(code: string): void {
  quitterEcoute();
  S.code = code;
  S.charge = false;
  localStorage.setItem('grille:salon', code);
  const ecoute = <K extends keyof Etat>(chemin: string, cle: K, vide: Etat[K]) =>
    abonnements.push(
      onValue(
        ref(db, chemin),
        (s) => {
          S[cle] = (s.val() ?? vide) as Etat[K];
          charges.add(cle);
          if (cle === 'deroule') S.charge = true;
          if (cle === 'infos' || cle === 'joueurs') surveillerHote();
          if (cle === 'infos') suivreSaison();
          changement();
        },
        (err) => console.warn('lecture refusée', chemin, err.message),
      ),
    );
  const base = `salons/${code}`;
  ecoute(`${base}/infos`, 'infos', null);
  ecoute(`${base}/joueurs`, 'joueurs', {});
  ecoute(`${base}/deroule`, 'deroule', null);
  ecoute(`${base}/jeu`, 'jeu', null);
  ecoute(`${base}/scores`, 'scores', {});
  ecoute(`${base}/compteurs`, 'compteurs', {});
  ecoute(`${base}/revelation`, 'revelation', {});
  ecoute(`${base}/votes`, 'votes', {});
  ecoute(`${base}/accusations`, 'accusations', {});
  ecoute(`${base}/vengeance/offre/${S.uid}`, 'offreVengeance', null);
  ecoute(`${base}/vengeance/annonce/${S.uid}`, 'annonceVengeance', null);
  ecoute(`secrets/${code}/${S.uid}`, 'secrets', {});
  ecoute(`${base}/motsImposteur/${S.uid}`, 'monMot', null);
  ecoute(`${base}/attente`, 'attente', null);
  ecoute(`${base}/reponses/${S.uid}`, 'maReponse', null);
  ecoute(`${base}/paris/${S.uid}`, 'monPari', null);
  abonnements.push(signalerPresence(S.uid, code));
}

export function quitterEcoute(): void {
  abonnements.forEach((f) => f());
  abonnements = [];
  charges.clear();
  abonnementReponses?.forEach((f) => f());
  abonnementReponses = null;
  if (minuterieReprise) clearTimeout(minuterieReprise);
  abonnementSaison?.();
  abonnementSaison = null;
  saisonSuivie = null;
  Object.assign(S, {
    code: null, infos: null, joueurs: {}, deroule: null, jeu: null, scores: {}, compteurs: {},
    revelation: {}, votes: {}, attente: null, maReponse: null, monPari: null, secrets: {}, monMot: null, reponses: {}, paris: {}, prive: {}, accusations: {}, saison: null, offreVengeance: null, annonceVengeance: null, onglet: 'partie', confirmerQuitter: false, accuser: false, menuSaison: false,
  });
  localStorage.removeItem('grille:salon');
}

// La saison du salon : on la suit dès que l'hôte en choisit une (et on la retient sur ce téléphone).
let abonnementSaison: Unsubscribe | null = null;
let saisonSuivie: string | null = null;
function suivreSaison(): void {
  const id = S.infos?.saison ?? null;
  if (id === saisonSuivie) return;
  abonnementSaison?.();
  abonnementSaison = null;
  saisonSuivie = id;
  S.saison = null;
  if (!id) return;
  if (S.infos?.nomSaison) retenirSaison(id, S.infos.nomSaison);
  abonnementSaison = onValue(
    ref(db, `saisons/${id}`),
    (s) => {
      S.saison = s.val();
      changement();
    },
    (err) => console.warn('saison', err.message),
  );
}

/** Gère qui pilote : l'hôte lit les réponses ; si l'hôte disparaît, un autre reprend la main. */
function surveillerHote(): void {
  if (!S.code || !S.infos) return;
  // Seul l'hôte écoute les réponses (les règles Firebase l'interdisent aux autres).
  if (estHote() && !abonnementReponses) {
    abonnementReponses = [
      onValue(ref(db, `salons/${S.code}/reponses`), (s) => {
        S.reponses = s.val() ?? {};
        changement();
      }),
      onValue(ref(db, `salons/${S.code}/paris`), (s) => {
        S.paris = s.val() ?? {};
        changement();
      }),
      onValue(ref(db, `salons/${S.code}/prive`), (s) => {
        S.prive = s.val() ?? {};
        changement();
      }),
    ];
  } else if (!estHote() && abonnementReponses) {
    abonnementReponses.forEach((f) => f());
    abonnementReponses = null;
    S.reponses = {};
    S.paris = {};
    S.prive = {};
  }
  // Reprise de la main si l'hôte est parti.
  if (minuterieReprise) clearTimeout(minuterieReprise);
  minuterieReprise = null;
  const ancien = S.infos.hote;
  if (quiDoitReprendre(S.infos, S.joueurs) === S.uid) {
    minuterieReprise = setTimeout(() => {
      if (S.code && S.infos?.hote === ancien && quiDoitReprendre(S.infos, S.joueurs) === S.uid) {
        void reprendreLaMain(S.uid, S.code, ancien);
      }
    }, DELAI_REPRISE_HOTE);
  }
}
