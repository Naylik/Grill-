// Les écrans de la partie, phase par phase.
import { S, estHote } from '../etat';
import { maintenant } from '../firebase';
import { jeuParId } from '../games';
import type { VueJeu } from '../games/interface';
import { esc, auHasard } from '../outils';
import { majoriteOui, missionTrouvee, places, pointsMission, scoreVide, totalFinal, totalProvisoire } from '../score';
import { avantPalierSuivant, classementSaison, niveauCuisson } from '../saison';
import { NOMS_CUISSON } from '../mallow';
import { DUREE_RECIT } from '../hote';
import { RAPPELS_MISSION } from '../narrateur';
import { brouillons } from '../ui';
import { attenteDes, bulle, chrono, pastille } from './commun';
import { carteMission } from './missions';
import { blocFlash } from './flash';
import { mallow, sequenceGrille } from '../mallow';
import { missionsGrillees, PENALITE_MENSONGE } from '../accusations';

/** Mémoire locale des jeux sur ce téléphone (ex. « j'ai répondu oui »). */
export const localJeu: Record<string, unknown> = {};

const uids = () => Object.entries(S.joueurs).sort((a, b) => a[1].rejointLe - b[1].rejointLe).map(([u]) => u);
const nom = (u: string) => esc(S.joueurs[u]?.prenom ?? '?');
const boutonHote = (valeur: string, texte: string, couleur = 'jaune') =>
  estHote() ? `<button class="bouton ${couleur}" data-action="hote" data-valeur="${valeur}">${texte}</button>` : '';

// ——— Choix du jeu ———

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
          ${options.map((id, i) => `<span style="transform: rotate(${(i + 0.5) * (360 / k)}deg)"><b>${esc(jeuParId(id)?.nom ?? id)}</b></span>`).join('')}
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
  return `<div class="entete-jeu" style="--c:${jeu.couleur}"><span>Jeu ${d.numeroJeu}/${S.infos!.duree} · les règles</span><strong>${esc(jeu.nom)}</strong></div>
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
  return `<div class="entete-jeu" style="--c:${jeu.couleur}"><span>Jeu ${S.deroule!.numeroJeu}/${S.infos!.duree}</span><strong>${esc(jeu.nom)}</strong></div>${jeu.ecran(vueJeu())}`;
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
  const lignes = liste.map((u, i) => {
    const gagne = d.dernierJeu?.points?.[u] ?? 0;
    const p = placesJeu[u];
    const place = p ? `<span class="place-jeu">${p === 1 ? '1er' : `${p}e`} au jeu</span>` : '';
    return `<div class="ligne-classement ${u === S.uid ? 'moi' : ''}">
      <span class="rang">${i + 1}</span>${pastille(S.joueurs[u], 30)}<strong>${nom(u)}${place}</strong>
      <span class="gain">${gagne > 0 ? `+${gagne}` : gagne < 0 ? gagne : ''}</span><span class="total">${totalProvisoire(S.scores[u])}</span></div>`;
  }).join('');
  const suivant = d.numeroJeu >= total ? 'Passer au pari détective' : d.numeroJeu === total / 2 ? 'Mi-partie : nouvelles missions' : `Jeu suivant (${d.numeroJeu + 1}/${total})`;
  return `<p class="petit centre-texte">${jeu ? `Fin de « ${esc(jeu.nom)} »` : ''} · ${d.numeroJeu}/${total}</p>
    <h2>Classement provisoire</h2>
    ${d.dernierJeu?.resume ? `<p class="aide gauche">${esc(d.dernierJeu.resume)}</p>` : ''}
    <div class="pile">${lignes}</div>
    <p class="aide">Sans les points de mission : ils tombent à la fin.</p>
    ${d.vanne ? bulle(esc(d.vanne)) : ''}
    <button class="rappel" data-action="onglet" data-valeur="missions">${rappel.texte}</button>
    <div class="pile bas">${estHote() ? boutonHote('suivant', suivant) : '<p class="attente">Pause ! L’hôte lance la suite quand tout le monde est prêt.</p>'}</div>`;
}

// ——— Pari détective ———

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
    <p class="aide gauche">Choisis un joueur et écris, en secret, ce que tu crois être une de ses missions. À la révélation, le groupe dira si tu as vu juste.</p>
    <p class="aide gauche"><strong>Juste</strong> : tu lui voles 4 pts (mission facile) ou 6 pts (difficile). <strong>Raté</strong> : −2 pts.</p>
    <div class="options deux">${autres.map((u) => `<button class="option ${cible === u ? 'actif jaune' : ''}" data-action="choisirCible" data-valeur="${u}">${nom(u)}</button>`).join('')}</div>
    <label class="champ"><span>Sa mission, à ton avis</span>
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
  const cartes = missions.map((m, i) => `<p class="intitule">Mission ${i + 1}</p>${carteMission({ ...m, id: '', type: m.type as 'vie' | 'jeu' })}${grillees[i + 1] ? marqueGrillee(i + 1) : ''}`);

  if (r.etape === 'recit') {
    return `${entete}${chrono(r.fin)}
      ${bulle(moiSujet ? `À toi ! Tu as ${DUREE_RECIT / 1000} secondes pour raconter comment tu t’y es pris.` : `${nom(sujet)} a ${DUREE_RECIT / 1000} secondes pour se justifier. Écoutez bien.`)}
      ${cartes.join('')}`;
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
        ${peutVoter ? `<p class="aide gauche">C’est une de ses missions ?</p>${boutonsVote(`d-${p.de}`, [
          ...missions.map((_, i) => ({ valeur: String(i + 1), texte: `Mission ${i + 1}`, couleur: 'vert' })),
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
    const pts = pointsMission({ difficulte: m.difficulte, reussie: true, vengeance: m.vengeance });
    return `<div class="verdict ${ok ? 'ok' : 'ko'}"><strong>Mission ${i + 1} : ${ok ? 'réussie' : 'ratée'}${m.vengeance ? ' (vengeance)' : ''}</strong><span>${ok ? `+${pts} pts` : '0 pt'}</span></div>`;
  });
  const grillages = (r.paris ?? []).map((p) => {
    const n = missionTrouvee(Object.values(S.votes[`d-${p.de}`] ?? {}).map(Number));
    return `<div class="verdict ${n ? 'grille' : 'ko'}"><strong>${nom(p.de)} : ${n ? `grillé, mission ${n} !` : 'pari raté'}</strong><span>${n ? 'vol de points' : '−2 pts'}</span></div>`;
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
      <div class="chiffres"><span>Mini-jeux <b>${s.jeux + s.parieur}</b></span><span>Missions <b>${s.missions}</b></span><span>Détective <b>${s.detective > 0 ? '+' : ''}${s.detective}</b></span>${s.grille ? `<span>Grillé ! <b>${s.grille > 0 ? '+' : ''}${s.grille}</b></span>` : ''}</div>
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
    <div class="pile bas"><button class="bouton rose" data-action="partagerPodium">Partager le podium</button>
      ${estHote() ? boutonHote('rejouer', 'Rejouer') : '<p class="attente">L’hôte peut relancer une partie.</p>'}
      <button class="bouton discret" data-action="quitter">Quitter</button></div>`;
}

