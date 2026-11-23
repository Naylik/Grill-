// Éléments visuels « Arène » partagés par les jeux d'action (Réflexe Mallow, Le bon timing) :
// barre de manches, écran d'intro, piste « qui a touché avant qui », classement en barres.
import { esc } from '../outils';
import { chrono } from '../ecrans/commun';
import type { Joueur } from '../types';

/** Barre du haut : titre du jeu et une pastille par manche (jouées, en cours, à venir). */
export function hud(titre: string, manche: number, total: number, enCours = true): string {
  const pips = Array.from({ length: total }, (_, i) => `<i class="${i < manche ? 'ok' : i === manche && enCours ? 'en' : ''}"></i>`).join('');
  return `<div class="hud-arene"><span>${esc(titre)}</span><span class="pips" aria-label="Manche ${Math.min(manche + 1, total)} sur ${total}">${pips}</span></div>`;
}

/** Écran d'intro : illustration, règles en 3 cartes, et le décompte avant le début. */
export function introArene(titre: string, sousTitre: string, illustration: string, regles: [string, string][], fin?: number): string {
  return `<div class="intro-arene">
    <div class="hud-arene"><span>${esc(titre)}</span><span>${esc(sousTitre)}</span></div>
    <div class="illustration flotte">${illustration}</div>
    ${regles.map(([n, t]) => `<div class="regle-arene"><b>${esc(n)}</b><span>${esc(t)}</span></div>`).join('')}
    ${fin ? `<div class="debut-arene"><span>Ça commence dans</span>${chrono(fin)}</div>` : ''}
  </div>`;
}

export interface PointPiste {
  joueur: Joueur;
  valeur: number; // position sur la piste (ms)
  texte: string; // ce qu'on affiche sous le prénom
  moi: boolean;
}

/**
 * La piste, façon couloirs de course : un couloir par joueur, dans l'ordre d'arrivée (le premier en haut).
 * Chaque pastille glisse jusqu'à sa valeur (temps de réaction, ou temps d'arrêt) : on voit qui a touché
 * avant qui, même quand deux temps sont très proches. Avec une cible (Le bon timing), une ligne dorée
 * marque le temps à viser sur tous les couloirs.
 */
/** Moment (en secondes) où la dernière pastille est arrivée sur la piste. */
export const finPiste = (nb: number): number => nb * 0.3 + 0.8;

export function piste(points: PointPiste[], max: number, cible?: { valeur: number; libelle: string }, min = 0): string {
  // min..max : la portion du temps affichée (Le bon timing zoome autour de la cible).
  const pos = (v: number) => Math.max(3, Math.min(97, ((v - min) / (max - min)) * 100));
  const tries = [...points].sort((a, b) => a.valeur - b.valeur);
  const couloirs = tries
    .map((p, rang) => {
      const x = pos(p.valeur);
      return `<div class="couloir ${p.moi ? 'moi' : ''}" style="--x:${x}%;--c:${p.joueur.couleur};--d:${(rang * 0.3).toFixed(2)}s">
        <span class="rang">${rang + 1}</span>
        <div class="voie"><div class="marqueur ${x > 58 ? 'a-gauche' : ''}">
          <span class="point">${esc(p.joueur.prenom.slice(0, 1))}</span>
          <span class="etiquette-piste"><strong>${esc(p.joueur.prenom)}</strong> ${esc(p.texte)}</span>
        </div></div>
      </div>`;
    })
    .join('');
  // Le bon timing : chaque pastille part de la ligne cible et glisse jusqu'à son temps (on voit l'écart se creuser).
  const depart = cible ? `--x0:${pos(cible.valeur)}%;` : '';
  return `<div class="piste-arene ${cible ? 'depuis-cible' : ''}" style="${depart}--fin:${finPiste(tries.length).toFixed(2)}s" role="img" aria-label="${esc(tries.map((p, i) => `${i + 1}. ${p.joueur.prenom} ${p.texte}`).join(', '))}">
    ${cible ? `<div class="ligne-cible" style="--xn:${(pos(cible.valeur) / 100).toFixed(4)}"><span>${esc(cible.libelle)}</span></div>` : ''}
    ${couloirs}
  </div>`;
}

export interface LigneBarre {
  joueur: Joueur;
  texte: string; // valeur affichée à droite
  part: number; // 0 à 1 : longueur de la barre (1 = meilleur)
  moi: boolean;
}

/** Classement final du jeu, en barres colorées. */
export function classementBarres(lignes: LigneBarre[]): string {
  return lignes
    .map((l, i) => `<div class="barre-arene ${l.moi ? 'moi' : ''}" style="--c:${l.joueur.couleur};--d:${(i * 0.12).toFixed(2)}s">
      <b>${i + 1}</b><span class="pastille" style="--c:${l.joueur.couleur};width:26px;height:26px"></span>
      <div><strong>${esc(l.joueur.prenom)}</strong><span class="jauge"><i style="width:${Math.round(Math.max(0.08, l.part) * 100)}%"></i></span></div>
      <em>${esc(l.texte)}</em></div>`)
    .join('');
}

/** Note d'un temps de réaction. */
export function noteReflexe(ms: number): [string, string] {
  if (ms < 0) return ['FAUX DÉPART', 'var(--rose)'];
  if (ms < 250) return ['ÉCLAIR', 'var(--vert)'];
  if (ms < 330) return ['TRÈS RAPIDE', 'var(--cyan)'];
  if (ms < 450) return ['CORRECT', 'var(--jaune)'];
  return ['ESCARGOT', 'var(--orange)'];
}

/** Note d'un écart au temps visé (Le bon timing). */
export function noteTiming(ecart: number): [string, string] {
  const a = Math.abs(ecart);
  if (a < 80) return ['PILE !', 'var(--vert)'];
  if (a < 300) return ['PRESQUE', 'var(--cyan)'];
  if (a < 800) return ['PAS LOIN', 'var(--jaune)'];
  return ['À CÔTÉ', 'var(--orange)'];
}

/** « Kilyan », « Kilyan et Manon » ou « Kilyan, Manon et Cassie » : tous les ex æquo à la 1re place, en gras. */
export function premiersEnGras(prenoms: string[]): { texte: string; pluriel: boolean } {
  const g = prenoms.map((p) => `<strong>${esc(p)}</strong>`);
  const texte = g.length > 1 ? `${g.slice(0, -1).join(', ')} et ${g[g.length - 1]}` : g[0] ?? '';
  return { texte, pluriel: g.length > 1 };
}
