// Écran pendant la partie : bandeau du joueur + onglets « Partie » et « Mes missions ».
import { S, moi } from '../etat';
import { esc } from '../outils';
import { boutonSon, pastille } from './commun';
import { sonActif } from '../son';
import { ecranChoixMission, ongletMissions } from './missions';
import { coucheGrille } from './accusation';
import { fenetreVengeance } from './missions';
import { ecranFlash } from './flash';
import { ecranRegles } from './deroule';
import { avecMissions } from '../volonte';
import { ecranChoixJeu, ecranClassement, ecranDetective, ecranFin, ecranJeu, ecranRevelation } from './deroule';

function bandeau(): string {
  const j = moi()!;
  const badge = ''; // pas de pastille « mission flash » : elle trahirait le porteur
  return `<header class="bandeau">
    <div class="qui">${pastille(j, 30)}<span><strong>${esc(j.prenom)}</strong> <span style="color:${j.couleur}">${esc(j.nomCode)}</span></span>
      <span class="code-mini">${S.code}</span>
      ${boutonSon(sonActif())}
      <button class="quitter-mini" data-action="demanderQuitter" aria-label="Quitter la partie">Quitter</button></div>
    ${S.confirmerQuitter ? `<div class="confirmer" role="alertdialog" aria-label="Quitter la partie ?">
      <p>Quitter la partie ? Tu pourras revenir plus tard avec le code <strong>${S.code}</strong>, tes missions et tes points seront gardés.</p>
      <div class="options deux"><button class="option" data-action="annulerQuitter">Rester</button><button class="option actif rose" data-action="quitter">Quitter</button></div>
    </div>` : ''}
    ${avecMissions() ? `<nav class="onglets">
      <button class="${S.onglet === 'partie' ? 'actif' : ''}" data-action="onglet" data-valeur="partie">Partie</button>
      <button class="${S.onglet === 'missions' ? 'actif' : ''}" data-action="onglet" data-valeur="missions">Mes missions${badge}</button>
    </nav>` : ''}
  </header>`;
}

function contenuPartie(): string {
  switch (S.deroule!.phase) {
    case 'missions': return ecranChoixMission();
    case 'choixJeu': return ecranChoixJeu();
    case 'regles': return ecranRegles();
    case 'jeu': return ecranJeu();
    case 'flash': return ecranFlash();
    case 'classement': return ecranClassement();
    case 'detective': return ecranDetective();
    case 'revelation': return ecranRevelation();
    case 'fin': return ecranFin();
    default: return '';
  }
}

export function ecranPartie(): string {
  // À volonté sans missions : ni onglet « Mes missions », ni bouton GRILLÉ !
  if (!avecMissions()) return bandeau() + `<section class="ecran phase-${S.deroule!.phase}">${contenuPartie()}</section>`;
  const contenu = S.onglet === 'missions' ? ongletMissions() : `<section class="ecran phase-${S.deroule!.phase}">${contenuPartie()}</section>`;
  return bandeau() + contenu + (fenetreVengeance() || coucheGrille());
}
