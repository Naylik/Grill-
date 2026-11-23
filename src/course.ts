// Réflexe Mallow : la course rejouée au ralenti. Tout le monde part quand Mallow prend feu et avance au même
// rythme que le chrono ; chaque pastille s'arrête net au temps de réaction du joueur. Le premier arrêté gagne.
// Ce module ne dépend de rien : le même minutage sert à l'écran (animations.ts) et aux sons (effets.ts).

/** Écart (ms) sous lequel les deux premiers sont à la photo-finish : la course passe au ralenti entre eux. */
export const PHOTO_FINISH = 40;
const ATTENTE = 500; // ms avant le départ
const DUREE_MAX = 3200; // ms réelles pour aller jusqu'au dernier arrêt (hors ralenti)
const LENT_MAX = 7.5; // au plus 7,5 ms réelles par ms de chrono
const RALENTI = 0.2; // vitesse pendant le ralenti (5 fois plus lent)

export interface MinutageCourse {
  /** Temps du chrono (ms) affiché `reel` ms après l'apparition de l'écran. */
  chrono: (reel: number) => number;
  /** Moment réel (ms) où chaque temps est atteint (même ordre que les temps donnés). */
  arrets: number[];
  /** Ralenti [début, fin] en ms réelles, ou null. */
  ralenti: [number, number] | null;
  /** Fin de la course (dernier arrêt), en ms réelles. */
  fin: number;
  serre: boolean;
}

export function minutageCourse(temps: number[]): MinutageCourse {
  const tries = [...temps].sort((a, b) => a - b);
  const max = tries[tries.length - 1] ?? 0;
  const lent = Math.min(LENT_MAX, DUREE_MAX / Math.max(1, max));
  const serre = tries.length >= 2 && tries[1] - tries[0] <= PHOTO_FINISH;
  // Ralenti en temps du chrono : un peu avant le 1er, jusqu'à juste après le 2e.
  const a = serre ? Math.max(0, tries[0] - 45) : Infinity;
  const b = serre ? tries[1] + 8 : Infinity;
  const versReel = (v: number): number => {
    if (v <= a) return ATTENTE + v * lent;
    const debutLent = ATTENTE + a * lent;
    if (v <= b) return debutLent + ((v - a) * lent) / RALENTI;
    return debutLent + ((b - a) * lent) / RALENTI + (v - b) * lent;
  };
  const chrono = (reel: number): number => {
    const r = reel - ATTENTE;
    if (r <= 0) return 0;
    if (r <= a * lent) return r / lent;
    const dureeLente = ((b - a) * lent) / RALENTI;
    if (r <= a * lent + dureeLente) return a + ((r - a * lent) * RALENTI) / lent;
    return b + (r - a * lent - dureeLente) / lent;
  };
  return { chrono, arrets: temps.map(versReel), ralenti: serre ? [versReel(a), versReel(b)] : null, fin: versReel(max), serre };
}
