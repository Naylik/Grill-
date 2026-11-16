// Le salon : créer une partie, la rejoindre, signaler sa présence, reprendre la main si l'hôte part.
import {
  ref, get, set, update, remove, runTransaction, onValue, onDisconnect,
} from 'firebase/database';
import { db, maintenant } from './firebase';
import { codeAleatoire } from './outils';
import { tirerIdentite } from './identite';
import type { Deroule, Duree, Infos, Joueur, ModeChoix } from './types';

export const MIN_JOUEURS = 3;
export const MAX_JOUEURS = 6;
/** Au bout de combien de temps sans nouvelles de l'hôte un autre joueur reprend la main. */
export const DELAI_REPRISE_HOTE = 15_000;

const chemin = (code: string, ...suite: string[]) => ref(db, ['salons', code, ...suite].join('/'));

export class ErreurSalon extends Error {}

export async function creerSalon(uid: string, prenom: string, duree: Duree, modeChoix: ModeChoix): Promise<string> {
  for (let essai = 0; essai < 12; essai++) {
    const code = codeAleatoire();
    const infos: Infos = { hote: uid, duree, modeChoix, creeLe: maintenant() };
    // On réserve le code d'un coup : si un salon récent l'utilise déjà, on en tire un autre.
    const res = await runTransaction(chemin(code, 'infos'), (actuel: Infos | null) => {
      if (actuel && actuel.creeLe > maintenant() - 12 * 3600_000) return undefined;
      return infos;
    });
    if (!res.committed) continue;
    const deroule: Deroule = { phase: 'salon', numeroJeu: 0 };
    const identite = tirerIdentite([]);
    const moi: Joueur = { prenom, ...identite, rejointLe: maintenant(), connecte: true };
    // Remise à zéro (un vieux salon a pu porter ce code) puis inscription de l'hôte.
    await update(chemin(code), {
      deroule, joueurs: { [uid]: moi },
      jeu: null, scores: null, reponses: null, compteurs: null, tirage: null, revelation: null,
      votes: null, paris: null, motsImposteur: null,
    });
    await remove(ref(db, `secrets/${code}`)).catch(() => undefined);
    return code;
  }
  throw new ErreurSalon('Impossible de créer un salon, réessaie.');
}

export async function rejoindreSalon(uid: string, code: string, prenom: string): Promise<void> {
  const infos = (await get(chemin(code, 'infos'))).val() as Infos | null;
  if (!infos) throw new ErreurSalon(`Aucune partie avec le code ${code}.`);
  const joueurs = ((await get(chemin(code, 'joueurs'))).val() ?? {}) as Record<string, Joueur>;
  if (joueurs[uid]) {
    // Reconnexion : on retrouve sa place, ses missions et ses points.
    await update(chemin(code, 'joueurs', uid), { connecte: true });
    return;
  }
  const deroule = (await get(chemin(code, 'deroule'))).val() as Deroule | null;
  if (deroule?.phase !== 'salon') throw new ErreurSalon('La partie a déjà commencé sans toi.');
  const liste = Object.values(joueurs);
  if (liste.length >= MAX_JOUEURS) throw new ErreurSalon('Le salon est complet (6 joueurs max).');
  if (liste.some((j) => j.prenom.toLowerCase() === prenom.toLowerCase())) {
    throw new ErreurSalon(`Il y a déjà un ${prenom} ici. Ajoute l'initiale de ton nom !`);
  }
  const moi: Joueur = { prenom, ...tirerIdentite(liste), rejointLe: maintenant(), connecte: true };
  await set(chemin(code, 'joueurs', uid), moi);
}

/** Signale « je suis là » et, à la coupure, « je suis parti » (fait par le serveur Firebase). */
export function signalerPresence(uid: string, code: string): () => void {
  const moi = chemin(code, 'joueurs', uid, 'connecte');
  return onValue(ref(db, '.info/connected'), (s) => {
    if (s.val() !== true) return;
    void onDisconnect(moi).set(false).then(() => set(moi, true)).catch(() => undefined);
  });
}

/** Quitter le salon avant le lancement (pendant la partie, on reste inscrit pour pouvoir revenir). */
export async function quitterSalon(uid: string, code: string, infos: Infos | null, joueurs: Record<string, Joueur>, phase?: string): Promise<void> {
  const autres = Object.entries(joueurs).filter(([id]) => id !== uid).sort((a, b) => a[1].rejointLe - b[1].rejointLe);
  if (infos?.hote === uid && autres.length) await update(chemin(code, 'infos'), { hote: autres[0][0] });
  await onDisconnect(chemin(code, 'joueurs', uid, 'connecte')).cancel();
  if (phase === 'salon') await remove(chemin(code, 'joueurs', uid));
  else await set(chemin(code, 'joueurs', uid, 'connecte'), false);
}

/**
 * Si l'hôte est déconnecté depuis plus de 15 s, le joueur connecté arrivé le plus tôt prend sa place.
 * La transaction garantit qu'un seul téléphone gagne, même si deux essaient en même temps.
 */
export function quiDoitReprendre(infos: Infos, joueurs: Record<string, Joueur>): string | null {
  if (joueurs[infos.hote]?.connecte) return null;
  const candidats = Object.entries(joueurs).filter(([, j]) => j.connecte).sort((a, b) => a[1].rejointLe - b[1].rejointLe);
  return candidats[0]?.[0] ?? null;
}

export async function reprendreLaMain(uid: string, code: string, ancienHote: string): Promise<boolean> {
  const res = await runTransaction(chemin(code, 'infos', 'hote'), (actuel: string | null) =>
    actuel === ancienHote ? uid : undefined,
  );
  return res.committed;
}

export async function changerReglages(code: string, reglages: Partial<Pick<Infos, 'duree' | 'modeChoix'>>): Promise<void> {
  await update(chemin(code, 'infos'), reglages);
}

