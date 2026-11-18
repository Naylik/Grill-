// « Quitte ou Double » (fusion avec le Quiz express du cahier des charges) : des questions à 4 choix, de plus en
// plus dures. Une bonne réponse fait passer la cagnotte à 1 point, puis elle double (2, 4, 8…). Une erreur fait tout
// perdre. Après chaque bonne réponse, chacun choisit en secret : encaisser (on garde et on s'arrête) ou doubler.
// La bonne réponse reste chez l'hôte (prive/quitte) jusqu'au résultat : personne ne peut la lire avant.
import questions from '../data/quiz.json';
import { esc, fraisDabord, melanger } from '../outils';
import { pointsDePlace } from '../score';
import { attenteDes, chrono } from '../ecrans/commun';
import { etapeTerminee, reponsesDe, selonFormat, type ContexteHote, type EtatDeBase, type MiniJeu } from './interface';
import { classementBarres, hud } from './arene';
import { fuseeHtml } from '../fusee';
import { sons } from '../son';

const NB_QUESTIONS: [number, number, number] = [5, 6, 7]; // Courte, Normale, Longue
const DUREE_QUESTION = 15_000;
const DUREE_RESULTAT = 6_000;
const DUREE_CHOIX = 12_000;
const DUREE_BILAN = 6_500;
const NOMS_NIVEAUX = ['', 'facile', 'moyen', 'difficile', 'très difficile'];

type Statut = 'enJeu' | 'encaisse' | 'perdu';

interface QuestionPublique {
  id: string;
  niveau: number;
  texte: string;
  choix: string[]; // mélangés : la bonne réponse n'est pas dans l'état public
}

interface Etat extends EtatDeBase {
  phase: 'question' | 'resultat' | 'choix' | 'bilan';
  numeroJeu: number;
  index: number;
  questions: QuestionPublique[];
  cagnotte: Record<string, number>;
  statut: Record<string, Statut>;
  bonne?: number; // révélée au résultat seulement
  reponses?: Record<string, number>; // révélées au résultat
  avant?: Record<string, number>; // cagnottes avant cette question (pour l'animation)
  perdus?: string[]; // ceux qui ont tout perdu à cette question
}

const etapeDe = (n: number, i: number, quoi: string) => `quitte-${n}-${i}-${quoi}`;
/** Cagnotte après une bonne réponse : 0 → 1, puis elle double. */
export const doubler = (c: number): number => (c > 0 ? c * 2 : 1);

/** Niveau de la question n° i (0 à total-1) : du facile au très difficile. */
export const niveauDe = (i: number, total: number): number => 1 + Math.min(3, Math.floor((i * 4) / total));

const enJeu = (e: Etat, uids: string[]) => uids.filter((u) => (e.statut[u] ?? 'enJeu') === 'enJeu');

function demarrerQuestion(ctx: ContexteHote, etat: Etat, index: number) {
  return { etat: { ...etat, phase: 'question' as const, index, etape: etapeDe(etat.numeroJeu, index, 'q'), fin: ctx.maintenant + DUREE_QUESTION, bonne: undefined, reponses: undefined } };
}

export const quitteOuDouble: MiniJeu<Etat> = {
  id: 'quitte',
  nom: 'Quitte ou Double',
  accroche: 'Bonne réponse : ta cagnotte double. Erreur : tu perds tout.',
  explication: {
    comment: 'Une question à 4 choix, tout le monde répond en même temps. Bonne réponse : ta cagnotte passe à 1 point, puis double à chaque fois (2, 4, 8…). Mauvaise réponse : tu perds tout. Après chaque bonne réponse, tu choisis en secret d’encaisser ou de doubler.',
    gagner: 'La plus grosse cagnotte encaissée gagne. Les questions sont de plus en plus dures (5 à 7 selon le format).',
  },
  icone: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z" fill="currentColor"/>',
  couleur: '#FFD84A',
  autorise: () => true,
  tours: (duree) => `${selonFormat(duree, NB_QUESTIONS)} questions`,
  contenus: (e) => e.questions.map((q) => q.id),

  demarrer(ctx) {
    const total = selonFormat(ctx.duree, NB_QUESTIONS);
    // Une question par niveau voulu, d'abord celles que le groupe n'a jamais vues.
    const deja = new Set<string>();
    const tirees = Array.from({ length: total }, (_, i) => {
      const niveau = niveauDe(i, total);
      const q = fraisDabord(questions.filter((x) => x.niveau === niveau && !deja.has(x.id)), ctx.dejaVus, ctx.hasard)[0];
      deja.add(q.id);
      return q;
    });
    // On mélange les choix : seul l'hôte garde l'emplacement de la bonne réponse.
    const bonnes: number[] = [];
    const publiques = tirees.map((q) => {
      const ordre = melanger([0, 1, 2, 3], ctx.hasard);
      bonnes.push(ordre.indexOf(q.bonne));
      return { id: q.id, niveau: q.niveau, texte: q.texte, choix: ordre.map((k) => q.choix[k]) };
    });
    const etat: Etat = {
      etape: etapeDe(ctx.numeroJeu, 0, 'q'), phase: 'question', numeroJeu: ctx.numeroJeu, index: 0, questions: publiques,
      cagnotte: Object.fromEntries(ctx.uids.map((u) => [u, 0])),
      statut: Object.fromEntries(ctx.uids.map((u) => [u, 'enJeu' as Statut])),
      fin: ctx.maintenant + DUREE_QUESTION,
    };
    return { etat, ecritures: { 'prive/quitte': { bonnes } } };
  },

  piloter(ctx, etat) {
    const now = ctx.maintenant;
    const joueurs = enJeu(etat, ctx.uids);
    if (etat.phase === 'question' && etapeTerminee(ctx, etat.etape, etat.fin, joueurs)) {
      const bonne = Number((ctx.prive.quitte as { bonnes?: number[] } | undefined)?.bonnes?.[etat.index] ?? -1);
      const recues = reponsesDe<{ choix: number }>(ctx, etat.etape);
      const reponses = Object.fromEntries(joueurs.filter((u) => recues[u]).map((u) => [u, Number(recues[u].choix)]));
      const cagnotte = { ...etat.cagnotte };
      const statut = { ...etat.statut };
      for (const u of joueurs) {
        if (reponses[u] === bonne) cagnotte[u] = doubler(cagnotte[u] ?? 0);
        else {
          cagnotte[u] = 0;
          statut[u] = 'perdu';
        }
      }
      const perdus = joueurs.filter((u) => statut[u] === 'perdu');
      return { etat: { ...etat, phase: 'resultat', bonne, reponses, cagnotte, statut, avant: { ...etat.cagnotte }, perdus, fin: now + DUREE_RESULTAT } };
    }
    if (etat.phase === 'resultat' && now >= (etat.fin ?? 0)) {
      const dernier = etat.index + 1 >= etat.questions.length;
      if (dernier || !joueurs.length) {
        // Fin : ceux qui sont encore en jeu encaissent automatiquement.
        const statut = Object.fromEntries(ctx.uids.map((u) => [u, (etat.statut[u] ?? 'enJeu') === 'enJeu' ? 'encaisse' : etat.statut[u]])) as Record<string, Statut>;
        return { etat: { ...etat, phase: 'bilan', statut, fin: now + DUREE_BILAN } };
      }
      return { etat: { ...etat, phase: 'choix', etape: etapeDe(etat.numeroJeu, etat.index, 'c'), fin: now + DUREE_CHOIX } };
    }
    if (etat.phase === 'choix' && etapeTerminee(ctx, etat.etape, etat.fin, joueurs)) {
      const recues = reponsesDe<{ decision: string }>(ctx, etat.etape);
      // Pas de réponse : on encaisse (on ne fait jamais perdre quelqu'un qui n'a rien choisi).
      const statut = { ...etat.statut };
      for (const u of joueurs) if (recues[u]?.decision !== 'doubler') statut[u] = 'encaisse';
      const suite = { ...etat, statut };
      if (!enJeu(suite, ctx.uids).length) return { etat: { ...suite, phase: 'bilan', fin: now + DUREE_BILAN } };
      return demarrerQuestion(ctx, suite, etat.index + 1);
    }
    if (etat.phase === 'bilan' && now >= (etat.fin ?? 0)) {
      const meilleur = Math.max(...ctx.uids.map((u) => etat.cagnotte[u] ?? 0));
      const champions = ctx.uids.filter((u) => (etat.cagnotte[u] ?? 0) === meilleur && meilleur > 0).map((u) => ctx.joueurs[u]?.prenom);
      return {
        etat,
        ecritures: { 'prive/quitte': null },
        fin: { points: pointsDePlace(etat.cagnotte), sorte: 'place', resume: champions.length ? `${champions.join(' et ')} : ${meilleur} pts encaissés.` : 'Tout le monde a tout perdu !' },
      };
    }
    return null;
  },

  ecran(v) {
    const e = v.etat;
    const total = e.questions.length;
    const nom = (u: string) => esc(v.joueurs[u]?.prenom ?? '?');
    const moiStatut = e.statut[v.uid] ?? 'enJeu';
    const maCagnotte = e.cagnotte[v.uid] ?? 0;
    const q = e.questions[e.index];
    const tete = `${hud('QUITTE OU DOUBLE', e.index, total, e.phase !== 'bilan')}
      <div class="record-arene"><span>QUESTION ${Math.min(e.index + 1, total)}/${total} · ${NOMS_NIVEAUX[q?.niveau ?? 1].toUpperCase()}</span><span>TA CAGNOTTE <b>${maCagnotte} pt${maCagnotte > 1 ? 's' : ''}</b></span></div>`;
    const lignesJoueurs = () => v.uids.map((u) => {
      const s = e.statut[u] ?? 'enJeu';
      return `<div class="${u === v.uid ? 'moi' : ''} ${s === 'perdu' ? 'elimine' : ''}"><span class="pastille" style="--c:${v.joueurs[u].couleur};width:24px;height:24px"></span>${nom(u)}<em>${s === 'perdu' ? 'perdu' : s === 'encaisse' ? `encaissé ${e.cagnotte[u]}` : `${e.cagnotte[u] ?? 0} pt${(e.cagnotte[u] ?? 0) > 1 ? 's' : ''}`}</em></div>`;
    }).join('');

    if (e.phase === 'bilan') {
      const ordre = [...v.uids].sort((a, b) => (e.cagnotte[b] ?? 0) - (e.cagnotte[a] ?? 0));
      const max = Math.max(1, ...ordre.map((u) => e.cagnotte[u] ?? 0));
      return `${hud('QUITTE OU DOUBLE', total, total, false)}
        <h2 class="question centre-texte">Les cagnottes</h2>
        <div class="pile">${classementBarres(ordre.map((u) => ({ joueur: v.joueurs[u], texte: `${e.cagnotte[u] ?? 0} pts`, part: (e.cagnotte[u] ?? 0) / max, moi: u === v.uid })))}</div>`;
    }

    if (e.phase === 'question') {
      const ma = v.local[e.etape] as number | undefined;
      const repondu = v.maReponse?.etape === e.etape || ma !== undefined;
      const joueurs = enJeu(e, v.uids);
      const choix = q.choix.map((c, i) => `<button class="option choix-quiz ${ma === i ? 'actif jaune' : ''}" ${moiStatut !== 'enJeu' || repondu ? 'disabled' : `data-action="jeu" data-geste="repondre" data-valeur="${i}"`}><b>${'ABCD'[i]}</b>${esc(c)}</button>`).join('');
      return `${tete}${chrono(e.fin)}
        <h2 class="question">${esc(q.texte)}</h2>
        <div class="choix-quiz-grille">${choix}</div>
        ${moiStatut === 'perdu' ? '<p class="aide">Tu as tout perdu : regarde les autres trembler.</p>' : moiStatut === 'encaisse' ? `<p class="aide">Tu as encaissé ${maCagnotte} pts. Tu regardes les autres prendre des risques.</p>` : repondu ? '<p class="attente">Réponse envoyée…</p>' : `<p class="aide">Bonne réponse : ${doubler(maCagnotte)} pt${doubler(maCagnotte) > 1 ? 's' : ''}. Erreur : 0.</p>`}
        ${attenteDes(joueurs, v.joueurs, (u) => v.ontRepondu.includes(u) || (u === v.uid && repondu))}`;
    }

    if (e.phase === 'resultat') {
      const reponses = e.reponses ?? {};
      const choix = q.choix.map((c, i) => {
        const qui = Object.keys(reponses).filter((u) => reponses[u] === i);
        return `<div class="option choix-quiz resultat ${i === e.bonne ? 'bonne' : qui.length ? 'fausse' : ''}"><b>${'ABCD'[i]}</b>${esc(c)}<small>${qui.map(nom).join(', ')}</small></div>`;
      }).join('');
      // Ma fusée : elle grimpe si j'ai bon, elle crashe si je viens de tout perdre.
      const avant = e.avant?.[v.uid] ?? 0;
      const fusee = e.perdus?.includes(v.uid)
        ? fuseeHtml(`${e.etape}-crash`, { depart: avant, cible: avant, crash: true })
        : moiStatut === 'enJeu'
          ? fuseeHtml(`${e.etape}-monte`, { depart: avant, cible: maCagnotte })
          : '';
      return `${tete}${fusee}
        <h2 class="question petite">${esc(q.texte)}</h2>
        <div class="choix-quiz-grille">${choix}</div>
        <div class="joueurs-arene">${lignesJoueurs()}</div>`;
    }

    // Choix secret : encaisser ou doubler.
    const decide = v.maReponse?.etape === e.etape || v.local[e.etape] !== undefined;
    const joueurs = enJeu(e, v.uids);
    const prochaine = e.questions[e.index + 1];
    if (moiStatut !== 'enJeu') {
      return `${tete}<h2 class="question centre-texte">Les autres décident en secret…</h2>
        <p class="aide">Encaisser ou doubler ? Prochaine question : ${NOMS_NIVEAUX[prochaine?.niveau ?? 4]}.</p>
        ${attenteDes(joueurs, v.joueurs, (u) => v.ontRepondu.includes(u))}${chrono(e.fin)}`;
    }
    const monChoix = v.local[e.etape] as string | undefined;
    return `${tete}${chrono(e.fin)}
      ${fuseeHtml(`${e.etape}-${monChoix === 'encaisser' ? 'encaisse' : 'choix'}`, { depart: maCagnotte, cible: maCagnotte, encaisse: monChoix === 'encaisser' })}
      <p class="aide">Prochaine question : <strong>${NOMS_NIVEAUX[prochaine?.niveau ?? 4]}</strong>. Doubler, c’est viser ${maCagnotte * 2} pts… ou tout perdre.</p>
      ${decide
        ? '<p class="attente">Choix enregistré, en secret.</p>'
        : `<div class="options deux grosses choix-qd"><button class="bouton vert" data-action="jeu" data-geste="decider" data-valeur="encaisser">Encaisser</button><button class="bouton rose" data-action="jeu" data-geste="decider" data-valeur="doubler">Doubler</button></div>`}
      <p class="aide">Sans réponse, tu encaisses.</p>
      ${attenteDes(joueurs, v.joueurs, (u) => v.ontRepondu.includes(u) || (u === v.uid && decide))}`;
  },

  gestes: {
    async repondre(el, o, v) {
      const e = v.etat;
      if (e.phase !== 'question' || (e.statut[v.uid] ?? 'enJeu') !== 'enJeu' || o.local[e.etape] !== undefined || v.maReponse?.etape === e.etape) return;
      const choix = Number(el.dataset.valeur);
      o.local[e.etape] = choix;
      o.rafraichir();
      await o.repondre({ choix });
    },
    async decider(el, o, v) {
      const e = v.etat;
      if (e.phase !== 'choix' || (e.statut[v.uid] ?? 'enJeu') !== 'enJeu' || o.local[e.etape] !== undefined) return;
      o.local[e.etape] = el.dataset.valeur;
      if (el.dataset.valeur === 'encaisser') sons.reussi();
      o.rafraichir();
      await o.repondre({ decision: el.dataset.valeur });
    },
  },
};
