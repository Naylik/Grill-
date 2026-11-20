// Le « chef d'orchestre » : seul le téléphone de l'hôte exécute ce fichier.
// Il regarde l'état de la partie et décide de l'étape suivante. Tout est recalculé à partir de Firebase :
// si l'hôte change (départ, coupure), le nouvel hôte reprend exactement là où on en était.
import { ref, remove, update } from 'firebase/database';
import { majSaison } from './saison';
import { db, maintenant } from './firebase';
import { S, cheminMemoire, estHote, memoireDuGroupe } from './etat';
import { JEUX, jeuParId, jeuxPossibles, jeuxPourVote } from './games';
import type { Avancee, ContexteHote } from './games/interface';
import { auHasard, melanger } from './outils';
import { majoriteOui, missionTrouvee, pointsDeFin, scoreVide, titres, totalFinal, totalProvisoire, VOL_DETECTIVE, type ResultatMission, type ResultatPari } from './score';
import { accusationEnCours, accusationsADoubler, liste as listeAccusations, mancheAction, missionsGrillees, PENALITE_ACCUSATION, PENALITE_MENSONGE, piloterAccusations } from './accusations';
import { vanneDuClassement } from './narrateur';
import type { Bilan, Deroule, EtatFlash, EtatRevelation, Score } from './types';
import { flashReussie, nbPorteurs, POINTS_FLASH } from './flash';

const DUREE_ROUE = 5_500;
const DUREE_VOTE_JEU = 20_000;
const DUREE_VOTE = 45_000;
const DUREE_GRILLAGE = 25_000; // « Dernière chance » : le temps d'appuyer sur GRILLÉ ! avant la révélation
const DUREE_COLLECTE_FLASH = 6_000; // le temps que les porteurs révèlent leur mission flash
const DUREE_VOTE_FLASH = 30_000;
const DUREE_RESULTAT_FLASH = 5_000;

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
    duree: S.infos?.duree ?? 4,
    dejaVus: memoireDuGroupe(),
    reponses: S.reponses,
    compteurs: S.compteurs,
    totaux: Object.fromEntries(uids().map((u) => [u, totalProvisoire(S.scores[u])])),
    prive: S.prive,
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
    case 'detective': return 'detective';
    case 'choixJeu': return d.propositions ? `choix-${d.numeroJeu}` : null;
    case 'regles': return `pret-${d.numeroJeu}`;
    case 'flash': return d.flash?.etape === 'grillage' ? `grille-${d.flash.numero}` : null;
    case 'jeu': return (S.jeu as { etape?: string } | null)?.etape ?? null;
    default: return null;
  }
}

// ——— Choix du jeu ———

function entrerChoixJeu(numeroJeu: number): Ecritures {
  const nb = uids().length;
  const possibles = jeuxPossibles(numeroJeu, nb, S.deroule?.jeuxJoues ?? []);
  const base = { 'deroule/phase': 'choixJeu', 'deroule/numeroJeu': numeroJeu, 'deroule/vanne': null, 'reponses': null, 'attente': null };
  const pourVote = jeuxPourVote(numeroJeu, nb, S.deroule?.jeuxJoues ?? []);
  if (S.infos?.modeChoix === 'vote' && pourVote.length >= 2) {
    const propositions = pourVote.map((j) => j.id);
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

/** Avant chaque jeu : l'écran des règles, le temps que tout le monde lise et appuie sur « Je suis prêt ». */
function entrerRegles(id: string): Ecritures {
  return {
    'deroule/phase': 'regles', 'deroule/jeuEnCours': id, 'deroule/finChrono': null, 'deroule/roue': null, 'deroule/propositions': null,
    // Missions flash : l'hôte publie seulement une graine ; chaque téléphone en déduit s'il est porteur, et laquelle.
    // Tirage dès l'écran des règles : tout le monde y voit le même encart, porteur ou non.
    'deroule/flashTirage': { numero: S.deroule?.numeroJeu ?? 0, graine: 1 + Math.floor(Math.random() * 2_000_000_000), nb: nbPorteurs(uids().length) }, 'deroule/flash': null,
    'reponses': null, 'attente': null,
  };
}

function demarrerJeu(id: string): Ecritures {
  const jeu = jeuParId(id)!;
  const av = jeu.demarrer(contexte());
  return {
    'deroule/phase': 'jeu', 'deroule/jeuEnCours': id, 'deroule/finChrono': null, 'deroule/roue': null, 'deroule/propositions': null,
    'reponses': null, 'attente': null,
    ...appliquer(av, id),
  };
}

// ——— Mini-jeu en cours ———

function appliquer(av: Avancee<unknown>, jeuId = S.deroule?.jeuEnCours): Ecritures {
  // jeuId : permet aux téléphones de ne pas afficher un jeu avec l'état du précédent.
  const e: Ecritures = { jeu: { ...(av.etat as object), jeuId }, ...(av.ecritures ?? {}) };
  if (!av.fin) return e;
  // Mémoire du groupe : ce jeu a utilisé ces contenus, ils ne reviendront pas aux parties suivantes.
  memoriser(jeuParId(jeuId)?.contenus?.(av.etat as never) ?? []);
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
    // Avant le classement : les missions flash de ce jeu sont révélées et votées.
    'deroule/phase': 'flash',
    'deroule/flash': { numero: d.numeroJeu, etape: 'grillage', fin: maintenant() + DUREE_GRILLAGE },
    'deroule/jeuxJoues': [...(d.jeuxJoues ?? []), d.jeuEnCours],
    'deroule/dernierJeu': { id: d.jeuEnCours, points: Object.fromEntries(uids().map((u) => [u, scores[u].detail![d.numeroJeu]])), sorte: av.fin.sorte, ...(av.fin.resume ? { resume: av.fin.resume } : {}) },
    'deroule/vanne': vanneDuClassement(classement),
    'attente': null,
  };
}

// ——— Missions flash (après chaque jeu) ———

const cleFlash = (n: number) => `j${n}`;
/** Porteurs qui ont révélé leur mission flash pour ce jeu. */
const flashRevelees = (n: number) => uids().filter((u) => S.revelation[u]?.flash?.[cleFlash(n)]);
/** Mission flash grillée en direct (bouton GRILLÉ !) : ratée, sans vote. */
const flashGrillee = (u: string, n: number) => !!missionsGrillees(S.accusations, u)[100 + n];
const votantsFlash = (porteur: string) => connectes().filter((v) => v !== porteur);

function etapeFlash(f: EtatFlash): Ecritures | null {
  const now = maintenant();
  const n = f.numero;
  if (f.etape === 'grillage') {
    // Fini quand tout le monde a dit « rien à signaler » (ou le temps), et qu'aucune accusation n'est en cours.
    const fini = tousPrets(`grille-${n}`) || now >= (f.fin ?? 0);
    if (!fini || accusationEnCours(S.accusations)) return null;
    return { 'deroule/flash': { numero: n, etape: 'collecte', fin: now + DUREE_COLLECTE_FLASH } };
  }
  if (f.etape === 'collecte') {
    const revelees = flashRevelees(n);
    const attendus = S.deroule?.flashTirage?.numero === n ? S.deroule.flashTirage.nb : 0;
    if (revelees.length < attendus && now < (f.fin ?? 0)) return null;
    if (!revelees.length) return { 'deroule/phase': 'classement', 'deroule/flash': null };
    return { 'deroule/flash': { numero: n, etape: 'vote', fin: now + DUREE_VOTE_FLASH, porteurs: revelees } };
  }
  if (f.etape === 'vote') {
    const porteurs = f.porteurs ?? [];
    const aVoter = porteurs.filter((u) => !flashGrillee(u, n));
    const fini = aVoter.every((u) => votantsFlash(u).every((v) => S.votes[`f${n}-${u}`]?.[v] !== undefined));
    if (!fini && now < (f.fin ?? 0)) return null;
    const resultats: Record<string, boolean> = {};
    const e: Ecritures = {};
    for (const u of porteurs) {
      const votes = Object.entries(S.votes[`f${n}-${u}`] ?? {}).filter(([v]) => v !== u).map(([, x]) => x === true);
      resultats[u] = flashReussie(votes, flashGrillee(u, n));
      if (resultats[u]) e[`scores/${u}/flash`] = (S.scores[u]?.flash ?? 0) + POINTS_FLASH;
    }
    // Mémoire du groupe : ces missions flash ne reviendront pas aux prochaines parties.
    memoriser(porteurs.map((u) => S.revelation[u]?.flash?.[cleFlash(n)]?.id).filter((x): x is string => !!x));
    return { ...e, 'deroule/flash': { ...f, etape: 'resultat', resultats, fin: now + DUREE_RESULTAT_FLASH } };
  }
  if (f.etape === 'resultat' && now >= (f.fin ?? 0)) return { 'deroule/phase': 'classement' };
  return null;
}

// ——— Révélation ———

function entrerRevelation(): Ecritures {
  const r: EtatRevelation = { ordre: melanger(uids()), index: 0, etape: 'recit' };
  return { 'deroule/phase': 'revelation', 'deroule/revelation': r, votes: null, attente: null };
}

const missionsDe = (u: string) => S.revelation[u]?.missions ?? [];

function votantsMissions(sujet: string) {
  return connectes().filter((u) => u !== sujet);
}

/** Accusations GRILLÉ ! auxquelles le sujet a répondu « Raté » : le groupe vérifie s'il a menti. */
const mensongesDe = (sujet: string) => accusationsADoubler(S.accusations, sujet).map((a) => ({ cle: a.cle, de: a.de, texte: a.texte }));

/** Après les votes de missions (et les paris) : les mensonges éventuels, puis le résultat. */
function apresParis(sujet: string, now: number): Ecritures {
  const mensonges = mensongesDe(sujet);
  if (mensonges.length) return { 'deroule/revelation/etape': 'mensonges', 'deroule/revelation/mensonges': mensonges, 'deroule/revelation/fin': now + DUREE_VOTE };
  return { 'deroule/revelation/etape': 'resultat', 'deroule/revelation/fin': null };
}

function etapeRevelation(r: EtatRevelation): Ecritures | null {
  const sujet = r.ordre[r.index];
  const now = maintenant();
  if (r.etape === 'recit') {
    if (!missionsDe(sujet).length) return null; // on attend que son téléphone publie ses missions (ou que l'hôte passe)
    // Pas de chrono : on laisse rire et débattre. Le joueur révélé lance le vote quand le groupe est prêt (ou l'hôte).
    if (S.reponses[sujet]?.etape !== `recit-${r.index}`) return null;
    return { 'deroule/revelation/etape': 'vote', 'deroule/revelation/fin': now + DUREE_VOTE };
  }
  if (r.etape === 'vote') {
    const nb = missionsDe(sujet).length;
    // Les missions grillées en direct ne se votent pas : elles sont ratées.
    const grillees = missionsGrillees(S.accusations, sujet);
    const aVoter = Array.from({ length: nb }, (_, i) => i + 1).filter((n) => !grillees[n]);
    const fini = votantsMissions(sujet).every((v) => aVoter.every((n) => S.votes[`m${n}-${sujet}`]?.[v] !== undefined));
    if (!fini && now < (r.fin ?? 0)) return null;
    const paris = Object.entries(S.paris)
      .filter(([de, p]) => !p.passe && p.cible === sujet && p.texte && de !== sujet)
      .map(([de, p]) => ({ de, texte: p.texte! }));
    if (paris.length) return { 'deroule/revelation/etape': 'detective', 'deroule/revelation/paris': paris, 'deroule/revelation/fin': now + DUREE_VOTE };
    return apresParis(sujet, now);
  }
  if (r.etape === 'detective') {
    const fini = (r.paris ?? []).every((p) => connectes().filter((v) => v !== p.de && v !== sujet).every((v) => S.votes[`d-${p.de}`]?.[v] !== undefined));
    if (!fini && now < (r.fin ?? 0)) return null;
    return apresParis(sujet, now);
  }
  if (r.etape === 'mensonges') {
    const fini = (r.mensonges ?? []).every((m) => connectes().filter((v) => v !== m.de && v !== sujet).every((v) => S.votes[`l-${m.cle}`]?.[v] !== undefined));
    if (!fini && now < (r.fin ?? 0)) return null;
    return { 'deroule/revelation/etape': 'resultat', 'deroule/revelation/fin': null };
  }
  return null;
}

function bilanFinal(): Ecritures {
  const missions: Record<string, ResultatMission[]> = {};
  const bilan: Bilan = { missions: {}, paris: [], titres: [] };
  for (const u of uids()) {
    const grillees = missionsGrillees(S.accusations, u);
    const liste = missionsDe(u).map((m, i) => ({
      difficulte: m.difficulte,
      texte: m.texte,
      vengeance: !!m.vengeance,
      reussie: !grillees[i + 1] && majoriteOui(Object.values(S.votes[`m${i + 1}-${u}`] ?? {}).map((v) => v === true)),
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
  const pts = pointsDeFin(missions, paris, S.infos?.duree ?? 6);
  // Bouton GRILLÉ ! : les menteurs démasqués (« Raté » alors que l'accusation était juste).
  const ajustes: Record<string, number> = {};
  const enPlus: Bilan['titres'] = [];
  bilan.mensonges = [];
  for (const u of uids()) {
    for (const a of accusationsADoubler(S.accusations, u)) {
      const n = missionTrouvee(Object.values(S.votes[`l-${a.cle}`] ?? {}).map(Number));
      const difficulte = n ? missionsDe(u)[n - 1]?.difficulte : undefined;
      if (!difficulte) continue;
      const vol = VOL_DETECTIVE[difficulte];
      ajustes[a.de] = (ajustes[a.de] ?? 0) + PENALITE_ACCUSATION + vol; // il récupère ses 2 points et vole son dû
      ajustes[u] = (ajustes[u] ?? 0) - PENALITE_MENSONGE - vol;
      bilan.mensonges.push({ de: a.de, cible: u, texte: a.texte });
      enPlus.push({ uid: u, titre: 'Menteur démasqué', pourquoi: 'a répondu « Raté » à une accusation juste' });
    }
  }
  for (const a of listeAccusations(S.accusations)) {
    if (a.statut === 'grille' || a.verdict === 'grille') {
      enPlus.push({ uid: a.de, titre: 'Sherlock', pourquoi: 'a grillé quelqu’un en direct' });
      enPlus.push({ uid: a.cible, titre: 'Grillé', pourquoi: 'mission découverte en direct' });
    }
  }
  const scores: Record<string, Score> = {};
  for (const u of uids()) {
    const avant = { ...scoreVide(), ...S.scores[u] };
    scores[u] = { ...avant, missions: pts.missions[u] ?? 0, detective: pts.detective[u] ?? 0, grille: (avant.grille ?? 0) + (ajustes[u] ?? 0) };
  }
  // Rancune de la saison : qui a découvert la mission de qui ce soir.
  const grilleurs: Record<string, string[]> = {};
  const ajouter = (cible: string, de: string) => (grilleurs[cible] = [...(grilleurs[cible] ?? []), de]);
  for (const p of paris) if (p.trouvee) ajouter(p.cible, p.de);
  for (const m of bilan.mensonges) ajouter(m.cible, m.de);
  for (const a of listeAccusations(S.accusations)) if (a.statut === 'grille' || a.verdict === 'grille') ajouter(a.cible, a.de);
  bilan.grilleurs = grilleurs;
  // Missions flash : le roi de l'éclair (au moins 2 réussies).
  const flashs = uids().map((u) => ({ u, n: Math.round((scores[u].flash ?? 0) / POINTS_FLASH) }));
  const maxFlash = Math.max(0, ...flashs.map((x) => x.n));
  if (maxFlash >= 2) for (const x of flashs) if (x.n === maxFlash) enPlus.push({ uid: x.u, titre: 'Éclair', pourquoi: `${x.n} missions flash réussies` });
  for (const [u, liste] of Object.entries(missions)) {
    if (liste.some((m) => m.vengeance && m.reussie)) enPlus.push({ uid: u, titre: 'Vengeur', pourquoi: 'mission de vengeance réussie' });
  }
  const tous = [...titres(scores, missions, paris), ...enPlus];
  bilan.titres = tous.filter((t, i) => tous.findIndex((x) => x.uid === t.uid && x.titre === t.titre) === i);
  return { scores, 'deroule/phase': 'fin', 'deroule/bilan': bilan, 'deroule/revelation': null, attente: null };
}

// ——— Boucle de l'hôte ———

function calculer(): Ecritures | null {
  const d = S.deroule;
  if (!d) return null;
  const now = maintenant();
  // Bouton GRILLÉ ! : l'accusation en cours avance quelle que soit l'étape de la partie.
  if (d.phase !== 'salon' && d.phase !== 'fin') {
    const pause = mancheAction({ phase: d.phase, numeroJeu: d.numeroJeu, jeuEnCours: d.jeuEnCours, phaseJeu: d.phase === 'flash' ? d.flash?.etape : (S.jeu as { phase?: string } | null)?.phase });
    const acc = piloterAccusations({ accs: S.accusations, votes: S.votes, connectes: connectes(), maintenant: now, scores: S.scores, pause });
    if (acc) return acc;
  }
  let e: Ecritures | null = null;
  switch (d.phase) {
    case 'missions':
      if (tousPrets('mission1')) e = entrerChoixJeu(1);
      break;
    case 'choixJeu': {
      const fini = now >= (d.finChrono ?? 0) || (d.propositions && tousPrets(`choix-${d.numeroJeu}`));
      if (fini) e = entrerRegles(d.roue?.gagnant ?? (d.propositions?.length ? resultatVoteJeu(d) : JEUX[0].id));
      break;
    }
    case 'regles':
      if (d.jeuEnCours && tousPrets(`pret-${d.numeroJeu}`)) e = demarrerJeu(d.jeuEnCours);
      break;
    case 'jeu': {
      const jeu = jeuParId(d.jeuEnCours);
      if (jeu && S.jeu && (S.jeu as { jeuId?: string }).jeuId === jeu.id) {
        const av = jeu.piloter(contexte(), S.jeu as never);
        if (av) e = appliquer(av);
      }
      break;
    }
    case 'flash':
      if (d.flash) e = etapeFlash(d.flash);
      else e = { 'deroule/phase': 'classement' };
      break;
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
    // Une seule grosse mission par soirée : plus de 2e mission à la mi-partie.
    if (d.numeroJeu >= S.infos.duree) e = { 'deroule/phase': 'detective', reponses: null, attente: null };
    else e = entrerChoixJeu(d.numeroJeu + 1);
  } else if (d.phase === 'revelation' && d.revelation) {
    const r = d.revelation;
    if (valeur === 'suivant' && r.etape === 'resultat') {
      e = r.index + 1 < r.ordre.length
        ? { 'deroule/revelation': { ordre: r.ordre, index: r.index + 1, etape: 'recit' } }
        : bilanFinal();
      if (r.index + 1 >= r.ordre.length) {
        await ecrire(e);
        await enregistrerSaison(e);
        return;
      }
    } else if (valeur === 'auVote' && r.etape === 'recit') {
      e = { 'deroule/revelation/etape': 'vote', 'deroule/revelation/fin': maintenant() + DUREE_VOTE };
    } else if (valeur === 'passer') {
      e = { 'deroule/revelation/etape': 'resultat', 'deroule/revelation/fin': null };
    } else if (valeur === 'cloreVote') {
      e = { 'deroule/revelation/fin': maintenant() - 1 };
    }
  } else if (valeur === 'rejouer' && d.phase === 'fin') {
    await remove(ref(db, `secrets/${S.code}`));
    e = {
      deroule: { phase: 'salon', numeroJeu: 0 }, jeu: null, scores: null, reponses: null, compteurs: null, tirage: null,
      revelation: null, votes: null, paris: null, motsImposteur: null, attente: null, prive: null, accusations: null, vengeance: null,
    };
  } else if (valeur === 'forcer' && d.phase === 'flash') {
    // L'hôte peut passer les missions flash (un porteur absent, un vote qui traîne).
    e = d.flash?.etape === 'vote' || d.flash?.etape === 'grillage' ? { 'deroule/flash/fin': maintenant() - 1 } : { 'deroule/phase': 'classement' };
  } else if (valeur === 'forcer' && d.phase === 'regles' && d.jeuEnCours) {
    e = demarrerJeu(d.jeuEnCours);
  } else if (valeur === 'forcer' && ['missions', 'detective'].includes(d.phase)) {
    // L'hôte peut avancer sans attendre un joueur absent ou trop lent.
    e = d.phase === 'detective' ? entrerRevelation() : entrerChoixJeu(d.phase === 'missions' ? 1 : d.numeroJeu + 1);
  }
  if (e) await ecrire(e);
}

/** Ajoute des contenus joués à la mémoire du groupe (sans attendre : une erreur ne bloque pas la partie). */
function memoriser(ids: string[]): void {
  const chemin = cheminMemoire();
  if (!chemin || !ids.length) return;
  void update(ref(db, chemin), Object.fromEntries(ids.map((id) => [id, true]))).catch((err) => console.warn('mémoire', err));
}

/** Fin de partie : on ajoute la soirée à la saison (points, missions réussies, rancunes). */
async function enregistrerSaison(fin: Ecritures): Promise<void> {
  const id = S.infos?.saison;
  const bilan = fin['deroule/bilan'] as Bilan | undefined;
  const scores = fin.scores as Record<string, Score> | undefined;
  // Les missions jouées ce soir (révélées à tous) rejoignent la mémoire du groupe.
  memoriser(uids().flatMap((u) => missionsDe(u).map((m) => m.id).filter((x): x is string => !!x)));
  if (!id || !bilan || !scores) return;
  const maj = majSaison({
    saison: S.saison,
    partieId: S.deroule?.partieId ?? `${S.code}-${S.infos?.creeLe}`,
    joueurs: S.joueurs,
    points: Object.fromEntries(Object.entries(scores).map(([u, s]) => [u, totalFinal(s)])),
    missionsReussies: Object.fromEntries(Object.entries(bilan.missions).map(([u, l]) => [u, l.filter((m) => m.reussie).length])),
    grilleurs: bilan.grilleurs ?? {},
  });
  if (!maj) return;
  try {
    await update(ref(db, `saisons/${id}`), JSON.parse(JSON.stringify(maj)));
  } catch (err) {
    console.warn('saison non enregistrée', err);
  }
}

export async function commandeJeu(valeur: string): Promise<void> {
  if (!estHote() || !S.code || S.deroule?.phase !== 'jeu') return;
  const jeu = jeuParId(S.deroule.jeuEnCours);
  if ((S.jeu as { jeuId?: string } | null)?.jeuId !== jeu?.id) return;
  const av = jeu?.commande?.(contexte(), S.jeu as never, valeur);
  if (av) await ecrire(appliquer(av));
}
