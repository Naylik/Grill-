import { S, estHote } from '../etat';
import { MAX_JOUEURS, MIN_JOUEURS } from '../salon';
import { erreur } from './commun';
import { mallow, NOMS_CUISSON } from '../mallow';
import { flammeGrille } from '../stickers';
import type { Joueur } from '../types';
import { esc } from '../outils';
import { brouillons } from '../ui';
import { classementSaison, niveauCuisson, saisonsConnues } from '../saison';

/** Choix de la saison (hôte) : nouvelle saison, une saison déjà jouée, ou sans saison. */
function blocSaison(hote: boolean): string {
  const infos = S.infos!;
  const actuelle = infos.saison ? `Saison « ${esc(infos.nomSaison ?? '')} »` : 'Sans saison';
  if (!hote) return infos.saison ? `<div class="pile"><span class="intitule">Saison</span><p class="saison-actuelle">${actuelle}</p></div>` : '';
  const connues = saisonsConnues().filter((s) => s.id !== infos.saison);
  return `<div class="pile">
    <span class="intitule">Saison</span>
    <button class="option saison-actuelle ${infos.saison ? 'actif jaune' : ''}" data-action="menuSaison">${actuelle}<small>${S.menuSaison ? 'fermer' : 'changer'}</small></button>
    ${S.menuSaison ? `<div class="boite menu-saison">
      <label class="champ"><span>Nouvelle saison</span><input name="nomSaison" maxlength="30" placeholder="Les Daronnes, Coloc 2026…" value="${esc(brouillons.nomSaison ?? '')}" data-entree="creerSaison"></label>
      <button class="bouton jaune" data-action="creerSaison">Créer la saison</button>
      ${connues.length ? `<span class="intitule">Reprendre une saison</span>${connues.map((s) => `<button class="option" data-action="choisirSaison" data-valeur="${s.id}">${esc(s.nom)}</button>`).join('')}` : ''}
      ${infos.saison ? '<button class="bouton discret" data-action="choisirSaison" data-valeur="aucune">Jouer sans saison</button>' : ''}
      <p class="aide gauche">Une saison cumule les points de vos parties, fait dorer les Mallow et permet de se venger d’une partie à l’autre.</p>
    </div>` : ''}
  </div>`;
}

export function lienSalon(code: string): string {
  return `${location.origin}${location.pathname}#${code}`;
}

/** Places autour du feu (en % de la scène), dans l'ordre d'arrivée. */
const PLACES_FEU: [number, number][] = [[50, 30], [83, 48], [17, 48], [74, 78], [26, 78], [50, 86]];

/** Cuisson du Mallow d'un joueur : ses missions réussies dans la saison (cru sans saison). */
function cuissonDe(uid: string): number {
  return S.infos?.saison ? niveauCuisson(S.saison?.membres?.[uid]?.missions ?? 0) : 0;
}

/** La couronne : au joueur en tête du classement de la saison (s'il est là et a marqué des points). */
function roiDeSaison(): string | null {
  if (!S.infos?.saison) return null;
  const [premier] = classementSaison(S.saison);
  return premier && premier[1].points > 0 && S.joueurs[premier[0]] ? premier[0] : null;
}

/** Le feu de camp : chaque joueur arrive avec son Mallow (plus ou moins grillé), le feu grandit avec le groupe. */
function feuDeCamp(joueurs: [string, Joueur][]): string {
  const n = joueurs.length;
  const roi = roiDeSaison();
  const places = PLACES_FEU.slice(0, MAX_JOUEURS).map(([x, y], i) => {
    const entree = joueurs[i];
    if (!entree) return `<div class="place-feu vide" style="left:${x}%;top:${y}%"><div class="silhouette">?</div><span class="nom">Libre</span></div>`;
    const [u, j] = entree;
    const c = cuissonDe(u);
    const titre = `${j.prenom} · ${NOMS_CUISSON[c]}${u === roi ? ' · en tête de la saison' : ''}${u === S.infos!.hote ? ' · hôte' : ''}${j.connecte ? '' : ' · déconnecté'}`;
    return `<div class="place-feu joueur ${u === S.uid ? 'moi' : ''} ${j.connecte ? '' : 'absent'}" style="left:${x}%;top:${y}%" title="${esc(titre)}" aria-label="${esc(titre)}">
      ${mallow({ vue: 'tete', taille: 54, couronne: u === roi, cuisson: c })}<span class="nom" style="--c:${j.couleur}">${esc(j.prenom)}</span></div>`;
  }).join('');
  const texte = n < MIN_JOUEURS
    ? `Autour du feu : <b>${n} chamallow${n > 1 ? 's' : ''}</b>, encore ${MIN_JOUEURS - n} pour commencer`
    : `Autour du feu : <b>${n} chamallows</b> prêts à griller`;
  return `<div class="feu-de-camp" style="--n:${n}">
    <p class="titre-feu">${texte}</p>
    <div class="buches"></div><div class="buches b2"></div>
    <div class="feu-central">${flammeGrille()}</div>
    ${places}
  </div>`;
}

export function ecranSalon(qr: string): string {
  const infos = S.infos!;
  const joueurs = Object.entries(S.joueurs).sort((a, b) => a[1].rejointLe - b[1].rejointLe);
  const n = joueurs.length;
  const hote = estHote();
  const choix = (groupe: string, valeur: string | number, actuel: string | number, libelle: string, classe: string) =>
    `<button class="option ${valeur === actuel ? `actif ${classe}` : ''}" aria-pressed="${valeur === actuel}"
      ${hote ? `data-action="${groupe}" data-valeur="${valeur}"` : 'disabled'}>${libelle}</button>`;
  const resume = `${({ 4: 'Courte', 6: 'Normale', 8: 'Longue' } as Record<number, string>)[infos.duree] ?? ''} · ${infos.modeChoix === 'vote' ? 'Vote entre 2' : 'La roue'}${infos.saison ? ` · Saison « ${esc(infos.nomSaison ?? '')} »` : ''}`;
  const reglages = S.reglagesOuverts
    ? `<div class="boite reglages-salon">
      <div class="pile">
        <span class="intitule">Durée</span>
        <div class="options trois">
          ${choix('duree', 4, infos.duree, 'Courte<small>4 jeux</small>', 'rose')}
          ${choix('duree', 6, infos.duree, 'Normale<small>6 jeux</small>', 'rose')}
          ${choix('duree', 8, infos.duree, 'Longue<small>8 jeux</small>', 'rose')}
        </div>
      </div>
      <div class="pile">
        <span class="intitule">Choix des jeux</span>
        <div class="options deux">
          ${choix('mode', 'roue', infos.modeChoix, 'La roue', 'vert')}
          ${choix('mode', 'vote', infos.modeChoix, 'Vote entre 2', 'vert')}
        </div>
      </div>
      ${blocSaison(hote)}
      <button class="bouton discret" data-action="reglages">Fermer les réglages</button>
    </div>`
    : `<button class="resume-reglages" data-action="reglages"><span>Réglages · <b>${resume}</b></span><span>${hote ? 'Modifier' : 'Voir'} ›</span></button>`;

  return `<section class="ecran salon">
    <div class="boite code-salon">
      <div class="qr" role="img" aria-label="QR code pour rejoindre">${qr}</div>
      <div>
        <span class="petit">Code de la partie</span>
        <strong class="gros-code">${S.code}</strong>
        <span class="petit">Scanne ou tape le code</span>
      </div>
    </div>
    ${feuDeCamp(joueurs)}
    ${reglages}
    ${erreur(S.erreur)}
    <div class="pile bas">
      ${hote
        ? `<button class="bouton jaune" data-action="lancer" ${n < MIN_JOUEURS ? 'disabled' : ''}>${n < MIN_JOUEURS ? `Encore ${MIN_JOUEURS - n} joueur${MIN_JOUEURS - n > 1 ? 's' : ''}…` : 'Lancer la partie'}</button>`
        : `<p class="attente">L’hôte lance la partie quand tout le monde est là.</p>`}
      <button class="bouton cyan" data-action="inviter">Inviter des amis</button>
      <button class="bouton discret" data-action="quitter">Quitter le salon</button>
    </div>
  </section>`;
}
