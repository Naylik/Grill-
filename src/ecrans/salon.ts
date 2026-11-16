import { S, estHote } from '../etat';
import { MAX_JOUEURS, MIN_JOUEURS } from '../salon';
import { carteJoueur, erreur } from './commun';

export function lienSalon(code: string): string {
  return `${location.origin}${location.pathname}#${code}`;
}

export function ecranSalon(qr: string): string {
  const infos = S.infos!;
  const joueurs = Object.entries(S.joueurs).sort((a, b) => a[1].rejointLe - b[1].rejointLe);
  const n = joueurs.length;
  const hote = estHote();
  const choix = (groupe: string, valeur: string | number, actuel: string | number, libelle: string, classe: string) =>
    `<button class="option ${valeur === actuel ? `actif ${classe}` : ''}" aria-pressed="${valeur === actuel}"
      ${hote ? `data-action="${groupe}" data-valeur="${valeur}"` : 'disabled'}>${libelle}</button>`;
  const places = Array.from({ length: Math.max(0, MIN_JOUEURS - n) }, () => `<div class="place-vide">En attente d’un agent…</div>`).join('');

  return `<section class="ecran salon">
    <div class="boite code-salon">
      <div class="qr" role="img" aria-label="QR code pour rejoindre">${qr}</div>
      <div>
        <span class="petit">Code de la partie</span>
        <strong class="gros-code">${S.code}</strong>
        <span class="petit">Scanne ou tape le code</span>
      </div>
    </div>
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
    <div class="pile">
      <span class="intitule">Joueurs · ${n}/${MAX_JOUEURS}</span>
      ${joueurs.map(([id, j]) => carteJoueur(j, id === infos.hote ? ' · hôte' : '', id === S.uid ? 'moi' : '')).join('')}
      ${places}
    </div>
    ${erreur(S.erreur)}
    <div class="pile bas">
      ${hote
        ? `<button class="bouton jaune" data-action="lancer" ${n < MIN_JOUEURS ? 'disabled' : ''}>${n < MIN_JOUEURS ? `Encore ${MIN_JOUEURS - n} joueur${MIN_JOUEURS - n > 1 ? 's' : ''}…` : 'Lancer la partie'}</button>`
        : `<p class="attente">L’hôte lance la partie quand tout le monde est là.</p>`}
      <button class="bouton discret" data-action="quitter">Quitter le salon</button>
    </div>
  </section>`;
}
