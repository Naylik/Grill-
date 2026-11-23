// « Champ de mines » : chacun pose d'abord une mine en secret sur une grille de colis commune. Puis, à chaque manche,
// les joueurs encore en lice ouvrent UN colis chacun à tour de rôle : chaque colis sûr rapporte un peu plus que le
// précédent du même joueur (1, puis 2, puis 3… pts). À son tour, on peut encaisser et sortir de la manche.
// Tomber sur une mine fait perdre les points de la manche (on sort), et c'est le poseur de la mine qui gagne.
// Le 1er joueur change à chaque manche : personne n'a l'avantage de jouer sur une grille encore pleine.
// Bluff : à voix haute, chacun peut « conseiller » les autres… et les envoyer sur sa propre mine.
// Les mines ne sont connues que de l'hôte (prive/mines) jusqu'à ce qu'elles sautent.
// Détecteur secret : chaque joueur a 1 détecteur par jeu. Activé avant d'ouvrir un colis, il donne le nombre de mines
// dans les 8 cases autour… sur l'écran de ce joueur seulement. Il peut ensuite dire la vérité ou mentir à voix haute.
// Secret : le téléphone envoie une clé (lisible par l'hôte seul) ; l'hôte publie le chiffre brouillé avec cette clé.
// Les autres voient juste une loupe sur la case.
import { esc } from '../outils';
import { hacher } from '../flash';
import { pointsDePlace } from '../score';
import { attenteDes, chrono } from '../ecrans/commun';
import { etapeTerminee, reponsesDe, selonFormat, type ContexteHote, type EtatDeBase, type MiniJeu } from './interface';
import { classementBarres, hud } from './arene';

const NB_CASES = 20; // grille de 4 × 5
const COLONNES = 5;
export const DETECTEURS = 1; // par joueur et par jeu : un seul, à utiliser au bon moment
const MANCHES: [number, number, number] = [2, 2, 2]; // Courte, Normale, Longue : 2 manches, une grille neuve à chaque fois
const DUREE_ACTION = 20_000;
const DUREE_BOUM = 4_000;
const DUREE_BILAN = 6_500;
const GAIN_MINE = 3; // au minimum, pour le poseur de la mine

interface Etat extends EtatDeBase {
  phase: 'pose' | 'tour' | 'boum' | 'bilan';
  numeroJeu: number;
  ordre: string[]; // ordre de jeu de base ; il tourne d'un cran à chaque manche
  nbManches: number;
  manche: number;
  action: number; // n° de l'action dans la partie (sert d'étape)
  enLice: string[]; // joueurs encore dans la manche, dans l'ordre de jeu
  actif: number; // index dans enLice du joueur qui doit ouvrir un colis
  pots: Record<string, number>; // points en jeu dans la manche (perdus si mine)
  sures: Record<string, number>; // colis sûrs ouverts par chacun dans la manche
  ouvertes: Record<string, 'sur' | 'mine'>; // case → ce qu'elle cachait
  detections?: Record<string, { u: string; v: number }>; // case → qui a utilisé son détecteur, chiffre brouillé
  detecteurs?: Record<string, number>; // détecteurs déjà utilisés, par joueur
  poseurs?: Record<string, string[]>; // cases minées révélées → qui les avait posées
  banque: Record<string, number>;
  bonus: Record<string, number>; // points gagnés grâce à sa mine
  dernier?: { case: number; joueur: string; poseurs: string[]; gain: number };
  dernierSur?: { case: number; joueur: string; action: number };
}

// Gemme (colis sûr) et bombe (mine), façon jeux de mines.
const GEMME = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M8 15 L14 7 H26 L32 15 L20 33 Z" fill="#3DF58A"/><path d="M8 15 H32 L20 33 Z" fill="#1FC86A"/><path d="M14 7 L17 15 L20 7 L23 15 L26 7" fill="none" stroke="#B9FFD6" stroke-width="1.5"/><path d="M8 15 H32" stroke="#B9FFD6" stroke-width="1.5"/></svg>';
const BOMBE = '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="18" cy="23" r="12" fill="#1A1220"/><circle cx="14" cy="19" r="3.5" fill="#ffffff55"/><rect x="22" y="8" width="8" height="6" rx="2" fill="#3A2F45" transform="rotate(35 26 11)"/><path d="M28 7 q4 -4 8 -2" stroke="#FFB547" stroke-width="2" fill="none"/><circle cx="36" cy="5" r="2.5" fill="#FF5A3D"/></svg>';

const etapeDe = (e: Pick<Etat, 'numeroJeu' | 'manche' | 'action'>) => `mines-${e.numeroJeu}-${e.manche}-${e.action}`;
const joueurDu = (e: Etat): string | undefined => e.enLice[e.actif % Math.max(1, e.enLice.length)];
/** Le k-ième colis sûr d'un joueur dans la manche rapporte k points. */
export const gainSur = (sures: number): number => sures + 1;

/** Brouillage du chiffre du détecteur : seul celui qui connaît la clé peut le lire. */
const masque = (cle: string, c: number) => hacher(`${cle}:${c}`) % 16;
export const brouiller = (chiffre: number, cle: string, c: number): number => (chiffre + masque(cle, c)) % 16;
export const lireDetection = (v: number, cle: string, c: number): number => (v - masque(cle, c) + 16) % 16;

/** Détecteur : nombre de cases minées parmi les 8 cases autour de « i » (diagonales comprises). */
export function minesAutour(i: number, mines: Record<string, string[]>): number {
  const l = Math.floor(i / COLONNES);
  const c = i % COLONNES;
  let n = 0;
  for (let dl = -1; dl <= 1; dl++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dl && !dc) continue;
      const l2 = l + dl;
      const c2 = c + dc;
      if (l2 < 0 || c2 < 0 || c2 >= COLONNES || l2 * COLONNES + c2 >= NB_CASES) continue;
      if (mines[l2 * COLONNES + c2]?.length) n++;
    }
  }
  return n;
}

const restentSures = (e: Etat, mines: Record<string, string[]>) =>
  Array.from({ length: NB_CASES }, (_, i) => i).some((i) => !e.ouvertes[i] && !mines[i]?.length);

/** Fin d'une manche : une grille neuve et une nouvelle pose de mines, ou le bilan après la dernière manche. */
function finDeManche(ctx: ContexteHote, e: Etat): { etat: Etat; ecritures?: Record<string, unknown> } {
  const manche = e.manche + 1;
  if (manche >= e.nbManches) return { etat: { ...e, phase: 'bilan', enLice: [], fin: ctx.maintenant + DUREE_BILAN } };
  const zero = Object.fromEntries(e.ordre.map((u) => [u, 0]));
  return {
    etat: {
      ...e, phase: 'pose', manche, enLice: [], actif: 0, pots: zero, sures: { ...zero }, ouvertes: {}, poseurs: {}, detections: {}, dernier: undefined, dernierSur: undefined,
      etape: `mines-${e.numeroJeu}-pose-${manche}`, fin: undefined,
    },
    ecritures: { 'prive/mines': null },
  };
}

/** Les mines sont posées : les tours commencent, le 1er joueur avance d'un cran à chaque manche. */
function debutTours(ctx: ContexteHote, e: Etat): { etat: Etat } {
  const n = e.ordre.length;
  const enLice = e.ordre.map((_, i) => e.ordre[(i + e.manche) % n]).filter((u) => ctx.connectes.includes(u));
  if (!enLice.length) return { etat: { ...e, phase: 'bilan', fin: ctx.maintenant + DUREE_BILAN } };
  const zero = Object.fromEntries(e.ordre.map((u) => [u, 0]));
  const suite: Etat = { ...e, phase: 'tour', enLice, actif: 0, pots: zero, sures: { ...zero }, action: e.action + 1, fin: ctx.maintenant + DUREE_ACTION };
  return { etat: { ...suite, etape: etapeDe(suite) } };
}

/** Au suivant : `sort` = le joueur actif quitte la manche (il a encaissé ou sauté). */
function auSuivant(ctx: ContexteHote, e: Etat, mines: Record<string, string[]>, sort: boolean): { etat: Etat; ecritures?: Record<string, unknown> } {
  const joueur = joueurDu(e);
  const enLice = sort ? e.enLice.filter((u) => u !== joueur) : e.enLice;
  if (!enLice.length) return finDeManche(ctx, { ...e, enLice });
  // Plus aucun colis sûr fermé : ceux qui restent encaissent d'office, et la manche se termine.
  if (!restentSures(e, mines)) {
    const banque = { ...e.banque };
    for (const u of enLice) banque[u] = (banque[u] ?? 0) + (e.pots[u] ?? 0);
    return finDeManche(ctx, { ...e, banque, enLice: [] });
  }
  const actif = sort ? e.actif % enLice.length : (e.actif + 1) % enLice.length;
  const suite: Etat = { ...e, phase: 'tour', enLice, actif, action: e.action + 1, fin: ctx.maintenant + DUREE_ACTION };
  return { etat: { ...suite, etape: etapeDe(suite) } };
}

function boutonDetecteur(e: Etat, v: { uid: string; local: Record<string, unknown> }): string {
  const reste = DETECTEURS - (e.detecteurs?.[v.uid] ?? 0);
  if (reste <= 0) return '<p class="aide">Plus de détecteur pour ce jeu.</p>';
  const arme = v.local[`${e.etape}-detecteur`] === true;
  return `<button class="bouton discret detecteur-mines ${arme ? 'arme' : ''}" data-action="jeu" data-geste="detecteur">🔍 ${arme ? 'Détecteur prêt : ouvre un colis' : `Activer le détecteur (${reste} restant${reste > 1 ? 's' : ''})`}</button>`;
}

export const champDeMines: MiniJeu<Etat> = {
  id: 'mines',
  nom: 'Champ de mines',
  accroche: 'Pose ta mine en secret, puis ouvre des colis… sans sauter.',
  explication: {
    comment: '2 manches, avec une grille neuve à chaque fois. Au début de chaque manche, chacun pose une mine en secret sur la grille commune. Puis on ouvre UN colis chacun son tour : chaque colis sûr te rapporte plus que ton précédent (1, 2, 3 pts…). À ton tour, tu peux encaisser et sortir de la manche, ou tenter un colis de plus. Si tu tombes sur une mine, tu perds les points de la manche et le poseur de la mine gagne !',
    gagner: 'Le plus de points gagne : ceux encaissés et ceux gagnés quand quelqu’un saute sur ta mine.',
    note: 'Détecteur secret : 1 seul par joueur, à garder pour le bon moment. Activé avant d’ouvrir un colis, il te montre (à toi seul) le nombre de mines dans les 8 cases autour. Les autres voient juste une loupe. Tu vois aussi ta propre mine. Conseiller à voix haute est autorisé… et pas forcément honnête.',
  },
  icone: '<rect x="4" y="9" width="16" height="11" rx="2" fill="currentColor"/><path d="M12 9c1-3 3-5 6-5" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="19" cy="4" r="2" fill="currentColor"/>',
  couleur: '#E0A060',
  autorise: (_n, nb) => nb >= 3,
  tours: (duree) => `${selonFormat(duree, MANCHES)} manches`,

  demarrer(ctx) {
    const ordre = [...ctx.uids].sort(() => ctx.hasard() - 0.5);
    const zero = Object.fromEntries(ctx.uids.map((u) => [u, 0]));
    const e: Etat = {
      etape: `mines-${ctx.numeroJeu}-pose-0`, phase: 'pose', numeroJeu: ctx.numeroJeu, ordre, nbManches: selonFormat(ctx.duree, MANCHES),
      manche: 0, action: 0, enLice: [], actif: 0, pots: { ...zero }, sures: { ...zero }, ouvertes: {}, banque: zero, bonus: { ...zero }, fin: undefined,
    };
    return { etat: e };
  },

  piloter(ctx, etat) {
    const now = ctx.maintenant;
    const e: Etat = { ...etat, ouvertes: etat.ouvertes ?? {}, poseurs: etat.poseurs ?? {}, enLice: etat.enLice ?? [], pots: etat.pots ?? {}, sures: etat.sures ?? {} };
    const mines = (ctx.prive.mines as Record<string, string[]> | undefined) ?? {};

    if (e.phase === 'pose' && etapeTerminee(ctx, e.etape, e.fin)) {
      const recues = reponsesDe<{ case: number }>(ctx, e.etape);
      const poses: Record<string, string[]> = {};
      for (const u of ctx.uids) {
        const c = Number.isInteger(recues[u]?.case) ? Number(recues[u].case) : Math.floor(ctx.hasard() * NB_CASES); // pas de choix : au hasard
        poses[c] = [...(poses[c] ?? []), u];
      }
      return { ...debutTours(ctx, e), ecritures: { 'prive/mines': poses } };
    }

    if (e.phase === 'tour') {
      const joueur = joueurDu(e);
      if (!joueur) return finDeManche(ctx, e);
      const r = reponsesDe<{ case?: number; stop?: boolean; detecteur?: string }>(ctx, e.etape)[joueur];
      const encaisser = () => auSuivant(ctx, { ...e, banque: { ...e.banque, [joueur]: (e.banque[joueur] ?? 0) + (e.pots[joueur] ?? 0) } }, mines, true);
      // Pas de réponse à temps (ou joueur parti) : il encaisse ce qu'il a et sort de la manche.
      if (!r) return now >= (e.fin ?? 0) || !ctx.connectes.includes(joueur) ? encaisser() : null;
      if (r.stop) return encaisser();
      const c = Number(r.case);
      if (!Number.isInteger(c) || c < 0 || c >= NB_CASES || e.ouvertes[c]) return null;
      const poseurs = mines[c] ?? [];
      if (poseurs.length) {
        // KABOOM : le joueur perd les points de la manche et sort ; chaque poseur (sauf lui) gagne.
        const gain = Math.max(GAIN_MINE, e.pots[joueur] ?? 0);
        const bonus = { ...e.bonus };
        for (const p of poseurs) if (p !== joueur) bonus[p] = (bonus[p] ?? 0) + gain;
        return {
          etat: {
            ...e, phase: 'boum', bonus, pots: { ...e.pots, [joueur]: 0 }, ouvertes: { ...e.ouvertes, [c]: 'mine' }, poseurs: { ...e.poseurs, [c]: poseurs },
            dernier: { case: c, joueur, poseurs, gain }, fin: now + DUREE_BOUM,
          },
        };
      }
      // Détecteur secret : le chiffre est publié brouillé avec la clé du joueur (lui seul peut le lire).
      const utilises = e.detecteurs?.[joueur] ?? 0;
      const detecte = typeof r.detecteur === 'string' && r.detecteur.length >= 8 && utilises < DETECTEURS;
      const sures = (e.sures[joueur] ?? 0) + 1;
      const suite: Etat = {
        ...e, ouvertes: { ...e.ouvertes, [c]: 'sur' }, sures: { ...e.sures, [joueur]: sures }, pots: { ...e.pots, [joueur]: (e.pots[joueur] ?? 0) + gainSur(sures - 1) },
        dernierSur: { case: c, joueur, action: e.action },
        ...(detecte ? { detections: { ...(e.detections ?? {}), [c]: { u: joueur, v: brouiller(minesAutour(c, mines), r.detecteur!, c) } }, detecteurs: { ...(e.detecteurs ?? {}), [joueur]: utilises + 1 } } : {}),
      };
      return auSuivant(ctx, suite, mines, false);
    }

    // Après l'explosion : le joueur qui a sauté sort de la manche.
    if (e.phase === 'boum' && now >= (e.fin ?? 0)) return auSuivant(ctx, e, mines, true);

    if (e.phase === 'bilan' && now >= (e.fin ?? 0)) {
      const score = Object.fromEntries(ctx.uids.map((u) => [u, (e.banque[u] ?? 0) + (e.bonus[u] ?? 0)]));
      return { etat: e, ecritures: { 'prive/mines': null }, fin: { points: pointsDePlace(score), sorte: 'place' } };
    }
    return null;
  },

  ecran(v) {
    const e = { ...v.etat, ouvertes: v.etat.ouvertes ?? {}, poseurs: v.etat.poseurs ?? {}, detections: v.etat.detections ?? {}, enLice: v.etat.enLice ?? [], pots: v.etat.pots ?? {}, sures: v.etat.sures ?? {} };
    const maCle = v.local[`mines-${e.numeroJeu}-cle`] as string | undefined;
    const nom = (u: string) => esc(v.joueurs[u]?.prenom ?? '?');
    const maMine = v.local[`mines-${e.numeroJeu}-${e.manche}-ma-mine`] as number | undefined;
    const tete = hud('CHAMP DE MINES', Math.min(e.manche, e.nbManches), Math.max(1, e.nbManches), e.phase !== 'bilan');
    const score = (u: string) => (e.banque[u] ?? 0) + (e.bonus[u] ?? 0);
    const pts = (n: number) => `${n} pt${n > 1 ? 's' : ''}`;

    // Il reste peu de colis fermés par rapport aux mines encore cachées : la grille pulse en rouge.
    const fermes = Array.from({ length: NB_CASES }, (_, i) => i).filter((i) => !e.ouvertes[i]).length;
    const minesCachees = Math.max(0, e.ordre.length - Object.values(e.ouvertes).filter((o) => o === 'mine').length);
    const tendue = e.phase === 'tour' && minesCachees > 0 && fermes <= minesCachees * 2 + 1;
    const grille = (cliquable: boolean, geste: string, choisie?: number) => `<div class="champ-mines ${tendue ? 'tendue' : ''}">${Array.from({ length: NB_CASES }, (_, i) => {
      const o = e.ouvertes[i];
      const marque = maMine === i && !o ? `<span class="ma-mine ${e.phase === 'pose' ? 'enterre' : ''}">${BOMBE}<em>ta mine</em></span>` : '';
      const d = e.detections[i];
      // Mon détecteur : je lis le chiffre ; celui des autres : une loupe, sans le chiffre.
      const k = d && d.u === v.uid && maCle ? lireDetection(d.v, maCle, i) : undefined;
      const info = k !== undefined
        ? `<span class="chiffre-mine n${Math.min(3, k)}" aria-label="${k} mine${k > 1 ? 's' : ''} autour (toi seul le vois)">${k}</span>`
        : d ? '<span class="loupe-mine" aria-label="détecteur utilisé ici">🔍</span>' : '';
      // Suspens court : le colis qui vient d'être ouvert tremble 0,4 s avant de montrer ce qu'il cachait.
      if (o === 'sur') return `<div class="case-champ sure ${e.dernierSur?.case === i && e.phase === 'tour' ? 'recente' : ''}">${GEMME}${info}</div>`;
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
        <p class="petit centre-texte">MANCHE ${e.manche + 1}/${e.nbManches}${e.manche ? ' · GRILLE NEUVE' : ''}</p>
        <h2 class="question">${fait ? 'Ta mine est posée' : 'Pose ta mine en secret'}</h2>
        <p class="aide gauche">${fait ? 'Personne ne sait où elle est. Pendant le jeu, à toi d’y attirer les autres…' : 'Choisis un colis. Si quelqu’un l’ouvre, c’est toi qui gagnes ses points.'}</p>
        ${grille(!fait, 'choisirMine', choisie ?? maMine)}
        ${fait ? '' : `<button class="bouton rose" data-action="jeu" data-geste="poserMine" ${choisie === undefined ? 'disabled' : ''}>Poser ma mine ici</button>`}
        ${attenteDes(v.uids, v.joueurs, (u) => v.ontRepondu.includes(u) || (u === v.uid && fait))}`;
    }

    const joueur = joueurDu(e as Etat);
    // Chacun : en lice (points en jeu cette manche) ou sorti ; total à l'abri entre parenthèses.
    const scores = `<div class="joueurs-arene">${e.ordre.map((u) => {
      const enJeu = e.enLice.includes(u);
      return `<div class="${u === v.uid ? 'moi' : ''} ${u === joueur && e.phase === 'tour' ? 'porteur' : ''} ${enJeu ? '' : 'sorti'}"><span class="pastille" style="--c:${v.joueurs[u].couleur};width:24px;height:24px"></span>${nom(u)}<em>${enJeu ? `+${e.pots[u] ?? 0} en jeu` : 'sorti'} · ${score(u)} pts</em></div>`;
    }).join('')}</div>`;
    const manche = `<p class="petit centre-texte">MANCHE ${e.manche + 1}/${e.nbManches} · ${e.enLice.length} joueur${e.enLice.length > 1 ? 's' : ''} encore en lice</p>`;

    if (e.phase === 'boum') {
      const d = e.dernier!;
      const autres = d.poseurs.filter((p) => p !== d.joueur);
      return `${tete}
        <div class="boum-mine" aria-live="assertive"><span class="eclat-mine"></span><p class="mot-boum">KABOOM !</p></div>
        <h2 class="question centre-texte">${nom(d.joueur)} saute sur ${autres.length ? `la mine de ${autres.map(nom).join(' et ')}` : 'sa propre mine'} !</h2>
        <p class="aide">${autres.length ? `${autres.map(nom).join(' et ')} gagne${autres.length > 1 ? 'nt' : ''} ${d.gain} pts.` : 'Aucun point pour personne.'} ${nom(d.joueur)} perd les points de cette manche et sort.</p>
        ${grille(false, '')}${scores}`;
    }

    // Un tour : UN colis, puis au suivant.
    const aMoi = joueur === v.uid;
    if (aMoi) {
      const fait = v.local[e.etape] !== undefined;
      const pot = e.pots[v.uid] ?? 0;
      return `${tete}${chrono(e.fin)}${manche}
        <h2 class="question">À toi ! Ouvre un colis</h2>
        <div class="pot-mines"><span>Ta manche : <b>${pts(pot)}</b></span><span>Prochain colis : <b>+${gainSur(e.sures[v.uid] ?? 0)}</b></span></div>
        ${grille(!fait, 'ouvrir')}
        ${fait ? '' : boutonDetecteur(e as Etat, v)}
        ${pot > 0 && !fait ? `<button class="bouton vert" data-action="jeu" data-geste="arreter">J’encaisse ${pts(pot)} et je sors de la manche</button>` : ''}
        ${scores}`;
    }
    const moiEnLice = e.enLice.includes(v.uid);
    return `${tete}${chrono(e.fin)}${manche}
      <h2 class="question">${joueur ? nom(joueur) : '…'} ouvre un colis…</h2>
      <div class="pot-mines">${moiEnLice ? `<span>Ta manche : <b>${pts(e.pots[v.uid] ?? 0)}</b></span><span>Ton prochain colis : <b>+${gainSur(e.sures[v.uid] ?? 0)}</b></span>` : `<span>Tu es sorti de cette manche</span><span>Total : <b>${pts(score(v.uid))}</b></span>`}</div>
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
      o.local[`mines-${e.numeroJeu}-${e.manche}-ma-mine`] = c; // seul ce téléphone sait où est ma mine
      o.rafraichir();
      await o.repondre({ case: c });
    },
    detecteur(_el, o, v) {
      const e = v.etat;
      if (e.phase !== 'tour' || joueurDu(e) !== v.uid || (e.detecteurs?.[v.uid] ?? 0) >= DETECTEURS) return;
      o.local[`${e.etape}-detecteur`] = o.local[`${e.etape}-detecteur`] !== true;
      o.rafraichir();
    },
    async ouvrir(el, o, v) {
      const e = v.etat;
      if (e.phase !== 'tour' || joueurDu(e) !== v.uid || o.local[e.etape] !== undefined) return;
      o.local[e.etape] = true;
      // Clé secrète de ce téléphone pour ce jeu (elle ne part que vers l'hôte, dans ma réponse).
      const cleLocale = `mines-${e.numeroJeu}-cle`;
      if (!o.local[cleLocale]) o.local[cleLocale] = Array.from(crypto.getRandomValues(new Uint32Array(3)), (n) => n.toString(36)).join('');
      const arme = o.local[`${e.etape}-detecteur`] === true;
      o.rafraichir();
      await o.repondre({ case: Number(el.dataset.valeur), ...(arme ? { detecteur: o.local[cleLocale] } : {}) });
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

// Pas de chrono pour pose : on attend tout le monde. L'hôte peut lancer la suite si quelqu'un bloque.
const PHASES_SANS_CHRONO: string[] = ['pose'];
const ecranDeBase = champDeMines.ecran;
champDeMines.ecran = (v) => ecranDeBase(v) + (v.estHote && PHASES_SANS_CHRONO.includes(v.etat.phase) ? '<button class="bouton discret" data-action="hote-jeu" data-valeur="forcerEtape">Commencer sans attendre</button>' : '');
const commandeDeBase = champDeMines.commande;
champDeMines.commande = (ctx, etat, valeur) =>
  valeur === 'forcerEtape' && PHASES_SANS_CHRONO.includes(etat.phase) ? { etat: { ...etat, fin: ctx.maintenant } } : commandeDeBase ? commandeDeBase(ctx, etat, valeur) : null;
