// Choix des missions et onglet « Mes missions ».
import { S, estHote } from '../etat';
import { esc } from '../outils';
import { POINTS_MISSION } from '../score';
import type { MissionTiree } from '../types';
import { attenteDes, bulle } from './commun';

const ETIQUETTE_TYPE = { vie: 'Vie réelle', jeu: 'Dans les mini-jeux' } as const;

export function carteMission(m: MissionTiree, opts: { secret?: boolean; bouton?: string } = {}): string {
  return `<article class="mission ${m.difficulte}">
    <div class="tags"><span class="tag">${m.difficulte === 'facile' ? 'Facile' : 'Difficile'} · ${POINTS_MISSION[m.difficulte]} pts</span><span class="tag discret">${ETIQUETTE_TYPE[m.type]}</span></div>
    ${opts.secret
      ? `<p class="texte-secret" data-appui>${esc(m.texte)}</p><p class="aide">Appuie longtemps pour lire</p>`
      : `<p class="texte-mission">${esc(m.texte)}</p>`}
    ${opts.bouton ?? ''}
  </article>`;
}

/** Écran de choix (début de partie et mi-partie). */
export function ecranChoixMission(numero: 1 | 2): string {
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
  if (S.masque) return `<section class="ecran centre masque"><button class="bouton jaune" data-action="masquer">Réafficher</button></section>`;
  const { mission1, mission2 } = S.secrets;
  const liste = [mission1, mission2].filter(Boolean) as MissionTiree[];
  return `<section class="ecran">
    <div class="ligne-titre"><h2>Mes missions</h2><button class="bouton petit-bouton rose" data-action="masquer">Masquer vite</button></div>
    ${liste.length ? liste.map((m, i) => `<p class="intitule">Mission ${i + 1}</p>${carteMission(m, { secret: true })}`).join('') : '<p class="attente">Pas encore de mission. Elle arrive au début de la partie.</p>'}
    ${!mission2 ? '<p class="aide">Une deuxième mission t’attend à la mi-partie.</p>' : ''}
  </section>`;
}
