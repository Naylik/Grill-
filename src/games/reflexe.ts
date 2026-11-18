// « Réflexe Mallow » : touche l'écran dès que Mallow prend feu. Attention aux pièges (il éternue avant) :
// toucher trop tôt = faux départ. 5 manches ; le plus rapide au total gagne.
// Le moment du feu est fixé en heure du serveur : il apparaît au même instant sur tous les téléphones.
import { maintenant } from '../firebase';
import { mallow } from '../mallow';
import { esc } from '../outils';
import { pointsDePlace } from '../score';
import { attenteDes } from '../ecrans/commun';
import { etapeTerminee, reponsesDe, type EtatDeBase, type MiniJeu } from './interface';

const NB_MANCHES = 5;
const PENALITE = 1000; // faux départ
const ABSENT = 1500; // pas de réponse

interface Etat extends EtatDeBase {
  phase: 'attente' | 'resultat';
  numeroJeu: number;
  manche: number;
  feu: number; // heure serveur où Mallow prend feu
  leurre: number | null; // heure serveur d'un faux départ (Mallow éternue)
  temps?: Record<string, number>; // temps de la manche (ms), -1 = faux départ
  cumul: Record<string, number>;
}

const etapeDe = (n: number, m: number) => `reflexe-${n}-${m}`;

function nouvelleManche(ctx: { maintenant: number; hasard: () => number }, base: Pick<Etat, 'numeroJeu' | 'cumul'>, manche: number): Etat {
  const feu = ctx.maintenant + 2500 + 1500 + ctx.hasard() * 2500;
  const leurre = ctx.hasard() < 0.45 ? ctx.maintenant + 2500 + (feu - ctx.maintenant - 2500) * (0.35 + ctx.hasard() * 0.3) : null;
  return { ...base, etape: etapeDe(base.numeroJeu, manche), phase: 'attente', manche, feu, leurre, fin: feu + 4000 };
}

/** Temps comptés pour le classement : faux départ et absence pénalisés. */
export function tempsCompte(t: number | undefined): number {
  if (t === undefined) return ABSENT;
  return t < 0 ? PENALITE : Math.min(t, ABSENT);
}

export const reflexe: MiniJeu<Etat> = {
  id: 'reflexe',
  nom: 'Réflexe Mallow',
  accroche: 'Touche dès que Mallow prend feu. Pas avant !',
  explication: {
    comment: 'Gardez le doigt prêt : à un moment, Mallow prend feu sur tous les téléphones en même temps. Touche ton écran le plus vite possible. Attention : parfois Mallow éternue avant, ce n’est pas du feu ! Toucher trop tôt, c’est un faux départ.',
    gagner: 'Le plus rapide sur 5 manches gagne. Un faux départ compte 1 seconde de pénalité.',
  },
  icone: '<path d="M12 2c1.5 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 3-6 .3 2 1.3 3 2.3 3.3C10.6 7.3 11 4.6 12 2z" fill="currentColor"/>',
  couleur: '#FF8A3D',
  autorise: () => true,

  demarrer(ctx) {
    return { etat: nouvelleManche(ctx, { numeroJeu: ctx.numeroJeu, cumul: Object.fromEntries(ctx.uids.map((u) => [u, 0])) }, 0) };
  },

  piloter(ctx, etat) {
    if (etat.phase === 'attente' && etapeTerminee(ctx, etat.etape, etat.fin)) {
      const recues = reponsesDe<{ temps: number }>(ctx, etat.etape);
      const temps = Object.fromEntries(Object.entries(recues).map(([u, r]) => [u, Math.round(Number(r.temps))]));
      const cumul = Object.fromEntries(ctx.uids.map((u) => [u, (etat.cumul[u] ?? 0) + tempsCompte(temps[u])]));
      return { etat: { ...etat, phase: 'resultat', temps, cumul, fin: ctx.maintenant + 3500 } };
    }
    // Le résultat de la manche reste affiché 3,5 s, puis la suivante démarre toute seule.
    if (etat.phase === 'resultat' && ctx.maintenant >= (etat.fin ?? 0)) {
      if (etat.manche + 1 >= NB_MANCHES) {
        const meilleur = Object.entries(etat.cumul).sort((a, b) => a[1] - b[1])[0];
        const resume = meilleur ? `${ctx.joueurs[meilleur[0]]?.prenom} : ${Math.round(meilleur[1] / NB_MANCHES)} ms en moyenne.` : undefined;
        return { etat, fin: { points: pointsDePlace(etat.cumul, false), sorte: 'place', resume } };
      }
      return { etat: nouvelleManche(ctx, etat, etat.manche + 1) };
    }
    return null;
  },

  ecran(v) {
    const e = v.etat;
    const entete = `<p class="petit">Manche ${e.manche + 1}/${NB_MANCHES}</p>`;
    if (e.phase === 'attente') {
      const moi = v.local[e.etape] as number | undefined;
      const dejaEnvoye = v.maReponse?.etape === e.etape || moi !== undefined;
      const message = moi === undefined ? '' : moi < 0 ? '<strong class="rouge">Faux départ !</strong>' : `<strong>${moi} ms</strong>`;
      return `${entete}
        <button class="aire-reflexe ${dejaEnvoye ? 'fini' : ''}" data-action="jeu" data-geste="taper" data-immediat
          data-feu="${e.feu}" ${e.leurre ? `data-leurre="${e.leurre}"` : ''} aria-label="Touche dès que Mallow prend feu">
          <span class="consigne-attente">Attends le feu…</span>
          <span class="consigne-feu">TOUCHE !</span>
          <span class="atchoum">ATCHOUM !</span>
          <span class="flammes-reflexe" aria-hidden="true"><svg viewBox="0 0 200 120"><path d="M40 120 C20 90 44 70 40 40 C62 62 70 88 66 120 Z" fill="#FF7A3D"/><path d="M80 120 C58 80 96 50 100 10 C118 50 140 80 120 120 Z" fill="#FFD84A"/><path d="M134 120 C130 90 144 70 160 46 C170 76 182 96 162 120 Z" fill="#FF7A3D"/></svg></span>
          <span class="mallow-reflexe">${mallow({ taille: 130 })}</span>
          <span class="resultat-local">${message}</span>
        </button>
        ${attenteDes(v.uids, v.joueurs, (u) => v.ontRepondu.includes(u) || (u === v.uid && dejaEnvoye))}`;
    }
    const lignes = v.uids
      .map((u) => ({ u, t: e.temps?.[u] }))
      .sort((a, b) => tempsCompte(a.t) - tempsCompte(b.t))
      .map(({ u, t }, i) => `<div class="ligne-resultat"><span class="pastille" style="--c:${v.joueurs[u].couleur};width:26px;height:26px"></span><strong>${esc(v.joueurs[u].prenom)}</strong>
        <span>${t === undefined ? 'trop tard' : t < 0 ? 'faux départ' : `${t} ms`}</span><span class="pts ${i === 0 && t !== undefined && t >= 0 ? 'gagne' : ''}">${i === 0 && t !== undefined && t >= 0 ? 'le + rapide' : ''}</span></div>`)
      .join('');
    return `${entete}<h2 class="question">Résultat de la manche</h2><div class="pile">${lignes}</div>
      <p class="attente">${e.manche + 1 < NB_MANCHES ? 'Manche suivante dans un instant…' : 'Dernière manche terminée !'}</p>`;
  },

  gestes: {
    async taper(el, o, v) {
      const etape = v.etat.etape;
      if (v.maReponse?.etape === etape || o.local[etape] !== undefined) return;
      const feu = Number(el.dataset.feu);
      const t = maintenant() - feu;
      const temps = t < 0 ? -1 : Math.round(t);
      o.local[etape] = temps;
      o.rafraichir();
      await o.repondre({ temps });
    },
  },
};
