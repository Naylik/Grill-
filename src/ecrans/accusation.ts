// Écrans du bouton GRILLÉ ! : le bouton rond, la fenêtre pour accuser, et le « procès » visible par tous.
import { S } from '../etat';
import { flammeGrille } from '../stickers';
import { esc } from '../outils';
import { brouillons } from '../ui';
import { sequenceGrille } from '../mallow';
import { VOL_DETECTIVE } from '../score';
import { accusationEnCours, mancheAction, missionsGrillees, peutAccuser, PENALITE_ACCUSATION, PENALITE_MENSONGE, type AccusationListee } from '../accusations';
import type { MissionTiree } from '../types';
import { carteMission } from './missions';
import { maFlashEnCours } from './flash';
import { VOL_FLASH } from '../flash';
import { chrono, pastille } from './commun';

const uids = () => Object.entries(S.joueurs).sort((a, b) => a[1].rejointLe - b[1].rejointLe).map(([u]) => u);
const nom = (u: string) => esc(S.joueurs[u]?.prenom ?? '?');

export function contexteAccusation() {
  const d = S.deroule!;
  return { phase: d.phase, numeroJeu: d.numeroJeu, jeuEnCours: d.jeuEnCours, phaseJeu: d.phase === 'flash' ? d.flash?.etape : (S.jeu as { phase?: string } | null)?.phase };
}

export const accusationPossible = (): boolean =>
  !!S.deroule && peutAccuser(S.uid, contexteAccusation(), S.accusations, Object.keys(S.joueurs).length);

/** Le bouton flamme, en bas à droite de l'écran. */
export function boutonGrille(): string {
  if (!accusationPossible() || S.accuser) return '';
  return `<button class="bouton-grille" data-action="ouvrirAccuser" aria-label="GRILLÉ ! Accuser quelqu’un">${flammeGrille()}<span>GRILLÉ</span></button>`;
}

/** Mes missions encore actives (pas grillées en direct). */
export function missionsActives(): { numero: number; mission: MissionTiree }[] {
  const grillees = missionsGrillees(S.accusations, S.uid);
  const res: { numero: number; mission: MissionTiree }[] = [];
  if (S.secrets.mission1 && !grillees[1]) res.push({ numero: 1, mission: S.secrets.mission1 });
  // Ma mission flash du jeu en cours (numéro 100 + jeu, pour le bouton GRILLÉ !).
  const flash = maFlashEnCours();
  if (flash && !grillees[100 + flash.numero]) res.push({ numero: 100 + flash.numero, mission: { id: 'flash', type: 'jeu', difficulte: 'facile', texte: flash.texte } });
  return res;
}

const intituleMission = (numero: number) => (numero >= 100 ? '⚡ Mission flash' : 'Grosse mission');

function fenetreAccuser(): string {
  if (!S.accuser) return '';
  if (!accusationPossible()) {
    S.accuser = false;
    return '';
  }
  const cible = brouillons.accuse;
  const autres = uids().filter((u) => u !== S.uid);
  return `<div class="proces" role="dialog" aria-label="Accuser quelqu’un"><div class="proces-carte">
    <p class="proces-titre">GRILLÉ ?</p>
    <p class="aide gauche">Qui est en train de faire une mission ? Sa <strong>grosse mission</strong> ou sa <strong>mission flash</strong> du jeu en cours : les deux comptent. Écris ce que tu crois qu’il ou elle fait ; seul l’accusé verra si tu as raison.</p>
    <div class="options deux">${autres.map((u) => `<button class="option ${cible === u ? 'actif rose' : ''}" data-action="choisirAccuse" data-valeur="${u}">${nom(u)}</button>`).join('')}</div>
    <label class="champ"><span>Sa mission (grosse ou flash), à ton avis</span>
      <textarea name="accusation" rows="3" maxlength="160" placeholder="Il essaie de me faire dire « franchement »…">${esc(brouillons.accusation ?? '')}</textarea></label>
    <p class="aide gauche"><strong>Vu juste</strong> : tu lui voles des points (${VOL_FLASH} pour une mission flash, 3 à 8 pour sa grosse mission) et sa mission est ratée. <strong>Raté</strong> : −${PENALITE_ACCUSATION} pts. Une accusation par manche.</p>
    <div class="options deux"><button class="option" data-action="fermerAccuser">Annuler</button><button class="option actif rose" data-action="accuser" ${cible ? '' : 'disabled'}>Accuser !</button></div>
  </div></div>`;
}

function enTete(a: AccusationListee): string {
  return `<div class="proces-qui">${pastille(S.joueurs[a.de], 34)}<span><strong>${nom(a.de)}</strong> accuse <strong>${nom(a.cible)}</strong></span>${pastille(S.joueurs[a.cible], 34)}</div>
    <p class="proces-proposition">« ${esc(a.texte)} »</p>`;
}

function fenetreProces(): string {
  const a = accusationEnCours(S.accusations);
  if (!a) return '';
  const moiAccuse = a.cible === S.uid;

  if (a.statut === 'grille') {
    const vol = a.mission ? (a.mission.numero >= 100 ? VOL_FLASH : VOL_DETECTIVE[a.mission.difficulte]) : 0;
    return `<div class="proces grille" role="alert"><div class="proces-carte">
      <div class="moment-grille">${sequenceGrille(130)}<p class="titre-grille">GRILLÉ !</p></div>
      <p class="proces-verdict"><strong>${nom(a.de)}</strong> a grillé <strong>${nom(a.cible)}</strong> : +${vol} pts pour ${nom(a.de)}, −${vol} pts pour ${nom(a.cible)}.</p>
      ${a.mission ? `<p class="aide">${a.mission.numero >= 100 ? 'Sa mission flash' : 'Sa grosse mission'} est ratée : « ${esc(a.mission.texte)} »</p>` : ''}
    </div></div>`;
  }
  if (a.statut === 'rate') {
    const nonConvaincu = a.reponse === 'eu';
    return `<div class="proces rate" role="alert"><div class="proces-carte">
      <p class="proces-titre">RATÉ !</p>
      ${enTete(a)}
      <p class="proces-verdict">${nonConvaincu ? 'Le groupe n’est pas convaincu.' : `${nom(a.cible)} dit que ce n’est pas ça.`} ${nom(a.de)} perd ${PENALITE_ACCUSATION} pts.</p>
      ${nonConvaincu ? '' : '<p class="aide">S’il a menti, ça se verra à la révélation…</p>'}
    </div></div>`;
  }
  if (a.statut === 'vote') {
    const votant = S.uid !== a.de && S.uid !== a.cible;
    const mon = S.votes[`g-${a.cle}`]?.[S.uid];
    return `<div class="proces" role="dialog" aria-label="Vote : bien grillé ?"><div class="proces-carte">
      ${chrono(a.fin)}
      ${enTete(a)}
      <p class="aide gauche">${nom(a.cible)} avoue. Sa vraie mission :</p>
      ${a.mission ? `<p class="proces-mission">« ${esc(a.mission.texte)} »</p>` : ''}
      ${votant
        ? `<p class="aide gauche">C’est bien grillé ?</p>
           <div class="options deux">
             <button class="option ${mon === true ? 'actif vert' : ''}" data-action="voter" data-sujet="g-${a.cle}" data-valeur="true">Grillé !</button>
             <button class="option ${mon === false ? 'actif rose' : ''}" data-action="voter" data-sujet="g-${a.cle}" data-valeur="false">À côté</button></div>`
        : '<p class="attente">Le groupe vote…</p>'}
    </div></div>`;
  }
  // En attente de la réponse de l'accusé.
  if (moiAccuse && !a.reponse) {
    const actives = missionsActives();
    return `<div class="proces moi" role="dialog" aria-label="On t’accuse"><div class="proces-carte">
      <p class="proces-titre">ON T’ACCUSE !</p>
      ${enTete(a)}
      ${actives.length
        ? `<p class="aide gauche">Compare avec tes missions, en cachant ton écran. Si c’est l’une d’elles, sois honnête :</p>
           ${actives.map(({ numero, mission }) => `<p class="intitule">${intituleMission(numero)}</p>${carteMission(mission, { secret: true, bouton: `<button class="bouton rose" data-action="repondreAccusation" data-valeur="eu" data-numero="${numero}">Il m’a eu</button>` })}`).join('')}`
        : '<p class="aide gauche">Tu n’as pas de mission en cours : forcément, c’est raté !</p>'}
      <button class="bouton vert" data-action="repondreAccusation" data-valeur="rate">Raté, ce n’est pas ça</button>
      <p class="aide">Si tu réponds « Raté » alors que c’est juste, ça se verra à la fin : −${PENALITE_MENSONGE} pts.</p>
    </div></div>`;
  }
  return `<div class="proces" role="status"><div class="proces-carte">
    <p class="proces-titre">ACCUSATION !</p>
    ${enTete(a)}
    <p class="attente">${moiAccuse ? 'Réponse envoyée…' : `${nom(a.cible)} vérifie en secret…`}</p>
  </div></div>`;
}

/** Tout ce que le bouton GRILLÉ ! ajoute à l'écran de la partie. */
export function coucheGrille(): string {
  const d = S.deroule;
  if (!d || d.phase === 'salon' || d.phase === 'fin') return '';
  const a = accusationEnCours(S.accusations);
  // Pendant une manche de Réflexe ou de Timing, l'accusation ne couvre pas l'écran : un simple bandeau.
  if (a && mancheAction(contexteAccusation())) {
    return `<div class="bandeau-proces" role="status"><strong>${nom(a.de)}</strong> accuse <strong>${nom(a.cible)}</strong>${a.cible === S.uid && !a.reponse ? ' : réponds après la manche' : ''}</div>`;
  }
  const proces = fenetreProces();
  return proces || fenetreAccuser() || boutonGrille();
}
