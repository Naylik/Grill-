// Choix des missions et onglet « Mes missions ».
import { S, estHote } from '../etat';
import { esc } from '../outils';
import { POINTS_MISSION } from '../score';
import type { MissionTiree } from '../types';
import { attenteDes, bulle } from './commun';

const ETIQUETTE_TYPE = { vie: 'Vie réelle', jeu: 'Dans les mini-jeux' } as const;

export function carteMission(m: MissionTiree, opts: { secret?: boolean; bouton?: string } = {}): string {
  return `<article class="mission ${m.difficulte}">
    <div class="tags">${m.vengeance ? '<span class="tag vengeance">Vengeance ×2</span>' : ''}<span class="tag">${m.difficulte === 'facile' ? 'Facile' : 'Difficile'} · ${POINTS_MISSION[m.difficulte] * (m.vengeance ? 2 : 1)} pts</span><span class="tag discret">${ETIQUETTE_TYPE[m.type]}</span></div>
    ${opts.secret
      ? `<p class="texte-secret" data-appui>${esc(m.texte)}</p><p class="aide">Appuie longtemps pour lire</p>`
      : `<p class="texte-mission">${esc(m.texte)}</p>`}
    ${opts.bouton ?? ''}
  </article>`;
}

/** Écran de choix (début de partie et mi-partie). */
/** Quelqu'un a juré de se venger de moi ce soir : je suis prévenu, sans savoir comment. */
export function alerteVengeance(): string {
  const a = S.annonceVengeance;
  if (!a?.de || !S.joueurs[a.de]) return '';
  return `<div class="alerte-vengeance" role="note"><strong>${esc(S.joueurs[a.de].prenom)} a juré de se venger de toi ce soir.</strong>
    <span>Tu l’as grillé la dernière fois. Méfie-toi de tout ce qu’il ou elle te demande…</span></div>`;
}

/** Annonces de vengeance déjà fermées sur ce téléphone (par partie). */
export const vengeancesVues = new Set<string>();

/** Fenêtre affichée une fois à la cible, par-dessus tout, dès que la vengeance est jurée. */
export function fenetreVengeance(): string {
  const a = S.annonceVengeance;
  const cle = `${S.deroule?.partieId}-${a?.de}`;
  if (!a?.de || !S.joueurs[a.de] || vengeancesVues.has(cle) || S.deroule?.phase === 'fin') return '';
  return `<div class="proces moi" role="alertdialog" aria-label="Vengeance"><div class="proces-carte">
    <p class="proces-titre">VENGEANCE !</p>
    ${alerteVengeance()}
    <p class="aide">Sa mission de ce soir te vise et vaut le double. Tu peux l’accuser avec le bouton GRILLÉ ! si tu la démasques.</p>
    <button class="bouton jaune" data-action="vuVengeance" data-valeur="${cle}">Compris, je me méfie</button>
  </div></div>`;
}

/** L'offre de vengeance, pour le joueur tiré au sort. */
function offreVengeance(): string {
  const choix = Object.keys(S.offreVengeance?.choix ?? {}).filter((u) => S.joueurs[u]);
  return `<h2>Vengeance ?</h2>
    <div class="alerte-vengeance offre"><strong>${choix.map((u) => esc(S.joueurs[u].prenom)).join(' et ')} ${choix.length > 1 ? 't’ont' : 't’a'} grillé la dernière fois.</strong>
      <span>Tu peux te venger : ta première mission visera ${choix.length > 1 ? 'la personne de ton choix' : 'cette personne'} et vaudra <b>le double</b>. Elle sera prévenue que tu veux te venger, mais pas de ta mission.</span></div>
    <div class="pile">${choix.map((u) => `<button class="bouton rose" data-action="vengeance" data-valeur="${u}">Me venger de ${esc(S.joueurs[u].prenom)}</button>`).join('')}
      <button class="bouton discret" data-action="vengeance" data-valeur="non">Non merci, pas ce soir</button></div>`;
}

export function ecranChoixMission(numero: 1 | 2): string {
  if (numero === 1 && S.offreVengeance && !S.secrets.vengeanceChoix && !S.secrets.mission1) return offreVengeance();
  return alerteVengeance() + ecranChoixMissionNormal(numero);
}

function ecranChoixMissionNormal(numero: 1 | 2): string {
  const propositions = numero === 1 ? S.secrets.propositions1 : S.secrets.propositions2;
  const choisie = numero === 1 ? S.secrets.mission1 : S.secrets.mission2;
  const uids = Object.keys(S.joueurs);
  const prets = S.attente?.etape === `mission${numero}` ? S.attente.uids ?? [] : [];
  const forcer = estHote() ? `<button class="bouton discret" data-action="hote" data-valeur="forcer">Continuer sans attendre</button>` : '';
  const titre = numero === 1 ? 'Ta mission secrète' : 'Nouvelle mission !';
  if (choisie) {
    return `<h2>${titre}</h2>
      ${bulle('Mission acceptée. Maintenant, sois naturel. Enfin, essaie.')}
      <p class="attente">On attend que tout le monde choisisse…</p>
      ${attenteDes(uids, S.joueurs, (u) => prets.includes(u))}
      <div class="pile bas">${forcer}</div>`;
  }
  if (!propositions?.length) return `<h2>${titre}</h2><p class="attente">Tirage de tes missions…</p>`;
  return `<h2>${titre}</h2>
    <p class="aide gauche">Garde-en une, en secret. Cache ton écran ! Les deux sont ${numero === 2 ? `de type « ${ETIQUETTE_TYPE[propositions[0].type]} »` : 'du même type'}.</p>
    ${propositions.map((m, i) => carteMission(m, { bouton: `<button class="bouton ${m.difficulte === 'facile' ? 'cyan' : 'rose'}" data-action="choisirMission" data-numero="${numero}" data-index="${i}">Je prends celle-ci</button>` })).join('')}`;
}

export function ongletMissions(): string {
  const { mission1, mission2 } = S.secrets;
  const liste = [mission1, mission2].filter(Boolean) as MissionTiree[];
  return `<section class="ecran">
    <h2>Mes missions</h2>
    ${alerteVengeance()}
    ${liste.length ? liste.map((m, i) => `<p class="intitule">Mission ${i + 1}</p>${carteMission(m, { secret: true })}`).join('') : '<p class="attente">Pas encore de mission. Elle arrive au début de la partie.</p>'}
    ${!mission2 ? '<p class="aide">Une deuxième mission t’attend à la mi-partie.</p>' : ''}
  </section>`;
}
