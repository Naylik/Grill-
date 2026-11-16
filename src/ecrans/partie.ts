// Écran pendant la partie : bandeau du joueur + onglets « Partie » et « Mes missions ».
import { S, moi } from '../etat';
import { esc } from '../outils';
import { pastille, bulle } from './commun';

function bandeau(): string {
  const j = moi()!;
  const badge = S.secrets.mission2 && !S.secrets.nouvelleMissionVue ? '<span class="badge" aria-label="nouvelle mission"></span>' : '';
  return `<header class="bandeau">
    <div class="qui">${pastille(j, 30)}<span><strong>${esc(j.prenom)}</strong> <span style="color:${j.couleur}">${esc(j.nomCode)}</span></span></div>
    <nav class="onglets">
      <button class="${S.onglet === 'partie' ? 'actif' : ''}" data-action="onglet" data-valeur="partie">Partie</button>
      <button class="${S.onglet === 'missions' ? 'actif' : ''}" data-action="onglet" data-valeur="missions">Mes missions${badge}</button>
    </nav>
  </header>`;
}

function ongletMissions(): string {
  if (S.masque) {
    return `<section class="ecran centre masque"><button class="bouton jaune" data-action="masquer">Réafficher</button></section>`;
  }
  return `<section class="ecran">
    <h2>Mes missions</h2>
    <p class="aide">Bientôt ici : tes missions secrètes.</p>
    <button class="bouton rose" data-action="masquer">Masquer vite</button>
  </section>`;
}

export function ecranPartie(): string {
  const contenu = S.onglet === 'missions'
    ? ongletMissions()
    : `<section class="ecran">${bulle('La partie est lancée ! (La suite arrive à l’étape 2.)')}</section>`;
  return bandeau() + contenu;
}
