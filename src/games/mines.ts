// « Champ de mines » : chacun pose d'abord une mine en secret sur une grille de colis. Puis, chacun son tour, on
// ouvre des colis : chaque colis sûr rapporte de plus en plus (1, puis 2, puis 3… pts) ; on peut s'arrêter et
// encaisser, ou continuer. Tomber sur une mine fait perdre les points du tour, et c'est le poseur de la mine qui gagne.
// Bluff : à voix haute, chacun peut « conseiller » le joueur… et l'envoyer sur sa propre mine.
// Les mines ne sont connues que de l'hôte (prive/mines) jusqu'à ce qu'elles sautent.
import { esc } from '../outils';
import { pointsDePlace } from '../score';
import { attenteDes, chrono } from '../ecrans/commun';
import { etapeTerminee, reponsesDe, selonFormat, type ContexteHote, type EtatDeBase, type MiniJeu } from './interface';
import { classementBarres, hud } from './arene';

const NB_CASES = 20; // grille de 4 × 5
const TOURS_PAR_JOUEUR: [number, number, number] = [2, 2, 3]; // Courte, Normale, Longue
const DUREE_POSE = 30_000;
const DUREE_ACTION = 20_000;
const DUREE_BOUM = 4_000;
const DUREE_BILAN = 6_500;
const GAIN_MINE = 3; // au minimum, pour le poseur de la mine

interface Etat extends EtatDeBase {
  phase: 'pose' | 'tour' | 'boum' | 'bilan';
  numeroJeu: number;
  ordre: string[];
  totalTours: number;
  tour: number; // n° du tour (le joueur qui joue : ordre[tour % n])
  action: number; // n° de l'action dans le tour (sert d'étape)
  pot: number; // points du tour en cours (perdus si mine)
  sures: number; // colis sûrs ouverts pendant ce tour
  ouvertes: Record<string, 'sur' | 'mine'>; // case → ce qu'elle cachait
  poseurs?: Record<string, string[]>; // cases minées révélées → qui les avait posées
  banque: Record<string, number>;
  bonus: Record<string, number>; // points gagnés grâce à sa mine
  dernier?: { case: number; joueur: string; poseurs: string[]; gain: number };
}

// Gemme (colis sûr) et bombe (mine), façon jeux de mines.
const GEMME = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M8 15 L14 7 H26 L32 15 L20 33 Z" fill="#3DF58A"/><path d="M8 15 H32 L20 33 Z" fill="#1FC86A"/><path d="M14 7 L17 15 L20 7 L23 15 L26 7" fill="none" stroke="#B9FFD6" stroke-width="1.5"/><path d="M8 15 H32" stroke="#B9FFD6" stroke-width="1.5"/></svg>';
const BOMBE = '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="18" cy="23" r="12" fill="#1A1220"/><circle cx="14" cy="19" r="3.5" fill="#ffffff55"/><rect x="22" y="8" width="8" height="6" rx="2" fill="#3A2F45" transform="rotate(35 26 11)"/><path d="M28 7 q4 -4 8 -2" stroke="#FFB547" stroke-width="2" fill="none"/><circle cx="36" cy="5" r="2.5" fill="#FF5A3D"/></svg>';

const etapeDe = (e: Pick<Etat, 'numeroJeu' | 'tour' | 'action'>) => `mines-${e.numeroJeu}-${e.tour}-${e.action}`;
const joueurDu = (e: Etat) => e.ordre[e.tour % e.ordre.length];
/** Le k-ième colis sûr du tour rapporte k points. */
export const gainSur = (sures: number): number => sures + 1;

function tourSuivant(ctx: ContexteHote, e: Etat, mines: Record<string, string[]>): { etat: Etat } {
  const tour = e.tour + 1;
  const fermeesSures = Array.from({ length: NB_CASES }, (_, i) => i).filter((i) => !e.ouvertes[i] && !mines[i]);
  if (tour >= e.totalTours || !fermeesSures.length) return { etat: { ...e, phase: 'bilan', fin: ctx.maintenant + DUREE_BILAN } };
  const suite: Etat = { ...e, phase: 'tour', tour, action: 0, pot: 0, sures: 0, fin: ctx.maintenant + DUREE_ACTION };
  return { etat: { ...suite, etape: etapeDe(suite) } };
}

export const champDeMines: MiniJeu<Etat> = {
  id: 'mines',
  nom: 'Champ de mines',
  accroche: 'Pose ta mine en secret, puis ouvre des colis… sans sauter.',
  explication: {
    comment: 'Chacun pose d’abord une mine en secret sur la grille. Puis, chacun son tour, on ouvre des colis : chaque colis sûr rapporte plus que le précédent (1, 2, 3 pts…). Tu peux t’arrêter pour encaisser, ou continuer. Si tu tombes sur une mine, tu perds les points du tour et le poseur de la mine gagne !',
    gagner: 'Le plus de points gagne : ceux encaissés et ceux gagnés quand quelqu’un saute sur ta mine.',
    note: 'Conseiller les autres à voix haute est autorisé… et pas forcément honnête.',
  },
  icone: '<rect x="4" y="9" width="16" height="11" rx="2" fill="currentColor"/><path d="M12 9c1-3 3-5 6-5" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="19" cy="4" r="2" fill="currentColor"/>',
  couleur: '#E0A060',
  autorise: (_n, nb) => nb >= 3,
  tours: (duree) => `${selonFormat(duree, TOURS_PAR_JOUEUR)} tours chacun`,

  demarrer(ctx) {
    const ordre = [...ctx.uids].sort(() => ctx.hasard() - 0.5);
    const zero = Object.fromEntries(ctx.uids.map((u) => [u, 0]));
    const e: Etat = {
      etape: `mines-${ctx.numeroJeu}-pose`, phase: 'pose', numeroJeu: ctx.numeroJeu, ordre, totalTours: ordre.length * selonFormat(ctx.duree, TOURS_PAR_JOUEUR),
      tour: 0, action: 0, pot: 0, sures: 0, ouvertes: {}, banque: zero, bonus: { ...zero }, fin: ctx.maintenant + DUREE_POSE,
    };
    return { etat: e };
  },

  piloter(ctx, etat) {
    const now = ctx.maintenant;
    const e: Etat = { ...etat, ouvertes: etat.ouvertes ?? {}, poseurs: etat.poseurs ?? {} };
    const mines = (ctx.prive.mines as Record<string, string[]> | undefined) ?? {};

    if (e.phase === 'pose' && etapeTerminee(ctx, e.etape, e.fin)) {
      const recues = reponsesDe<{ case: number }>(ctx, e.etape);
      const poses: Record<string, string[]> = {};
      for (const u of ctx.uids) {
        const c = Number.isInteger(recues[u]?.case) ? Number(recues[u].case) : Math.floor(ctx.hasard() * NB_CASES); // pas de choix : au hasard
        poses[c] = [...(poses[c] ?? []), u];
      }
      const suite: Etat = { ...e, phase: 'tour', tour: 0, action: 0, pot: 0, sures: 0, fin: now + DUREE_ACTION };
      return { etat: { ...suite, etape: etapeDe(suite) }, ecritures: { 'prive/mines': poses } };
    }

    if (e.phase === 'tour') {
      const joueur = joueurDu(e);
      const r = reponsesDe<{ case?: number; stop?: boolean }>(ctx, e.etape)[joueur];
      const banquer = () => tourSuivant(ctx, { ...e, banque: { ...e.banque, [joueur]: (e.banque[joueur] ?? 0) + e.pot } }, mines);
      // Pas de réponse à temps (ou joueur parti) : il encaisse ce qu'il a.
      if (!r) return now >= (e.fin ?? 0) || !ctx.connectes.includes(joueur) ? banquer() : null;
      if (r.stop) return banquer();
      const c = Number(r.case);
      if (!Number.isInteger(c) || c < 0 || c >= NB_CASES || e.ouvertes[c]) return null;
      const poseurs = mines[c] ?? [];
      if (poseurs.length) {
        // KABOOM : le joueur perd les points du tour ; chaque poseur (sauf lui) gagne.
        const gain = Math.max(GAIN_MINE, e.pot);
        const bonus = { ...e.bonus };
        for (const p of poseurs) if (p !== joueur) bonus[p] = (bonus[p] ?? 0) + gain;
        return {
          etat: {
            ...e, phase: 'boum', bonus, pot: 0, ouvertes: { ...e.ouvertes, [c]: 'mine' }, poseurs: { ...e.poseurs, [c]: poseurs },
            dernier: { case: c, joueur, poseurs, gain }, fin: now + DUREE_BOUM,
          },
        };
      }
      const sures = e.sures + 1;
      const suite: Etat = { ...e, ouvertes: { ...e.ouvertes, [c]: 'sur' }, sures, pot: e.pot + gainSur(e.sures), action: e.action + 1, fin: now + DUREE_ACTION };
      // Plus aucun colis sûr fermé : il encaisse d'office.
      const resteSur = Array.from({ length: NB_CASES }, (_, i) => i).some((i) => !suite.ouvertes[i] && !mines[i]);
      if (!resteSur) return tourSuivant(ctx, { ...suite, banque: { ...suite.banque, [joueur]: (suite.banque[joueur] ?? 0) + suite.pot } }, mines);
      return { etat: { ...suite, etape: etapeDe(suite) } };
    }

    if (e.phase === 'boum' && now >= (e.fin ?? 0)) return tourSuivant(ctx, e, mines);

    if (e.phase === 'bilan' && now >= (e.fin ?? 0)) {
      const score = Object.fromEntries(ctx.uids.map((u) => [u, (e.banque[u] ?? 0) + (e.bonus[u] ?? 0)]));
      return { etat: e, ecritures: { 'prive/mines': null }, fin: { points: pointsDePlace(score), sorte: 'place' } };
    }
    return null;
  },

  ecran(v) {
    const e = { ...v.etat, ouvertes: v.etat.ouvertes ?? {}, poseurs: v.etat.poseurs ?? {} };
    const nom = (u: string) => esc(v.joueurs[u]?.prenom ?? '?');
    const maMine = v.local[`mines-${e.numeroJeu}-ma-mine`] as number | undefined;
    const tete = hud('CHAMP DE MINES', Math.floor(e.tour / Math.max(1, e.ordre.length)), Math.max(1, Math.round(e.totalTours / Math.max(1, e.ordre.length))), e.phase !== 'bilan');
    const score = (u: string) => (e.banque[u] ?? 0) + (e.bonus[u] ?? 0);

    const grille = (cliquable: boolean, geste: string, choisie?: number) => `<div class="champ-mines">${Array.from({ length: NB_CASES }, (_, i) => {
      const o = e.ouvertes[i];
      const marque = maMine === i && !o ? `<span class="ma-mine">${BOMBE}</span>` : '';
      if (o === 'sur') return `<div class="case-champ sure">${GEMME}</div>`;
      if (o === 'mine') return `<div class="case-champ minee ${e.dernier?.case === i && e.phase === 'boum' ? 'vient' : ''}">${BOMBE}<small>${(e.poseurs[i] ?? []).map(nom).join(', ')}</small></div>`;
      return cliquable
        ? `<button class="case-champ fermee ${choisie === i ? 'choisie' : ''}" data-action="jeu" data-geste="${geste}" data-valeur="${i}" aria-label="Colis ${i + 1}">${marque}</button>`
        : `<div class="case-champ fermee">${marque}</div>`;
    }).join('')}</div>`;

    if (e.phase === 'bilan') {
      const ordre = [...v.uids].sort((a, b) => score(b) - score(a));
      const max = Math.max(1, ...ordre.map(score));
      return `${tete}<h2 class="question centre-texte">Les survivants</h2>
        <div class="pile">${classementBarres(ordre.map((u) => ({ joueur: v.joueurs[u], texte: `${score(u)} pts${e.bonus[u] ? ` (dont ${e.bonus[u]} de mine)` : ''}`, part: score(u) / max, moi: u === v.uid })))}</div>
        ${grille(false, '')}`;
    }

    if (e.phase === 'pose') {
      const fait = v.maReponse?.etape === e.etape || v.local[e.etape] !== undefined;
      const choisie = v.local[`${e.etape}-choix`] as number | undefined;
      return `${tete}${chrono(e.fin)}
        <h2 class="question">${fait ? 'Ta mine est posée' : 'Pose ta mine en secret'}</h2>
        <p class="aide gauche">${fait ? 'Personne ne sait où elle est. Pendant le jeu, à toi d’y attirer les autres…' : 'Choisis un colis. Si quelqu’un l’ouvre, c’est toi qui gagnes ses points.'}</p>
        ${grille(!fait, 'choisirMine', choisie ?? maMine)}
        ${fait ? '' : `<button class="bouton rose" data-action="jeu" data-geste="poserMine" ${choisie === undefined ? 'disabled' : ''}>Poser ma mine ici</button>`}
        ${attenteDes(v.uids, v.joueurs, (u) => v.ontRepondu.includes(u) || (u === v.uid && fait))}`;
    }

    const joueur = joueurDu(e);
    const scores = `<div class="joueurs-arene">${e.ordre.map((u) => `<div class="${u === v.uid ? 'moi' : ''} ${u === joueur && e.phase === 'tour' ? 'porteur' : ''}"><span class="pastille" style="--c:${v.joueurs[u].couleur};width:24px;height:24px"></span>${nom(u)}<em>${score(u)} pts</em></div>`).join('')}</div>`;

    if (e.phase === 'boum') {
      const d = e.dernier!;
      const autres = d.poseurs.filter((p) => p !== d.joueur);
      return `${tete}
        <div class="boum-mine" aria-live="assertive"><span class="eclat-mine"></span><p class="mot-boum">KABOOM !</p></div>
        <h2 class="question centre-texte">${nom(d.joueur)} saute sur ${autres.length ? `la mine de ${autres.map(nom).join(' et ')}` : 'sa propre mine'} !</h2>
        <p class="aide">${autres.length ? `${autres.map(nom).join(' et ')} gagne${autres.length > 1 ? 'nt' : ''} ${d.gain} pts.` : 'Aucun point pour personne.'} ${nom(d.joueur)} perd les points de ce tour.</p>
        ${grille(false, '')}${scores}`;
    }

    // Un tour.
    const aMoi = joueur === v.uid;
    const prochain = gainSur(e.sures);
    if (aMoi) {
      const fait = v.local[e.etape] !== undefined;
      return `${tete}${chrono(e.fin)}
        <h2 class="question">À toi ! Ouvre un colis</h2>
        <div class="pot-mines"><span>Ce tour : <b>${e.pot} pt${e.pot > 1 ? 's' : ''}</b></span><span>Prochain colis : <b>+${prochain}</b></span></div>
        ${grille(!fait, 'ouvrir')}
        ${e.pot > 0 && !fait ? `<button class="bouton vert" data-action="jeu" data-geste="arreter">Je m’arrête et j’encaisse ${e.pot} pt${e.pot > 1 ? 's' : ''}</button>` : ''}
        ${scores}`;
    }
    return `${tete}${chrono(e.fin)}
      <h2 class="question">${nom(joueur)} choisit un colis…</h2>
      <div class="pot-mines"><span>Son tour : <b>${e.pot} pt${e.pot > 1 ? 's' : ''}</b></span><span>Prochain : <b>+${prochain}</b></span></div>
      <p class="aide gauche">Conseille-${'le'} à voix haute… ou envoie-${'le'} sur ta mine.</p>
      ${grille(false, '')}${scores}`;
  },

  gestes: {
    choisirMine(el, o, v) {
      o.local[`${v.etat.etape}-choix`] = Number(el.dataset.valeur);
      o.rafraichir();
    },
    async poserMine(_el, o, v) {
      const e = v.etat;
      const c = o.local[`${e.etape}-choix`] as number | undefined;
      if (e.phase !== 'pose' || c === undefined || o.local[e.etape] !== undefined) return;
      o.local[e.etape] = true;
      o.local[`mines-${e.numeroJeu}-ma-mine`] = c; // seul ce téléphone sait où est ma mine
      o.rafraichir();
      await o.repondre({ case: c });
    },
    async ouvrir(el, o, v) {
      const e = v.etat;
      if (e.phase !== 'tour' || joueurDu(e) !== v.uid || o.local[e.etape] !== undefined) return;
      o.local[e.etape] = true;
      o.rafraichir();
      await o.repondre({ case: Number(el.dataset.valeur) });
    },
    async arreter(_el, o, v) {
      const e = v.etat;
      if (e.phase !== 'tour' || joueurDu(e) !== v.uid || o.local[e.etape] !== undefined) return;
      o.local[e.etape] = true;
      o.rafraichir();
      await o.repondre({ stop: true });
    },
  },
};
