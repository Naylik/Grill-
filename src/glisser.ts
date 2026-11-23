// La Patate : on la fait glisser du doigt vers un joueur pour la lui lancer.
// Au relâchement, on choisit le nom (bouton .cible-patate) le plus proche de la direction du geste
// et on « touche » ce bouton : c'est lui qui envoie le lancer (même chemin que toucher le nom).

export function installerGlisser(): void {
  let el: HTMLElement | null = null;
  let x0 = 0;
  let y0 = 0;
  document.addEventListener('pointerdown', (e) => {
    el = (e.target as HTMLElement).closest<HTMLElement>('[data-glisser-patate]');
    if (!el) return;
    e.preventDefault();
    x0 = e.clientX;
    y0 = e.clientY;
    el.setPointerCapture?.(e.pointerId);
    el.style.transition = 'none'; // le colis suit le doigt sans retard (un lancer raté précédent a pu laisser une transition)
    el.classList.add('tenue');
  });
  document.addEventListener('pointermove', (e) => {
    if (!el) return;
    el.style.transform = `translate(${e.clientX - x0}px, ${e.clientY - y0}px) rotate(${(e.clientX - x0) / 6}deg)`;
  });
  const lacher = (e: PointerEvent) => {
    if (!el) return;
    const patate = el;
    el = null;
    patate.classList.remove('tenue');
    const dx = e.clientX - x0;
    const dy = e.clientY - y0;
    const longueur = Math.hypot(dx, dy);
    const cibles = Array.from(document.querySelectorAll<HTMLElement>('.cible-patate:not(.pas-encore)'));
    if (longueur < 50 || !cibles.length) {
      patate.style.transition = 'transform .2s ease-out'; // geste trop court : le colis revient en douceur
      patate.style.transform = '';
      return;
    }
    // Le nom dont la direction ressemble le plus à celle du geste.
    const depart = patate.getBoundingClientRect();
    const cx = depart.left + depart.width / 2 - dx;
    const cy = depart.top + depart.height / 2 - dy;
    let meilleure = cibles[0];
    let score = -2;
    for (const c of cibles) {
      const r = c.getBoundingClientRect();
      const vx = r.left + r.width / 2 - cx;
      const vy = r.top + r.height / 2 - cy;
      const cos = (vx * dx + vy * dy) / (Math.hypot(vx, vy) * longueur || 1);
      if (cos > score) {
        score = cos;
        meilleure = c;
      }
    }
    const r = meilleure.getBoundingClientRect();
    patate.style.transition = 'transform .25s ease-in';
    patate.style.transform = `translate(${r.left + r.width / 2 - cx}px, ${r.top + r.height / 2 - cy}px) scale(.3) rotate(540deg)`;
    meilleure.click();
  };
  document.addEventListener('pointerup', lacher);
  document.addEventListener('pointercancel', (e) => {
    if (el) el.style.transform = '';
    el = null;
    void e;
  });
}
