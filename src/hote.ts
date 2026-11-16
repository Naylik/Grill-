// Le « chef d'orchestre » : seul le téléphone de l'hôte exécute ce fichier.
// Il regarde l'état de la partie et décide de l'étape suivante. Tout est recalculé à partir de Firebase :
// si l'hôte change (départ, coupure), le nouvel hôte reprend exactement là où on en était.
import { ref, remove, update } from 'firebase/database';
import { db, maintenant } from './firebase';
import { S, estHote } from './etat';
import { JEUX, jeuParId, jeuxPossibles } from './games';
import type { Avancee, ContexteHote } from './games/interface';
import { auHasard, melanger } from './outils';
import { majoriteOui, missionTrouvee, pointsDeFin, scoreVide, titres, totalProvisoire, type ResultatMission, type ResultatPari } from './score';
import { vanneDuClassement } from './narrateur';
import type { Bilan, Deroule, EtatRevelation, Score } from './types';

const DUREE_ROUE = 5_500;
const DUREE_VOTE_JEU = 20_000;
export const DUREE_RECIT = 15_000;
const DUREE_VOTE = 45_000;

type Ecritures = Record<string, unknown>;

const uids = () => Object.entries(S.joueurs).sort((a, b) => a[1].rejointLe - b[1].rejointLe).map(([u]) => u);
const connectes = () => uids().filter((u) => S.joueurs[u].connecte);

export function contexte(): ContexteHote {
  return {
    joueurs: S.joueurs,
    uids: uids(),
    connectes: connectes(),
    maintenant: maintenant(),
    numeroJeu: S.deroule?.numeroJeu ?? 0,
    reponses: S.reponses,
    compteurs: S.compteurs,
    totaux: Object.fromEntries(uids().map((u) => [u, totalProvisoire(S.scores[u])])),
    hasard: Math.random,
  };
}

/** Tous les joueurs connectés ont envoyé une réponse pour cette étape. */
function tousPrets(etape: string): boolean {
  const c = connectes();
  return c.length > 0 && c.every((u) => S.reponses[u]?.etape === etape);
}

/** Étape dont on affiche « qui a répondu ». */
function etapeAttendue(d: Deroule): string | null {
  switch (d.phase) {
    case 'missions': return 'mission1';
    case 'miPartie': return 'mission2';
    case 'detective': return 'detective';
    case 'choixJeu': return d.propositions ? `choix-${d.numeroJeu}` : null;
    case 'jeu': return (S.jeu as { etape?: string } | null)?.etape ?? null;
    default: return null;
  }
}

// ——— Choix du jeu ———

function entrerChoixJeu(numeroJeu: number): Ecritures {
  const nb = uids().length;
  const possibles = jeuxPossibles(numeroJeu, nb, S.deroule?.jeuxJoues ?? []);
  const base = { 'deroule/phase': 'choixJeu', 'deroule/numeroJeu': numeroJeu, 'deroule/vanne': null, 'reponses': null, 'attente': null };
  if (S.infos?.modeChoix === 'vote' && possibles.length >= 2) {
    const propositions = melanger(possibles).slice(0, 2).map((j) => j.id);
    return { ...base, 'deroule/propositions': propositions, 'deroule/roue': null, 'deroule/finChrono': maintenant() + DUREE_VOTE_JEU };
  }
  const gagnant = auHasard(possibles).id;
  const options = JEUX.filter((j) => j.autorise(numeroJeu, nb)).map((j) => j.id);
  return { ...base, 'deroule/propositions': null, 'deroule/roue': { gagnant, options, lanceLe: maintenant() }, 'deroule/finChrono': maintenant() + DUREE_ROUE };
}

function resultatVoteJeu(d: Deroule): string {
  const votes: Record<string, number> = {};
  for (const u of uids()) {
    const r = S.reponses[u];
    if (r?.etape === `choix-${d.numeroJeu}` && d.propositions!.includes(r.jeu as string)) votes[r.jeu as string] = (votes[r.jeu as string] ?? 0) + 1;
  }
  const max = Math.max(0, ...Object.values(votes));
  const enTete = d.propositions!.filter((id) => (votes[id] ?? 0) === max);
  return auHasard(enTete);
}

function demarrerJeu(id: string): Ecritures {
  const jeu = jeuParId(id)!;
  const av = jeu.demarrer(contexte());
  return {
    'deroule/phase': 'jeu', 'deroule/jeuEnCours': id, 'deroule/finChrono': null, 'deroule/roue': null, 'deroule/propositions': null,
    'reponses': null, 'attente': null,
    ...appliquer(av),
  };
}

// ——— Mini-jeu en cours ———

function appliquer(av: Avancee<unknown>): Ecritures {
  const e: Ecritures = { jeu: av.etat, ...(av.ecritures ?? {}) };
  if (!av.fin) return e;
  // Fin du jeu : on ajoute les points et on passe au classement provisoire.
  const d = S.deroule!;
  const scores: Record<string, Score> = {};
  for (const u of uids()) {
    const s = { ...scoreVide(), ...S.scores[u] };
    const pts = av.fin.points[u] ?? (av.fin.sorte === 'place' ? 1 : 0);
    if (av.fin.sorte === 'place') s.jeux += pts;
    else s.parieur += pts;
    s.detail = { ...(s.detail ?? {}), [d.numeroJeu]: pts };
    scores[u] = s;
  }
  const classement = uids()
    .map((u) => ({ prenom: S.joueurs[u].prenom, points: totalProvisoire(scores[u]) }))
    .sort((a, b) => b.points - a.points);
  return {
    ...e,
    scores,
    'deroule/phase': 'classement',
    'deroule/jeuxJoues': [...(d.jeuxJoues ?? []), d.jeuEnCours],
    'deroule/dernierJeu': { id: d.jeuEnCours, points: Object.fromEntries(uids().map((u) => [u, scores[u].detail![d.numeroJeu]])), sorte: av.fin.sorte, ...(av.fin.resume ? { resume: av.fin.resume } : {}) },
    'deroule/vanne': vanneDuClassement(classement),
    'attente': null,
  };
}

// ——— Révélation ———

function entrerRevelation(): Ecritures {
  const r: EtatRevelation = { ordre: melanger(uids()), index: 0, etape: 'recit', fin: maintenant() + DUREE_RECIT };
  return { 'deroule/phase': 'revelation', 'deroule/revelation': r, votes: null, attente: null };
}

const missionsDe = (u: string) => S.revelation[u]?.missions ?? [];

function votantsMissions(sujet: string) {
  return connectes().filter((u) => u !== sujet);
}

function etapeRevelation(r: EtatRevelation): Ecritures | null {
  const sujet = r.ordre[r.index];
  const now = maintenant();
  if (r.etape === 'recit') {
    if (!missionsDe(sujet).length) return null; // on attend que son téléphone publie ses missions (ou que l'hôte passe)
    if (now < (r.fin ?? 0)) return null;
    return { 'deroule/revelation/etape': 'vote', 'deroule/revelation/fin': now + DUREE_VOTE };
  }
  if (r.etape === 'vote') {
    const nb = missionsDe(sujet).length;
    const fini = votantsMissions(sujet).every((v) => Array.from({ length: nb }, (_, i) => S.votes[`m${i + 1}-${sujet}`]?.[v] !== undefined).every(Boolean));
    if (!fini && now < (r.fin ?? 0)) return null;
    const paris = Object.entries(S.paris)
      .filter(([de, p]) => !p.passe && p.cible === sujet && p.texte && de !== sujet)
      .map(([de, p]) => ({ de, texte: p.texte! }));
    if (paris.length) return { 'deroule/revelation/etape': 'detective', 'deroule/revelation/paris': paris, 'deroule/revelation/fin': now + DUREE_VOTE };
    return { 'deroule/revelation/etape': 'resultat', 'deroule/revelation/fin': null };
  }
  if (r.etape === 'detective') {
    const fini = (r.paris ?? []).every((p) => connectes().filter((v) => v !== p.de && v !== sujet).every((v) => S.votes[`d-${p.de}`]?.[v] !== undefined));
    if (!fini && now < (r.fin ?? 0)) return null;
    return { 'deroule/revelation/etape': 'resultat', 'deroule/revelation/fin': null };
  }
  return null;
}

function bilanFinal(): Ecritures {
  const missions: Record<string, ResultatMission[]> = {};
  const bilan: Bilan = { missions: {}, paris: [], titres: [] };
  for (const u of uids()) {
    const liste = missionsDe(u).map((m, i) => ({
      difficulte: m.difficulte,
      texte: m.texte,
      reussie: majoriteOui(Object.values(S.votes[`m${i + 1}-${u}`] ?? {}).map((v) => v === true)),
    }));
    bilan.missions[u] = liste;
    missions[u] = liste;
  }
  const paris: ResultatPari[] = [];
  for (const [de, p] of Object.entries(S.paris)) {
    if (p.passe || !p.cible || !p.texte) continue;
    const n = missionTrouvee(Object.values(S.votes[`d-${de}`] ?? {}).map(Number));
    const trouvee = n ? missionsDe(p.cible)[n - 1]?.difficulte ?? null : null;
    paris.push({ de, cible: p.cible, trouvee });
    bilan.paris.push({ de, cible: p.cible, texte: p.texte, trouvee });
  }
  const pts = pointsDeFin(missions, paris);
  const scores: Record<string, Score> = {};
  for (const u of uids()) scores[u] = { ...scoreVide(), ...S.scores[u], missions: pts.missions[u] ?? 0, detective: pts.detective[u] ?? 0 };
  bilan.titres = titres(scores, missions, paris);
  return { scores, 'deroule/phase': 'fin', 'deroule/bilan': bilan, 'deroule/revelation': null, attente: null };
}

// ——— Boucle de l'hôte ———

function calculer(): Ecritures | null {
  const d = S.deroule;
  if (!d) return null;
  const now = maintenant();
  let e: Ecritures | null = null;
  switch (d.phase) {
    case 'missions':
      if (tousPrets('mission1')) e = entrerChoixJeu(1);
      break;
    case 'miPartie':
      if (tousPrets('mission2')) e = entrerChoixJeu(d.numeroJeu + 1);
      break;
    case 'choixJeu': {
      const fini = now >= (d.finChrono ?? 0) || (d.propositions && tousPrets(`choix-${d.numeroJeu}`));
      if (fini) e = demarrerJeu(d.roue?.gagnant ?? (d.propositions?.length ? resultatVoteJeu(d) : JEUX[0].id));
      break;
    }
    case 'jeu': {
      const jeu = jeuParId(d.jeuEnCours);
      if (jeu && S.jeu) {
        const av = jeu.piloter(contexte(), S.jeu as never);
        if (av) e = appliquer(av);
      }
      break;
    }
    case 'detective':
      if (tousPrets('detective')) e = entrerRevelation();
      break;
    case 'revelation':
      if (d.revelation) e = etapeRevelation(d.revelation);
      break;
  }
  if (e) return e;
  // Publier qui a déjà répondu (les autres téléphones ne peuvent pas lire les réponses).
  const etape = etapeAttendue(d);
  if (etape) {
    const ont = uids().filter((u) => S.reponses[u]?.etape === etape);
    if (S.attente?.etape !== etape || (S.attente.uids ?? []).join() !== ont.join()) return { attente: { etape, uids: ont } };
  }
  return null;
}

/** Firebase refuse les valeurs « undefined » : on les retire avant d'écrire. */
function ecrire(e: Ecritures): Promise<void> {
  const propre = Object.fromEntries(Object.entries(e).map(([k, v]) => [k, v === undefined ? null : JSON.parse(JSON.stringify(v))]));
  return update(ref(db, `salons/${S.code}`), propre);
}

let verrou = false;
export async function piloter(): Promise<void> {
  if (verrou || !estHote() || !S.code) return;
  verrou = true;
  try {
    const e = calculer();
    if (e) await ecrire(e);
  } catch (err) {
    console.error('pilotage', err);
  } finally {
    verrou = false;
  }
}

/** Boutons de l'hôte. */
export async function commandeHote(valeur: string): Promise<void> {
  if (!estHote() || !S.code || !S.deroule || !S.infos) return;
  const d = S.deroule;
  let e: Ecritures | null = null;
  if (valeur === 'suivant' && d.phase === 'classement') {
    const moitie = S.infos.duree / 2;
    if (d.numeroJeu >= S.infos.duree) e = { 'deroule/phase': 'detective', reponses: null, attente: null };
    else if (d.numeroJeu === moitie) e = { 'deroule/phase': 'miPartie', reponses: null, attente: null };
    else e = entrerChoixJeu(d.numeroJeu + 1);
  } else if (d.phase === 'revelation' && d.revelation) {
    const r = d.revelation;
    if (valeur === 'suivant' && r.etape === 'resultat') {
      e = r.index + 1 < r.ordre.length
        ? { 'deroule/revelation': { ordre: r.ordre, index: r.index + 1, etape: 'recit', fin: maintenant() + DUREE_RECIT } }
        : bilanFinal();
    } else if (valeur === 'passer') {
      e = { 'deroule/revelation/etape': 'resultat', 'deroule/revelation/fin': null };
    } else if (valeur === 'cloreVote') {
      e = { 'deroule/revelation/fin': maintenant() - 1 };
    }
  } else if (valeur === 'rejouer' && d.phase === 'fin') {
    await remove(ref(db, `secrets/${S.code}`));
    e = {
      deroule: { phase: 'salon', numeroJeu: 0 }, jeu: null, scores: null, reponses: null, compteurs: null, tirage: null,
      revelation: null, votes: null, paris: null, motsImposteur: null, attente: null,
    };
  } else if (valeur === 'forcer' && ['missions', 'miPartie', 'detective'].includes(d.phase)) {
    // L'hôte peut avancer sans attendre un joueur absent ou trop lent.
    e = d.phase === 'detective' ? entrerRevelation() : entrerChoixJeu(d.phase === 'missions' ? 1 : d.numeroJeu + 1);
  }
  if (e) await ecrire(e);
}

export async function commandeJeu(valeur: string): Promise<void> {
  if (!estHote() || !S.code || S.deroule?.phase !== 'jeu') return;
  const jeu = jeuParId(S.deroule.jeuEnCours);
  const av = jeu?.commande?.(contexte(), S.jeu as never, valeur);
  if (av) await ecrire(appliquer(av));
}
