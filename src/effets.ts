// Ce que chaque téléphone fait tout seul selon l'étape de la partie :
// tirer ses missions, dire « je suis prêt », publier ses missions à la révélation, vibrer à la mi-partie.
import { ref, set } from 'firebase/database';
import { db } from './firebase';
import { S, charges, memoireDuGroupe } from './etat';
import { preparerPropositions } from './missions';
import { porteursFlash, tirerFlash } from './flash';
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
    if (d.phase === 'missions' && phasePrecedente) vibrer(150);
    phasePrecedente = d.phase;
  }
  if (!prets) return;

  if (d.phase === 'missions') {
    // Pas de propositions tant que le joueur tiré au sort n'a pas répondu à l'offre de vengeance.
    const attendVengeance = charges.has('offreVengeance') ? !!S.offreVengeance && !secrets.vengeanceChoix : true;
    if (!secrets.mission1 && !secrets.propositions1?.length && !attendVengeance) une('p1', () => preparerPropositions(code, S.uid, S.joueurs, secrets, memoireDuGroupe()));
    if (secrets.mission1 && S.maReponse?.etape !== 'mission1') une('r1', () => repondre('mission1'));
  }
  // Mission flash : au début du jeu, je regarde si je suis tiré au sort, et je tire ma mission (en secret).
  const t = d.flashTirage;
  if ((d.phase === 'regles' || d.phase === 'jeu') && t && t.numero === d.numeroJeu && d.jeuEnCours && !secrets.flash?.[`j${t.numero}`]) {
    const tous = Object.entries(S.joueurs).sort((a, b) => a[1].rejointLe - b[1].rejointLe).map(([u]) => u);
    const rang = porteursFlash(t.graine, tous, t.nb).indexOf(S.uid);
    if (rang >= 0) {
      // Jamais mon coéquipier comme cible (jeux d'équipe).
      const jeuPret = (S.jeu as { jeuId?: string } | null)?.jeuId === d.jeuEnCours;
      const equipes = jeuPret ? ((S.jeu as { equipes?: string[][] }).equipes ?? []).filter(Boolean) : [];
      const partenaires = equipes.find((e) => e.includes(S.uid)) ?? [];
      const cibles = tous.filter((u) => u !== S.uid && !partenaires.includes(u)).map((u) => ({ uid: u, prenom: S.joueurs[u].prenom }));
      const m = tirerFlash({ jeu: d.jeuEnCours, graine: t.graine, rang, dejaVus: memoireDuGroupe(), cibles });
      if (m) une(`flash-${t.numero}`, () => set(ref(db, `secrets/${code}/${S.uid}/flash/j${t.numero}`), JSON.parse(JSON.stringify(m))));
    }
  }
  // Après le jeu : je révèle ma mission flash à tout le monde (le groupe vote).
  const f = d.flash;
  const maFlash = f ? secrets.flash?.[`j${f.numero}`] : undefined;
  if (d.phase === 'flash' && f && maFlash && charges.has('revelation') && !S.revelation[S.uid]?.flash?.[`j${f.numero}`]) {
    une(`flash-rev-${f.numero}`, () => set(ref(db, `salons/${code}/revelation/${S.uid}/flash/j${f.numero}`), { id: maFlash.id, jeu: maFlash.jeu, texte: maFlash.texte }));
  }
  if (d.phase === 'detective' && S.monPari && S.maReponse?.etape !== 'detective') une('rd', () => repondre('detective'));
  // À la révélation, chacun publie ses propres missions (personne d'autre ne peut les lire avant).
  if (d.phase === 'revelation' && charges.has('revelation') && !S.revelation[S.uid]?.missions && secrets.mission1) {
    const m = secrets.mission1;
    const missions = [{ id: m.id, texte: m.texte, difficulte: m.difficulte, type: m.type, ...(m.vengeance ? { vengeance: true } : {}) }];
    une('rev', () => set(ref(db, `salons/${code}/revelation/${S.uid}/missions`), missions));
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
    const q = S.jeu as { phase?: string; etape?: string; perdus?: string[]; cagnotte?: Record<string, number> };
    if (q.phase === 'resultat') {
      if (q.perdus?.includes(S.uid)) moment(`qd-${q.etape}`, () => { sons.rate(); vibrer([200, 80, 300]); });
      else if ((q.cagnotte?.[S.uid] ?? 0) > 0) moment(`qd-${q.etape}`, () => sons.reussi());
    }
  }
  // Roue des territoires : la roue s'arrête sur le gagnant.
  if (d.phase === 'jeu' && d.jeuEnCours === 'territoires' && S.jeu) {
    const t = S.jeu as { phase?: string; manche?: number; spin?: { gagnant: string } };
    if (t.phase === 'gain') moment(`roue-gain-${d.numeroJeu}-${t.manche}`, () => { if (t.spin?.gagnant === S.uid) { sons.reussi(); confettis(60); vibrer([80, 40, 160]); } else sons.ding(); });
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
  // Télépathie : 3, 2, 1 (tic) puis CRIEZ ; une équipe qui se connecte (confettis pour elle).
  if (d.phase === 'jeu' && d.jeuEnCours === 'telepathie' && S.jeu) {
    const t = S.jeu as { phase?: string; manche?: number; fin?: number; equipes?: string[][]; trouve?: Record<string, number> };
    if (t.phase === 'decompte') moment(`tele-dec-${d.numeroJeu}-${t.manche}`, () => {
      const reste = (t.fin ?? 0) - maintenant();
      [3, 2, 1, 0].forEach((k) => { const dans = reste - 1500 - k * 1000; if (dans >= -200) setTimeout(() => (k ? sons.tic() : sons.tic(true)), Math.max(0, dans)); });
    });
    const connectees = Object.entries(t.trouve ?? {}).filter(([, m]) => m === (t.manche ?? 0) + 1).map(([k]) => Number(k));
    if (connectees.length && t.phase !== 'decompte') moment(`tele-${d.numeroJeu}-${t.manche}-${connectees.join('.')}`, () => {
      const moi = connectees.some((k) => t.equipes?.[k]?.includes(S.uid));
      setTimeout(() => { sons.reussi(); if (moi) { confettis(80); vibrer([80, 40, 160]); } }, t.phase === 'revele' ? 900 : 0);
    });
  }
  // Le bon timing : « PILE ! » (bonus de fierté).
  if (d.phase === 'jeu' && d.jeuEnCours === 'timing' && S.jeu) {
    const t = S.jeu as { phase?: string; etape?: string; cible?: number; temps?: Record<string, number> };
    if (t.phase === 'resultat' && t.cible && Object.values(t.temps ?? {}).some((x) => Math.abs(x - t.cible! * 1000) <= 50)) {
      moment(`pile-${t.etape}`, () => { sons.reussi(); if (Math.abs((t.temps?.[S.uid] ?? -1e9) - t.cible! * 1000) <= 50) { confettis(90); vibrer([80, 40, 160]); } });
    }
  }
  // Mission flash : le verdict du groupe (pas de vibration à la réception : ça trahirait le porteur).
  if (d.phase === 'flash' && d.flash?.etape === 'resultat') moment(`flash-res-${d.flash.numero}`, () => { if (d.flash?.resultats?.[S.uid]) { sons.reussi(); confettis(50); } else if (d.flash?.resultats && S.uid in d.flash.resultats) sons.rate(); else sons.ding(); });
  // Champ de mines : gemme (ding) ou KABOOM.
  if (d.phase === 'jeu' && d.jeuEnCours === 'mines' && S.jeu) {
    const m = S.jeu as { phase?: string; tour?: number; sures?: number; dernier?: { joueur: string } };
    if (m.phase === 'tour' && (m.sures ?? 0) > 0) moment(`mines-${d.numeroJeu}-${m.tour}-${m.sures}`, () => sons.ding());
    if (m.phase === 'boum') moment(`mines-boum-${d.numeroJeu}-${m.tour}`, () => { sons.boum(); vibrer(m.dernier?.joueur === S.uid ? [400, 100, 400] : 200); });
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
