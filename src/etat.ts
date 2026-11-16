// L'état de l'appli sur ce téléphone : ce qu'on lit dans Firebase + ce qui est propre à l'écran.
import { ref, onValue, type Unsubscribe } from 'firebase/database';
import { db } from './firebase';
import { DELAI_REPRISE_HOTE, quiDoitReprendre, reprendreLaMain, signalerPresence } from './salon';
import type { Deroule, Infos, Joueur, Pari, Score, Secrets } from './types';
import type { Reponse } from './games/interface';

export interface Etat {
  uid: string;
  code: string | null;
  infos: Infos | null;
  joueurs: Record<string, Joueur>;
  deroule: Deroule | null;
  jeu: Record<string, unknown> | null;
  scores: Record<string, Score>;
  compteurs: Record<string, number>;
  revelation: Record<string, { missions?: { texte: string; difficulte: 'facile' | 'difficile'; type: string }[] }>;
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
  charge: boolean;
  // Propre à ce téléphone
  onglet: 'partie' | 'missions';
  masque: boolean;
  erreur: string | null;
}

export const S: Etat = {
  uid: '', code: null, infos: null, joueurs: {}, deroule: null, jeu: null, scores: {}, compteurs: {},
  revelation: {}, votes: {}, attente: null, maReponse: null, monPari: null, secrets: {}, monMot: null, reponses: {}, paris: {}, prive: {}, charge: false,
  onglet: 'partie', masque: false, erreur: null,
};

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
  Object.assign(S, {
    code: null, infos: null, joueurs: {}, deroule: null, jeu: null, scores: {}, compteurs: {},
    revelation: {}, votes: {}, attente: null, maReponse: null, monPari: null, secrets: {}, monMot: null, reponses: {}, paris: {}, prive: {}, onglet: 'partie', masque: false,
  });
  localStorage.removeItem('grille:salon');
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
