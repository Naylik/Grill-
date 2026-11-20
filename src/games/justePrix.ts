// « Le Juste Prix » : chacun estime en secret. Le plus proche gagne la manche ;
// classement au nombre de manches gagnées.
import questions from '../data/justeprix.json';
import { esc, fraisDabord, melanger } from '../outils';
import { plusProches, pointsDePlace } from '../score';
import { attenteDes, bulle, chrono } from '../ecrans/commun';
import { brouillons } from '../ui';
import { etapeTerminee, reponsesDe, type EtatDeBase, type MiniJeu, selonFormat } from './interface';

const NB_MANCHES: [number, number, number] = [4, 6, 8]; // Courte, Normale, Longue
const DUREE = 40_000;

interface Question { id?: string; texte: string; reponse: number; unite: string }
interface Etat extends EtatDeBase {
  phase: 'question' | 'resultat';
  numeroJeu: number;
  index: number;
  questions: Question[];
  estimations?: Record<string, number>;
  gagnants?: string[];
  manches: Record<string, number>;
}

const etapeDe = (n: number, i: number) => `prix-${n}-${i}`;
export const formater = (n: number) => n.toLocaleString('fr-FR');
/** « 42 195 », « 3,5 » ou « 1 789 » → nombre. */
export function lireNombre(saisie: string): number | null {
  const propre = saisie.replace(/[\s\u202F\u00A0]/g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(propre)) return null;
  return Number(propre);
}

export const justePrix: MiniJeu<Etat> = {
  id: 'justeprix',
  nom: 'Le Juste Prix',
  accroche: 'Estime en secret. Le plus proche gagne la manche.',
  explication: {
    comment: 'Une question de culture ou une question fun (« Combien mesure la tour Eiffel ? »). Chacun tape son estimation en secret, puis on découvre la bonne réponse et celles des autres.',
    gagner: 'Le plus proche gagne la manche. Celui qui gagne le plus de manches gagne le jeu (4 à 8 manches selon le format).',
  },
  icone: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.5"/><circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="2.5"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/>',
  couleur: '#FFD23F',
  tours: (duree) => `${selonFormat(duree, NB_MANCHES)} manches`,
  contenus: (e) => e.questions.map((q) => q.id).filter((id): id is string => !!id),
  autorise: () => true,

  demarrer(ctx) {
    const nb = selonFormat(ctx.duree, NB_MANCHES);
    const culture = fraisDabord(questions.filter((q) => q.categorie === 'culture'), ctx.dejaVus, ctx.hasard).slice(0, Math.ceil(nb / 2));
    const fun = fraisDabord(questions.filter((q) => q.categorie === 'fun'), ctx.dejaVus, ctx.hasard).slice(0, Math.floor(nb / 2));
    const choix = melanger([...culture, ...fun], ctx.hasard).map(({ id, texte, reponse, unite }) => ({ id, texte, reponse, unite }));
    return {
      etat: {
        etape: etapeDe(ctx.numeroJeu, 0), numeroJeu: ctx.numeroJeu, phase: 'question', index: 0, questions: choix,
        fin: ctx.maintenant + DUREE, manches: Object.fromEntries(ctx.uids.map((u) => [u, 0])),
      },
    };
  },

  piloter(ctx, etat) {
    if (etat.phase !== 'question' || !etapeTerminee(ctx, etat.etape, etat.fin)) return null;
    const estimations = Object.fromEntries(Object.entries(reponsesDe<{ estimation: number }>(ctx, etat.etape)).map(([u, r]) => [u, Number(r.estimation)]));
    const gagnants = plusProches(estimations, etat.questions[etat.index].reponse);
    const manches = { ...etat.manches };
    for (const g of gagnants) manches[g] = (manches[g] ?? 0) + 1;
    return { etat: { ...etat, phase: 'resultat', estimations, gagnants, manches, fin: undefined } as Etat };
  },

  commande(ctx, etat, valeur) {
    if (valeur !== 'suivant' || etat.phase !== 'resultat') return null;
    const index = etat.index + 1;
    if (index >= etat.questions.length) {
      const max = Math.max(...Object.values(etat.manches));
      const champions = Object.keys(etat.manches).filter((u) => etat.manches[u] === max).map((u) => ctx.joueurs[u]?.prenom);
      return { etat, fin: { points: pointsDePlace(etat.manches), sorte: 'place', resume: `${champions.join(' et ')} : ${max} manche${max > 1 ? 's' : ''} gagnée${max > 1 ? 's' : ''}.` } };
    }
    return { etat: { ...etat, etape: etapeDe(etat.numeroJeu, index), index, phase: 'question', fin: ctx.maintenant + DUREE, estimations: undefined, gagnants: undefined } };
  },

  ecran(v) {
    const e = v.etat;
    const q = e.questions[e.index];
    const titre = `<p class="petit">Manche ${e.index + 1}/${e.questions.length}</p><h2 class="question">${esc(q.texte)}</h2>`;
    if (e.phase === 'question') {
      const deja = v.maReponse?.etape === e.etape;
      const champ = `prix-${e.etape}`;
      return `${chrono(e.fin)}${titre}
        ${deja
          ? `<p class="attente">Estimation envoyée : <strong>${formater(Number(v.maReponse!.estimation))}</strong> ${esc(q.unite)}</p>`
          : `<label class="champ"><span>Ton estimation ${q.unite ? `(${esc(q.unite)})` : ''}</span>
              <input name="${champ}" inputmode="decimal" autocomplete="off" value="${esc(brouillons[champ] ?? '')}" placeholder="?" data-entree="jeu" class="code nombre"></label>
             <button class="bouton jaune" data-action="jeu" data-geste="estimer">Valider</button>`}
        ${attenteDes(v.uids, v.joueurs, (u) => v.ontRepondu.includes(u) || (u === v.uid && deja))}`;
    }
    const lignes = v.uids
      .filter((u) => e.estimations?.[u] !== undefined)
      .sort((a, b) => Math.abs(e.estimations![a] - q.reponse) - Math.abs(e.estimations![b] - q.reponse))
      .map((u) => {
        const j = v.joueurs[u];
        const gagne = e.gagnants?.includes(u);
        return `<div class="ligne-resultat"><span class="pastille" style="--c:${j.couleur};width:26px;height:26px"></span><strong>${esc(j.prenom)}</strong><span>${formater(e.estimations![u])}</span><span class="pts ${gagne ? 'gagne' : ''}">${gagne ? 'Gagné' : ''}</span></div>`;
      })
      .join('');
    const pire = v.uids.filter((u) => e.estimations?.[u] !== undefined).sort((a, b) => Math.abs(e.estimations![b] - q.reponse) - Math.abs(e.estimations![a] - q.reponse))[0];
    return `${titre}
      <div class="gros-chiffre"><strong>${formater(q.reponse)}</strong><span>${esc(q.unite)}</span></div>
      <div class="pile">${lignes || '<p class="attente">Personne n’a répondu…</p>'}</div>
      ${pire && v.uids.length > 2 ? bulle(`${esc(v.joueurs[pire].prenom)}, ${formater(e.estimations![pire])} ? Tu étais sérieux ?`) : ''}
      ${v.estHote ? `<button class="bouton jaune bas" data-action="hote-jeu" data-valeur="suivant">${e.index + 1 < e.questions.length ? 'Manche suivante' : 'Voir le classement'}</button>` : `<p class="attente bas">L’hôte passe à la suite.</p>`}`;
  },

  gestes: {
    async estimer(_el, o, v) {
      const champ = `prix-${v.etat.etape}`;
      const n = lireNombre(brouillons[champ] ?? '');
      if (n === null) {
        alert('Tape un nombre (ex. 1789 ou 42 195).');
        return;
      }
      await o.repondre({ estimation: n });
    },
  },
};
