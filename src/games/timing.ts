// « Le bon timing » (style Arène) : un chrono invisible démarre ; arrête-le le plus près possible du temps
// demandé, en comptant dans ta tête. 3 manches ; le plus petit écart total gagne.
// Déroulé : intro (règles) → 3 × (chrono → piste avec la ligne cible) → classement du jeu.
import { maintenant } from '../firebase';
import { mallow } from '../mallow';
import { esc } from '../outils';
import { pointsDePlace } from '../score';
import { etapeTerminee, reponsesDe, type EtatDeBase, type MiniJeu } from './interface';
import { classementBarres, hud, introArene, noteTiming, piste } from './arene';

const CIBLES = [5, 7, 10]; // secondes, une par manche
const DECOMPTE = 3500; // « Prêts ? 3, 2, 1, partez ! »
const DUREE_INTRO = 7000;
const DUREE_PISTE = 5000;
const DUREE_BILAN = 6500;

interface Etat extends EtatDeBase {
  phase: 'intro' | 'chrono' | 'resultat' | 'bilan';
  numeroJeu: number;
  manche: number;
  cible: number; // secondes
  depart: number; // heure serveur du départ
  temps?: Record<string, number>; // ms écoulées à l'arrêt
  cumul: Record<string, number>; // écarts cumulés (ms)
}

const etapeDe = (n: number, m: number) => `timing-${n}-${m}`;
export const formaterSecondes = (ms: number) => `${(ms / 1000).toFixed(2).replace('.', ',')} s`;
/** Écart compté : pas de réponse = l'écart maximum possible. */
export const ecartCompte = (t: number | undefined, cible: number) => (t === undefined ? cible * 1000 : Math.abs(t - cible * 1000));
const ecartSigne = (ms: number) => `${ms > 0 ? '+' : ms < 0 ? '−' : ''}${formaterSecondes(Math.abs(ms))}`;

function nouvelleManche(ctx: { maintenant: number }, base: Etat, manche: number): Etat {
  const cible = CIBLES[manche];
  const depart = ctx.maintenant + DECOMPTE;
  return { ...base, etape: etapeDe(base.numeroJeu, manche), phase: 'chrono', manche, cible, depart, temps: undefined, fin: depart + cible * 2000 + 2000 };
}

/** Le cadran : 60 graduations, le décompte au centre, puis Mallow qui compte les yeux fermés. */
const GRADUATIONS = Array.from({ length: 60 }, (_, i) => `<i style="--a:${i * 6}deg" class="${i % 5 ? '' : 'forte'}"></i>`).join('');

export const timing: MiniJeu<Etat> = {
  id: 'timing',
  nom: 'Le bon timing',
  accroche: 'Un chrono invisible : arrête-le pile au bon moment.',
  explication: {
    comment: 'Après « 3, 2, 1, partez ! », un chrono démarre… mais il est invisible. Compte dans ta tête et appuie sur STOP quand tu penses que le temps demandé est écoulé (5, 7 puis 10 secondes).',
    gagner: 'Le plus petit écart sur les 3 manches gagne. Bonus de fierté si tu tombes pile au centième.',
  },
  icone: '<circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M12 9v4l3 2M9 2h6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" fill="none"/>',
  couleur: '#5CD8FF',
  autorise: () => true,

  // Les règles se lisent avant (écran « Je suis prêt ») : le jeu commence directement par la 1re manche.
  demarrer(ctx) {
    const base: Etat = {
      etape: etapeDe(ctx.numeroJeu, -1), phase: 'intro', numeroJeu: ctx.numeroJeu, manche: 0, cible: CIBLES[0], depart: 0,
      cumul: Object.fromEntries(ctx.uids.map((u) => [u, 0])), fin: ctx.maintenant + DUREE_INTRO,
    };
    return { etat: nouvelleManche(ctx, base, 0) };
  },

  regles: () => introArene('LE BON TIMING', '3 MANCHES', mallow({ taille: 110, expression: 'yeuxFermes' }), [
    ['1', 'Un chrono démarre après « 3, 2, 1, partez ! »… mais il est invisible.'],
    ['2', 'Compte dans ta tête et appuie sur STOP au temps demandé : 5, 7 puis 10 s.'],
    ['★', 'Le plus petit écart sur les 3 manches gagne.'],
  ]),

  piloter(ctx, etat) {
    if (etat.phase === 'intro' && ctx.maintenant >= (etat.fin ?? 0)) return { etat: nouvelleManche(ctx, etat, 0) };
    if (etat.phase === 'chrono' && etapeTerminee(ctx, etat.etape, etat.fin)) {
      const temps = Object.fromEntries(Object.entries(reponsesDe<{ temps: number }>(ctx, etat.etape)).map(([u, r]) => [u, Math.round(Number(r.temps))]));
      const cumul = Object.fromEntries(ctx.uids.map((u) => [u, (etat.cumul[u] ?? 0) + ecartCompte(temps[u], etat.cible)]));
      return { etat: { ...etat, phase: 'resultat', temps, cumul, fin: ctx.maintenant + DUREE_PISTE } };
    }
    if (etat.phase === 'resultat' && ctx.maintenant >= (etat.fin ?? 0)) {
      if (etat.manche + 1 >= CIBLES.length) return { etat: { ...etat, phase: 'bilan', fin: ctx.maintenant + DUREE_BILAN } };
      return { etat: nouvelleManche(ctx, etat, etat.manche + 1) };
    }
    if (etat.phase === 'bilan' && ctx.maintenant >= (etat.fin ?? 0)) {
      const meilleur = Object.entries(etat.cumul).sort((a, b) => a[1] - b[1])[0];
      const resume = meilleur ? `${ctx.joueurs[meilleur[0]]?.prenom} : ${formaterSecondes(meilleur[1])} d’écart au total.` : undefined;
      return { etat, fin: { points: pointsDePlace(etat.cumul, false), sorte: 'place', resume } };
    }
    return null;
  },

  ecran(v) {
    const e = v.etat;
    if (e.phase === 'intro') {
      return introArene('LE BON TIMING', '3 MANCHES', mallow({ taille: 110, expression: 'yeuxFermes' }), [
        ['1', 'Un chrono démarre après « 3, 2, 1, partez ! »… mais il est invisible.'],
        ['2', 'Compte dans ta tête et appuie sur STOP au temps demandé : 5, 7 puis 10 s.'],
        ['★', 'Le plus petit écart sur les 3 manches gagne.'],
      ], e.fin);
    }

    if (e.phase === 'bilan') {
      const lignes = v.uids.map((u) => ({ u, ecart: e.cumul[u] ?? 0 })).sort((a, b) => a.ecart - b.ecart);
      const meilleur = Math.max(1, lignes[0]?.ecart ?? 1);
      return `${hud('LE BON TIMING', CIBLES.length, CIBLES.length, false)}
        <div class="vainqueur-arene">${mallow({ taille: 90, couronne: true })}<p><strong>${esc(v.joueurs[lignes[0].u].prenom)}</strong> a l’horloge dans la tête</p></div>
        <div class="pile">${classementBarres(lignes.map((l) => ({ joueur: v.joueurs[l.u], texte: formaterSecondes(l.ecart), part: meilleur / Math.max(1, l.ecart), moi: l.u === v.uid })))}</div>
        <p class="aide">Écart total sur ${CIBLES.length} manches. Pas de STOP = écart maximum.</p>`;
    }

    const entete = `${hud('LE BON TIMING', e.manche, CIBLES.length, e.phase === 'chrono')}
      <h2 class="question titre-timing">Arrête le chrono à <span class="cible-timing">${e.cible} secondes</span></h2>`;

    if (e.phase === 'chrono') {
      const moi = v.local[e.etape] as number | undefined;
      const fini = v.maReponse?.etape === e.etape || moi !== undefined;
      return `${entete}
        <div class="cadran-timing ${fini ? 'fini' : ''}" data-depart="${e.depart}">
          <span class="graduations" aria-hidden="true">${GRADUATIONS}</span>
          <span class="decompte"></span>
          <span class="mallow-compte" aria-hidden="true">${mallow({ taille: 96, expression: 'yeuxFermes' })}<em>…je compte…</em></span>
          ${fini ? `<span class="arrete">ARRÊTÉ</span>` : ''}
        </div>
        ${fini
          ? `<p class="attente">Résultat quand tout le monde aura appuyé…</p>`
          : `<button class="stop-timing" data-action="jeu" data-geste="stop" data-immediat data-depart="${e.depart}" aria-label="Stop">STOP</button>`}
        <div class="joueurs-arene">${v.uids.map((u) => {
          const ok = v.ontRepondu.includes(u) || (u === v.uid && fini);
          return `<div class="${u === v.uid ? 'moi' : ''} ${ok ? 'ok' : ''}"><span class="pastille" style="--c:${v.joueurs[u].couleur};width:24px;height:24px"></span>${esc(v.joueurs[u].prenom)}<em>${ok ? 'arrêté' : '…'}</em></div>`;
        }).join('')}</div>`;
    }

    // Résultat : la piste montre qui s'est arrêté avant qui, et la ligne dorée le temps visé.
    const temps = e.temps ?? {};
    const cibleMs = e.cible * 1000;
    const presents = v.uids.filter((u) => temps[u] !== undefined);
    const max = Math.max(cibleMs * 1.6, ...presents.map((u) => temps[u] + 400));
    const points = presents.map((u) => ({ joueur: v.joueurs[u], valeur: temps[u], texte: formaterSecondes(temps[u]), moi: u === v.uid }));
    const absents = v.uids.filter((u) => temps[u] === undefined);
    const mien = temps[v.uid];
    const [note, couleur] = mien !== undefined ? noteTiming(mien - cibleMs) : ['PAS DE STOP', 'var(--rose)'];
    const premier = [...presents].sort((a, b) => ecartCompte(temps[a], e.cible) - ecartCompte(temps[b], e.cible))[0];
    return `${entete}
      <div class="mon-ecart"><span class="note-arene" style="--c:${couleur}">${note}</span>${mien !== undefined ? `<strong style="color:${couleur}">${ecartSigne(mien - cibleMs)}</strong>` : ''}</div>
      ${piste(points, max, { valeur: cibleMs, libelle: `${e.cible} s` })}
      ${premier ? `<p class="aide gauche"><strong style="color:${v.joueurs[premier].couleur}">${esc(v.joueurs[premier].prenom)}</strong> est le plus proche (${ecartSigne(temps[premier] - cibleMs)}).</p>` : ''}
      ${absents.length ? `<p class="hors-piste">Pas de STOP : ${absents.map((u) => esc(v.joueurs[u].prenom)).join(', ')}</p>` : ''}
      <p class="attente">${e.manche + 1 < CIBLES.length ? 'Manche suivante dans un instant…' : 'Classement dans un instant…'}</p>`;
  },

  gestes: {
    async stop(el, o, v) {
      const etape = v.etat.etape;
      const depart = Number(el.dataset.depart);
      if (v.etat.phase !== 'chrono' || v.maReponse?.etape === etape || o.local[etape] !== undefined || maintenant() < depart) return; // pas avant le départ
      const temps = Math.round(maintenant() - depart);
      o.local[etape] = temps;
      o.rafraichir();
      await o.repondre({ temps });
    },
  },
};
