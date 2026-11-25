// Version de l'appli et mise à jour forcée.
import { joueurTest } from './joueurTest';
// Chaque téléphone publie sa version dans le salon. Si un autre joueur a une version plus récente,
// ce téléphone se met à jour tout seul (sinon il pourrait ne pas connaître un nouveau mini-jeu et rester bloqué).
declare const __VERSION__: number;
export const VERSION: number = typeof __VERSION__ === 'number' ? __VERSION__ : 0;

let enregistrement: ServiceWorkerRegistration | undefined;
export function retenirEnregistrement(r: ServiceWorkerRegistration | undefined): void {
  enregistrement = r;
}

/** Va chercher la nouvelle version et recharge la page (la partie reprend toute seule après). */
export async function mettreAJour(): Promise<void> {
  try {
    await enregistrement?.update();
  } catch {
    /* hors ligne : on recharge quand même */
  }
  // En mode « mise à jour automatique », la page se recharge d'elle-même quand la nouvelle version prend la main ;
  // sinon, on recharge après un court délai.
  setTimeout(() => location.reload(), 2500);
}

/** Une version plus récente est utilisée par un autre joueur du salon : on se met à jour (une fois par version). */
export function verifierVersion(versions: (number | undefined)[]): void {
  const max = Math.max(0, ...versions.filter((v): v is number => typeof v === 'number'));
  if (!VERSION || max <= VERSION) return;
  // Table virtuelle : pas de rechargement automatique (4 téléphones qui redémarrent ensemble dans le même navigateur).
  if (joueurTest !== null) return;
  try {
    if (sessionStorage.getItem('grille:maj') === String(max)) return;
    sessionStorage.setItem('grille:maj', String(max));
  } catch {
    return;
  }
  void mettreAJour();
}
