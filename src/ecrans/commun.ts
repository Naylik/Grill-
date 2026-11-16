// Morceaux d'interface réutilisés par plusieurs écrans.
import { esc } from '../outils';
import { maintenant } from '../firebase';
import type { Joueur } from '../types';

export const FLAMME = `<svg class="flamme" viewBox="0 0 76 88" aria-hidden="true"><path d="M38 4c6 16 30 26 30 52 0 17-13 28-30 28S8 73 8 56c0-14 8-22 14-28 1 9 5 14 10 15C29 30 30 17 38 4z" fill="#FF8A3D" stroke="#15112E" stroke-width="4" stroke-linejoin="round"/><path d="M38 40c4 9 16 14 16 27 0 9-7 15-16 15s-16-6-16-15c0-7 4-11 7-14 1 5 3 7 6 8-1-8 0-15 3-21z" fill="#FFD23F"/><circle cx="31" cy="64" r="3.5" fill="#15112E"/><circle cx="45" cy="64" r="3.5" fill="#15112E"/><path d="M32 73c4 3 8 3 12 0" fill="none" stroke="#15112E" stroke-width="3" stroke-linecap="round"/></svg>`;

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
  return `<div class="narrateur"><span class="tete" aria-hidden="true"><svg viewBox="0 0 26 26"><circle cx="9" cy="11" r="2.5"/><circle cx="17" cy="11" r="2.5"/><path d="M8 17c3 2.5 7 2.5 10 0"/></svg></span><p>${texte}</p></div>`;
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
