// « Réflexe Mallow » (style Arène) : touche l'écran dès que Mallow prend feu. Attention aux pièges (il éternue
// avant) : toucher trop tôt = faux départ. 5 manches ; le plus rapide au total gagne.
// Le moment du feu est fixé en heure du serveur : il apparaît au même instant sur tous les téléphones.
// Déroulé : intro (règles) → 5 × (attente → piste « qui a touché avant qui ») → classement du jeu.
// Leurre du vainqueur : le gagnant d'une manche choisit en secret une victime ; à la manche suivante, sur son écran
// seulement, Mallow « chauffe » (lueur et flammes) un instant avant le vrai feu, pour la pousser au faux départ.
import { maintenant } from '../firebase';
import { mallow } from '../mallow';
import { esc } from '../outils';
import { pointsDePlace } from '../score';
import { etapeTerminee, reponsesDe, type EtatDeBase, type MiniJeu, selonFormat } from './interface';
import { arriveeSerree, classementBarres, finPiste, hud, introArene, noteReflexe, piste } from './arene';

const NB_MANCHES: [number, number, number] = [3, 4, 5]; // Courte, Normale, Longue (au-delà, c'est épuisant)
const PENALITE = 1000; // faux départ
const ABSENT = 1500; // pas de réponse
const DUREE_INTRO = 7000;
const DUREE_PISTE = 6000; // laisse le temps de lire le gagnant après la course (et la photo-finish)
const DUREE_PISTE_CHOIX = 15_000; // le gagnant choisit sa victime : on attend son choix (15 s au plus)
const DUREE_BILAN = 6500;
export const PHOTO_FINISH = 40; // ms : en dessous, les deux premiers sont départagés à la photo-finish

interface Etat extends EtatDeBase {
  phase: 'intro' | 'attente' | 'resultat' | 'bilan';
  numeroJeu: number;
  manche: number;
  total?: number; // nombre de manches (selon le format)
  feu: number; // heure serveur où Mallow prend feu
  leurre: number | null; // heure serveur d'un faux départ (Mallow éternue)
  temps?: Record<string, number>; // temps de la manche (ms), -1 = faux départ
  historique: Record<string, number[]>; // temps bruts de chaque manche, par joueur
  cumul: Record<string, number>;
  piege?: { cible: string; heure: number }; // leurre du vainqueur pour cette manche (visible chez la cible seulement)
  gagnant?: string; // gagnant de la manche qui vient de se jouer
}

const etapeDe = (n: number, m: number) => `reflexe-${n}-${m}`;

const etapePiege = (n: number, m: number) => `reflexe-${n}-${m}-piege`;

function nouvelleManche(ctx: { maintenant: number; hasard: () => number }, base: Etat, manche: number, cible?: string): Etat {
  // Environ une manche sur trois, Mallow se fait attendre (9 à 14 s) : la tension monte.
  const tard = ctx.hasard() < 0.3;
  const feu = ctx.maintenant + 2500 + (tard ? 6500 + ctx.hasard() * 5000 : 1500 + ctx.hasard() * 2500);
  const leurre = ctx.hasard() < 0.45 ? ctx.maintenant + 2500 + (feu - ctx.maintenant - 2500) * (0.35 + ctx.hasard() * 0.3) : null;
  // Le piège tombe entre 1,2 s après le début et 0,7 s avant le vrai feu.
  const piege = cible ? { cible, heure: ctx.maintenant + 2500 + 1200 + (feu - ctx.maintenant - 2500 - 1900) * ctx.hasard() } : undefined;
  const { piege: _ancien, gagnant: _g, ...reste } = base;
  return { ...reste, ...(piege ? { piege } : {}), etape: etapeDe(base.numeroJeu, manche), phase: 'attente', manche, feu, leurre, temps: undefined, fin: feu + 4000 };
}

/** Gagnant d'une manche : le temps valide le plus court. */
export function gagnantManche(temps: Record<string, number>): string | undefined {
  return Object.entries(temps).filter(([, t]) => t >= 0 && t < ABSENT).sort((a, b) => a[1] - b[1])[0]?.[0];
}

/** Temps comptés pour le classement : faux départ et absence pénalisés. */
export function tempsCompte(t: number | undefined): number {
  if (t === undefined) return ABSENT;
  return t < 0 ? PENALITE : Math.min(t, ABSENT);
}

const meilleurTemps = (liste: number[] = []) => {
  const bons = liste.filter((t) => t >= 0 && t < ABSENT);
  return bons.length ? Math.min(...bons) : null;
};

const FLAMMES = '<svg class="flammes-arene" viewBox="0 0 200 120" aria-hidden="true"><path d="M40 120 C20 90 44 70 40 40 C62 62 70 88 66 120 Z" fill="#FF7A3D"/><path d="M80 120 C58 80 96 50 100 10 C118 50 140 80 120 120 Z" fill="#FFD84A"/><path d="M134 120 C130 90 144 70 160 46 C170 76 182 96 162 120 Z" fill="#FF7A3D"/></svg>';

/** Le gagnant de la manche choisit sa victime (lui seul voit ce choix). */
function choixPiege(e: Etat, v: { uid: string; uids: string[]; joueurs: Record<string, { prenom: string; couleur: string }>; local: Record<string, unknown> }): string {
  if (e.gagnant !== v.uid) return '';
  const fait = v.local[etapePiege(e.numeroJeu, e.manche)] as string | undefined;
  if (fait) return `<p class="aide gauche piege-fait">Piège posé sur <strong>${esc(v.joueurs[fait]?.prenom ?? '?')}</strong>. Chut…</p>`;
  return `<div class="choix-piege"><p class="titre-piege">Tu as gagné la manche ! Choisis ta victime</p>
    <p class="aide gauche">À la prochaine manche, sur son écran seulement, Mallow fera semblant de prendre feu. Personne ne saura que c’est toi.</p>
    <div class="options deux">${v.uids.filter((u) => u !== v.uid).map((u) => `<button class="option" data-action="jeu" data-geste="pieger" data-valeur="${u}">${esc(v.joueurs[u].prenom)}</button>`).join('')}</div></div>`;
}

export const reflexe: MiniJeu<Etat> = {
  id: 'reflexe',
  nom: 'Réflexe Mallow',
  accroche: 'Touche dès que Mallow prend feu. Pas avant !',
  explication: {
    comment: 'Gardez le doigt prêt : à un moment, Mallow prend feu sur tous les téléphones en même temps. Touche ton écran le plus vite possible. Attention : parfois Mallow éternue avant, ce n’est pas du feu ! Toucher trop tôt, c’est un faux départ.',
    gagner: 'Le plus rapide sur l’ensemble des manches gagne (3 à 5 selon le format). Un faux départ compte 1 seconde de pénalité.',
  },
  icone: '<path d="M12 2c1.5 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 3-6 .3 2 1.3 3 2.3 3.3C10.6 7.3 11 4.6 12 2z" fill="currentColor"/>',
  couleur: '#FF8A3D',
  autorise: () => true,

  // Les règles se lisent avant (écran « Je suis prêt ») : le jeu commence directement par la 1re manche.
  demarrer(ctx) {
    const vide = Object.fromEntries(ctx.uids.map((u) => [u, 0]));
    const base: Etat = {
      etape: etapeDe(ctx.numeroJeu, -1), phase: 'intro', numeroJeu: ctx.numeroJeu, manche: 0, feu: 0, leurre: null,
      historique: {}, cumul: vide, total: selonFormat(ctx.duree, NB_MANCHES), fin: ctx.maintenant + DUREE_INTRO,
    };
    return { etat: nouvelleManche(ctx, base, 0) };
  },

  tours: (duree) => `${selonFormat(duree, NB_MANCHES)} manches`,
  regles: (v) => introArene('RÉFLEXE MALLOW', `${selonFormat(v.duree, NB_MANCHES)} MANCHES`, mallow({ taille: 110 }), [
    ['1', 'Attends que Mallow prenne feu sur tous les écrans.'],
    ['2', 'Touche le plus vite possible : on mesure en millisecondes.'],
    ['!', 'S’il éternue, ce n’est pas du feu. Trop tôt : 1 s de pénalité.'],
  ]),

  piloter(ctx, etat) {
    if (etat.phase === 'intro' && ctx.maintenant >= (etat.fin ?? 0)) return { etat: nouvelleManche(ctx, etat, 0) };
    if (etat.phase === 'attente' && etapeTerminee(ctx, etat.etape, etat.fin)) {
      const recues = reponsesDe<{ temps: number }>(ctx, etat.etape);
      const temps = Object.fromEntries(Object.entries(recues).map(([u, r]) => [u, Math.round(Number(r.temps))]));
      const historique = Object.fromEntries(ctx.uids.map((u) => [u, [...(etat.historique?.[u] ?? []), temps[u] ?? ABSENT]]));
      const cumul = Object.fromEntries(ctx.uids.map((u) => [u, (etat.cumul[u] ?? 0) + tempsCompte(temps[u])]));
      const derniere = etat.manche + 1 >= (etat.total ?? NB_MANCHES[0]);
      const gagnant = derniere ? undefined : gagnantManche(temps);
      const { piege: _p, ...sansPiege } = etat;
      return { etat: { ...sansPiege, phase: 'resultat', temps, historique, cumul, ...(gagnant ? { gagnant } : {}), fin: ctx.maintenant + (gagnant ? DUREE_PISTE_CHOIX : DUREE_PISTE) } };
    }
    if (etat.phase === 'resultat') {
      // Le gagnant a choisi sa victime : on n'attend pas la fin du chrono.
      const choix = etat.gagnant ? reponsesDe<{ cible?: string }>(ctx, etapePiege(etat.numeroJeu, etat.manche))[etat.gagnant] : undefined;
      if (!choix && ctx.maintenant < (etat.fin ?? 0)) return null;
      if (etat.manche + 1 >= (etat.total ?? NB_MANCHES[0])) return { etat: { ...etat, phase: 'bilan', fin: ctx.maintenant + DUREE_BILAN } };
      const cible = choix?.cible && choix.cible !== etat.gagnant && ctx.uids.includes(choix.cible) ? choix.cible : undefined;
      return { etat: nouvelleManche(ctx, etat, etat.manche + 1, cible) };
    }
    if (etat.phase === 'bilan' && ctx.maintenant >= (etat.fin ?? 0)) {
      const meilleur = Object.entries(etat.cumul).sort((a, b) => a[1] - b[1])[0];
      const resume = meilleur ? `${ctx.joueurs[meilleur[0]]?.prenom} : ${Math.round(meilleur[1] / (etat.total ?? NB_MANCHES[0]))} ms en moyenne.` : undefined;
      return { etat, fin: { points: pointsDePlace(etat.cumul, false), sorte: 'place', resume } };
    }
    return null;
  },

  ecran(v) {
    const e = v.etat;
    const N = e.total ?? NB_MANCHES[0];
    if (e.phase === 'intro') {
      return introArene('RÉFLEXE MALLOW', '5 MANCHES', mallow({ taille: 110 }), [
        ['1', 'Attends que Mallow prenne feu sur tous les écrans.'],
        ['2', 'Touche le plus vite possible : on mesure en millisecondes.'],
        ['!', 'S’il éternue, ce n’est pas du feu. Trop tôt : 1 s de pénalité.'],
      ], e.fin);
    }

    if (e.phase === 'bilan') {
      const lignes = v.uids
        .map((u) => ({ u, moy: Math.round((e.cumul[u] ?? ABSENT * N) / N) }))
        .sort((a, b) => a.moy - b.moy);
      const meilleure = lignes[0]?.moy ?? 1;
      return `${hud('RÉFLEXE MALLOW', N, N, false)}
        <div class="vainqueur-arene">${mallow({ taille: 90, couronne: true })}<p><strong>${esc(v.joueurs[lignes[0].u].prenom)}</strong> a les meilleurs réflexes</p></div>
        <div class="pile">${classementBarres(lignes.map((l) => ({ joueur: v.joueurs[l.u], texte: `${l.moy} ms`, part: meilleure / l.moy, moi: l.u === v.uid })))}</div>
        <p class="aide">Moyenne sur ${N} manches, faux départs comptés 1&#8239;000 ms.</p>`;
    }

    const record = meilleurTemps(e.historique?.[v.uid]);
    const entete = `${hud('RÉFLEXE MALLOW', e.manche, N, e.phase === 'attente')}
      <div class="record-arene"><span>MANCHE ${e.manche + 1}/${N}</span><span>TON RECORD <b>${record !== null ? `${record} ms` : '—'}</b></span></div>`;

    if (e.phase === 'attente') {
      const moi = v.local[e.etape] as number | undefined;
      const fini = v.maReponse?.etape === e.etape || moi !== undefined;
      const [note, couleur] = moi !== undefined ? noteReflexe(moi) : ['', ''];
      const retour = moi === undefined
        ? `<span class="ordre-arene attente-txt">Attends…</span><span class="ordre-arene feu-txt">TOUCHE !</span><span class="ordre-arene atchoum-txt">ATCHOUM !</span>`
        : `<span class="temps-arene" style="color:${couleur}">${moi < 0 ? 'OUPS' : `${moi}<small> ms</small>`}</span><span class="note-arene" style="--c:${couleur}">${note}</span>`;
      return `${entete}
        <button class="aire-reflexe arene-reflexe ${fini ? 'fini' : ''}" data-action="jeu" data-geste="taper" data-immediat
          data-feu="${e.feu}" ${e.leurre ? `data-leurre="${e.leurre}"` : ''} ${e.piege?.cible === v.uid ? `data-piege="${e.piege.heure}"` : ''} aria-label="Touche dès que Mallow prend feu">
          <span class="anneau-arene" aria-hidden="true"></span>
          ${moi !== undefined && moi >= 0 ? '<span class="onde-arene" aria-hidden="true"></span>' : ''}
          ${FLAMMES}
          <span class="visage normal">${mallow({ taille: 150 })}</span>
          <span class="visage surprise">${mallow({ taille: 150, expression: 'surprise' })}</span>
          <span class="visage atchoum">${mallow({ taille: 150, expression: 'yeuxFermes' })}</span>
        </button>
        <div class="retour-arene">${retour}</div>
        <div class="joueurs-arene">${v.uids.map((u) => {
          const ok = v.ontRepondu.includes(u) || (u === v.uid && fini);
          return `<div class="${u === v.uid ? 'moi' : ''} ${ok ? 'ok' : ''}"><span class="pastille" style="--c:${v.joueurs[u].couleur};width:24px;height:24px"></span>${esc(v.joueurs[u].prenom)}<em>${ok ? 'touché' : '…'}</em></div>`;
        }).join('')}</div>`;
    }

    // Résultat de la manche : la piste montre qui a touché avant qui.
    const temps = e.temps ?? {};
    const valides = v.uids.filter((u) => temps[u] !== undefined && temps[u] >= 0);
    const max = Math.max(600, ...valides.map((u) => temps[u] + 80));
    const points = valides.map((u) => ({ joueur: v.joueurs[u], valeur: temps[u], texte: `${temps[u]} ms`, moi: u === v.uid }));
    const fauxDeparts = v.uids.filter((u) => temps[u] !== undefined && temps[u] < 0);
    const absents = v.uids.filter((u) => temps[u] === undefined);
    const premier = [...valides].sort((a, b) => temps[a] - temps[b])[0];
    return `${entete}
      <h2 class="question">Qui a touché en premier ?</h2>
      ${piste(points, max, undefined, { photoFinish: PHOTO_FINISH })}
      ${premier ? `<p class="aide gauche gagnant-piste" style="--d:${(finPiste(valides.length) + (arriveeSerree(valides.map((u) => temps[u]), PHOTO_FINISH) ? 1.3 : 0.2)).toFixed(2)}s"><strong style="color:${v.joueurs[premier].couleur}">${esc(v.joueurs[premier].prenom)}</strong> gagne la manche en ${temps[premier]} ms.</p>` : ''}
      ${fauxDeparts.length ? `<p class="hors-piste rouge">Faux départ : ${fauxDeparts.map((u) => esc(v.joueurs[u].prenom)).join(', ')}</p>` : ''}
      ${absents.length ? `<p class="hors-piste">Trop tard : ${absents.map((u) => esc(v.joueurs[u].prenom)).join(', ')}</p>` : ''}
      ${choixPiege(e, v)}
      <p class="attente">${e.manche + 1 < N ? 'Manche suivante dans un instant…' : 'Classement dans un instant…'}</p>`;
  },

  gestes: {
    async pieger(el, o, v) {
      const e = v.etat;
      const etape = etapePiege(e.numeroJeu, e.manche);
      if (e.phase !== 'resultat' || e.gagnant !== v.uid || o.local[etape] !== undefined) return;
      o.local[etape] = el.dataset.valeur;
      o.rafraichir();
      await o.repondre({ cible: el.dataset.valeur, etape });
    },
    async taper(el, o, v) {
      const etape = v.etat.etape;
      if (v.etat.phase !== 'attente' || v.maReponse?.etape === etape || o.local[etape] !== undefined) return;
      const feu = Number(el.dataset.feu);
      const t = maintenant() - feu;
      const temps = t < 0 ? -1 : Math.round(t);
      o.local[etape] = temps;
      o.rafraichir();
      await o.repondre({ temps });
    },
  },
};
