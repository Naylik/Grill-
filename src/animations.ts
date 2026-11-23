// Petites animations pilotées par l'horloge des jeux (main.ts) : ce que le CSS seul ne sait pas faire.

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
