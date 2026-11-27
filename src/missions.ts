// Tirage des missions secrètes. Chaque téléphone tire les siennes lui-même : ni l'hôte ni personne
// d'autre ne les voit. Les doublons sont évités grâce à une « réservation » par empreinte (tirage/prises).
import { get, ref, runTransaction, set, update } from 'firebase/database';
import { db } from './firebase';
import { empreinte, fraisDabord, melanger } from './outils';
import banque from './data/missions.json';
import type { Joueur, Mission, MissionTiree, Niveau, Secrets, TypeMission } from './types';

export const BANQUE = banque as Mission[];
const NIVEAUX_AUTORISES: Record<Niveau, Niveau[]> = { soft: ['soft'], epice: ['soft', 'epice'], hot: ['soft', 'epice', 'hot'] };

/** Partie pure (testée) : choisit une mission longue durée et une plus courte parmi celles encore libres. */
export function choisirPropositions(opts: {
  type: TypeMission;
  niveau: Niveau;
  prises: Set<string>; // ids déjà réservés par d'autres
  exclues: string[]; // ids à éviter (déjà proposés à moi)
  cibles: { uid: string; prenom: string; fois: number }[]; // autres joueurs et nb de missions qui les visent
  hasard?: () => number;
}): MissionTiree[] {
  const hasard = opts.hasard ?? Math.random;
  const ok = (m: Mission) =>
    // Une seule mission principale par soirée : le type (vie / jeu) ne compte plus.
    NIVEAUX_AUTORISES[opts.niveau].includes(m.niveau) && !opts.prises.has(m.id) && !opts.exclues.includes(m.id);
  const ciblesLibres = melanger(opts.cibles.filter((c) => c.fois < 2), hasard).sort((a, b) => a.fois - b.fois);
  const res: MissionTiree[] = [];
  // Toujours une mission longue durée, et une plus courte (facile ou difficile) au choix.
  for (const difficulte of ['longue', hasard() < 0.5 ? 'facile' : 'difficile'] as const) {
    const candidates = melanger(BANQUE.filter((m) => ok(m) && m.difficulte === difficulte), hasard);
    // Une mission avec {cible} n'est possible que s'il reste quelqu'un à viser (2 fois max par personne).
    const m = candidates.find((c) => !c.texte.includes('{cible}') || ciblesLibres.length > 0);
    if (!m) continue;
    const cible = m.texte.includes('{cible}') ? ciblesLibres[res.length % Math.max(1, ciblesLibres.length)] : undefined;
    res.push({
      id: m.id,
      type: m.type,
      difficulte: m.difficulte,
      texte: cible ? m.texte.replaceAll('{cible}', cible.prenom) : m.texte,
      ...(cible ? { cible: cible.uid } : {}),
    });
  }
  return res;
}

const cheminSecrets = (code: string, uid: string) => `secrets/${code}/${uid}`;

async function etatTirage(code: string, uid: string, joueurs: Record<string, Joueur>) {
  const t = (await get(ref(db, `salons/${code}/tirage`))).val() ?? {};
  const prisesEmpreintes = new Set(Object.keys(t.prises ?? {}));
  const prises = new Set<string>();
  for (const m of BANQUE) if (prisesEmpreintes.has(await empreinte(`${code}:${m.id}`))) prises.add(m.id);
  const cibles = Object.entries(joueurs)
    .filter(([id]) => id !== uid)
    .map(([id, j]) => ({ uid: id, prenom: j.prenom, fois: (t.cibles ?? {})[id] ?? 0 }));
  return { prises, cibles };
}

/** Tire et enregistre (en secret) les 2 propositions de mission principale du joueur, si ce n'est pas déjà fait. */
export async function preparerPropositions(code: string, uid: string, joueurs: Record<string, Joueur>, secrets: Secrets, dejaJouees: Record<string, boolean> = {}): Promise<void> {
  const cle = 'propositions1';
  if (secrets[cle]?.length) return;
  const { prises, cibles } = await etatTirage(code, uid, joueurs);
  const type: TypeMission = Math.random() < 0.5 ? 'vie' : 'jeu';
  const exclues = [...(secrets.propositions1 ?? []).map((m) => m.id)];
  // Mémoire du groupe : pas de mission déjà jouée par ce groupe… tant qu'il en reste assez de nouvelles.
  // Les deux propositions sont réservées tout de suite : deux joueurs ne se voient jamais proposer la même mission.
  // (Celle qu'on ne garde pas reste réservée : elle sort du jeu pour cette soirée, il en reste largement assez.)
  const reservees = new Set<string>();
  let propositions: MissionTiree[] = [];
  for (let essai = 0; essai < 6; essai++) {
    propositions = choisirPropositions({ type, niveau: 'epice', prises, exclues: [...exclues, ...Object.keys(dejaJouees)], cibles });
    if (propositions.length < 2) propositions = choisirPropositions({ type, niveau: 'epice', prises, exclues, cibles });
    let toutes = true;
    for (const m of propositions) {
      if (reservees.has(m.id)) continue;
      if (await reserver(code, m.id)) reservees.add(m.id);
      else {
        prises.add(m.id); // prise par quelqu'un d'autre entre-temps : on en tire une autre
        toutes = false;
      }
    }
    if (toutes) break;
  }
  propositions = propositions.filter((m) => reservees.has(m.id)).map((m) => ({ ...m, reservee: true }));
  await set(ref(db, `${cheminSecrets(code, uid)}/${cle}`), propositions);
}

/** Réserve une mission pour ce salon (Firebase refuse si quelqu'un l'a déjà). */
async function reserver(code: string, id: string): Promise<boolean> {
  try {
    await set(ref(db, `salons/${code}/tirage/prises/${await empreinte(`${code}:${id}`)}`), true);
    return true;
  } catch {
    return false;
  }
}

/**
 * Vengeance (saisons) : 2 missions qui visent la personne choisie, au choix comme d'habitude, qui valent ×1,5.
 * Missions avec {cible} : une longue durée et une plus courte quand c'est possible, réservées dès qu'elles sont
 * proposées (comme les autres). Renvoie le nombre de missions proposées (0 : aucune disponible).
 */
export async function proposerMissionsVengeance(code: string, uid: string, joueurs: Record<string, Joueur>, cible: string, dejaJouees: Record<string, boolean> = {}): Promise<number> {
  const { prises } = await etatTirage(code, uid, joueurs);
  const candidates = fraisDabord(BANQUE.filter((m) => m.texte.includes('{cible}') && NIVEAUX_AUTORISES.epice.includes(m.niveau) && !prises.has(m.id)), dejaJouees);
  // Une longue durée d'abord, puis une plus courte (facile ou difficile) ; à défaut, ce qui reste.
  const ordre = [...candidates.filter((m) => m.difficulte === 'longue'), ...candidates.filter((m) => m.difficulte !== 'longue')];
  const choisies: Mission[] = [];
  for (const m of ordre) {
    if (choisies.length >= 2) break;
    if (choisies.length === 1 && choisies[0].difficulte === m.difficulte && ordre.some((x) => x.difficulte !== choisies[0].difficulte && !choisies.includes(x))) continue;
    if (await reserver(code, m.id)) choisies.push(m);
  }
  if (!choisies.length) return 0;
  const propositions: MissionTiree[] = choisies.map((m) => ({ id: m.id, type: m.type, difficulte: m.difficulte, texte: m.texte.replaceAll('{cible}', joueurs[cible].prenom), cible, vengeance: true, reservee: true }));
  await update(ref(db, cheminSecrets(code, uid)), { propositions1: propositions, vengeanceChoix: cible });
  return propositions.length;
}

/**
 * Le joueur garde une des deux missions : on la réserve (personne d'autre ne pourra l'avoir)
 * et on compte la cible. Si quelqu'un a été plus rapide, on retire de nouvelles propositions.
 */
export async function choisirMission(code: string, uid: string, joueurs: Record<string, Joueur>, secrets: Secrets, index: number): Promise<boolean> {
  const cle = 'propositions1';
  const proposee = secrets[cle]?.[index];
  if (!proposee) return false;
  const { reservee, ...mission } = proposee;
  // Déjà réservée pour moi au moment de la proposition ; sinon (anciennes propositions), on la réserve maintenant.
  if (!reservee && !(await reserver(code, mission.id))) {
    // Déjà prise par un autre joueur : nouvelles propositions.
    await set(ref(db, `${cheminSecrets(code, uid)}/${cle}`), null);
    await preparerPropositions(code, uid, joueurs, { ...secrets, [cle]: undefined });
    return false;
  }
  if (mission.vengeance && mission.cible) {
    // Vengeance : la cible est imposée, on la compte sans jamais changer de cible.
    await runTransaction(ref(db, `salons/${code}/tirage/cibles/${mission.cible}`), (n: number | null) => Math.min(2, (n ?? 0) + 1));
  } else if (mission.cible) {
    const res = await runTransaction(ref(db, `salons/${code}/tirage/cibles/${mission.cible}`), (n: number | null) =>
      (n ?? 0) < 2 ? (n ?? 0) + 1 : undefined,
    );
    if (!res.committed) {
      // Cette personne est déjà visée 2 fois : on vise quelqu'un d'autre avec la même mission.
      const { cibles } = await etatTirage(code, uid, joueurs);
      const autre = cibles.filter((c) => c.fois < 2).sort((a, b) => a.fois - b.fois)[0];
      const modele = BANQUE.find((m) => m.id === mission.id)!;
      if (autre) {
        await runTransaction(ref(db, `salons/${code}/tirage/cibles/${autre.uid}`), (n: number | null) => ((n ?? 0) < 2 ? (n ?? 0) + 1 : undefined));
        mission.cible = autre.uid;
        mission.texte = modele.texte.replaceAll('{cible}', autre.prenom);
      }
    }
  }
  await update(ref(db, cheminSecrets(code, uid)), { mission1: mission });
  return true;
}
