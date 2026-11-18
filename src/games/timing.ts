// « Le bon timing » : un chrono invisible démarre ; arrête-le le plus près possible du temps demandé,
// en comptant dans ta tête. 3 manches ; le plus petit écart total gagne.
import { maintenant } from '../firebase';
import { esc } from '../outils';
import { pointsDePlace } from '../score';
import { attenteDes } from '../ecrans/commun';
import { etapeTerminee, reponsesDe, type EtatDeBase, type MiniJeu } from './interface';

const CIBLES = [5, 7, 10]; // secondes, une par manche
const DECOMPTE = 3500; // « 3, 2, 1, partez ! »

interface Etat extends EtatDeBase {
  phase: 'chrono' | 'resultat';
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

function nouvelleManche(ctx: { maintenant: number }, base: Pick<Etat, 'numeroJeu' | 'cumul'>, manche: number): Etat {
  const cible = CIBLES[manche];
  const depart = ctx.maintenant + DECOMPTE;
  return { ...base, etape: etapeDe(base.numeroJeu, manche), phase: 'chrono', manche, cible, depart, fin: depart + cible * 2000 + 2000 };
}

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

  demarrer(ctx) {
    return { etat: nouvelleManche(ctx, { numeroJeu: ctx.numeroJeu, cumul: Object.fromEntries(ctx.uids.map((u) => [u, 0])) }, 0) };
  },

  piloter(ctx, etat) {
    if (etat.phase === 'chrono' && etapeTerminee(ctx, etat.etape, etat.fin)) {
      const temps = Object.fromEntries(Object.entries(reponsesDe<{ temps: number }>(ctx, etat.etape)).map(([u, r]) => [u, Math.round(Number(r.temps))]));
      const cumul = Object.fromEntries(ctx.uids.map((u) => [u, (etat.cumul[u] ?? 0) + ecartCompte(temps[u], etat.cible)]));
      return { etat: { ...etat, phase: 'resultat', temps, cumul, fin: ctx.maintenant + 5000 } };
    }
    if (etat.phase === 'resultat' && ctx.maintenant >= (etat.fin ?? 0)) {
      if (etat.manche + 1 >= CIBLES.length) {
        return { etat, fin: { points: pointsDePlace(etat.cumul, false), sorte: 'place' } };
      }
      return { etat: nouvelleManche(ctx, etat, etat.manche + 1) };
    }
    return null;
  },

  ecran(v) {
    const e = v.etat;
    const entete = `<p class="petit">Manche ${e.manche + 1}/${CIBLES.length}</p><h2 class="question">Arrête le chrono à <span class="cible-timing">${e.cible} secondes</span></h2>`;
    if (e.phase === 'chrono') {
      const moi = v.local[e.etape] as number | undefined;
      const fini = v.maReponse?.etape === e.etape || moi !== undefined;
      return `${entete}
        <div class="cadran-timing" data-depart="${e.depart}">
          <span class="decompte"></span>
          <span class="chrono-cache" aria-hidden="true">?</span>
        </div>
        ${fini
          ? `<p class="attente">Arrêté ! Réponse quand tout le monde aura fini…</p>`
          : `<button class="bouton rose stop-timing" data-action="jeu" data-geste="stop" data-immediat data-depart="${e.depart}">STOP</button>`}
        ${attenteDes(v.uids, v.joueurs, (u) => v.ontRepondu.includes(u) || (u === v.uid && fini))}`;
    }
    const lignes = v.uids
      .map((u) => ({ u, t: e.temps?.[u] }))
      .sort((a, b) => ecartCompte(a.t, e.cible) - ecartCompte(b.t, e.cible))
      .map(({ u, t }, i) => {
        const ecart = t === undefined ? null : t - e.cible * 1000;
        return `<div class="ligne-resultat"><span class="pastille" style="--c:${v.joueurs[u].couleur};width:26px;height:26px"></span><strong>${esc(v.joueurs[u].prenom)}</strong>
          <span>${t === undefined ? '—' : formaterSecondes(t)}</span><span class="pts ${i === 0 && t !== undefined ? 'gagne' : ''}">${ecart === null ? 'raté' : `${ecart > 0 ? '+' : ecart < 0 ? '−' : ''}${formaterSecondes(Math.abs(ecart))}`}</span></div>`;
      })
      .join('');
    return `${entete}<div class="pile">${lignes}</div>
      <p class="attente">${e.manche + 1 < CIBLES.length ? 'Manche suivante dans un instant…' : 'Dernière manche terminée !'}</p>`;
  },

  gestes: {
    async stop(el, o, v) {
      const etape = v.etat.etape;
      const depart = Number(el.dataset.depart);
      if (v.maReponse?.etape === etape || o.local[etape] !== undefined || maintenant() < depart) return; // pas avant le départ
      const temps = Math.round(maintenant() - depart);
      o.local[etape] = temps;
      o.rafraichir();
      await o.repondre({ temps });
    },
  },
};
