// Les sons de Grillé ! : fabriqués par le navigateur (Web Audio), aucun fichier à télécharger.
// Activés par défaut ; le choix « son coupé » est mémorisé sur le téléphone.

let ctx: AudioContext | null = null;
let actif = lire();

function lire(): boolean {
  try {
    return localStorage.getItem('grille:son') !== 'coupe';
  } catch {
    return true;
  }
}

export const sonActif = (): boolean => actif;

export function basculerSon(): boolean {
  actif = !actif;
  try {
    localStorage.setItem('grille:son', actif ? 'actif' : 'coupe');
  } catch {
    /* pas grave */
  }
  if (actif) void debloquer();
  return actif;
}

/** Vidéo « Grillé ! » : pendant l'enregistrement, les sons partent aussi dans la vidéo (même son coupé). */
let sortieVideo: GainNode | null = null;

export function ouvrirSortieVideo(): MediaStream | null {
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    const dest = ctx.createMediaStreamDestination();
    // Dans la vidéo, les bruitages restent discrets (moitié moins forts).
    sortieVideo = ctx.createGain();
    sortieVideo.gain.value = 0.45;
    sortieVideo.connect(dest);
    return dest.stream;
  } catch {
    return null;
  }
}
export function fermerSortieVideo(): void {
  sortieVideo = null;
}
/** Vers le haut-parleur (si le son est actif) et vers la vidéo (si on enregistre). */
function brancher(c: AudioContext, n: AudioNode): void {
  if (actif) n.connect(c.destination);
  if (sortieVideo) n.connect(sortieVideo);
}

function audio(): AudioContext | null {
  if (!actif && !sortieVideo) return null;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Les téléphones n'autorisent le son qu'après un premier appui : on « débloque » l'audio à ce moment-là. */
export async function debloquer(): Promise<void> {
  const c = audio();
  if (!c) return;
  try {
    await c.resume();
    // Un son muet très court : nécessaire sur iPhone pour autoriser les suivants.
    const o = c.createOscillator();
    const g = c.createGain();
    g.gain.value = 0;
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + 0.01);
  } catch {
    /* pas grave */
  }
}

function note(f: number, debut: number, duree: number, type: OscillatorType = 'sine', volume = 0.22): void {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + debut;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(volume, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
  brancher(c, o.connect(g));
  o.start(t);
  o.stop(t + duree + 0.05);
}

function bruit(debut: number, duree: number, de: number, vers: number, volume = 0.45): void {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + debut;
  const tampon = c.createBuffer(1, Math.floor(c.sampleRate * duree), c.sampleRate);
  const d = tampon.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource();
  s.buffer = tampon;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(de, t);
  f.frequency.exponentialRampToValueAtTime(vers, t + duree);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(volume, t + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duree * 0.95);
  brancher(c, s.connect(f).connect(g));
  s.start(t);
}

export const sons = {
  /** Pschhh de grillade. */
  pschhh(debut = 0): void {
    bruit(debut, 1.3, 5000, 1800);
  },
  /** Grillé ! : la grillade, puis une petite musique qui descend (synchronisée avec l'animation). */
  grille(): void {
    sons.pschhh(0.3);
    [392, 370, 349, 330].forEach((f, i) => note(f, 1.4 + i * 0.3, i === 3 ? 0.7 : 0.3, 'sawtooth', 0.1));
  },
  /** La roue qui tourne et ralentit (environ 4 s, comme l'animation). */
  roue(): void {
    let t = 0;
    for (let i = 0; i < 24; i++) {
      t += 0.04 + i * i * 0.0011;
      note(1600, t, 0.03, 'square', 0.06);
    }
    note(880, t + 0.15, 0.4, 'triangle', 0.22);
  },
  /** Ding : réponse ou vote enregistré. */
  ding(): void {
    note(988, 0, 0.18, 'sine', 0.2);
    note(1319, 0.08, 0.3, 'sine', 0.16);
  },
  /** Tic des 5 dernières secondes du chrono. */
  tic(dernier = false): void {
    note(dernier ? 660 : 1100, 0, dernier ? 0.25 : 0.05, 'square', dernier ? 0.12 : 0.06);
  },
  /** Jingle du podium. */
  podium(): void {
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) => note(f, i * 0.13, i === 5 ? 0.7 : 0.18, 'triangle', 0.22));
  },
  /** Bouton GRILLÉ ! : une accusation tombe (petite sirène). */
  accusation(): void {
    [0, 1, 2].forEach((i) => {
      note(880, i * 0.32, 0.15, 'square', 0.09);
      note(660, i * 0.32 + 0.16, 0.15, 'square', 0.09);
    });
  },
  /** Accusation ratée : « wouah wouah » qui descend. */
  rate(): void {
    [392, 349, 311].forEach((f, i) => note(f, i * 0.22, i === 2 ? 0.5 : 0.2, 'triangle', 0.18));
  },
  /** La Patate : explosion (gros souffle grave). */
  boum(): void {
    bruit(0, 1.1, 900, 80, 0.8);
    note(70, 0, 0.6, 'sawtooth', 0.25);
  },
  /** Roue des territoires : un cran qui claque contre le curseur. */
  cran(): void {
    note(1700 + Math.random() * 300, 0, 0.035, 'square', 0.05);
  },
  /** La Patate : tic-tac de la mèche. */
  meche(): void {
    note(2200, 0, 0.03, 'square', 0.035);
  },
  /** Mission réussie : petit arpège joyeux. */
  reussi(): void {
    [659, 784, 1047].forEach((f, i) => note(f, i * 0.09, 0.22, 'triangle', 0.2));
  },
};
