// Morceaux d'interface réutilisés par plusieurs écrans.
import { esc } from '../outils';
import { mallow } from '../mallow';
import { maintenant } from '../firebase';
import type { Joueur } from '../types';

export function pastille(j: Joueur, taille = 40): string {
  return `<span class="pastille" style="--c:${j.couleur};width:${taille}px;height:${taille}px"></span>`;
}

export function carteJoueur(j: Joueur, suffixe = '', classe = ''): string {
  return `<div class="carte-joueur ${classe} ${j.connecte ? '' : 'absent'}">
    ${pastille(j)}
    <div class="identite"><strong>${esc(j.prenom)}</strong><span style="color:${j.couleur}">${esc(j.nomCode)}${suffixe}</span></div>
    ${j.connecte ? '' : '<span class="etiquette">déconnecté</span>'}
  </div>`;
}

export function bulle(texte: string): string {
  return `<div class="narrateur"><span class="tete">${mallow({ vue: 'tete', taille: 40 })}</span><p>${texte}</p></div>`;
}

export function erreur(message: string | null): string {
  return message ? `<p class="erreur" role="alert">${esc(message)}</p>` : '';
}

/** Chrono qui se met à jour tout seul (voir main.ts). */
export function chrono(fin?: number): string {
  if (!fin) return '';
  const s = Math.max(0, Math.ceil((fin - maintenant()) / 1000));
  return `<div class="chrono ${s <= 5 ? 'urgent' : ''}" data-fin="${fin}" aria-live="off"><span>${s}</span></div>`;
}

export function attenteDes(uids: string[], joueurs: Record<string, Joueur>, ontRepondu: (uid: string) => boolean): string {
  return `<div class="qui-a-repondu">${uids
    .map((u) => joueurs[u])
    .map((j, i) => `<span class="mini ${ontRepondu(uids[i]) ? 'ok' : ''}" style="--c:${j.couleur}" title="${esc(j.prenom)}">${esc(j.prenom.slice(0, 1))}</span>`)
    .join('')}</div>`;
}

/** Bouton pour couper ou remettre le son. */
export function boutonSon(actif: boolean): string {
  const haut = actif
    ? '<path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>'
    : '<path d="M16 9l5 6M21 9l-5 6"/>';
  return `<button class="son-mini" data-action="son" aria-pressed="${actif}" aria-label="${actif ? 'Couper le son' : 'Remettre le son'}">
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/>${haut}</svg>
  </button>`;
}
