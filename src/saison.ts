// Saisons : un groupe d'amis cumule ses points de partie en partie (nom choisi par l'hôte, sans durée).
// - Cuisson : le Mallow de chacun dore selon son nombre de missions réussies dans la saison.
// - Rancune : on retient qui a découvert ta mission à la dernière partie. À la partie suivante, UNE seule personne
//   (tirée au hasard parmi celles qui ont été grillées) peut se venger : sa 1re mission vise son « grilleur » et vaut ×1,5.
// Données : saisons/{id} = { infos, membres/{uid}, rancunes/{uid}/{grilleur}, parties/{partieId} }.
import type { Joueur } from './types';

export interface MembreSaison {
  prenom: string;
  couleur: string;
  points: number;
  missions: number; // missions réussies (fait dorer le Mallow)
  parties: number;
}

export interface Saison {
  infos: { nom: string; createur: string; creeLe: number };
  membres?: Record<string, MembreSaison>;
  rancunes?: Record<string, Record<string, boolean>>;
  parties?: Record<string, boolean>;
  /** Mémoire du groupe : identifiants des missions et contenus déjà joués dans la saison. */
  memoire?: Record<string, boolean>;
}

/** Paliers de cuisson (missions réussies) : Cru, Tiède, Doré, Caramel, Flambé. */
export const PALIERS_CUISSON = [0, 3, 8, 15, 25];

export function niveauCuisson(missions: number): number {
  let n = 0;
  PALIERS_CUISSON.forEach((p, i) => {
    if (missions >= p) n = i;
  });
  return n;
}

/** Missions qu'il manque pour le palier suivant (null au maximum). */
export function avantPalierSuivant(missions: number): number | null {
  const suivant = PALIERS_CUISSON[niveauCuisson(missions) + 1];
  return suivant === undefined ? null : suivant - missions;
}

export const nouvelIdSaison = (hasard = Math.random): string =>
  Array.from({ length: 12 }, () => 'abcdefghijkmnpqrstuvwxyz23456789'[Math.floor(hasard() * 32)]).join('');

export function classementSaison(s: Saison | null): [string, MembreSaison][] {
  return Object.entries(s?.membres ?? {}).sort((a, b) => b[1].points - a[1].points || b[1].missions - a[1].missions);
}

/**
 * Tirage de la vengeance au lancement d'une partie : au plus UNE personne, au hasard parmi les joueurs présents
 * qui ont été grillés à leur dernière partie par quelqu'un qui est là ce soir.
 */
export function tirerVengeance(s: Saison | null, presents: string[], hasard = Math.random): { de: string; choix: string[] } | null {
  const candidats = presents
    .map((u) => ({ de: u, choix: Object.keys(s?.rancunes?.[u] ?? {}).filter((g) => g !== u && presents.includes(g)) }))
    .filter((c) => c.choix.length > 0);
  if (!candidats.length) return null;
  return candidats[Math.floor(hasard() * candidats.length)];
}

/**
 * Écritures (relatives à saisons/{id}) à la fin d'une partie : points cumulés, missions réussies, parties jouées,
 * et la rancune de chacun (remplacée à chaque partie : on ne se venge que de la dernière fois).
 */
export function majSaison(opts: {
  saison: Saison | null;
  partieId: string;
  joueurs: Record<string, Joueur>;
  points: Record<string, number>;
  missionsReussies: Record<string, number>;
  grilleurs: Record<string, string[]>;
}): Record<string, unknown> | null {
  if (opts.saison?.parties?.[opts.partieId]) return null; // déjà comptée
  const e: Record<string, unknown> = { [`parties/${opts.partieId}`]: true };
  for (const [u, j] of Object.entries(opts.joueurs)) {
    const m = opts.saison?.membres?.[u];
    e[`membres/${u}`] = {
      prenom: j.prenom,
      couleur: j.couleur,
      points: (m?.points ?? 0) + (opts.points[u] ?? 0),
      missions: (m?.missions ?? 0) + (opts.missionsReussies[u] ?? 0),
      parties: (m?.parties ?? 0) + 1,
    };
    const g = [...new Set(opts.grilleurs[u] ?? [])].filter((x) => x !== u);
    e[`rancunes/${u}`] = g.length ? Object.fromEntries(g.map((x) => [x, true])) : null;
  }
  return e;
}

// ——— Saisons connues de ce téléphone (pour que l'hôte retrouve la sienne) ———

export interface SaisonConnue {
  id: string;
  nom: string;
}

export function saisonsConnues(): SaisonConnue[] {
  try {
    return JSON.parse(localStorage.getItem('grille:saisons') ?? '[]') as SaisonConnue[];
  } catch {
    return [];
  }
}

export function retenirSaison(id: string, nom: string): void {
  try {
    const liste = saisonsConnues().filter((s) => s.id !== id);
    localStorage.setItem('grille:saisons', JSON.stringify([{ id, nom }, ...liste].slice(0, 8)));
  } catch {
    /* pas grave */
  }
}
