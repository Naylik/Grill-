// Choix des missions et onglet « Mes missions ».
import { S, estHote } from '../etat';
import { esc } from '../outils';
import { pointsGrosse } from '../score';
import type { MissionTiree } from '../types';
import { attenteDes, bulle } from './commun';
import { maFlashEnCours } from './flash';
import { POINTS_FLASH } from '../flash';

const ETIQUETTE_TYPE = { vie: 'Vie réelle', jeu: 'Dans les mini-jeux' } as const;
const NIVEAU = { facile: 'Facile', difficile: 'Difficile', longue: 'Longue durée' } as const;

export function carteMission(m: MissionTiree, opts: { secret?: boolean; bouton?: string } = {}): string {
  return `<article class="mission ${m.difficulte}">
    <div class="tags">${m.vengeance ? '<span class="tag vengeance">Vengeance ×1,5</span>' : ''}<span class="tag">${NIVEAU[m.difficulte]} · ${pointsGrosse(m.difficulte, S.infos?.duree ?? 6, m.vengeance)} pts</span><span class="tag discret">${ETIQUETTE_TYPE[m.type]}</span></div>
    ${opts.secret
      ? `<p class="texte-secret" data-appui>${esc(m.texte)}</p><p class="aide">Appuie longtemps pour lire</p>`
      : `<p class="texte-mission">${esc(m.texte)}</p>`}
    ${opts.bouton ?? ''}
  </article>`;
}


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
    <p class="aide">Sa mission de ce soir te vise et vaut ×1,5. Tu peux l’accuser avec le bouton GRILLÉ ! si tu la démasques.</p>
    <button class="bouton jaune" data-action="vuVengeance" data-valeur="${cle}">Compris, je me méfie</button>
  </div></div>`;
}

/** L'offre de vengeance, pour le joueur tiré au sort. */
function offreVengeance(): string {
  const choix = Object.keys(S.offreVengeance?.choix ?? {}).filter((u) => S.joueurs[u]);
  return `<h2>Vengeance ?</h2>
    <div class="alerte-vengeance offre"><strong>${choix.map((u) => esc(S.joueurs[u].prenom)).join(' et ')} ${choix.length > 1 ? 't’ont' : 't’a'} grillé la dernière fois.</strong>
      <span>Tu peux te venger : ta première mission visera ${choix.length > 1 ? 'la personne de ton choix' : 'cette personne'} et vaudra <b>×1,5</b>. Elle sera prévenue que tu veux te venger, mais pas de ta mission.</span></div>
    <div class="pile">${choix.map((u) => `<button class="bouton rose" data-action="vengeance" data-valeur="${u}">Me venger de ${esc(S.joueurs[u].prenom)}</button>`).join('')}
      <button class="bouton discret" data-action="vengeance" data-valeur="non">Non merci, pas ce soir</button></div>`;
}

export function ecranChoixMission(): string {
  if (S.offreVengeance && !S.secrets.vengeanceChoix && !S.secrets.mission1) return offreVengeance();
  return alerteVengeance() + ecranChoixMissionNormal();
}

function ecranChoixMissionNormal(): string {
  const propositions = S.secrets.propositions1;
  const choisie = S.secrets.mission1;
  const uids = Object.keys(S.joueurs);
  const prets = S.attente?.etape === 'mission1' ? S.attente.uids ?? [] : [];
  const forcer = estHote() ? `<button class="bouton discret" data-action="hote" data-valeur="forcer">Continuer sans attendre</button>` : '';
  const titre = 'Ta grosse mission';
  if (choisie) {
    return `<h2>${titre}</h2>
      ${bulle('Mission acceptée. Maintenant, sois naturel. Enfin, essaie.')}
      <p class="attente">On attend que tout le monde choisisse…</p>
      ${attenteDes(uids, S.joueurs, (u) => prets.includes(u))}
      <div class="pile bas">${forcer}</div>`;
  }
  if (!propositions?.length) return `<h2>${titre}</h2><p class="attente">Tirage de tes missions…</p>`;
  return `<h2>${titre}</h2>
    <p class="aide gauche">${propositions[0]?.vengeance && propositions[0].cible
      ? `<strong>${esc(S.joueurs[propositions[0].cible]?.prenom ?? '?')}</strong> va regretter de t’avoir grillé. Choisis ta mission.`
      : 'Garde-en une, en secret : elle dure toute la soirée. Cache ton écran ! Pendant les jeux, tu recevras peut-être aussi des missions flash.'}</p>
    ${propositions.map((m, i) => carteMission(m, { bouton: `<button class="bouton ${m.difficulte === 'facile' ? 'cyan' : 'rose'}" data-action="choisirMission" data-index="${i}">Je prends celle-ci</button>` })).join('')}`;
}

export function ongletMissions(): string {
  const liste = S.secrets.mission1 ? [S.secrets.mission1] : [];
  const flash = maFlashEnCours();
  return `<section class="ecran">
    <h2>Mes missions</h2>
    ${alerteVengeance()}
    ${flash ? `<p class="intitule">⚡ Mission flash (ce jeu)</p><article class="mission flash"><div class="tags"><span class="tag eclair">Flash · +${POINTS_FLASH} pts</span></div><p class="texte-secret" data-appui>${esc(flash.texte)}</p><p class="aide">Appuie longtemps pour lire</p></article>` : ''}
    ${liste.length ? liste.map((m, i) => `<p class="intitule">${i === 0 ? 'Grosse mission (toute la soirée)' : 'Mission 2'}</p>${carteMission(m, { secret: true })}`).join('') : '<p class="attente">Pas encore de mission. Elle arrive au début de la partie.</p>'}
    ${flash ? '' : '<p class="aide">Pendant les jeux, tu peux recevoir une mission flash : ton téléphone vibre.</p>'}
  </section>`;
}
