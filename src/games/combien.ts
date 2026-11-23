// « Combien ont dit oui ? » : une question gênante, chacun répond oui ou non anonymement,
// puis devine combien ont dit oui. Seul le total est révélé. 3 pts si exact, 1 pt à un près.
import questions from '../data/combien.json';
import { fraisDabord } from '../outils';
import { esc, parmi } from '../outils';
import { hacher, hasardDe } from '../flash';
import { pointsCombien, pointsDePlace } from '../score';
import { attenteDes, bulle, chrono } from '../ecrans/commun';
import { vibrer } from '../ui';
import { etapeTerminee, reponsesDe, type EtatDeBase, type MiniJeu, selonFormat } from './interface';

export type Feinte = 'hesite' | 'fauxPlein' | 'clignote' | 'fausseFin' | 'aucune';

/**
 * Minutage de la jauge de suspense (en ms depuis l'affichage) : un cran par « oui », de plus en plus lent, avec une
 * feinte différente à chaque question (le cran suivant qui hésite, qui se remplit puis se vide, qui clignote, ou un
 * long silence avant le dernier cran…). Tiré à partir de l'étape : le même sur tous les téléphones.
 */
export function minutageJauge(total: number, nbJoueurs: number, graine = ''): { crans: number[]; feinte: { type: Feinte; cran: number; t: number } | null; fin: number } {
  const hasard = hasardDe(hacher(`jauge:${graine}`));
  const reste = total < nbJoueurs;
  const possibles: Feinte[] = reste ? ['hesite', 'fauxPlein', 'clignote', ...(total > 0 ? (['fausseFin', 'aucune'] as Feinte[]) : [])] : ['fausseFin', 'aucune'];
  const type = graine ? possibles[Math.floor(hasard() * possibles.length)] : reste ? 'hesite' : 'aucune';
  // Rythme variable : départ, pas et ralentissement tirés au hasard.
  let t = graine ? 400 + Math.round(hasard() * 500) : 600;
  const pas = graine ? 450 + Math.round(hasard() * 350) : 700;
  const frein = graine ? 150 + Math.round(hasard() * 300) : 400;
  const crans: number[] = [];
  for (let k = 0; k < total; k++) {
    // Fausse fin : un long silence juste avant le dernier cran… on croit que c'est fini.
    if (type === 'fausseFin' && k === total - 1) t += 1400 + Math.round(hasard() * 700);
    crans.push(t);
    t += pas + frein * k;
  }
  if (type === 'hesite' || type === 'fauxPlein' || type === 'clignote') {
    const duree = { hesite: 1500, fauxPlein: 1700, clignote: 1300 }[type];
    return { crans, feinte: { type, cran: total, t }, fin: t + duree };
  }
  return { crans, feinte: type === 'fausseFin' ? { type, cran: total - 1, t: crans[total - 1] } : null, fin: t + 200 };
}

// Le narrateur réagit au total (taquin, jamais méchant ; la même phrase sur tous les téléphones).
const PHRASES_ZERO = ['Zéro ! Soit vous êtes des anges, soit vous êtes très organisés.', 'Personne ? La table la plus sage de France.', 'Aucun oui. Je note, je ne crois pas, mais je note.'];
const PHRASES_TOUS = ['Tout le monde ! Cette table n’a plus aucun secret.', 'Unanimité. Je propose qu’on n’en parle plus jamais.', '100 % de oui. Au moins, vous êtes honnêtes.'];
const PHRASES_CERTAINS = ['Les regards se croisent… et personne ne dit rien.', 'Hmm. Il y a des coupables autour de cette table.', 'Je ne dirai pas qui. Mais quelqu’un rougit.', 'Intéressant… Les suspects sont parmi nous.']
const NB_QUESTIONS: [number, number, number] = [4, 6, 8]; // Courte, Normale, Longue
const DUREE_QUESTION = 45_000;

interface Etat extends EtatDeBase {
  phase: 'question' | 'resultat';
  numeroJeu: number;
  index: number;
  questions: string[];
  ids?: string[]; // identifiants des questions (mémoire du groupe)
  totalOui?: number;
  estimations?: Record<string, number>;
  gagnes?: Record<string, number>; // points de cette question
  cumul: Record<string, number>; // score interne du jeu
}

const etapeDe = (numeroJeu: number, i: number) => `combien-${numeroJeu}-${i}`;

export const combien: MiniJeu<Etat> = {
  id: 'combien',
  nom: 'Combien ont dit oui ?',
  accroche: 'Réponds en secret, puis devine combien ont dit oui. Seul le total est révélé.',
  explication: {
    comment: 'Une question gênante s’affiche (« As-tu déjà stalké un ex ? »). Chacun répond oui ou non en secret, puis devine combien de joueurs ont dit oui. Seul le total est révélé : personne ne sait qui a répondu quoi.',
    gagner: '3 points si tu trouves le chiffre exact, 1 point à un près. 4 à 8 questions selon le format choisi.',
  },
  icone: '<path d="M12 3a9 9 0 1 0 9 9h-9z" fill="currentColor"/><path d="M15 2.5A9 9 0 0 1 21.5 9H15z" fill="currentColor" opacity=".5"/>',
  couleur: '#FF4F8B',
  tours: (duree) => `${selonFormat(duree, NB_QUESTIONS)} questions`,
  contenus: (e) => e.ids ?? [],
  autorise: () => true,

  demarrer(ctx) {
    const tirees = fraisDabord(questions.filter((q) => q.niveau !== 'hot'), ctx.dejaVus, ctx.hasard).slice(0, selonFormat(ctx.duree, NB_QUESTIONS));
    const choix = tirees.map((q) => q.texte);
    return {
      etat: { etape: etapeDe(ctx.numeroJeu, 0), numeroJeu: ctx.numeroJeu, phase: 'question', index: 0, questions: choix, ids: tirees.map((q) => q.id), fin: ctx.maintenant + DUREE_QUESTION, cumul: Object.fromEntries(ctx.uids.map((u) => [u, 0])) },
      ecritures: { [`compteurs/${etapeDe(ctx.numeroJeu, 0)}`]: 0 },
    };
  },

  piloter(ctx, etat) {
    if (etat.phase !== 'question' || !etapeTerminee(ctx, etat.etape, etat.fin)) return null;
    const recues = reponsesDe<{ estimation: number }>(ctx, etat.etape);
    const totalOui = ctx.compteurs[etat.etape] ?? 0;
    const estimations = Object.fromEntries(Object.entries(recues).map(([u, r]) => [u, Number(r.estimation)]));
    const gagnes = Object.fromEntries(ctx.uids.map((u) => [u, u in estimations ? pointsCombien(estimations[u], totalOui) : 0]));
    const cumul = Object.fromEntries(ctx.uids.map((u) => [u, (etat.cumul[u] ?? 0) + gagnes[u]]));
    return { etat: { ...etat, phase: 'resultat', totalOui, estimations, gagnes, cumul, fin: undefined } as Etat };
  },

  commande(ctx, etat, valeur) {
    if (valeur !== 'suivant' || etat.phase !== 'resultat') return null;
    const index = etat.index + 1;
    if (index >= etat.questions.length) {
      return { etat, fin: { points: pointsDePlace(etat.cumul), sorte: 'place' } };
    }
    const etape = etapeDe(etat.numeroJeu, index);
    return {
      etat: { ...etat, etape, index, phase: 'question', fin: ctx.maintenant + DUREE_QUESTION, totalOui: undefined, estimations: undefined, gagnes: undefined },
      ecritures: { [`compteurs/${etape}`]: 0 },
    };
  },

  ecran(v) {
    const e = v.etat;
    const n = v.uids.length;
    const titre = `<p class="petit">Question ${e.index + 1}/${e.questions.length}</p><h2 class="question">${esc(e.questions[e.index])}</h2>`;
    if (e.phase === 'question') {
      const dejaRepondu = v.maReponse?.etape === e.etape;
      const monOui = v.local[e.etape] as 'oui' | 'non' | undefined;
      const tampon = v.local[`${e.etape}:tampon`] as string | undefined;
      const etatBouton = (valeur: string) => (tampon ? (tampon === valeur ? 'tamponne' : 'eteint') : '');
      let corps: string;
      if (dejaRepondu) corps = `<p class="attente">C’est noté. On attend les autres…</p>`;
      else if (!monOui) {
        corps = `<p class="aide">Ta réponse reste anonyme : seul le total sera affiché.</p>
          <div class="options deux grosses">
            <button class="bouton vert bouton-tampon ${etatBouton('oui')}" data-action="jeu" data-geste="ouiNon" data-valeur="oui"><span class="txt">Oui</span><span class="tampon-rep" aria-hidden="true">OUI ✔</span></button>
            <button class="bouton rose bouton-tampon ${etatBouton('non')}" data-action="jeu" data-geste="ouiNon" data-valeur="non"><span class="txt">Non</span><span class="tampon-rep" aria-hidden="true">NON ✘</span></button>
          </div>`;
      } else {
        corps = `<p class="intitule">Combien ont dit oui, à ton avis ? <span class="petit">(toi compris)</span></p>
          <div class="grille-nombres arrive-estimation">${Array.from({ length: n + 1 }, (_, i) => `<button class="option" data-action="jeu" data-geste="estimer" data-valeur="${i}">${i}</button>`).join('')}</div>
          <button class="bouton discret" data-action="jeu" data-geste="annulerOuiNon">Changer ma réponse (${monOui})</button>`;
      }
      return `${chrono(e.fin)}${titre}${corps}${attenteDes(v.uids, v.joueurs, (u) => v.ontRepondu.includes(u) || (u === v.uid && dejaRepondu))}`;
    }
    // Résultat
    const lignes = v.uids
      .map((u) => {
        const j = v.joueurs[u];
        const est = e.estimations?.[u];
        const pts = e.gagnes?.[u] ?? 0;
        // En toutes lettres : « a deviné 2 oui · ✔ exact : +3 · total : 5 pts ».
        const verdict = est === undefined ? 'pas de réponse' : pts >= 3 ? `✔ exact : +${pts}` : pts > 0 ? `à un près : +${pts}` : 'raté : +0';
        const detail = `${est !== undefined ? `a deviné ${est} oui · ` : ''}${verdict} · total : ${e.cumul?.[u] ?? 0} pt${(e.cumul?.[u] ?? 0) > 1 ? "s" : ""}`;
        return `<div class="ligne-resultat ligne-combien"><span class="pastille" style="--c:${j.couleur};width:26px;height:26px"></span><div><strong>${esc(j.prenom)}</strong><span class="detail-combien ${pts ? 'gagne' : ''}">${detail}</span></div></div>`;
      })
      .join('');
    const total = e.totalOui ?? 0;
    // Suspense : la jauge se remplit cran par cran (un cran par joueur), le cran suivant hésite… puis le chiffre tombe.
    const m = minutageJauge(total, n, e.etape);
    const crans = Array.from({ length: n }, (_, k) => {
      if (k < total) return `<div class="cran-oui on" style="--d:${m.crans[k]}ms"><i></i></div>`;
      if (m.feinte && k === m.feinte.cran && m.feinte.type !== 'fausseFin') return `<div class="cran-oui ${m.feinte.type}" style="--d:${m.feinte.t}ms"><i></i></div>`;
      return '<div class="cran-oui"><i></i></div>';
    }).join('');
    return `${titre}
      <div class="jauge-oui" style="grid-template-columns: repeat(${n}, 1fr)" aria-hidden="true">${crans}</div>
      <div class="apres-jauge" style="--d:${m.fin}ms">
        <div class="gros-chiffre"><strong>${total}</strong><span>sur ${n} ont dit oui</span></div>
        ${bulle(parmi(total === 0 ? PHRASES_ZERO : total === n ? PHRASES_TOUS : PHRASES_CERTAINS, v.etat.etape))}
        <div class="pile">${lignes}</div>
      </div>
      ${v.estHote ? `<button class="bouton jaune bas" data-action="hote-jeu" data-valeur="suivant">${e.index + 1 < e.questions.length ? 'Question suivante' : 'Voir le classement'}</button>` : `<p class="attente bas">L’hôte passe à la suite.</p>`}`;
  },

  gestes: {
    ouiNon(el, o, v) {
      // Un tampon « OUI ✔ » / « NON ✘ » s'écrase sur le bouton (sur mon téléphone seulement), puis la suite arrive.
      // Gardé dans la mémoire locale (et pas seulement sur le bouton) : si l'écran se redessine pendant le tampon,
      // il reste affiché.
      const etape = v.etat.etape;
      if (o.local[`${etape}:tampon`]) return;
      o.local[`${etape}:tampon`] = el.dataset.valeur;
      o.rafraichir();
      vibrer(30);
      setTimeout(() => {
        o.local[etape] = el.dataset.valeur;
        o.rafraichir();
      }, 750);
    },
    annulerOuiNon(_el, o, v) {
      delete o.local[v.etat.etape];
      delete o.local[`${v.etat.etape}:tampon`];
      o.rafraichir();
    },
    async estimer(el, o, v) {
      const etape = v.etat.etape;
      if (v.maReponse?.etape === etape || o.local[`${etape}:envoye`]) return;
      o.local[`${etape}:envoye`] = true;
      // Le « oui » est compté sans dire de qui il vient.
      if (o.local[etape] === 'oui') await o.incrementer(etape);
      await o.repondre({ estimation: Number(el.dataset.valeur) });
    },
  },
};
