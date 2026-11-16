import { brouillons } from '../ui';
import { esc } from '../outils';
import { S } from '../etat';
import { chamal, logo } from '../chamal';
import { erreur } from './commun';

/** Les cartes secrètes de l'accueil (élément fort choisi le 16/11). */
const CARTES = `<div class="cartes-secretes" aria-label="2 missions secrètes t’attendent">
  <div class="cartes" aria-hidden="true">
    <div class="carte-s g"><i></i><i style="width:70%"></i><i style="width:50%"></i></div>
    <div class="carte-s c"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg><span>TOP SECRET</span></div>
    <div class="carte-s d"><i></i><i style="width:60%"></i><i style="width:80%"></i></div>
  </div>
  <p class="legende-cartes">2 missions secrètes t’attendent</p>
</div>`;

export function ecranAccueil(codeLien: string | null): string {
  const prenom = esc(brouillons.prenom ?? localStorage.getItem('grille:prenom') ?? '');
  const code = esc(brouillons.code ?? codeLien ?? '');
  return `<section class="ecran accueil">
    <div class="haut-accueil"><span class="pilule">SAISON 1</span><span class="pilule">3–6 JOUEURS</span></div>
    <div class="titre">
      <div class="flotte">${chamal({ taille: 132 })}</div>
      ${logo()}
    </div>
    ${CARTES}
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
