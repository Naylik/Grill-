import { brouillons } from '../ui';
import { esc } from '../outils';
import { S } from '../etat';
import { FLAMME, bulle, erreur } from './commun';

export function ecranAccueil(codeLien: string | null): string {
  const prenom = esc(brouillons.prenom ?? localStorage.getItem('grille:prenom') ?? '');
  const code = esc(brouillons.code ?? codeLien ?? '');
  return `<section class="ecran accueil">
    <div class="titre">
      ${FLAMME}
      <h1 class="logo">Grillé !</h1>
      <p class="sous-titre">Mini-jeux, missions secrètes<br>et beaucoup de mauvaise foi.</p>
    </div>
    ${bulle('Ce soir, quelqu’un va se faire griller. Peut-être toi.')}
    <div class="pile bas">
      <label class="champ">
        <span>Ton prénom</span>
        <input name="prenom" value="${prenom}" maxlength="16" autocomplete="given-name" placeholder="Kilyan" data-entree="${codeLien ? 'rejoindre' : 'creer'}">
      </label>
      ${erreur(S.erreur)}
      ${codeLien ? '' : `<button class="bouton jaune" data-action="creer">Créer une partie</button>`}
      <div class="boite">
        <label class="champ">
          <span>Rejoindre avec le code</span>
          <input name="code" class="code" value="${code}" maxlength="4" autocapitalize="characters" autocomplete="off" placeholder="ABCD" data-entree="rejoindre">
        </label>
        <button class="bouton cyan" data-action="rejoindre">Rejoindre</button>
        <p class="aide">Ou scanne le QR code de l’hôte avec l’appareil photo.</p>
      </div>
      ${codeLien ? `<button class="bouton discret" data-action="creer">Créer ma propre partie</button>` : ''}
    </div>
  </section>`;
}
