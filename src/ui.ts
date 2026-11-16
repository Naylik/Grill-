// Affichage sans framework : chaque écran renvoie du HTML, et les boutons portent un data-action.
// On ne redessine que si le HTML a changé, et on garde ce que le joueur est en train de taper.

type Action = (el: HTMLElement) => void | Promise<void>;
const actions = new Map<string, Action>();
/** Ce que le joueur a tapé dans les champs (clé : attribut name). */
export const brouillons: Record<string, string> = {};

let racine: HTMLElement;
let dernierHtml = '';

export function action(nom: string, f: Action): void {
  actions.set(nom, f);
}

export function installer(el: HTMLElement): void {
  racine = el;
  document.addEventListener('click', (e) => {
    const cible = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!cible || (cible as HTMLButtonElement).disabled) return;
    e.preventDefault();
    const f = actions.get(cible.dataset.action!);
    if (f) Promise.resolve(f(cible)).catch((err) => console.error(err));
  });
  document.addEventListener('input', (e) => {
    const champ = e.target as HTMLInputElement;
    if (champ.name) brouillons[champ.name] = champ.value;
  });
  // « Entrée » dans un champ = cliquer sur le bouton indiqué par data-entree.
  document.addEventListener('keydown', (e) => {
    const champ = e.target as HTMLInputElement;
    if (e.key === 'Enter' && champ.dataset?.entree) {
      e.preventDefault();
      document.querySelector<HTMLElement>(`[data-action="${champ.dataset.entree}"]`)?.click();
    }
  });
}

export function afficher(html: string): void {
  if (html === dernierHtml) return;
  dernierHtml = html;
  const actif = document.activeElement as HTMLInputElement | null;
  const nomActif = actif?.name;
  const position = actif?.selectionStart ?? null;
  racine.innerHTML = html;
  if (nomActif) {
    const champ = racine.querySelector<HTMLInputElement>(`[name="${nomActif}"]`);
    if (champ) {
      champ.focus();
      if (position !== null) champ.setSelectionRange(position, position);
    }
  }
}

/** Vibration courte (si le téléphone le permet). */
export function vibrer(motif: number | number[] = 200): void {
  try {
    navigator.vibrate?.(motif);
  } catch {
    /* pas grave */
  }
}
