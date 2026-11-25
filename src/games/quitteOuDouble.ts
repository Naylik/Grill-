// « Quitte ou Double » (fusion avec le Quiz express du cahier des charges) : des questions à 4 choix, de plus en
// plus dures. Une bonne réponse fait passer la cagnotte à 1 point, puis elle double (2, 4, 8…). Une erreur fait perdre
// la cagnotte en cours. Après chaque bonne réponse, chacun choisit en secret : encaisser (la cagnotte passe dans sa
// banque, à l'abri, et il repart de 0) ou doubler. Tout le monde joue toutes les questions ; la plus grosse banque gagne.
// La bonne réponse reste chez l'hôte (prive/quitte) jusqu'au résultat : personne ne peut la lire avant.
import questions from '../data/quiz.json';
import { esc, fraisDabord, melanger, pts } from '../outils';
import { pointsDePlace } from '../score';
import { attenteDes, chrono } from '../ecrans/commun';
import { etapeTerminee, reponsesDe, selonFormat, type ContexteHote, type EtatDeBase, type MiniJeu, DUREE_BILAN, avecSuiteBilan } from './interface';
import { classementBarres, hud } from './arene';
import { fuseeHtml } from '../fusee';
import { sons } from '../son';

const NB_QUESTIONS: [number, number, number] = [8, 10, 12]; // Courte, Normale, Longue (assez pour encaisser plusieurs fois)
const DUREE_QUESTION = 15_000;
const DUREE_RESULTAT = 6_000;
const DUREE_CHOIX = 12_000;
const NOMS_NIVEAUX = ['', 'facile', 'moyen', 'difficile', 'très difficile'];


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
  cagnotte: Record<string, number>; // en jeu (perdue en cas d'erreur)
  banque: Record<string, number>; // total encaissé, à l'abri
  bonne?: number; // révélée au résultat seulement
  reponses?: Record<string, number>; // révélées au résultat
  avant?: Record<string, number>; // cagnottes avant cette question (pour l'animation)
  perdus?: string[]; // ceux qui viennent de perdre leur cagnotte en cours
  encaisses?: Record<string, number>; // ce que chacun vient d'encaisser (pour l'afficher)
}

const etapeDe = (n: number, i: number, quoi: string) => `quitte-${n}-${i}-${quoi}`;
/** Cagnotte après une bonne réponse : 0 → 1, puis elle double. */
export const doubler = (c: number): number => (c > 0 ? c * 2 : 1);

/** Niveau de la question n° i (0 à total-1) : du facile au très difficile. */
export const niveauDe = (i: number, total: number): number => 1 + Math.min(3, Math.floor((i * 4) / total));

/** Ceux qui ont une cagnotte en jeu : ils choisissent d'encaisser ou de doubler. */
const aDecider = (e: Etat, uids: string[]) => uids.filter((u) => (e.cagnotte[u] ?? 0) > 0);
/** Fin du jeu : ce qui reste en jeu est encaissé automatiquement. */
const toutEncaisser = (e: Etat, uids: string[]) => ({
  banque: Object.fromEntries(uids.map((u) => [u, (e.banque?.[u] ?? 0) + (e.cagnotte[u] ?? 0)])),
  cagnotte: Object.fromEntries(uids.map((u) => [u, 0])),
});

function demarrerQuestion(ctx: ContexteHote, etat: Etat, index: number) {
  return { etat: { ...etat, phase: 'question' as const, index, etape: etapeDe(etat.numeroJeu, index, 'q'), fin: ctx.maintenant + DUREE_QUESTION, bonne: undefined, reponses: undefined } };
}

export const quitteOuDouble: MiniJeu<Etat> = {
  id: 'quitte',
  nom: 'Quitte ou Double',
  accroche: 'Bonne réponse : ta cagnotte double. Encaisse avant de tout perdre.',
  explication: {
    comment: 'Une question à 4 choix, tout le monde répond en même temps. Bonne réponse : ta cagnotte passe à 1 point, puis double à chaque fois (2, 4, 8…). Mauvaise réponse : tu perds ta cagnotte en cours. Après chaque bonne réponse, tu choisis en secret : encaisser (tes points passent dans ta banque, à l’abri, et tu repars de 0) ou doubler.',
    gagner: 'Le plus gros total encaissé gagne. Tout le monde joue toutes les questions, de plus en plus dures (8 à 12 selon le format).',
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
      banque: Object.fromEntries(ctx.uids.map((u) => [u, 0])),
      fin: ctx.maintenant + DUREE_QUESTION,
    };
    return { etat, ecritures: { 'prive/quitte': { bonnes } } };
  },

  piloter(ctx, etat) {
    const now = ctx.maintenant;
    const e0: Etat = { ...etat, banque: etat.banque ?? {} };
    if (e0.phase === 'question' && etapeTerminee(ctx, e0.etape, e0.fin)) {
      const bonne = Number((ctx.prive.quitte as { bonnes?: number[] } | undefined)?.bonnes?.[e0.index] ?? -1);
      const recues = reponsesDe<{ choix: number }>(ctx, e0.etape);
      const reponses = Object.fromEntries(ctx.uids.filter((u) => recues[u]).map((u) => [u, Number(recues[u].choix)]));
      const cagnotte = { ...e0.cagnotte };
      for (const u of ctx.uids) cagnotte[u] = reponses[u] === bonne ? doubler(cagnotte[u] ?? 0) : 0;
      // Perdu : ceux qui avaient une cagnotte en jeu et se sont trompés.
      const perdus = ctx.uids.filter((u) => (e0.cagnotte[u] ?? 0) > 0 && cagnotte[u] === 0);
      return { etat: { ...e0, phase: 'resultat', bonne, reponses, cagnotte, avant: { ...e0.cagnotte }, perdus, encaisses: undefined, fin: now + DUREE_RESULTAT } };
    }
    if (e0.phase === 'resultat' && now >= (e0.fin ?? 0)) {
      const dernier = e0.index + 1 >= e0.questions.length;
      if (dernier) return { etat: { ...e0, ...toutEncaisser(e0, ctx.uids), phase: 'bilan', fin: now + DUREE_BILAN } };
      // Personne n'a de cagnotte en jeu : pas de choix à faire, question suivante.
      if (!aDecider(e0, ctx.uids).length) return demarrerQuestion(ctx, e0, e0.index + 1);
      return { etat: { ...e0, phase: 'choix', etape: etapeDe(e0.numeroJeu, e0.index, 'c'), fin: now + DUREE_CHOIX } };
    }
    if (e0.phase === 'choix' && etapeTerminee(ctx, e0.etape, e0.fin, aDecider(e0, ctx.uids))) {
      const recues = reponsesDe<{ decision: string }>(ctx, e0.etape);
      // Pas de réponse : on encaisse (on ne fait jamais perdre quelqu'un qui n'a rien choisi).
      const banque = { ...e0.banque };
      const cagnotte = { ...e0.cagnotte };
      const encaisses: Record<string, number> = {};
      for (const u of aDecider(e0, ctx.uids)) {
        if (recues[u]?.decision === 'doubler') continue;
        encaisses[u] = cagnotte[u];
        banque[u] = (banque[u] ?? 0) + cagnotte[u];
        cagnotte[u] = 0;
      }
      return demarrerQuestion(ctx, { ...e0, banque, cagnotte, encaisses }, e0.index + 1);
    }
    if (e0.phase === 'bilan' && now >= (e0.fin ?? 0)) {
      const meilleur = Math.max(...ctx.uids.map((u) => e0.banque[u] ?? 0));
      const champions = ctx.uids.filter((u) => (e0.banque[u] ?? 0) === meilleur && meilleur > 0).map((u) => ctx.joueurs[u]?.prenom);
      return {
        etat: e0,
        ecritures: { 'prive/quitte': null },
        fin: { points: pointsDePlace(e0.banque), sorte: 'place', resume: champions.length ? `${champions.join(' et ')} : ${pts(meilleur)} encaissés au total.` : 'Personne n’a rien encaissé !' },
      };
    }
    return null;
  },

  ecran(v) {
    const e = { ...v.etat, banque: v.etat.banque ?? {} };
    const total = e.questions.length;
    const nom = (u: string) => esc(v.joueurs[u]?.prenom ?? '?');
    const maCagnotte = e.cagnotte[v.uid] ?? 0;
    const maBanque = e.banque[v.uid] ?? 0;
    const q = e.questions[e.index];
    const pts = (n: number) => `${n} pt${n > 1 ? 's' : ''}`;
    const tete = `${hud('QUITTE OU DOUBLE', e.index, total, e.phase !== 'bilan')}
      <div class="record-arene"><span>QUESTION ${Math.min(e.index + 1, total)}/${total} · ${NOMS_NIVEAUX[q?.niveau ?? 1].toUpperCase()}</span><span>BANQUE <b>${pts(maBanque)}</b>${maCagnotte ? ` · EN JEU <b>${pts(maCagnotte)}</b>` : ''}</span></div>`;
    const lignesJoueurs = () => v.uids.map((u) => {
      const perdu = e.perdus?.includes(u);
      return `<div class="${u === v.uid ? 'moi' : ''} ${perdu ? 'elimine' : ''}"><span class="pastille" style="--c:${v.joueurs[u].couleur};width:24px;height:24px"></span>${nom(u)}<em>🏦 ${e.banque[u] ?? 0}${(e.cagnotte[u] ?? 0) ? ` · en jeu ${e.cagnotte[u]}` : perdu ? ' · perdu' : ''}</em></div>`;
    }).join('');

    if (e.phase === 'bilan') {
      const ordre = [...v.uids].sort((a, b) => (e.banque[b] ?? 0) - (e.banque[a] ?? 0));
      const max = Math.max(1, ...ordre.map((u) => e.banque[u] ?? 0));
      return `${hud('QUITTE OU DOUBLE', total, total, false)}
        <h2 class="question centre-texte">Les banques</h2>
        <div class="pile">${classementBarres(ordre.map((u) => ({ joueur: v.joueurs[u], texte: `${pts(e.banque[u] ?? 0)} encaissés`, part: (e.banque[u] ?? 0) / max, moi: u === v.uid })))}</div>`;
    }

    if (e.phase === 'question') {
      const ma = v.local[e.etape] as number | undefined;
      const repondu = v.maReponse?.etape === e.etape || ma !== undefined;
      const choix = q.choix.map((c, i) => `<button class="option choix-quiz ${ma === i ? 'actif jaune' : ''}" ${repondu ? 'disabled' : `data-action="jeu" data-geste="repondre" data-valeur="${i}"`}><b>${'ABCD'[i]}</b>${esc(c)}</button>`).join('');
      const vientDEncaisser = e.encaisses?.[v.uid];
      return `${tete}${chrono(e.fin)}
        ${vientDEncaisser ? `<p class="aide vert-texte">+${pts(vientDEncaisser)} à l’abri dans ta banque. Tu repars de 0.</p>` : ''}
        <h2 class="question">${esc(q.texte)}</h2>
        <div class="choix-quiz-grille">${choix}</div>
        ${repondu ? '<p class="attente">Réponse envoyée…</p>' : `<p class="aide">Bonne réponse : ${pts(doubler(maCagnotte))} en jeu. Erreur : ${maCagnotte ? `tu perds ces ${pts(maCagnotte)} (ta banque est à l’abri)` : '0'}.</p>`}
        ${attenteDes(v.uids, v.joueurs, (u) => v.ontRepondu.includes(u) || (u === v.uid && repondu))}`;
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
        : maCagnotte > 0
          ? fuseeHtml(`${e.etape}-monte`, { depart: avant, cible: maCagnotte })
          : '';
      return `${tete}${fusee}
        <h2 class="question petite">${esc(q.texte)}</h2>
        <div class="choix-quiz-grille">${choix}</div>
        <div class="joueurs-arene">${lignesJoueurs()}</div>`;
    }

    // Choix secret : encaisser ou doubler.
    const decide = v.maReponse?.etape === e.etape || v.local[e.etape] !== undefined;
    const joueurs = aDecider(e, v.uids);
    const prochaine = e.questions[e.index + 1];
    if (maCagnotte <= 0) {
      return `${tete}<h2 class="question centre-texte">Les autres décident en secret…</h2>
        <p class="aide">Encaisser ou doubler ? Toi, tu repars de 0 à la prochaine question (${NOMS_NIVEAUX[prochaine?.niveau ?? 4]}).</p>
        ${attenteDes(joueurs, v.joueurs, (u) => v.ontRepondu.includes(u))}${chrono(e.fin)}`;
    }
    const monChoix = v.local[e.etape] as string | undefined;
    return `${tete}${chrono(e.fin)}
      ${fuseeHtml(`${e.etape}-${monChoix === 'encaisser' ? 'encaisse' : 'choix'}`, { depart: maCagnotte, cible: maCagnotte, encaisse: monChoix === 'encaisser' })}
      <p class="aide">Encaisser : +${pts(maCagnotte)} dans ta banque (${pts(maBanque + maCagnotte)} au total) et tu repars de 0.<br>Doubler : prochaine question <strong>${NOMS_NIVEAUX[prochaine?.niveau ?? 4]}</strong>, tu vises ${pts(maCagnotte * 2)}… ou tu perds ces ${pts(maCagnotte)}.</p>
      ${decide
        ? '<p class="attente">Choix enregistré, en secret.</p>'
        : `<div class="options deux grosses choix-qd"><button class="bouton vert" data-action="jeu" data-geste="decider" data-valeur="encaisser">Encaisser</button><button class="bouton rose" data-action="jeu" data-geste="decider" data-valeur="doubler">Doubler</button></div>`}
      <p class="aide">Sans réponse, tu encaisses.</p>
      ${attenteDes(joueurs, v.joueurs, (u) => v.ontRepondu.includes(u) || (u === v.uid && decide))}`;
  },

  gestes: {
    async repondre(el, o, v) {
      const e = v.etat;
      if (e.phase !== 'question' || o.local[e.etape] !== undefined || v.maReponse?.etape === e.etape) return;
      const choix = Number(el.dataset.valeur);
      o.local[e.etape] = choix;
      o.rafraichir();
      await o.repondre({ choix });
    },
    async decider(el, o, v) {
      const e = v.etat;
      if (e.phase !== 'choix' || (e.cagnotte[v.uid] ?? 0) <= 0 || o.local[e.etape] !== undefined) return;
      o.local[e.etape] = el.dataset.valeur;
      if (el.dataset.valeur === 'encaisser') sons.reussi();
      o.rafraichir();
      await o.repondre({ decision: el.dataset.valeur });
    },
  },
};

avecSuiteBilan(quitteOuDouble);
