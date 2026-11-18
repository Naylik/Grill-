// Dessin au doigt (Dessin téléphone arabe). Un dessin = une liste de traits, chacun une couleur, une épaisseur
// et des points (coordonnées entières de 0 à 999 sur un carré). C'est très léger à envoyer dans Firebase,
// et le dessin se redessine à l'identique sur tous les téléphones.

export interface Trait {
  c: string; // couleur
  w: number; // épaisseur (1 fin, 2 moyen, 3 gros)
  p: number[]; // x0, y0, x1, y1… (0 à 999)
}

export const COULEURS = ['#24123A', '#FF5A6E', '#3B8BFF', '#FFC93C', '#2FCB8E', '#FF8A3D'];
export const GOMME = '#FFFFFF'; // la gomme peint en blanc, plus large
const MAX_POINTS = 3000; // au-delà, on ne prend plus de points (garde l'envoi léger)

/** Dessins en cours sur ce téléphone, par étape du jeu. */
const enCours = new Map<string, Trait[]>();
export const outil = { couleur: COULEURS[0], epaisseur: 2 };

export const traitsDe = (cle: string): Trait[] => enCours.get(cle) ?? [];
export function annuler(cle: string): void {
  traitsDe(cle).pop();
  redessinerTout();
}
export function effacer(cle: string): void {
  enCours.set(cle, []);
  redessinerTout();
}
const nbPoints = (traits: Trait[]) => traits.reduce((n, t) => n + t.p.length / 2, 0);

/** Dessine des traits sur une toile (fond blanc). */
export function peindre(toile: HTMLCanvasElement, traits: Trait[]): void {
  const ctx = toile.getContext('2d');
  if (!ctx) return;
  const k = toile.width / 1000;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, toile.width, toile.height);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const t of traits ?? []) {
    if (!t?.p?.length) continue;
    ctx.strokeStyle = t.c;
    ctx.lineWidth = (t.c === '#FFFFFF' ? 18 : 5) * (t.w ?? 2) * k;
    ctx.beginPath();
    ctx.moveTo(t.p[0] * k, t.p[1] * k);
    if (t.p.length === 2) ctx.lineTo(t.p[0] * k + 0.1, t.p[1] * k);
    for (let i = 2; i < t.p.length; i += 2) ctx.lineTo(t.p[i] * k, t.p[i + 1] * k);
    ctx.stroke();
  }
}

// ——— Dessins à afficher (ceux des autres) : on les enregistre ici, la toile les retrouve par leur clé ———
const aVoir = new Map<string, Trait[]>();
const dejaPeint = new WeakMap<HTMLCanvasElement, string>();

/** Une toile qui affichera ces traits (dessinée juste après l'affichage). */
export function toileAVoir(cle: string, traits: Trait[] | undefined, classe = ''): string {
  aVoir.set(cle, traits ?? []);
  return `<canvas class="toile-voir ${classe}" width="600" height="600" data-voir="${cle}" aria-label="Dessin"></canvas>`;
}

function redessinerTout(): void {
  document.querySelectorAll<HTMLCanvasElement>('canvas[data-dessiner]').forEach((t) => peindre(t, traitsDe(t.dataset.dessiner!)));
}

/** À appeler régulièrement : peint les toiles nouvellement affichées. */
export function peindreLesToiles(): void {
  document.querySelectorAll<HTMLCanvasElement>('canvas[data-voir]').forEach((t) => {
    const cle = t.dataset.voir!;
    if (dejaPeint.get(t) !== cle) {
      dejaPeint.set(t, cle);
      peindre(t, aVoir.get(cle) ?? []);
    }
  });
  document.querySelectorAll<HTMLCanvasElement>('canvas[data-dessiner]').forEach((t) => {
    const cle = t.dataset.dessiner!;
    if (dejaPeint.get(t) !== cle) {
      dejaPeint.set(t, cle);
      peindre(t, traitsDe(cle));
    }
  });
  // Temps écoulé : on envoie tout seul ce qui est fait (un bouton marqué data-envoi-auto).
  document.querySelectorAll<HTMLButtonElement>('[data-envoi-auto]:not([disabled])').forEach((b) => {
    const fin = Number(b.dataset.envoiAuto);
    if (fin && Date.now() + decalage() > fin - 1200 && !b.dataset.envoye) {
      b.dataset.envoye = '1';
      b.click();
    }
  });
}

let decalage = () => 0;
/** L'heure du serveur (pour l'envoi automatique) : donnée par main.ts. */
export function brancherHeure(f: () => number): void {
  decalage = f;
}

/** Le dessin au doigt sur les toiles marquées data-dessiner. */
export function installerDessin(): void {
  let toile: HTMLCanvasElement | null = null;
  let trait: Trait | null = null;
  const point = (e: PointerEvent): [number, number] => {
    const r = toile!.getBoundingClientRect();
    return [Math.round(Math.max(0, Math.min(999, ((e.clientX - r.left) / r.width) * 1000))), Math.round(Math.max(0, Math.min(999, ((e.clientY - r.top) / r.height) * 1000)))];
  };
  document.addEventListener('pointerdown', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLCanvasElement>('canvas[data-dessiner]');
    if (!t) return;
    e.preventDefault();
    toile = t;
    toile.setPointerCapture?.(e.pointerId);
    const cle = t.dataset.dessiner!;
    if (!enCours.has(cle)) enCours.set(cle, []);
    if (nbPoints(traitsDe(cle)) >= MAX_POINTS) return;
    trait = { c: outil.couleur, w: outil.epaisseur, p: point(e) };
    enCours.get(cle)!.push(trait);
    peindre(toile, traitsDe(cle));
  });
  document.addEventListener('pointermove', (e) => {
    if (!toile || !trait) return;
    const [x, y] = point(e);
    const n = trait.p.length;
    // On ne garde que les points assez éloignés du précédent : le dessin reste léger.
    if (Math.hypot(x - trait.p[n - 2], y - trait.p[n - 1]) < 7) return;
    if (nbPoints(traitsDe(toile.dataset.dessiner!)) >= MAX_POINTS) return;
    trait.p.push(x, y);
    peindre(toile, traitsDe(toile.dataset.dessiner!));
  });
  const fin = () => {
    toile = null;
    trait = null;
  };
  document.addEventListener('pointerup', fin);
  document.addEventListener('pointercancel', fin);
}
