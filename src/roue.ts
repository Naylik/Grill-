// Roue des territoires : la roue façon « roue de la fortune » (néon), dessinée sur une toile.
// Une part par joueur, proportionnelle à ses parts ; des crans dorés sur le bord et un curseur en haut qui claque
// à chaque cran (tic). La rotation suit l'heure du serveur : la roue tourne pareil sur tous les téléphones.

export interface PartRoue {
  nom: string;
  couleur: string;
  avant: number; // parts au début de l'animation (elles glissent vers « apres »)
  apres: number;
}

export interface EtatRoue {
  parts: PartRoue[];
  pot: number;
  rotation0: number; // angle de départ
  rotation1: number; // angle d'arrivée
  debut: number; // heure serveur du début de la rotation (0 : la roue ne tourne pas)
  duree: number;
  morph: number; // heure serveur du début du changement de taille des parts
}

const CRANS = 32;
const MORPH = 900;
const registre = new Map<string, EtatRoue>();
const memoire = new WeakMap<HTMLCanvasElement, { cran: number; flap: number }>();

let heure = () => Date.now();
let quandTic: () => void = () => undefined;
/** main.ts donne l'heure du serveur et le son du tic. */
export function brancherRoue(h: () => number, tic: () => void): void {
  heure = h;
  quandTic = tic;
}

/** Une roue à afficher ; « cle » identifie son état (à changer quand l'état change). */
export function roueHtml(cle: string, e: EtatRoue): string {
  registre.set(cle, e);
  return `<canvas class="roue-territoires" width="600" height="600" data-roue="${cle}" aria-label="La roue des territoires"></canvas>`;
}

/** Position de la rotation à l'instant t (ralentit comme une vraie roue). */
export function rotationA(e: EtatRoue, t: number): number {
  if (!e.debut || t <= e.debut) return e.rotation0;
  const p = Math.min(1, (t - e.debut) / e.duree);
  return e.rotation0 + (e.rotation1 - e.rotation0) * (1 - Math.pow(1 - p, 4));
}

/** À appeler à chaque image (boucle de main.ts). */
export function animerRoues(): void {
  document.querySelectorAll<HTMLCanvasElement>('canvas[data-roue]').forEach((cv) => {
    const e = registre.get(cv.dataset.roue!);
    if (!e) return;
    const t = heure();
    const rotation = rotationA(e, t);
    let m = memoire.get(cv);
    const cran = Math.floor(rotation / ((Math.PI * 2) / CRANS));
    if (!m) {
      m = { cran, flap: 0 };
      memoire.set(cv, m);
    }
    if (cran !== m.cran) {
      m.cran = cran;
      m.flap = -0.55;
      if (e.debut && t < e.debut + e.duree) quandTic();
    }
    m.flap *= 0.82;
    const pm = e.morph ? Math.min(1, Math.max(0, (t - e.morph) / MORPH)) : 1;
    const doux = 1 - Math.pow(1 - pm, 3);
    dessiner(cv, e, rotation, m.flap, doux);
  });
}

function dessiner(cv: HTMLCanvasElement, e: EtatRoue, rotation: number, flap: number, doux: number): void {
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  const W = cv.width;
  const C = W / 2 + 18;
  const R = W * 0.39;
  ctx.clearRect(0, 0, W, W);
  ctx.beginPath();
  ctx.arc(C, C, R + 16, 0, Math.PI * 2);
  ctx.fillStyle = '#1A1438';
  ctx.fill();
  const tailles = e.parts.map((p) => Math.max(0.0001, p.avant + (p.apres - p.avant) * doux));
  const total = tailles.reduce((s, x) => s + x, 0);
  let a = rotation;
  e.parts.forEach((p, i) => {
    const da = (tailles[i] / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(C, C);
    ctx.arc(C, C, R, a, a + da);
    ctx.closePath();
    ctx.fillStyle = p.couleur;
    ctx.shadowColor = p.couleur;
    ctx.shadowBlur = 22;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#0E0A22';
    ctx.stroke();
    const mi = a + da / 2;
    if (da > 0.35) {
      ctx.save();
      ctx.translate(C + Math.cos(mi) * R * 0.66, C + Math.sin(mi) * R * 0.66);
      ctx.rotate(mi + Math.PI / 2);
      ctx.fillStyle = '#0B0A16';
      ctx.font = '800 24px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.nom, 0, 8);
      ctx.restore();
    }
    a += da;
  });
  // Les crans dorés.
  for (let k = 0; k < CRANS; k++) {
    const ca = rotation + (k / CRANS) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(C + Math.cos(ca) * (R + 8), C + Math.sin(ca) * (R + 8), 6, 0, Math.PI * 2);
    ctx.fillStyle = '#FFF6EA';
    ctx.shadowColor = '#FFD84A';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  // Le moyeu et la cagnotte.
  ctx.beginPath();
  ctx.arc(C, C, R * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = '#0E0A22';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#FFD84A';
  ctx.stroke();
  ctx.fillStyle = '#FFD84A';
  ctx.textAlign = 'center';
  ctx.font = '700 46px "JetBrains Mono", ui-monospace, monospace';
  ctx.fillText(String(e.pot), C, C + 8);
  ctx.font = '800 14px Unbounded, sans-serif';
  ctx.fillText('PTS', C, C + 34);
  // Le curseur en haut, qui pivote quand un cran le frappe.
  ctx.save();
  ctx.translate(C, C - R - 34);
  ctx.rotate(flap);
  ctx.beginPath();
  ctx.moveTo(-18, 0);
  ctx.lineTo(18, 0);
  ctx.lineTo(0, 46);
  ctx.closePath();
  ctx.fillStyle = '#FFD84A';
  ctx.shadowColor = '#FFD84A';
  ctx.shadowBlur = 18;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fillStyle = '#0E0A22';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#FFD84A';
  ctx.stroke();
  ctx.restore();
}

/**
 * Où s'arrêter pour que le curseur (en haut) tombe dans la part du gagnant : l'hôte tire le gagnant au hasard
 * selon les parts, puis un point au hasard dans sa part, et ajoute 6 à 8 tours complets.
 */
export function tirerArret(parts: number[], rotation0: number, hasard: () => number): { gagnant: number; rotation1: number } {
  const total = parts.reduce((s, x) => s + x, 0);
  let r = hasard() * total;
  let gagnant = 0;
  while (gagnant < parts.length - 1 && r >= parts[gagnant]) {
    r -= parts[gagnant];
    gagnant++;
  }
  const debutPart = (parts.slice(0, gagnant).reduce((s, x) => s + x, 0) / total) * Math.PI * 2;
  const largeur = (parts[gagnant] / total) * Math.PI * 2;
  const cible = debutPart + largeur * (0.15 + 0.7 * hasard()); // angle dans la roue, loin des bords
  const tour = Math.PI * 2;
  const fin = -Math.PI / 2 - cible; // le curseur est en haut
  const base = rotation0 + (((fin - rotation0) % tour) + tour) % tour;
  return { gagnant, rotation1: base + tour * (6 + Math.floor(hasard() * 3)) };
}

/** Part de la roue qui se trouve sous le curseur pour une rotation donnée (sert aux tests). */
export function partSousCurseur(parts: number[], rotation: number): number {
  const total = parts.reduce((s, x) => s + x, 0);
  const tour = Math.PI * 2;
  const ang = (((-Math.PI / 2 - rotation) % tour) + tour) % tour;
  let acc = 0;
  for (let k = 0; k < parts.length; k++) {
    acc += (parts[k] / total) * tour;
    if (ang < acc) return k;
  }
  return parts.length - 1;
}
