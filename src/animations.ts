// Petites animations pilotées par l'horloge des jeux (main.ts) : ce que le CSS seul ne sait pas faire.
import { minutageCourse } from './course';

const debuts = new WeakMap<HTMLElement, number>();

/**
 * Compteur qui défile (Le Juste Prix) : <strong data-compteur="1250" data-final="1 250">1 250</strong>.
 * Le nombre monte de 0 à sa valeur en ralentissant (2,2 s), puis affiche le texte final. Le HTML contient déjà
 * la valeur finale : un rafraîchissement de l'écran ne casse rien, l'horloge réécrit le chiffre à l'image suivante.
 */
export function animerCompteurs(): void {
  const maintenant = performance.now();
  document.querySelectorAll<HTMLElement>('[data-compteur]').forEach((el) => {
    if (!debuts.has(el)) debuts.set(el, maintenant);
    const x = Math.min(1, (maintenant - debuts.get(el)!) / DUREE_COMPTEUR);
    const cible = Number(el.dataset.compteur);
    const texte = x >= 1 ? el.dataset.final ?? String(cible) : Math.round(cible * (1 - (1 - x) ** 3)).toLocaleString('fr-FR');
    if (el.textContent !== texte) el.textContent = texte;
  });
}

export const DUREE_COMPTEUR = 2200;

/**
 * Réflexe Mallow : la course rejouée (<div data-course>). Le HTML contient l'état final (tout le monde arrêté) ;
 * à chaque image on recalcule l'état à partir du temps écoulé, donc un rafraîchissement de l'écran ne casse rien.
 */
export function animerCourses(): void {
  const maintenant = performance.now();
  document.querySelectorAll<HTMLElement>('[data-course]').forEach((el) => {
    if (!debuts.has(el)) debuts.set(el, maintenant);
    const ecoule = maintenant - debuts.get(el)!;
    const couloirs = [...el.querySelectorAll<HTMLElement>('[data-t]')];
    const temps = couloirs.map((c) => Number(c.dataset.t));
    const m = minutageCourse(temps);
    const fini = ecoule >= m.fin + 250;
    el.classList.toggle('en-course', !fini);
    el.classList.toggle('fini', fini);
    el.classList.toggle('au-ralenti', !!m.ralenti && ecoule >= m.ralenti[0] && ecoule < m.ralenti[1]);
    const chrono = Math.min(Math.max(...temps), m.chrono(ecoule));
    const affiche = el.querySelector<HTMLElement>('[data-chrono]');
    const texte = String(Math.round(chrono));
    if (affiche && affiche.textContent !== texte) affiche.textContent = texte;
    const max = Math.max(1, ...temps);
    couloirs.forEach((c, i) => {
      c.style.setProperty('--v', (Math.min(chrono, temps[i]) / max).toFixed(4));
      c.classList.toggle('stop', ecoule >= m.arrets[i]);
    });
  });
}
