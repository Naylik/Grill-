import { brouillons } from '../ui';
import { esc } from '../outils';
import { S } from '../etat';
import { logo } from '../mallow';
import { boutonSon, erreur } from './commun';
import { sonActif } from '../son';
import { blocRetour, cartesAccueil, mallowAccueil, retourJoueur } from '../accueilVivant';

export function ecranAccueil(codeLien: string | null): string {
  const prenom = esc(brouillons.prenom ?? localStorage.getItem('grille:prenom') ?? '');
  const code = esc(brouillons.code ?? codeLien ?? '');
  return `<section class="ecran accueil">
    <div class="haut-accueil"><span class="pilule">3–6 JOUEURS</span>${boutonSon(sonActif())}</div>
    <div class="titre">
      ${mallowAccueil()}
      ${logo()}
      <p class="slogan">Qui va se faire griller ?</p>
    </div>
    ${(() => { const r = retourJoueur(); return r ? blocRetour(r) : cartesAccueil(); })()}
    <button class="bouton-liste" data-action="vueAccueil" data-valeur="jeux">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>
      Liste des jeux
    </button>
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
