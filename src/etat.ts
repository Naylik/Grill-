// L'état de l'appli sur ce téléphone : ce qu'on lit dans Firebase + ce qui est propre à l'écran.
import { ref, onValue, type Unsubscribe } from 'firebase/database';
import { db } from './firebase';
import { DELAI_REPRISE_HOTE, quiDoitReprendre, reprendreLaMain, signalerPresence } from './salon';
import type { Deroule, Infos, Joueur, Score, Secrets } from './types';

export interface Etat {
  uid: string;
  code: string | null;
  infos: Infos | null;
  joueurs: Record<string, Joueur>;
  deroule: Deroule | null;
  jeu: Record<string, unknown> | null;
  scores: Record<string, Score>;
  compteurs: Record<string, number>;
  revelation: Record<string, unknown>;
  votes: Record<string, Record<string, unknown>>;
  secrets: Secrets;
  monMot: string | null; // L'Imposteur
  /** Réponses de tous les joueurs : seul l'hôte a le droit de les lire. */
  reponses: Record<string, Record<string, unknown>>;
  charge: boolean;
  // Propre à ce téléphone
  onglet: 'partie' | 'missions';
  masque: boolean;
  erreur: string | null;
}

export const S: Etat = {
  uid: '', code: null, infos: null, joueurs: {}, deroule: null, jeu: null, scores: {}, compteurs: {},
  revelation: {}, votes: {}, secrets: {}, monMot: null, reponses: {}, charge: false,
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

let abonnements: Unsubscribe[] = [];
let abonnementReponses: Unsubscribe | null = null;
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
  abonnements.push(signalerPresence(S.uid, code));
}

export function quitterEcoute(): void {
  abonnements.forEach((f) => f());
  abonnements = [];
  abonnementReponses?.();
  abonnementReponses = null;
  if (minuterieReprise) clearTimeout(minuterieReprise);
  Object.assign(S, {
    code: null, infos: null, joueurs: {}, deroule: null, jeu: null, scores: {}, compteurs: {},
    revelation: {}, votes: {}, secrets: {}, monMot: null, reponses: {}, onglet: 'partie', masque: false,
  });
  localStorage.removeItem('grille:salon');
}

/** Gère qui pilote : l'hôte lit les réponses ; si l'hôte disparaît, un autre reprend la main. */
function surveillerHote(): void {
  if (!S.code || !S.infos) return;
  // Seul l'hôte écoute les réponses (les règles Firebase l'interdisent aux autres).
  if (estHote() && !abonnementReponses) {
    abonnementReponses = onValue(ref(db, `salons/${S.code}/reponses`), (s) => {
      S.reponses = s.val() ?? {};
      changement();
    });
  } else if (!estHote() && abonnementReponses) {
    abonnementReponses();
    abonnementReponses = null;
    S.reponses = {};
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
