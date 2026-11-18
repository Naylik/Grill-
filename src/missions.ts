// Tirage des missions secrètes. Chaque téléphone tire les siennes lui-même : ni l'hôte ni personne
// d'autre ne les voit. Les doublons sont évités grâce à une « réservation » par empreinte (tirage/prises).
import { get, ref, runTransaction, set, update } from 'firebase/database';
import { db } from './firebase';
import { empreinte, melanger } from './outils';
import banque from './data/missions.json';
import type { Joueur, Mission, MissionTiree, Niveau, Secrets, TypeMission } from './types';

export const BANQUE = banque as Mission[];
const NIVEAUX_AUTORISES: Record<Niveau, Niveau[]> = { soft: ['soft'], epice: ['soft', 'epice'], hot: ['soft', 'epice', 'hot'] };

/** Partie pure (testée) : choisit une mission facile et une difficile parmi celles encore libres. */
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
    m.type === opts.type && NIVEAUX_AUTORISES[opts.niveau].includes(m.niveau) && !opts.prises.has(m.id) && !opts.exclues.includes(m.id);
  const ciblesLibres = melanger(opts.cibles.filter((c) => c.fois < 2), hasard).sort((a, b) => a.fois - b.fois);
  const res: MissionTiree[] = [];
  for (const difficulte of ['facile', 'difficile'] as const) {
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

/** Tire et enregistre (en secret) les 2 propositions du joueur, si ce n'est pas déjà fait. */
export async function preparerPropositions(code: string, uid: string, joueurs: Record<string, Joueur>, secrets: Secrets, numero: 1 | 2): Promise<void> {
  const cle = numero === 1 ? 'propositions1' : 'propositions2';
  if (secrets[cle]?.length) return;
  const { prises, cibles } = await etatTirage(code, uid, joueurs);
  // La 2e mission est d'un autre type que la 1re.
  const type: TypeMission = numero === 2 ? (secrets.mission1?.type === 'vie' ? 'jeu' : 'vie') : Math.random() < 0.5 ? 'vie' : 'jeu';
  const exclues = [...(secrets.propositions1 ?? []).map((m) => m.id)];
  const propositions = choisirPropositions({ type, niveau: 'epice', prises, exclues, cibles });
  await set(ref(db, `${cheminSecrets(code, uid)}/${cle}`), propositions);
}

/**
 * Vengeance (saisons) : une mission qui vise la personne choisie, réservée comme les autres, qui vaut ×2.
 * On prend une mission avec {cible} (le joueur doit agir sur sa cible), du type et de la difficulté du hasard.
 */
export async function prendreMissionVengeance(code: string, uid: string, joueurs: Record<string, Joueur>, cible: string): Promise<MissionTiree | null> {
  const { prises } = await etatTirage(code, uid, joueurs);
  const candidates = melanger(BANQUE.filter((m) => m.texte.includes('{cible}') && NIVEAUX_AUTORISES.epice.includes(m.niveau) && !prises.has(m.id)));
  for (const m of candidates) {
    try {
      await set(ref(db, `salons/${code}/tirage/prises/${await empreinte(`${code}:${m.id}`)}`), true);
    } catch {
      continue; // prise entre-temps par quelqu'un d'autre
    }
    await runTransaction(ref(db, `salons/${code}/tirage/cibles/${cible}`), (n: number | null) => Math.min(2, (n ?? 0) + 1));
    const mission: MissionTiree = { id: m.id, type: m.type, difficulte: m.difficulte, texte: m.texte.replaceAll('{cible}', joueurs[cible].prenom), cible, vengeance: true };
    await update(ref(db, cheminSecrets(code, uid)), { mission1: mission, vengeanceChoix: cible });
    return mission;
  }
  return null;
}

/**
 * Le joueur garde une des deux missions : on la réserve (personne d'autre ne pourra l'avoir)
 * et on compte la cible. Si quelqu'un a été plus rapide, on retire de nouvelles propositions.
 */
export async function choisirMission(code: string, uid: string, joueurs: Record<string, Joueur>, secrets: Secrets, numero: 1 | 2, index: number): Promise<boolean> {
  const cle = numero === 1 ? 'propositions1' : 'propositions2';
  const mission = secrets[cle]?.[index];
  if (!mission) return false;
  try {
    await set(ref(db, `salons/${code}/tirage/prises/${await empreinte(`${code}:${mission.id}`)}`), true);
  } catch {
    // Déjà prise par un autre joueur : nouvelles propositions.
    await set(ref(db, `${cheminSecrets(code, uid)}/${cle}`), null);
    await preparerPropositions(code, uid, joueurs, { ...secrets, [cle]: undefined }, numero);
    return false;
  }
  if (mission.cible) {
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
  await update(ref(db, cheminSecrets(code, uid)), { [`mission${numero}`]: mission });
  return true;
}
