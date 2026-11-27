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
  // Jeux de réflexe : les boutons marqués data-immediat réagissent dès que le doigt touche l'écran
  // (le « click » arrive plus tard, au relâchement : trop lent pour mesurer un réflexe).
  document.addEventListener('pointerdown', (e) => {
    const cible = (e.target as HTMLElement).closest<HTMLElement>('[data-action][data-immediat]');
    if (!cible || (cible as HTMLButtonElement).disabled) return;
    e.preventDefault();
    const f = actions.get(cible.dataset.action!);
    if (f) Promise.resolve(f(cible)).catch((err) => console.error(err));
  });
  document.addEventListener('click', (e) => {
    const cible = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!cible || (cible as HTMLButtonElement).disabled || cible.hasAttribute('data-immediat')) return;
    e.preventDefault();
    const f = actions.get(cible.dataset.action!);
    if (f) Promise.resolve(f(cible)).catch((err) => console.error(err));
  });
  document.addEventListener('input', (e) => {
    const champ = e.target as HTMLInputElement;
    if (champ.name) brouillons[champ.name] = champ.value;
    // Le Juste Prix : l'étiquette de prix recopie ce qu'on tape et sursaute à chaque chiffre.
    const etiquette = champ.name ? document.querySelector<HTMLElement>(`[data-etiquette-de="${CSS.escape(champ.name)}"]`) : null;
    if (etiquette) {
      const valeur = etiquette.querySelector('b');
      if (valeur) valeur.textContent = champ.value.trim() || '?';
      etiquette.classList.remove('secoue');
      void etiquette.offsetWidth; // relance l'animation
      etiquette.classList.add('secoue');
    }
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

let derniereCle = '';

/**
 * Transition d'écran : quand on change d'écran (« cle » différente), le nouvel écran arrive en glissant
 * légèrement du bas avec un fondu. Le reste du temps, rien ne bouge (on ne rejoue pas l'animation).
 */
export function afficher(html: string, cle = ''): void {
  const nouvelEcran = cle !== derniereCle;
  derniereCle = cle;
  if (html === dernierHtml && !nouvelEcran) return;
  dernierHtml = html;
  const modele = document.createElement('template');
  modele.innerHTML = html;
  // On ne touche qu'à ce qui a changé : le défilement en cours, le champ en cours de saisie
  // et les animations déjà jouées ne sont pas interrompus (bug de défilement au Parieur, 16/11).
  harmoniser(racine, modele.content);
  if (nouvelEcran) {
    const ecran = racine.querySelector<HTMLElement>('.ecran');
    if (ecran) {
      ecran.classList.remove('entree-ecran');
      void ecran.offsetWidth; // relance l'animation
      ecran.classList.add('entree-ecran');
      window.scrollTo({ top: 0 });
    }
  }
}

/** Met à jour `cible` pour qu'il ressemble à `source`, en gardant les éléments existants quand c'est possible. */
export function harmoniser(cible: Node, source: Node): void {
  const anciens = Array.from(cible.childNodes);
  const nouveaux = Array.from(source.childNodes);
  nouveaux.forEach((n, i) => {
    const o = anciens[i];
    if (!o) {
      cible.appendChild(n.cloneNode(true));
      return;
    }
    if (o.nodeType !== n.nodeType || o.nodeName !== n.nodeName) {
      cible.replaceChild(n.cloneNode(true), o);
      return;
    }
    if (n.nodeType !== Node.ELEMENT_NODE) {
      if (o.nodeValue !== n.nodeValue) o.nodeValue = n.nodeValue;
      return;
    }
    const oe = o as Element;
    const ne = n as Element;
    // data-garder : élément animé par le code (Mallow à griller, carte à gratter) ; on le laisse tel quel.
    if (oe.hasAttribute('data-garder') && ne.hasAttribute('data-garder')) return;
    const enTransition = oe.classList.contains('entree-ecran'); // ne pas couper la transition d'écran en cours
    // data-style-libre : le style de cet élément est piloté par le code pendant un geste (colis qu'on fait glisser,
    // puis qui s'envole). Un rafraîchissement de l'écran ne doit pas le remettre à sa place en plein mouvement.
    const styleLibre = oe.hasAttribute('data-style-libre') && ne.hasAttribute('data-style-libre');
    for (const attr of Array.from(oe.attributes)) if (!ne.hasAttribute(attr.name) && !(styleLibre && attr.name === 'style')) oe.removeAttribute(attr.name);
    for (const attr of Array.from(ne.attributes)) if (oe.getAttribute(attr.name) !== attr.value && !(styleLibre && attr.name === 'style')) oe.setAttribute(attr.name, attr.value);
    if (enTransition) oe.classList.add('entree-ecran');
    if (oe instanceof HTMLInputElement && document.activeElement !== oe) {
      const v = ne.getAttribute('value') ?? '';
      if (oe.value !== v) oe.value = v;
    }
    if (oe instanceof HTMLTextAreaElement) {
      if (document.activeElement !== oe && oe.value !== (ne.textContent ?? '')) oe.value = ne.textContent ?? '';
      return;
    }
    harmoniser(oe, ne);
  });
  for (let i = anciens.length - 1; i >= nouveaux.length; i--) cible.removeChild(anciens[i]);
}

/** Vibration courte (si le téléphone le permet). */
export function vibrer(motif: number | number[] = 200): void {
  try {
    navigator.vibrate?.(motif);
  } catch {
    /* pas grave */
  }
}
