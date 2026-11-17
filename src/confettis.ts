// Confettis (podium, mission réussie) : dessinés sur une toile posée par-dessus l'écran, puis retirée.

const COULEURS = ['#FFD84A', '#FF5A6E', '#5CF2C2', '#5CD8FF', '#B18CFF', '#FF8A3D'];

interface Piece { x: number; y: number; vx: number; vy: number; t: number; c: string; a: number; va: number }

let toile: HTMLCanvasElement | null = null;
let pieces: Piece[] = [];
let boucle = 0;

export function confettis(quantite = 140): void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const r = window.devicePixelRatio || 1;
  if (!toile) {
    toile = document.createElement('canvas');
    toile.className = 'confettis';
    toile.setAttribute('aria-hidden', 'true');
    document.body.appendChild(toile);
  }
  toile.width = innerWidth * r;
  toile.height = innerHeight * r;
  for (let i = 0; i < quantite; i++) {
    pieces.push({
      x: toile.width / 2 + (Math.random() - 0.5) * toile.width * 0.3,
      y: toile.height * 0.55,
      vx: (Math.random() - 0.5) * 24 * r,
      vy: -(Math.random() * 20 + 12) * r,
      t: (Math.random() * 5 + 4) * r,
      c: COULEURS[i % COULEURS.length],
      a: Math.random() * 6,
      va: (Math.random() - 0.5) * 0.4,
    });
  }
  if (!boucle) dessiner();
}

function dessiner(): void {
  const cv = toile!;
  const c = cv.getContext('2d')!;
  const r = window.devicePixelRatio || 1;
  c.clearRect(0, 0, cv.width, cv.height);
  for (const p of pieces) {
    p.vy += 0.75 * r;
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.985;
    p.a += p.va;
    c.save();
    c.translate(p.x, p.y);
    c.rotate(p.a);
    c.fillStyle = p.c;
    c.fillRect(-p.t, -p.t / 2, p.t * 2, p.t);
    c.restore();
  }
  pieces = pieces.filter((p) => p.y < cv.height + 50);
  if (pieces.length) {
    boucle = requestAnimationFrame(dessiner);
  } else {
    boucle = 0;
    cv.remove();
    toile = null;
  }
}
