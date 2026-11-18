// Ce que chaque téléphone fait tout seul selon l'étape de la partie :
// tirer ses missions, dire « je suis prêt », publier ses missions à la révélation, vibrer à la mi-partie.
import { ref, set } from 'firebase/database';
import { db } from './firebase';
import { S, charges, memoireDuGroupe } from './etat';
import { preparerPropositions } from './missions';
import { vibrer } from './ui';
import { maintenant } from './firebase';
import { majoriteOui, missionTrouvee } from './score';
import { sons } from './son';
import { confettis } from './confettis';
import { accusationEnCours } from './accusations';
import { envolerReaction } from './dessin';
import { REACTIONS } from './games/telephone';
const reactionsVues = new Map<string, number>();
import { VERSION, verifierVersion } from './version';

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
  // Version de l'appli : je publie la mienne, et je me mets à jour si quelqu'un a plus récent.
  if (VERSION && S.joueurs[S.uid].version !== VERSION) une('version', () => set(ref(db, `salons/${code}/joueurs/${S.uid}/version`), VERSION));
  verifierVersion(Object.values(S.joueurs).map((j) => j.version));
  const prets = charges.has('secrets') && charges.has('maReponse');
  const { secrets } = S;

  if (phasePrecedente !== d.phase) {
    if (d.phase === 'miPartie' && phasePrecedente) vibrer([250, 120, 250]);
    if (d.phase === 'missions' && phasePrecedente) vibrer(150);
    phasePrecedente = d.phase;
  }
  if (!prets) return;

  if (d.phase === 'missions') {
    // Pas de propositions tant que le joueur tiré au sort n'a pas répondu à l'offre de vengeance.
    const attendVengeance = charges.has('offreVengeance') ? !!S.offreVengeance && !secrets.vengeanceChoix : true;
    if (!secrets.mission1 && !secrets.propositions1?.length && !attendVengeance) une('p1', () => preparerPropositions(code, S.uid, S.joueurs, secrets, 1, memoireDuGroupe()));
    if (secrets.mission1 && S.maReponse?.etape !== 'mission1') une('r1', () => repondre('mission1'));
  }
  if (d.phase === 'miPartie') {
    if (!secrets.mission2 && !secrets.propositions2?.length) une('p2', () => preparerPropositions(code, S.uid, S.joueurs, secrets, 2, memoireDuGroupe()));
    if (secrets.mission2 && S.maReponse?.etape !== 'mission2') une('r2', () => repondre('mission2'));
  }
  if (d.phase === 'detective' && S.monPari && S.maReponse?.etape !== 'detective') une('rd', () => repondre('detective'));
  // À la révélation, chacun publie ses propres missions (personne d'autre ne peut les lire avant).
  if (d.phase === 'revelation' && charges.has('revelation') && !S.revelation[S.uid]?.missions && secrets.mission1) {
    const missions = [secrets.mission1, secrets.mission2].filter(Boolean).map((m) => ({ id: m!.id, texte: m!.texte, difficulte: m!.difficulte, type: m!.type, ...(m!.vengeance ? { vengeance: true } : {}) }));
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
    const grille = (r.paris ?? []).some((p) => missionTrouvee(Object.values(S.votes[`d-${p.de}`] ?? {}).map(Number)) > 0)
      || (r.mensonges ?? []).some((m) => missionTrouvee(Object.values(S.votes[`l-${m.cle}`] ?? {}).map(Number)) > 0);
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
  // Quitte ou Double : ma fusée grimpe (bonne réponse) ou crashe (tout perdu).
  if (d.phase === 'jeu' && d.jeuEnCours === 'quitte' && S.jeu) {
    const q = S.jeu as { phase?: string; etape?: string; perdus?: string[]; statut?: Record<string, string> };
    if (q.phase === 'resultat') {
      if (q.perdus?.includes(S.uid)) moment(`qd-${q.etape}`, () => { sons.rate(); vibrer([200, 80, 300]); });
      else if (q.statut?.[S.uid] === 'enJeu') moment(`qd-${q.etape}`, () => sons.reussi());
    }
  }
  // Dessin téléphone arabe : les réactions (😂 🔥 💀 👏) s'envolent chez tout le monde quand quelqu'un réagit.
  for (const [cle, n] of Object.entries(S.compteurs ?? {})) {
    if (!cle.startsWith('reac-')) continue;
    const avant = reactionsVues.get(cle);
    reactionsVues.set(cle, n);
    if (avant === undefined || n <= avant) continue;
    const emoji = REACTIONS[Number(cle.split('-').pop())] ?? '😂';
    for (let i = 0; i < Math.min(5, n - avant); i++) setTimeout(() => envolerReaction(emoji), i * 120);
  }
  // Dessin téléphone arabe : un petit son à chaque étape dévoilée.
  if (d.phase === 'jeu' && d.jeuEnCours === 'telephone' && S.jeu) {
    const t = S.jeu as { phase?: string; revue?: number; affiches?: number };
    if (t.phase === 'revue') moment(`tel-${d.numeroJeu}-${t.revue}-${t.affiches}`, () => sons.ding());
  }
  // Vengeance : je suis prévenu qu'on veut se venger de moi.
  if (S.annonceVengeance?.de) moment(`vengeance-${S.deroule?.partieId}`, () => vibrer([200, 100, 200, 100, 400]));
  // La Patate : elle arrive chez moi, puis elle explose.
  if (d.phase === 'jeu' && d.jeuEnCours === 'patate' && S.jeu) {
    const p = S.jeu as { phase?: string; porteur?: string; etape?: string; manche?: number; explose?: string };
    if (p.phase === 'jeu' && p.porteur === S.uid) moment(`patate-${p.etape}`, () => vibrer(90));
    if (p.phase === 'boum') {
      moment(`boum-${d.numeroJeu}-${p.manche}`, () => {
        // Le colis explose au bout de 0,7 s : son et vibration à ce moment-là.
        setTimeout(() => {
          sons.boum();
          vibrer(p.explose === S.uid ? [400, 100, 400] : 200);
        }, 700);
      });
    }
  }
  // Bouton GRILLÉ ! : une accusation tombe, puis le verdict, sur tous les téléphones en même temps.
  const a = accusationEnCours(S.accusations);
  if (a) {
    moment(`accusation-${a.cle}`, () => {
      sons.accusation();
      vibrer(a.cible === S.uid ? [200, 80, 200, 80, 300] : [120]);
    });
    if (a.statut === 'grille') {
      moment(`grille-direct-${a.cle}`, () => {
        sons.grille();
        setTimeout(() => vibrer([120, 60, 220]), 1450);
      });
    }
    if (a.statut === 'rate') moment(`rate-${a.cle}`, () => sons.rate());
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
