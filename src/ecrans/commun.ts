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
