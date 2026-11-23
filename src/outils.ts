// Petits outils sans dépendance (testés dans tests/outils.test.ts).

/** Lettres sans ambiguïté (pas de I, L, O, 0…). */
const LETTRES = 'ABCDEFGHJKMNPQRSTUVWXYZ';

export function codeAleatoire(hasard: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < 4; i++) code += LETTRES[Math.floor(hasard() * LETTRES.length)];
  return code;
}

export function normaliserCode(saisie: string): string {
  return saisie.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
}

/** Mémoire du groupe : les contenus jamais joués d'abord (mélangés), puis les déjà joués s'il en faut encore. */
export function fraisDabord<T extends { id: string }>(liste: readonly T[], dejaVus: Record<string, boolean> | undefined, hasard: () => number = Math.random): T[] {
  return [...melanger(liste.filter((x) => !dejaVus?.[x.id]), hasard), ...melanger(liste.filter((x) => dejaVus?.[x.id]), hasard)];
}

export function melanger<T>(liste: readonly T[], hasard: () => number = Math.random): T[] {
  const copie = [...liste];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(hasard() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
}

export function auHasard<T>(liste: readonly T[], hasard: () => number = Math.random): T {
  return liste[Math.floor(hasard() * liste.length)];
}

/** Échappe le texte saisi par les joueurs avant de l'afficher (évite toute injection de HTML). */
export function esc(texte: unknown): string {
  return String(texte ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function nettoyerPrenom(saisie: string): string {
  const p = saisie.replace(/\s+/g, ' ').trim().slice(0, 16);
  return p.charAt(0).toUpperCase() + p.slice(1);
}

/** Empreinte courte et stable d'un texte (pour réserver une mission sans dévoiler laquelle). */
export async function empreinte(texte: string): Promise<string> {
  const octets = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texte));
  return Array.from(new Uint8Array(octets).slice(0, 12), (o) => o.toString(16).padStart(2, '0')).join('');
}

/** Une phrase au hasard… mais la même sur tous les téléphones (tirée à partir d'une graine commune, ex. l'étape du jeu). */
export function parmi<T>(liste: readonly T[], graine: string): T {
  let h = 0;
  for (let i = 0; i < graine.length; i++) h = (h * 31 + graine.charCodeAt(i)) >>> 0;
  return liste[h % liste.length];
}
