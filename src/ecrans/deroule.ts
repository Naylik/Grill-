// Les écrans de la partie, phase par phase.
import { S, estHote } from '../etat';
import { maintenant } from '../firebase';
import { jeuParId } from '../games';
import type { VueJeu } from '../games/interface';
import { esc, auHasard } from '../outils';
import { majoriteOui, missionTrouvee, PARI_RATE, places, pointsMission, scoreVide, totalFinal, totalProvisoire, VOL_DETECTIVE } from '../score';
import { avantPalierSuivant, classementSaison, niveauCuisson } from '../saison';
import { NOMS_CUISSON } from '../mallow';
import { RAPPELS_MISSION } from '../narrateur';
import { brouillons } from '../ui';
import { attenteDes, bulle, chrono, pastille } from './commun';
import { carteMission } from './missions';
import { blocFlash } from './flash';
import { POINTS_FLASH } from '../flash';
import { localJeu } from '../memoireJeu';
import { boutonsVideo } from './video';
import { mallow, sequenceGrille } from '../mallow';
import { missionsGrillees, PENALITE_MENSONGE } from '../accusations';


const uids = () => Object.entries(S.joueurs).sort((a, b) => a[1].rejointLe - b[1].rejointLe).map(([u]) => u);
const nom = (u: string) => esc(S.joueurs[u]?.prenom ?? '?');
const boutonHote = (valeur: string, texte: string, couleur = 'jaune') =>
  estHote() ? `<button class="bouton ${couleur}" data-action="hote" data-valeur="${valeur}">${texte}</button>` : '';

// ——— Choix du jeu ———

/** Noms courts pour la roue (les noms complets dépassent des parts). */
const NOMS_ROUE: Record<string, string> = { combien: 'Combien ?', justeprix: 'Juste Prix', parieur: 'Parieur', imposteur: 'Imposteur', reflexe: 'Réflexe', timing: 'Timing', patate: 'Colis', quitte: 'Quitte/Double', telephone: 'Dessin', mines: 'Mines', territoires: 'Territoires', telepathie: 'Télépathie' };

export function ecranChoixJeu(): string {
  const d = S.deroule!;
  const total = S.infos!.duree;
  const entete = `<p class="petit centre-texte">Jeu ${d.numeroJeu} sur ${total} · manche ${d.numeroJeu <= total / 2 ? 1 : 2}</p>`;
  if (d.roue) {
    const options = d.roue.options;
    const k = options.length;
    const w = Math.max(0, options.indexOf(d.roue.gagnant));
    const fin = 360 * 5 + (360 - (w + 0.5) * (360 / k));
    const segments = options.map((id, i) => `${jeuParId(id)?.couleur ?? '#888'} ${(i * 100) / k}% ${((i + 1) * 100) / k}%`).join(', ');
    const ecoule = Math.min(4500, Math.max(0, maintenant() - d.roue.lanceLe));
    const gagnant = jeuParId(d.roue.gagnant)!;
    return `${entete}<h2 class="centre-texte">La roue tourne…</h2>
      <div class="roue-cadre"><div class="pointeur" aria-hidden="true"></div>
        <div class="roue" style="background: conic-gradient(${segments}); --fin: ${fin}deg; animation-delay: -${ecoule}ms">
          ${options.map((id, i) => `<span style="transform: rotate(${(i + 0.5) * (360 / k)}deg)"><b>${esc(NOMS_ROUE[id] ?? jeuParId(id)?.nom ?? id)}</b></span>`).join('')}
        </div>
      </div>
      <div class="revele-jeu" style="animation-delay: ${4600 - ecoule}ms"><h3 style="color:${gagnant.couleur}">${esc(gagnant.nom)}</h3><p class="aide">${esc(gagnant.accroche)}</p></div>`;
  }
  const props = d.propositions ?? [];
  const monVote = S.maReponse?.etape === `choix-${d.numeroJeu}` ? (S.maReponse.jeu as string) : null;
  const ont = S.attente?.etape === `choix-${d.numeroJeu}` ? S.attente.uids ?? [] : [];
  return `${entete}${chrono(d.finChrono)}<h2 class="centre-texte">On joue à quoi ?</h2>
    ${props.map((id) => {
      const j = jeuParId(id)!;
      return `<button class="carte-jeu ${monVote === id ? 'choisi' : ''}" style="--c:${j.couleur}" data-action="voterJeu" data-valeur="${id}"><strong>${esc(j.nom)}</strong><span>${esc(j.accroche)}</span></button>`;
    }).join('')}
    ${attenteDes(uids(), S.joueurs, (u) => ont.includes(u) || (u === S.uid && !!monVote))}`;
}

// ——— Règles du jeu (avant chaque jeu) ———

export function ecranRegles(): string {
  const d = S.deroule!;
  const jeu = jeuParId(d.jeuEnCours);
  if (!jeu) {
    return `<h2>Ton appli n’est pas à jour</h2>
      <p class="aide gauche">Ce jeu vient d’être ajouté et ton téléphone a encore l’ancienne version. Mets-la à jour : tu reviens dans la partie juste après, avec tes missions.</p>
      <button class="bouton jaune" data-action="majAppli">Mettre à jour</button>`;
  }
  const etape = `pret-${d.numeroJeu}`;
  const pret = S.maReponse?.etape === etape;
  const ont = S.attente?.etape === etape ? S.attente.uids ?? [] : [];
  const regles = jeu.regles
    ? jeu.regles({ uids: uids(), duree: S.infos!.duree })
    : `<div class="regles-jeu">
        <p class="accroche-jeu">${esc(jeu.accroche)}</p>
        ${jeu.categorie === 'equipe' ? '<span class="tours-jeu equipe-chip">JEU D’ÉQUIPE · en duos</span>' : ''}
        ${jeu.tours ? `<span class="tours-jeu">Ce soir : ${esc(jeu.tours(S.infos!.duree))}</span>` : ''}
        <div class="regle-arene"><b>?</b><span>${esc(jeu.explication.comment)}</span></div>
        <div class="regle-arene"><b>★</b><span>${esc(jeu.explication.gagner)}</span></div>
        ${jeu.explication.note ? `<div class="regle-arene"><b>!</b><span>${esc(jeu.explication.note)}</span></div>` : ''}
      </div>`;
  return `<div class="entete-jeu regles" style="--c:${jeu.couleur}"><span class="icone-jeu"><svg viewBox="0 0 24 24" aria-hidden="true">${jeu.icone}</svg></span><span>Jeu ${d.numeroJeu}/${S.infos!.duree} · les règles</span><strong>${esc(jeu.nom)}</strong></div>
    ${regles}
    ${blocFlash()}
    <div class="pile bas">
      ${pret
        ? `<p class="attente">Prêt ! On attend les autres…</p>`
        : `<button class="bouton vert" data-action="pret">Je suis prêt</button>`}
      ${attenteDes(uids(), S.joueurs, (u) => ont.includes(u) || (u === S.uid && pret))}
      ${estHote() ? `<button class="bouton discret" data-action="hote" data-valeur="forcer">Lancer sans attendre</button>` : ''}
    </div>`;
}

// ——— Mini-jeu ———

export function vueJeu(): VueJeu<never> {
  return {
    etat: S.jeu as never,
    uid: S.uid,
    estHote: estHote(),
    joueurs: S.joueurs,
    uids: uids(),
    maReponse: S.maReponse,
    monMot: S.monMot,
    compteurs: S.compteurs,
    totaux: Object.fromEntries(uids().map((u) => [u, totalProvisoire(S.scores[u])])),
    ontRepondu: S.attente && S.attente.etape === (S.jeu as { etape?: string } | null)?.etape ? S.attente.uids ?? [] : [],
    local: localJeu,
  };
}

export function ecranJeu(): string {
  const jeu = jeuParId(S.deroule!.jeuEnCours);
  if (!jeu) {
    // Jeu inconnu : ce téléphone a une ancienne version de l'appli.
    return `<h2>Ton appli n’est pas à jour</h2>
      <p class="aide gauche">Ce jeu vient d’être ajouté et ton téléphone a encore l’ancienne version. Mets-la à jour : tu reviens dans la partie juste après, avec tes missions.</p>
      <button class="bouton jaune" data-action="majAppli">Mettre à jour</button>`;
  }
  if (!S.jeu || (S.jeu as { jeuId?: string }).jeuId !== jeu.id) return `<p class="attente">Chargement du jeu…</p>`;
  return `${ouvertureEtRideau(jeu)}<div class="entete-jeu" style="--c:${jeu.couleur}"><span>Jeu ${S.deroule!.numeroJeu}/${S.infos!.duree}</span><strong>${esc(jeu.nom)}</strong></div>${jeu.ecran(vueJeu())}`;
}

/**
 * Au lancement d'un mini-jeu, sa carte arrive en grand (« C'est parti ! ») puis s'envole ; à chaque nouvelle
 * manche, un rideau de la couleur du jeu traverse l'écran. Chaque moment ne se joue qu'une fois par téléphone
 * (heure gardée dans la mémoire du jeu, même après un rechargement).
 */
const DUREE_OUVERTURE = 2400;
const DUREE_RIDEAU = 1100;
function ouvertureEtRideau(jeu: { id: string; nom: string; couleur: string; icone: string }): string {
  const n = S.deroule!.numeroJeu;
  const maintenantMs = Date.now();
  const depuis = (cle: string) => {
    if (typeof localJeu[cle] !== 'number') localJeu[cle] = maintenantMs;
    return maintenantMs - (localJeu[cle] as number);
  };
  const j = S.jeu as { manche?: number; index?: number; phase?: string };
  if (depuis(`ouverture-${n}`) < DUREE_OUVERTURE) {
    return `<div class="ouverture-jeu" style="--c:${jeu.couleur}" aria-hidden="true"><div class="carte-ouverture">
      <span class="icone-ouverture"><svg viewBox="0 0 24 24">${jeu.icone}</svg></span>
      <span>Jeu ${n}/${S.infos!.duree}</span><strong>${esc(jeu.nom)}</strong><em>C’est parti !</em></div></div>`;
  }
  const m = j.manche ?? j.index;
  if (typeof m !== 'number' || m <= 0 || j.phase === 'bilan') return '';
  if (depuis(`rideau-${n}-${m}`) >= DUREE_RIDEAU) return '';
  return `<div class="rideau-manche" style="--c:${jeu.couleur}" aria-hidden="true"><strong>${jeu.id === 'combien' ? 'Question' : 'Manche'} ${m + 1}</strong></div>`;
}

// ——— Classement provisoire ———

let rappel = { numero: -1, texte: '' };
export function ecranClassement(): string {
  const d = S.deroule!;
  const total = S.infos!.duree;
  if (rappel.numero !== d.numeroJeu) rappel = { numero: d.numeroJeu, texte: auHasard(RAPPELS_MISSION) };
  const liste = uids().sort((a, b) => totalProvisoire(S.scores[b]) - totalProvisoire(S.scores[a]));
  const jeu = jeuParId(d.dernierJeu?.id);
  // Place de chacun au jeu qui vient de se terminer (au Parieur : selon les points gagnés),
  // pour pouvoir juger les missions du type « termine 2e » ou « finis dernier ».
  const placesJeu = d.dernierJeu?.points ? places(d.dernierJeu.points) : {};
  // Mission flash réussie à ce jeu : +3, affiché à côté des points du jeu.
  const flashOk = (u: string) => d.flash?.numero === d.numeroJeu && !!d.flash.resultats?.[u];
  const lignes = liste.map((u, i) => {
    const gagne = d.dernierJeu?.points?.[u] ?? 0;
    const p = placesJeu[u];
    const place = p ? `<span class="place-jeu">${p === 1 ? '1er' : `${p}e`} au jeu</span>` : '';
    const gains = [gagne > 0 ? `+${gagne}` : gagne < 0 ? `${gagne}` : '', flashOk(u) ? `⚡+${POINTS_FLASH}` : ''].filter(Boolean).join(' · ');
    return `<div class="ligne-classement ${u === S.uid ? 'moi' : ''}">
      <span class="rang">${i + 1}</span>${pastille(S.joueurs[u], 30)}<strong>${nom(u)}${place}</strong>
      <span class="gain">${gains}</span><span class="total">${totalProvisoire(S.scores[u])}</span></div>`;
  }).join('');
  // Podium du mini-jeu qui vient de finir : qui l'a gagné, avec les points gagnés.
  const podiumJeu = Object.keys(placesJeu).length
    ? `<div class="podium-jeu">${uids().filter((u) => placesJeu[u] && placesJeu[u] <= 3).sort((a, b) => placesJeu[a] - placesJeu[b])
      .map((u) => `<div class="marche-jeu p${placesJeu[u]}"><span>${['🥇', '🥈', '🥉'][placesJeu[u] - 1]}</span>${pastille(S.joueurs[u], placesJeu[u] === 1 ? 60 : 30)}<strong>${nom(u)}</strong><em>+${d.dernierJeu?.points?.[u] ?? 0}</em></div>`).join('')}</div>`
    : '';
  const suivant = d.numeroJeu >= total ? 'Passer au pari détective' : `Jeu suivant (${d.numeroJeu + 1}/${total})`;
  return `<p class="petit centre-texte">${jeu ? `Fin de « ${esc(jeu.nom)} »` : ''} · ${d.numeroJeu}/${total}</p>
    ${podiumJeu ? `<h2>${jeu ? `Podium · ${esc(jeu.nom)}` : 'Podium du jeu'}</h2>${podiumJeu}` : ''}
    ${d.dernierJeu?.resume ? `<p class="aide gauche">${esc(d.dernierJeu.resume)}</p>` : ''}
    <h2>Classement provisoire</h2>
    <div class="pile">${lignes}</div>
    <p class="aide">⚡ = mission flash réussie. Les points des grosses missions tombent à la fin.</p>
    ${d.vanne ? bulle(esc(d.vanne)) : ''}
    <button class="rappel" data-action="onglet" data-valeur="missions">${rappel.texte}</button>
    ${boutonsVideo({ numeroJeu: d.numeroJeu })}
    <div class="pile bas">${estHote() ? boutonHote('suivant', suivant) : '<p class="attente">Pause ! L’hôte lance la suite quand tout le monde est prêt.</p>'}</div>`;
}

// ——— Pari détective ———

/** Les missions flash déjà révélées d'un joueur, barrées : on ne parie pas dessus. */
function flashsDejaRevelees(u: string): string {
  const flashs = Object.values(S.revelation[u]?.flash ?? {});
  if (!flashs.length) return '';
  return `<div class="flashs-barrees"><p class="aide gauche">Ses missions flash (déjà révélées, ne comptent pas) :</p>${flashs.map((f) => `<p class="flash-barree">⚡ ${esc(f.texte)}</p>`).join('')}</div>`;
}

export function ecranDetective(): string {
  const ont = S.attente?.etape === 'detective' ? S.attente.uids ?? [] : [];
  const forcer = estHote() ? `<button class="bouton discret" data-action="hote" data-valeur="forcer">Continuer sans attendre</button>` : '';
  if (S.monPari) {
    return `<h2>Pari détective</h2>
      ${bulle(S.monPari.passe ? 'Pas de pari ? Prudent. Ou trouillard.' : 'Pari enregistré. Réponse à la révélation…')}
      ${attenteDes(uids(), S.joueurs, (u) => ont.includes(u) || u === S.uid)}
      <div class="pile bas">${forcer}</div>`;
  }
  const cible = brouillons.cible;
  const autres = uids().filter((u) => u !== S.uid);
  return `<h2>Pari détective</h2>
    <p class="aide gauche">Devine la <strong>grosse mission</strong> d’un joueur, celle de toute la soirée, et écris-la en secret. Les missions flash ne comptent pas : elles ont déjà été révélées après chaque jeu.</p>
    <p class="aide gauche"><strong>Juste</strong> : tu lui voles ${VOL_DETECTIVE.facile}, ${VOL_DETECTIVE.difficile} ou ${VOL_DETECTIVE.longue} pts (mission facile, difficile ou longue). <strong>Raté</strong> : −${-PARI_RATE} pts.</p>
    <div class="options deux">${autres.map((u) => `<button class="option ${cible === u ? 'actif jaune' : ''}" data-action="choisirCible" data-valeur="${u}">${nom(u)}</button>`).join('')}</div>
    ${cible ? flashsDejaRevelees(cible) : ''}
    <label class="champ"><span>Sa grosse mission, à ton avis</span>
      <textarea name="pari" rows="3" maxlength="160" placeholder="Il ou elle devait me faire dire « t’as raison »…">${esc(brouillons.pari ?? '')}</textarea></label>
    <div class="pile bas">
      <button class="bouton jaune" data-action="parier" ${cible ? '' : 'disabled'}>Valider mon pari</button>
      <button class="bouton discret" data-action="pasDePari">Je ne parie pas</button>
    </div>`;
}

// ——— Révélation ———

function boutonsVote(sujetVote: string, options: { valeur: string; texte: string; couleur: string }[]): string {
  const mon = S.votes[sujetVote]?.[S.uid];
  return `<div class="options ${options.length === 3 ? 'trois' : 'deux'}">${options
    .map((o) => `<button class="option ${String(mon) === o.valeur ? `actif ${o.couleur}` : ''}" data-action="voter" data-sujet="${sujetVote}" data-valeur="${o.valeur}">${o.texte}</button>`)
    .join('')}</div>`;
}

export function ecranRevelation(): string {
  const r = S.deroule!.revelation!;
  const sujet = r.ordre[r.index];
  const j = S.joueurs[sujet];
  const missions = S.revelation[sujet]?.missions ?? [];
  const moiSujet = sujet === S.uid;
  const entete = `<p class="petit centre-texte">Révélation ${r.index + 1}/${r.ordre.length}</p>
    <div class="sujet">${pastille(j, 54)}<div><h2>${nom(sujet)}</h2><span style="color:${j.couleur}">${esc(j.nomCode)}</span></div></div>`;
  if (!missions.length) {
    return `${entete}<p class="attente">En attente du téléphone de ${nom(sujet)}…</p>
      <div class="pile bas">${boutonHote('passer', 'Passer ce joueur', 'rose')}</div>`;
  }
  const grillees = missionsGrillees(S.accusations, sujet);
  const marqueGrillee = (n: number) => `<div class="verdict grille"><strong>Grillée en direct par ${nom(grillees[n])}</strong><span>ratée</span></div>`;
  const cartes = missions.map((m, i) => `<p class="intitule">${missions.length > 1 ? `Mission ${i + 1}` : 'Sa grosse mission'}</p>${carteMission({ ...m, id: '', type: m.type as 'vie' | 'jeu' })}${grillees[i + 1] ? marqueGrillee(i + 1) : ''}`);

  if (r.etape === 'recit') {
    // Pas de chrono : on raconte, on rit, on débat… puis le joueur révélé lance le vote (l'hôte peut aussi).
    const bouton = moiSujet
      ? '<button class="bouton jaune" data-action="finRecit">J’ai fini, on passe au vote</button>'
      : estHote() ? boutonHote('auVote', 'Passer au vote', 'discret') : '';
    return `${entete}
      ${bulle(moiSujet ? 'À toi ! Raconte comment tu t’y es pris. Prends ton temps.' : `${nom(sujet)} raconte comment il ou elle s’y est pris. Écoutez bien.`)}
      ${cartes.join('')}
      ${moiSujet ? '' : `<p class="attente">Quand ${nom(sujet)} a fini, on passe au vote.</p>`}
      <div class="pile bas">${bouton}</div>`;
  }
  if (r.etape === 'vote') {
    const blocs = missions.map((_, i) => `${cartes[i]}${moiSujet || grillees[i + 1] ? '' : boutonsVote(`m${i + 1}-${sujet}`, [{ valeur: 'true', texte: 'Réussi', couleur: 'vert' }, { valeur: 'false', texte: 'Raté', couleur: 'rose' }])}`);
    return `${entete}${chrono(r.fin)}
      ${moiSujet ? bulle('Les autres votent. Fais tes yeux de chien battu.') : '<p class="aide gauche">Mission réussie ou ratée ? Le groupe décide.</p>'}
      ${blocs.join('')}
      <div class="pile bas">${boutonHote('cloreVote', 'Clore le vote', 'discret')}</div>`;
  }
  if (r.etape === 'detective') {
    const blocs = (r.paris ?? []).map((p) => {
      const peutVoter = S.uid !== p.de && S.uid !== sujet;
      return `<div class="boite"><p><strong>${nom(p.de)}</strong> pense que ${nom(sujet)} devait :</p><p class="texte-mission">« ${esc(p.texte)} »</p>
        ${peutVoter ? `<p class="aide gauche">C’est sa grosse mission ?</p>${boutonsVote(`d-${p.de}`, [
          ...missions.map((_, i) => ({ valeur: String(i + 1), texte: missions.length > 1 ? `Oui, sa mission ${i + 1}` : 'Oui, c’est sa grosse mission', couleur: 'vert' })),
          { valeur: '0', texte: 'À côté', couleur: 'rose' },
        ])}` : `<p class="aide">${S.uid === p.de ? 'C’est ton pari : les autres jugent.' : 'Les autres jugent.'}</p>`}</div>`;
    });
    return `${entete}${chrono(r.fin)}${bulle(`Des détectives pensent avoir grillé ${nom(sujet)}…`)}${cartes.join('')}${blocs.join('')}
      <div class="pile bas">${boutonHote('cloreVote', 'Clore le vote', 'discret')}</div>`;
  }
  if (r.etape === 'mensonges') {
    const blocs = (r.mensonges ?? []).map((m) => {
      const peutVoter = S.uid !== m.de && S.uid !== sujet;
      return `<div class="boite"><p>En pleine partie, <strong>${nom(m.de)}</strong> a accusé ${nom(sujet)} :</p><p class="texte-mission">« ${esc(m.texte)} »</p>
        <p class="aide gauche">${nom(sujet)} a répondu « Raté ». ${peutVoter ? 'Il a menti ?' : 'Les autres jugent.'}</p>
        ${peutVoter ? boutonsVote(`l-${m.cle}`, [
          ...missions.map((_, i) => ({ valeur: String(i + 1), texte: `Menti : mission ${i + 1}`, couleur: 'rose' })),
          { valeur: '0', texte: 'Il a dit vrai', couleur: 'vert' },
        ]) : ''}</div>`;
    });
    return `${entete}${chrono(r.fin)}${bulle(`${nom(sujet)} a-t-il menti quand on l’a accusé ? S’il a menti : −${PENALITE_MENSONGE} pts.`)}${cartes.join('')}${blocs.join('')}
      <div class="pile bas">${boutonHote('cloreVote', 'Clore le vote', 'discret')}</div>`;
  }
  // Résultat pour ce joueur (calculé ici à partir des votes, comme le fera l'hôte à la fin).
  const verdicts = missions.map((m, i) => {
    if (grillees[i + 1]) return `<div class="verdict grille"><strong>Mission ${i + 1} : grillée en direct</strong><span>0 pt</span></div>`;
    const ok = majoriteOui(Object.values(S.votes[`m${i + 1}-${sujet}`] ?? {}).map((v) => v === true));
    const pts = pointsMission({ difficulte: m.difficulte, reussie: true, vengeance: m.vengeance }, S.infos?.duree ?? 6);
    return `<div class="verdict ${ok ? 'ok' : 'ko'}"><strong>Mission ${i + 1} : ${ok ? 'réussie' : 'ratée'}${m.vengeance ? ' (vengeance)' : ''}</strong><span>${ok ? `+${pts} pts` : '0 pt'}</span></div>`;
  });
  const grillages = (r.paris ?? []).map((p) => {
    const n = missionTrouvee(Object.values(S.votes[`d-${p.de}`] ?? {}).map(Number));
    const vol = n ? VOL_DETECTIVE[missions[n - 1]?.difficulte ?? 'facile'] : 0;
    return `<div class="verdict ${n ? 'grille' : 'ko'}"><strong>${nom(p.de)} : ${n ? 'mission grillée !' : 'pari raté'}</strong><span>${n ? `+${vol} pts pour ${nom(p.de)}, −${vol} pts pour ${nom(sujet)}` : `${PARI_RATE} pts pour ${nom(p.de)}`}</span></div>`;
  });
  const menteur = (r.mensonges ?? []).map((m) => {
    const n = missionTrouvee(Object.values(S.votes[`l-${m.cle}`] ?? {}).map(Number));
    return `<div class="verdict ${n ? 'grille' : 'ok'}"><strong>${n ? `Menteur ! ${nom(m.de)} avait vu juste` : `Accusation de ${nom(m.de)} : il a dit vrai`}</strong><span>${n ? `−${PENALITE_MENSONGE} pts` : 'rien'}</span></div>`;
  });
  const dernier = r.index + 1 >= r.ordre.length;
  const grille = (r.paris ?? []).some((p) => missionTrouvee(Object.values(S.votes[`d-${p.de}`] ?? {}).map(Number)) > 0)
    || (r.mensonges ?? []).some((m) => missionTrouvee(Object.values(S.votes[`l-${m.cle}`] ?? {}).map(Number)) > 0);
  const moment = grille
    ? `<div class="moment-grille">${sequenceGrille(140)}<p class="titre-grille">GRILLÉ !</p></div>`
    : '';
  return `${moment}${entete}<div class="pile">${verdicts.join('')}${grillages.join('')}${menteur.join('')}</div>
    ${bulle(verdicts.every((v) => v.includes('ok')) ? `${nom(sujet)}, agent d’élite. Ça fait peur.` : `${nom(sujet)}, l’espionnage, ce n’est peut-être pas pour toi.`)}
    <div class="pile bas">${estHote() ? boutonHote('suivant', dernier ? 'Voir le podium' : 'Joueur suivant') : '<p class="attente">L’hôte passe à la suite.</p>'}</div>`;
}

// ——— Saison ———

/** Classement cumulé de la saison, avec la cuisson de chaque Mallow (missions réussies). */
export function classementDeSaison(): string {
  const id = S.infos?.saison;
  if (!id) return '';
  const lignes = classementSaison(S.saison);
  const partie = S.deroule?.partieId;
  const aJour = !!partie && !!S.saison?.parties?.[partie];
  return `<div class="boite saison">
    <p class="intitule">Saison « ${esc(S.infos?.nomSaison ?? S.saison?.infos?.nom ?? '')} »</p>
    ${!aJour ? '<p class="attente">Mise à jour de la saison…</p>' : ''}
    ${lignes.map(([u, m], i) => {
      const n = niveauCuisson(m.missions);
      const reste = avantPalierSuivant(m.missions);
      return `<div class="ligne-saison ${u === S.uid ? 'moi' : ''}">
        <span class="rang">${i + 1}</span>
        <span class="tete-cuisson">${mallow({ vue: 'tete', taille: 46, cuisson: n })}</span>
        <div><strong>${esc(m.prenom)}</strong><span class="cuisson c${n}">${NOMS_CUISSON[n]} · ${m.missions} mission${m.missions > 1 ? 's' : ''}${reste !== null ? ` · encore ${reste} pour ${NOMS_CUISSON[n + 1]}` : ''}</span></div>
        <span class="total">${m.points}<small> pts</small></span></div>`;
    }).join('')}
    <p class="aide">${lignes.length ? `Points cumulés sur ${Math.max(...lignes.map(([, m]) => m.parties))} partie(s). Ton Mallow dore à chaque mission réussie.` : ''}</p>
  </div>`;
}

// ——— Fin ———

export function ecranFin(): string {
  const b = S.deroule!.bilan;
  const liste = uids().sort((a, c) => totalFinal(S.scores[c]) - totalFinal(S.scores[a]));
  const podium = [1, 0, 2]
    .filter((i) => liste[i])
    .map((i) => {
      const u = liste[i];
      return `<div class="marche m${i + 1}" style="--c:${S.joueurs[u].couleur}">${pastille(S.joueurs[u], i === 0 ? 56 : 44)}<strong>${nom(u)}</strong><span>${totalFinal(S.scores[u])} pts</span><div class="socle">${i + 1}</div></div>`;
    })
    .join('');
  const details = liste.map((u) => {
    const s = { ...scoreVide(), ...S.scores[u] };
    const t = (b?.titres ?? []).filter((x) => x.uid === u);
    return `<div class="boite detail-joueur">
      <div class="ligne">${pastille(S.joueurs[u], 30)}<strong>${nom(u)}</strong><span class="total">${totalFinal(s)} pts</span></div>
      <div class="chiffres"><span>Mini-jeux <b>${s.jeux + s.parieur}</b></span><span>Missions <b>${s.missions}</b></span>${s.flash ? `<span>Flash <b>+${s.flash}</b></span>` : ''}<span>Détective <b>${s.detective > 0 ? '+' : ''}${s.detective}</b></span>${s.grille ? `<span>Grillé ! <b>${s.grille > 0 ? '+' : ''}${s.grille}</b></span>` : ''}</div>
      ${t.length ? `<div class="titres">${t.map((x) => `<span class="titre-fun" title="${esc(x.pourquoi)}">${esc(x.titre)}</span>`).join('')}</div>` : ''}
    </div>`;
  }).join('');
  const vainqueur = liste[0];
  return `<h2 class="centre-texte">Podium</h2>
    <div class="mallow-podium"><div class="danse">${mallow({ taille: 96, couronne: true })}</div><p><strong>${nom(vainqueur)}</strong> règne sur la soirée</p></div>
    <div class="podium">${podium}</div>
    ${bulle(`Bravo ${nom(vainqueur)}. Les autres : on se refait ça ?`)}
    ${details}
    ${classementDeSaison()}
    ${boutonsVideo({ recap: true })}
    <div class="pile bas"><button class="bouton rose" data-action="partagerPodium">Partager le podium</button>
      ${estHote() ? boutonHote('rejouer', 'Rejouer') : '<p class="attente">L’hôte peut relancer une partie.</p>'}
      <button class="bouton discret" data-action="quitter">Quitter</button></div>`;
}

