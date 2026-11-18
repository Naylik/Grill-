// Quitte ou Double : la « fusée ». Une courbe qui grimpe avec la cagnotte (×1, ×2, ×4…) et vire du vert au rouge
// quand ça devient risqué. Tout est dessiné sur une toile (le texte aussi), animé par la boucle de main.ts.

export interface OptionsFusee {
  depart: number; // valeur au début de l'animation
  cible: number; // valeur à atteindre
  crash?: boolean; // mauvaise réponse : la courbe s'effondre
  encaisse?: boolean; // cagnotte encaissée : « +X PTS » et jetons
}

const couleur = (v: number) => (v <= 2 ? '#5CF2C2' : v <= 8 ? '#FFD84A' : '#FF5A6E');

/** Le bloc à placer dans l'écran ; « cle » change à chaque nouvelle animation (sinon elle n'est pas rejouée). */
export function fuseeHtml(cle: string, o: OptionsFusee): string {
  const jetons = o.encaisse
    ? Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2;
        return `<i class="jeton-fusee" style="--dx:${Math.round(Math.cos(a) * 120)}px;--dy:${Math.round(Math.sin(a) * 90 - 30)}px;animation-delay:${(i % 5) * 0.04}s"></i>`;
      }).join('')
    : '';
  const bandeau = o.crash ? '<span class="bandeau-fusee crash">CRASH !</span>' : o.encaisse ? `<span class="bandeau-fusee gagne">+${o.cible} PT${o.cible > 1 ? 'S' : ''}</span>` : '';
  return `<div class="fusee ${o.crash ? 'crash' : ''} ${o.encaisse ? 'encaisse' : ''}" data-fusee="${cle}" data-depart="${o.depart}" data-cible="${o.cible}" ${o.crash ? 'data-crash="1"' : ''} ${o.encaisse ? 'data-encaisse="1"' : ''}>
    <canvas width="600" height="330" aria-label="Cagnotte : ${o.crash ? 0 : o.cible} points"></canvas>${jetons}${bandeau}</div>`;
}

interface Anim { cle: string; affiche: number; chute: number }
const anims = new WeakMap<HTMLElement, Anim>();

/** À appeler à chaque image : fait avancer toutes les fusées affichées. */
export function animerFusees(): void {
  document.querySelectorAll<HTMLElement>('[data-fusee]').forEach((el) => {
    const cle = el.dataset.fusee!;
    const depart = Number(el.dataset.depart);
    const cible = Number(el.dataset.cible);
    const crash = el.dataset.crash === '1';
    let a = anims.get(el);
    if (!a || a.cle !== cle) {
      a = { cle, affiche: Math.max(0, depart), chute: 0 };
      anims.set(el, a);
    }
    if (!crash) a.affiche += (cible - a.affiche) * 0.06;
    else if (a.chute < 260) a.chute += 9;
    dessiner(el.querySelector('canvas'), a, crash, el.dataset.encaisse === '1', cible);
  });
}

function dessiner(cv: HTMLCanvasElement | null, a: Anim, crash: boolean, encaisse: boolean, cible: number): void {
  const ctx = cv?.getContext('2d');
  if (!cv || !ctx) return;
  const W = cv.width;
  const H = cv.height;
  const v = Math.max(0, a.affiche);
  const point = (m: number): [number, number] => {
    const t = Math.min(1, Math.log2(1 + Math.max(0, m)) / 6);
    return [36 + t * (W - 72), H - 36 - Math.pow(t, 1.35) * (H - 120)];
  };
  ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = '#ffffff12';
  ctx.lineWidth = 2;
  for (let y = H - 36; y > 40; y -= 70) {
    ctx.beginPath();
    ctx.moveTo(24, y);
    ctx.lineTo(W - 24, y);
    ctx.stroke();
  }
  const col = crash ? '#FF5A6E' : couleur(v);
  ctx.lineCap = 'round';
  ctx.lineWidth = 9;
  ctx.strokeStyle = col;
  ctx.shadowColor = col;
  ctx.shadowBlur = 22;
  ctx.beginPath();
  const pas = 50;
  for (let i = 0; i <= pas; i++) {
    const [x, y] = point(v * (i / pas));
    const yy = crash ? y + Math.pow(i / pas, 3) * a.chute : y;
    if (i) ctx.lineTo(x, yy);
    else ctx.moveTo(x, yy);
  }
  ctx.stroke();
  const [px, py] = point(v);
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(px, py + (crash ? a.chute : 0), 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 26;
  // Le multiplicateur, en grand, et ce qui est en jeu.
  ctx.textAlign = 'center';
  ctx.fillStyle = col;
  ctx.font = '700 92px "JetBrains Mono", ui-monospace, Menlo, monospace';
  const arrondi = Math.round(v * 10) / 10;
  ctx.fillText(crash ? 'CRASH' : `×${arrondi < 10 ? arrondi.toFixed(1) : Math.round(arrondi)}`, W / 2, 112);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#C4BCE6';
  ctx.font = '800 24px Unbounded, "Arial Black", sans-serif';
  ctx.fillText(crash ? 'TOUT EST PERDU' : encaisse ? `${cible} PTS ENCAISSÉS` : `${cible} PT${cible > 1 ? 'S' : ''} EN JEU`, W / 2, 152);
}
