// « Roue des territoires » : la roue est partagée en parts, une couleur par joueur. À chaque manche, chacun choisit
// en secret : Agrandir (+1 part, coûte 1 pt qui va dans la cagnotte), Voler (gratuit : prend 1 part à quelqu'un…
// mais si la cible s'est protégée, le voleur lui donne 1 pt) ou Protéger. Les actions se révèlent, les parts changent,
// puis la roue tourne façon roue de la fortune : la part sous le curseur remporte la cagnotte.
// L'hôte tire le gagnant avant que la roue tourne ; tous les téléphones l'animent à la même heure (serveur).
import { esc } from '../outils';
import { pointsDePlace } from '../score';
import { attenteDes, chrono } from '../ecrans/commun';
import { roueHtml, tirerArret } from '../roue';
import { etapeTerminee, reponsesDe, selonFormat, type EtatDeBase, type MiniJeu } from './interface';
import { classementBarres, hud } from './arene';

const NB_MANCHES: [number, number, number] = [4, 6, 8]; // Courte, Normale, Longue
const PARTS_DEPART = 3;
const POINTS_DEPART = 5;
const POT_DEPART = 6;
const DUREE_CHOIX = 25_000;
const DUREE_REVELATION = 4_500;
const DUREE_ROUE = 6_000;
const DUREE_GAIN = 3_500;
const DUREE_BILAN = 6_500;

export type Action = 'agrandir' | 'voler' | 'proteger';
interface Badge { type: 'agrandit' | 'vole' | 'rate' | 'protege' | 'victime' | 'pauvre'; texte: string; vise?: boolean }

interface Etat extends EtatDeBase {
  phase: 'choix' | 'revelation' | 'roue' | 'gain' | 'bilan';
  numeroJeu: number;
  ordre: string[]; // ordre des parts sur la roue
  manche: number;
  total: number;
  parts: Record<string, number>;
  partsAvant?: Record<string, number>; // pour animer le changement de taille
  points: Record<string, number>;
  pot: number;
  rotation: number; // angle de la roue au repos
  badges?: Record<string, Badge>;
  journal?: string[];
  spin?: { debut: number; rotation0: number; rotation1: number; gagnant: string; gain: number };
  morph?: number;
}

const etapeDe = (n: number, m: number) => `territoires-${n}-${m}`;

/** Applique les actions de la manche (fonction pure, testée). */
export function appliquerActions(e: Pick<Etat, 'ordre' | 'parts' | 'points' | 'pot'>, actions: Record<string, { a: Action; c?: string }>, noms: Record<string, string>) {
  const parts = { ...e.parts };
  const points = { ...e.points };
  let pot = e.pot;
  const badges: Record<string, Badge> = {};
  const journal: string[] = [];
  const protege = (u: string) => actions[u]?.a === 'proteger';
  for (const u of e.ordre) if (protege(u)) badges[u] = { type: 'protege', texte: '🛡 Bouclier' };
  for (const u of e.ordre) {
    const x = actions[u];
    if (x?.a === 'agrandir') {
      if ((points[u] ?? 0) >= 1) {
        parts[u]++;
        points[u]--;
        pot++;
        badges[u] = { type: 'agrandit', texte: '⬆ +1 part' };
        journal.push(`${noms[u]} agrandit sa part.`);
      } else badges[u] = { type: 'pauvre', texte: 'Pas assez de pts' };
    }
    if (x?.a === 'voler' && x.c && x.c !== u && e.ordre.includes(x.c)) {
      const v = x.c;
      if (protege(v)) {
        const don = Math.min(1, points[u] ?? 0);
        points[u] -= don;
        points[v] = (points[v] ?? 0) + don;
        badges[u] = { type: 'rate', texte: `✖ Vol raté (${noms[v]})` };
        badges[v] = { type: 'protege', texte: `🛡 Bloque ${noms[u]}` };
        journal.push(`${noms[v]} était protégé : ${noms[u]} rate son vol et lui donne 1 pt !`);
      } else if (parts[v] > 1) {
        parts[v]--;
        parts[u]++;
        badges[u] = { type: 'vole', texte: `🫳 Vole ${noms[v]}` };
        badges[v] = { ...(badges[v] ?? { type: 'victime', texte: '😱 Volé !' }), vise: true };
        journal.push(`${noms[u]} vole une part à ${noms[v]} !`);
      } else badges[u] = { type: 'rate', texte: `✖ ${noms[v]} n’a plus rien` };
    }
  }
  return { parts, points, pot, badges, journal };
}

export const territoires: MiniJeu<Etat> = {
  id: 'territoires',
  nom: 'Roue des territoires',
  accroche: 'Agrandis ta part, vole celle des autres… et que la roue tourne.',
  explication: {
    comment: 'La roue est partagée en parts, une couleur par joueur. À chaque manche, choisis en secret : Agrandir (+1 part, coûte 1 pt), Voler (gratuit : tu prends 1 part à quelqu’un… mais s’il s’est protégé, tu lui donnes 1 pt) ou Protéger. Puis la roue tourne : la part sous le curseur remporte la cagnotte.',
    gagner: 'Le plus de points à la fin des manches gagne.',
    note: 'Négocier à voix haute est autorisé. Tenir parole, beaucoup moins.',
  },
  icone: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M12 3v9l7 5" stroke="currentColor" stroke-width="2.5" fill="none"/>',
  couleur: '#B18CFF',
  autorise: (_n, nb) => nb >= 3,
  tours: (duree) => `${selonFormat(duree, NB_MANCHES)} manches`,

  demarrer(ctx) {
    const ordre = [...ctx.uids].sort(() => ctx.hasard() - 0.5);
    return {
      etat: {
        etape: etapeDe(ctx.numeroJeu, 0), phase: 'choix', numeroJeu: ctx.numeroJeu, ordre, manche: 0, total: selonFormat(ctx.duree, NB_MANCHES),
        parts: Object.fromEntries(ordre.map((u) => [u, PARTS_DEPART])), points: Object.fromEntries(ordre.map((u) => [u, POINTS_DEPART])),
        pot: POT_DEPART, rotation: 0, fin: ctx.maintenant + DUREE_CHOIX,
      },
    };
  },

  piloter(ctx, etat) {
    const now = ctx.maintenant;
    if (etat.phase === 'choix' && etapeTerminee(ctx, etat.etape, etat.fin)) {
      const recues = reponsesDe<{ a?: Action; c?: string }>(ctx, etat.etape);
      // Sans choix : on se protège.
      const actions = Object.fromEntries(etat.ordre.map((u) => [u, recues[u]?.a ? { a: recues[u].a!, c: recues[u].c } : { a: 'proteger' as Action }]));
      const noms = Object.fromEntries(etat.ordre.map((u) => [u, ctx.joueurs[u]?.prenom ?? '?']));
      const r = appliquerActions(etat, actions, noms);
      return { etat: { ...etat, phase: 'revelation', partsAvant: etat.parts, parts: r.parts, points: r.points, pot: r.pot, badges: r.badges, journal: r.journal, morph: now + etat.ordre.length * 350 + 400, spin: undefined, fin: now + DUREE_REVELATION } };
    }
    if (etat.phase === 'revelation' && now >= (etat.fin ?? 0)) {
      const { gagnant, rotation1 } = tirerArret(etat.ordre.map((u) => etat.parts[u]), etat.rotation, ctx.hasard);
      return { etat: { ...etat, phase: 'roue', spin: { debut: now + 300, rotation0: etat.rotation, rotation1, gagnant: etat.ordre[gagnant], gain: etat.pot }, fin: now + 300 + DUREE_ROUE } };
    }
    if (etat.phase === 'roue' && now >= (etat.fin ?? 0)) {
      const s = etat.spin!;
      return { etat: { ...etat, phase: 'gain', rotation: s.rotation1 % (Math.PI * 2), points: { ...etat.points, [s.gagnant]: (etat.points[s.gagnant] ?? 0) + s.gain }, fin: now + DUREE_GAIN } };
    }
    if (etat.phase === 'gain' && now >= (etat.fin ?? 0)) {
      if (etat.manche + 1 >= etat.total) return { etat: { ...etat, phase: 'bilan', fin: now + DUREE_BILAN } };
      const manche = etat.manche + 1;
      return { etat: { ...etat, phase: 'choix', manche, etape: etapeDe(etat.numeroJeu, manche), pot: POT_DEPART, badges: undefined, journal: undefined, partsAvant: undefined, spin: undefined, fin: now + DUREE_CHOIX } };
    }
    if (etat.phase === 'bilan' && now >= (etat.fin ?? 0)) {
      return { etat, fin: { points: pointsDePlace(etat.points), sorte: 'place' } };
    }
    return null;
  },

  ecran(v) {
    const e = v.etat;
    const nom = (u: string) => esc(v.joueurs[u]?.prenom ?? '?');
    const tete = `${hud('ROUE DES TERRITOIRES', e.manche, e.total, e.phase !== 'bilan')}`;
    const totalParts = e.ordre.reduce((s, u) => s + (e.parts[u] ?? 0), 0);
    const spin = e.phase === 'roue' || e.phase === 'gain' ? e.spin : undefined;
    const roue = roueHtml(`${e.etape}-${e.phase}`, {
      parts: e.ordre.map((u) => ({ nom: v.joueurs[u]?.prenom ?? '?', couleur: v.joueurs[u]?.couleur ?? '#888', avant: e.partsAvant?.[u] ?? e.parts[u], apres: e.parts[u] })),
      pot: e.phase === 'gain' ? 0 : e.pot,
      rotation0: spin ? spin.rotation0 : e.rotation,
      rotation1: spin ? spin.rotation1 : e.rotation,
      debut: spin?.debut ?? 0,
      duree: DUREE_ROUE,
      morph: e.phase === 'revelation' ? e.morph ?? 0 : 0,
    });
    const cartes = `<div class="joueurs-roue">${e.ordre.map((u, i) => {
      const b = e.phase === 'revelation' || e.phase === 'roue' || e.phase === 'gain' ? e.badges?.[u] : undefined;
      return `<div class="joueur-roue ${u === v.uid ? 'moi' : ''} ${b?.vise ? 'vise' : ''} ${spin && e.phase === 'gain' && spin.gagnant === u ? 'gagnant' : ''}" style="--k:${v.joueurs[u]?.couleur}">
        <i></i>${nom(u)}<b>${Math.round(((e.parts[u] ?? 0) / Math.max(1, totalParts)) * 100)}%</b><span>${e.points[u] ?? 0} pts</span>
        ${b ? `<em class="badge-action ${b.type}" style="animation-delay:${i * 0.35}s">${esc(b.texte)}</em>` : ''}</div>`;
    }).join('')}</div>`;

    if (e.phase === 'bilan') {
      const ordre = [...v.uids].sort((a, b) => (e.points[b] ?? 0) - (e.points[a] ?? 0));
      const max = Math.max(1, ...ordre.map((u) => e.points[u] ?? 0));
      return `${tete}<h2 class="question centre-texte">Les maîtres de la roue</h2>
        <div class="pile">${classementBarres(ordre.map((u) => ({ joueur: v.joueurs[u], texte: `${e.points[u] ?? 0} pts`, part: (e.points[u] ?? 0) / max, moi: u === v.uid })))}</div>`;
    }

    if (e.phase === 'choix') {
      const fait = v.maReponse?.etape === e.etape || v.local[e.etape] !== undefined;
      const choix = (v.local[`${e.etape}-choix`] as { a?: Action; c?: string }) ?? {};
      const pret = choix.a && (choix.a !== 'voler' || choix.c);
      const mesPoints = e.points[v.uid] ?? 0;
      return `${tete}${chrono(e.fin)}
        <div class="scene-roue">${roue}</div>${cartes}
        ${fait
          ? '<p class="attente">Action secrète enregistrée. Négocie… ou fais semblant.</p>'
          : `<div class="actions-roue">
              <button class="action-roue ${choix.a === 'agrandir' ? 'actif' : ''}" data-action="jeu" data-geste="choisir" data-valeur="agrandir" ${mesPoints < 1 ? 'disabled' : ''}>Agrandir<small>+1 part · 1 pt</small></button>
              <button class="action-roue ${choix.a === 'voler' ? 'actif' : ''}" data-action="jeu" data-geste="choisir" data-valeur="voler">Voler<small>gratuit, risqué</small></button>
              <button class="action-roue ${choix.a === 'proteger' ? 'actif' : ''}" data-action="jeu" data-geste="choisir" data-valeur="proteger">Protéger<small>bouclier</small></button>
            </div>
            ${choix.a === 'voler' ? `<div class="cibles-roue">${e.ordre.filter((u) => u !== v.uid).map((u) => `<button class="${choix.c === u ? 'actif' : ''}" style="--k:${v.joueurs[u]?.couleur}" data-action="jeu" data-geste="cibler" data-valeur="${u}">Voler ${nom(u)}</button>`).join('')}</div>` : ''}
            <button class="bouton jaune ${pret ? '' : 'pas-pret'}" data-action="jeu" data-geste="valider">${!choix.a ? '① Choisis ton action' : choix.a === 'voler' && !choix.c ? '② Choisis qui voler' : 'Valider en secret'}</button>`}
        ${attenteDes(e.ordre, v.joueurs, (u) => v.ontRepondu.includes(u) || (u === v.uid && fait))}`;
    }

    const bandeau = e.phase === 'gain' && spin
      ? `<div class="gain-roue" style="--k:${v.joueurs[spin.gagnant]?.couleur}">${nom(spin.gagnant)} +${spin.gain} PTS</div>` : '';
    return `${tete}
      <div class="scene-roue">${roue}${bandeau}</div>${cartes}
      <div class="journal-roue">${(e.journal ?? []).slice(-3).map((l) => `<p>${esc(l)}</p>`).join('') || '<p>Tout le monde s’est protégé…</p>'}</div>`;
  },

  gestes: {
    choisir(el, o, v) {
      const cle = `${v.etat.etape}-choix`;
      o.local[cle] = { a: el.dataset.valeur };
      o.rafraichir();
    },
    cibler(el, o, v) {
      const cle = `${v.etat.etape}-choix`;
      o.local[cle] = { ...(o.local[cle] as object), c: el.dataset.valeur };
      o.rafraichir();
    },
    async valider(_el, o, v) {
      const e = v.etat;
      const choix = (o.local[`${e.etape}-choix`] as { a?: Action; c?: string }) ?? {};
      if (e.phase !== 'choix' || o.local[e.etape] !== undefined || !choix.a || (choix.a === 'voler' && !choix.c)) return;
      o.local[e.etape] = true;
      o.rafraichir();
      await o.repondre(choix.a === 'voler' ? { a: 'voler', c: choix.c } : { a: choix.a });
    },
  },
};
