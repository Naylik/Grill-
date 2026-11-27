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
    const texte = x >= 1 ? el.dataset.final ?? String(cible) : Math.round(cible * (1 - (1 - x) ** 3)).toLocaleString('fr-FR').replace(/\u202f/g, '\u00a0') // espace fine absente de la police : espace insécable normale;
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

/**
 * L'Imposteur : tant que je n'ai pas voté, la loupe passe d'un joueur à l'autre (une seconde chacun, au hasard) ;
 * dès que je vote, elle se pose sur mon choix. Seulement sur mon téléphone.
 */
const loupes = new WeakMap<HTMLElement, { cible: number; depuis: number }>();
export function animerLoupes(): void {
  const maintenant = performance.now();
  document.querySelectorAll<HTMLElement>('[data-loupe]').forEach((zone) => {
    const loupe = zone.querySelector<HTMLElement>('.loupe-vote');
    const choix = [...zone.querySelectorAll<HTMLElement>('.option')];
    if (!loupe || !choix.length) return;
    const vote = choix.findIndex((c) => c.classList.contains('actif'));
    let etat = loupes.get(zone);
    if (!etat) loupes.set(zone, (etat = { cible: Math.floor(Math.random() * choix.length), depuis: maintenant }));
    if (vote >= 0) {
      if (etat.cible !== vote) { etat.cible = vote; loupe.classList.remove('posee'); void loupe.offsetWidth; }
      loupe.classList.add('posee');
    } else {
      loupe.classList.remove('posee');
      if (maintenant - etat.depuis > 1000 && choix.length > 1) {
        let suivant = Math.floor(Math.random() * (choix.length - 1));
        if (suivant >= etat.cible) suivant++;
        etat.cible = suivant;
        etat.depuis = maintenant;
      }
    }
    const c = choix[Math.min(etat.cible, choix.length - 1)];
    const x = `${c.offsetLeft + c.offsetWidth - 46}px`;
    const y = `${c.offsetTop - 14}px`;
    if (loupe.style.left !== x) loupe.style.left = x;
    if (loupe.style.top !== y) loupe.style.top = y;
  });
}

/** Carte d'ouverture d'un mini-jeu (deroule.ts) : le jeu ne démarre vraiment qu'après elle (hote.ts › demarrerJeu). */
export const DUREE_OUVERTURE = 2400;
