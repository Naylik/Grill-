// Ce que chaque téléphone fait tout seul selon l'étape de la partie :
// tirer ses missions, dire « je suis prêt », publier ses missions à la révélation, vibrer à la mi-partie.
import { ref, set } from 'firebase/database';
import { db } from './firebase';
import { S, charges } from './etat';
import { preparerPropositions } from './missions';
import { vibrer } from './ui';
import { maintenant } from './firebase';
import { majoriteOui, missionTrouvee } from './score';
import { sons } from './son';
import { confettis } from './confettis';

export function repondre(etape: string, valeurs: Record<string, unknown> = {}): Promise<void> {
  return set(ref(db, `salons/${S.code}/reponses/${S.uid}`), { ...valeurs, etape });
}

const enCours = new Set<string>();
function une(cle: string, f: () => Promise<unknown>): void {
  if (enCours.has(cle)) return;
  enCours.add(cle);
  f().catch((e) => console.error(cle, e)).finally(() => enCours.delete(cle));
}

let phasePrecedente: string | null = null;

export function effetsJoueur(): void {
  const d = S.deroule;
  const code = S.code;
  if (!code || !d || !S.joueurs[S.uid]) return;
  const prets = charges.has('secrets') && charges.has('maReponse');
  const { secrets } = S;

  if (phasePrecedente !== d.phase) {
    if (d.phase === 'miPartie' && phasePrecedente) vibrer([250, 120, 250]);
    if (d.phase === 'missions' && phasePrecedente) vibrer(150);
    phasePrecedente = d.phase;
  }
  if (!prets) return;

  if (d.phase === 'missions') {
    if (!secrets.mission1 && !secrets.propositions1?.length) une('p1', () => preparerPropositions(code, S.uid, S.joueurs, secrets, 1));
    if (secrets.mission1 && S.maReponse?.etape !== 'mission1') une('r1', () => repondre('mission1'));
  }
  if (d.phase === 'miPartie') {
    if (!secrets.mission2 && !secrets.propositions2?.length) une('p2', () => preparerPropositions(code, S.uid, S.joueurs, secrets, 2));
    if (secrets.mission2 && S.maReponse?.etape !== 'mission2') une('r2', () => repondre('mission2'));
  }
  if (d.phase === 'detective' && S.monPari && S.maReponse?.etape !== 'detective') une('rd', () => repondre('detective'));
  // À la révélation, chacun publie ses propres missions (personne d'autre ne peut les lire avant).
  if (d.phase === 'revelation' && charges.has('revelation') && !S.revelation[S.uid]?.missions && secrets.mission1) {
    const missions = [secrets.mission1, secrets.mission2].filter(Boolean).map((m) => ({ texte: m!.texte, difficulte: m!.difficulte, type: m!.type }));
    une('rev', () => set(ref(db, `salons/${code}/revelation/${S.uid}`), { missions }));
  }
}

// ——— Moments forts : sons et animations, joués une seule fois par moment ———
const joues = new Set<string>();
function moment(cle: string, f: () => void): void {
  if (joues.has(cle)) return;
  joues.add(cle);
  f();
}

export function momentsForts(): void {
  const d = S.deroule;
  if (!S.code || !d) return;
  if (d.phase === 'salon') {
    joues.clear();
    return;
  }
  // La roue : seulement si on la voit tourner depuis le début.
  if (d.phase === 'choixJeu' && d.roue && maintenant() - d.roue.lanceLe < 1500) {
    moment(`roue-${d.numeroJeu}-${d.roue.lanceLe}`, () => sons.roue());
  }
  // Révélation : quelqu'un s'est fait griller, ou une mission est réussie.
  const r = d.revelation;
  if (d.phase === 'revelation' && r?.etape === 'resultat') {
    const sujet = r.ordre[r.index];
    const grille = (r.paris ?? []).some((p) => missionTrouvee(Object.values(S.votes[`d-${p.de}`] ?? {}).map(Number)) > 0);
    const nbMissions = S.revelation[sujet]?.missions?.length ?? 0;
    const reussie = Array.from({ length: nbMissions }, (_, i) =>
      majoriteOui(Object.values(S.votes[`m${i + 1}-${sujet}`] ?? {}).map((v) => v === true)),
    ).some(Boolean);
    if (grille) {
      moment(`grille-${r.index}`, () => {
        sons.grille();
        setTimeout(() => vibrer([120, 60, 220]), 1450);
      });
    } else if (reussie) {
      moment(`reussi-${r.index}`, () => {
        sons.reussi();
        confettis(70);
      });
    }
  }
  // Podium.
  if (d.phase === 'fin') {
    moment('fin', () => {
      sons.podium();
      confettis(160);
      setTimeout(() => confettis(90), 900);
    });
  }
}
