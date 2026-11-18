// Dessin au doigt (Dessin téléphone arabe). Un dessin = une liste de traits, chacun une couleur, une épaisseur
// et des points (coordonnées entières de 0 à 999 sur un carré). C'est très léger à envoyer dans Firebase,
// et le dessin se redessine à l'identique sur tous les téléphones.

export interface Trait {
  c: string; // couleur
  w: number; // épaisseur (1 fin, 2 moyen, 3 gros)
  p: number[]; // x0, y0, x1, y1… (0 à 999)
}

// 12 feutres : les couleurs vives, plus de quoi dessiner une peau, un tronc, un ciel, une ombre.
export const COULEURS = ['#24123A', '#7A7489', '#FF5A6E', '#FF8A3D', '#FFC93C', '#2FCB8E', '#1E8F5E', '#5CD8FF', '#3B5BFF', '#B18CFF', '#FF8FC8', '#F2C9A0', '#8A5A2B'].slice(0, 12);
export const PAPIER = '#FFFDF6'; // la couleur de la feuille
export const GOMME = PAPIER; // la gomme peint couleur papier, plus large
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

/** Garde seulement les « n » premiers points du dessin (pour le rejouer trait par trait). */
function debut(traits: Trait[], n: number): Trait[] {
  const res: Trait[] = [];
  let reste = n;
  for (const t of traits ?? []) {
    if (reste <= 0) break;
    const k = Math.min(t.p.length / 2, reste);
    res.push({ ...t, p: t.p.slice(0, k * 2) });
    reste -= k;
  }
  return res;
}

/** Dessine des traits sur une toile (fond blanc). */
export function peindre(toile: HTMLCanvasElement, traits: Trait[]): void {
  const ctx = toile.getContext('2d');
  if (!ctx) return;
  const k = toile.width / 1000;
  ctx.fillStyle = PAPIER;
  ctx.fillRect(0, 0, toile.width, toile.height);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const t of traits ?? []) {
    if (!t?.p?.length) continue;
    ctx.strokeStyle = t.c;
    ctx.lineWidth = (t.c === GOMME || t.c === '#FFFFFF' ? 18 : 5) * (t.w ?? 2) * k;
    ctx.beginPath();
    ctx.moveTo(t.p[0] * k, t.p[1] * k);
    if (t.p.length === 2) ctx.lineTo(t.p[0] * k + 0.1, t.p[1] * k);
    for (let i = 2; i < t.p.length; i += 2) ctx.lineTo(t.p[i] * k, t.p[i + 1] * k);
    ctx.stroke();
  }
}

// ——— Dessins à afficher (ceux des autres) : on les enregistre ici, la toile les retrouve par leur clé ———
const aVoir = new Map<string, { traits: Trait[]; replay: boolean }>();
const dejaPeint = new WeakMap<HTMLCanvasElement, string>();
const replays = new WeakMap<HTMLCanvasElement, { cle: string; debut: number }>();

/**
 * Une toile qui affichera ces traits (dessinée juste après l'affichage).
 * replay : le dessin se redessine trait par trait, en accéléré (révélation du Dessin téléphone arabe).
 */
export function toileAVoir(cle: string, traits: Trait[] | undefined, classe = '', replay = false): string {
  aVoir.set(cle, { traits: traits ?? [], replay });
  return `<canvas class="toile-voir ${classe}" width="600" height="600" data-voir="${cle}" aria-label="Dessin"></canvas>`;
}

function redessinerTout(): void {
  document.querySelectorAll<HTMLCanvasElement>('canvas[data-dessiner]').forEach((t) => peindre(t, traitsDe(t.dataset.dessiner!)));
}

/** À appeler régulièrement : peint les toiles nouvellement affichées. */
export function peindreLesToiles(): void {
  document.querySelectorAll<HTMLCanvasElement>('canvas[data-voir]').forEach((t) => {
    const cle = t.dataset.voir!;
    const d = aVoir.get(cle) ?? { traits: [], replay: false };
    if (d.replay) {
      // Rejoué en accéléré : de 1,5 à 4 s selon la taille du dessin.
      let r = replays.get(t);
      if (!r || r.cle !== cle) {
        r = { cle, debut: performance.now() };
        replays.set(t, r);
      }
      const total = nbPoints(d.traits);
      const duree = Math.min(4000, 1500 + total * 2);
      const avance = Math.min(1, (performance.now() - r.debut) / duree);
      const cleImage = `${cle}@${avance >= 1 ? 'fin' : Math.round(avance * total)}`;
      if (dejaPeint.get(t) !== cleImage) {
        dejaPeint.set(t, cleImage);
        peindre(t, avance >= 1 ? d.traits : debut(d.traits, Math.round(avance * total)));
      }
      return;
    }
    if (dejaPeint.get(t) !== cle) {
      dejaPeint.set(t, cle);
      peindre(t, d.traits);
    }
  });
  document.querySelectorAll<HTMLCanvasElement>('canvas[data-dessiner]').forEach((t) => {
    const cle = t.dataset.dessiner!;
    if (dejaPeint.get(t) !== cle) {
      dejaPeint.set(t, cle);
      peindre(t, traitsDe(cle));
    }
  });
  // Le sablier se vide avec le temps qui reste.
  document.querySelectorAll<HTMLElement>('.sablier[data-fin]').forEach((s) => {
    const reste = Math.max(0, Math.min(1, (Number(s.dataset.fin) - (Date.now() + decalage())) / Number(s.dataset.duree || 60000)));
    s.style.setProperty('--p', reste.toFixed(3));
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

/** Une réaction (emoji) qui s'envole sur l'écran : lancée chez tout le monde quand quelqu'un réagit. */
export function envolerReaction(emoji: string): void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const el = document.createElement('span');
  el.className = 'reaction-volante';
  el.textContent = emoji;
  el.style.left = `${10 + Math.random() * 80}%`;
  el.style.setProperty('--derive', `${Math.round((Math.random() - 0.5) * 120)}px`);
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

/** Le sablier de l'atelier (il se vide grâce à peindreLesToiles). */
export function sablier(fin: number | undefined, duree: number): string {
  return `<div class="sablier" data-fin="${fin ?? 0}" data-duree="${duree}" aria-hidden="true">
    <svg viewBox="0 0 40 60"><path d="M6 4 H34 M6 56 H34" stroke="#C99A5A" stroke-width="5" stroke-linecap="round"/>
    <path d="M9 7 C9 22 18 26 20 30 C22 26 31 22 31 7 Z" fill="#ffffff22" stroke="#E9E4FF" stroke-width="2"/>
    <path d="M9 53 C9 38 18 34 20 30 C22 34 31 38 31 53 Z" fill="#ffffff22" stroke="#E9E4FF" stroke-width="2"/>
    <rect class="sable-haut" x="10" y="8" width="20" height="18" fill="#FFD84A"/>
    <rect class="sable-bas" x="10" y="34" width="20" height="18" fill="#FFD84A"/>
    <path class="filet" d="M20 30 V50" stroke="#FFD84A" stroke-width="1.6"/></svg></div>`;
}
