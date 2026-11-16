// Écran pendant la partie : bandeau du joueur + onglets « Partie » et « Mes missions ».
import { S, moi } from '../etat';
import { esc } from '../outils';
import { pastille } from './commun';
import { ecranChoixMission, ongletMissions } from './missions';
import { ecranChoixJeu, ecranClassement, ecranDetective, ecranFin, ecranJeu, ecranRevelation } from './deroule';

function bandeau(): string {
  const j = moi()!;
  const badge = S.secrets.mission2 && !S.secrets.nouvelleMissionVue ? '<span class="badge" aria-label="nouvelle mission"></span>' : '';
  return `<header class="bandeau">
    <div class="qui">${pastille(j, 30)}<span><strong>${esc(j.prenom)}</strong> <span style="color:${j.couleur}">${esc(j.nomCode)}</span></span>
      <span class="code-mini">${S.code}</span>
      <button class="quitter-mini" data-action="demanderQuitter" aria-label="Quitter la partie">Quitter</button></div>
    ${S.confirmerQuitter ? `<div class="confirmer" role="alertdialog" aria-label="Quitter la partie ?">
      <p>Quitter la partie ? Tu pourras revenir plus tard avec le code <strong>${S.code}</strong>, tes missions et tes points seront gardés.</p>
      <div class="options deux"><button class="option" data-action="annulerQuitter">Rester</button><button class="option actif rose" data-action="quitter">Quitter</button></div>
    </div>` : ''}
    <nav class="onglets">
      <button class="${S.onglet === 'partie' ? 'actif' : ''}" data-action="onglet" data-valeur="partie">Partie</button>
      <button class="${S.onglet === 'missions' ? 'actif' : ''}" data-action="onglet" data-valeur="missions">Mes missions${badge}</button>
    </nav>
  </header>`;
}

function contenuPartie(): string {
  switch (S.deroule!.phase) {
    case 'missions': return ecranChoixMission(1);
    case 'miPartie': return ecranChoixMission(2);
    case 'choixJeu': return ecranChoixJeu();
    case 'jeu': return ecranJeu();
    case 'classement': return ecranClassement();
    case 'detective': return ecranDetective();
    case 'revelation': return ecranRevelation();
    case 'fin': return ecranFin();
    default: return '';
  }
}

export function ecranPartie(): string {
  const contenu = S.onglet === 'missions' ? ongletMissions() : `<section class="ecran phase-${S.deroule!.phase}">${contenuPartie()}</section>`;
  return bandeau() + contenu;
}
