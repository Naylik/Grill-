import { brouillons } from '../ui';
import { esc } from '../outils';
import { S } from '../etat';
import { logo } from '../mallow';
import { boutonSon, erreur } from './commun';
import { sonActif } from '../son';
import { volonteDebloque } from '../volonte';
import { blocRetour, cartesAccueil, compteurAccueil, mallowAccueil, retourJoueur } from '../accueilVivant';

/** Accueil sans lien d'invitation : la case du code n'apparaît qu'après « Rejoindre ». */
let voirCode = false;
export const montrerCode = (): void => {
  voirCode = true;
};

/** Mode À volonté : on choisit son mini-jeu et on le rejoue sans fin (futur mode payant, ouvert pendant les tests). */
const INFINI = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" aria-hidden="true"><path d="M12 12c-2-2.6-3.6-4-5.5-4a4 4 0 0 0 0 8c1.9 0 3.5-1.4 5.5-4zm0 0c2 2.6 3.6 4 5.5 4a4 4 0 0 0 0-8c-1.9 0-3.5 1.4-5.5 4z"/></svg>';
const boutonVolonte = (): string => (volonteDebloque()
  ? `<button class="bouton-volonte" data-action="creerVolonte"><span class="infini">${INFINI}</span><span><strong>Mode À volonté</strong><small>Les 12 jeux, sans points. Rejoue ton préféré à l’infini.</small></span><span class="fleche" aria-hidden="true">›</span></button>`
  : '');

const BOUTON_LISTE = `<button class="bouton-liste" data-action="vueAccueil" data-valeur="jeux">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>
      Liste des jeux
    </button>`;

export function ecranAccueil(codeLien: string | null): string {
  const prenom = esc(brouillons.prenom ?? localStorage.getItem('grille:prenom') ?? '');
  const code = esc(brouillons.code ?? codeLien ?? '');
  const caseCode = `<div class="boite">
        <label class="champ">
          <span>Code de la partie</span>
          <input name="code" class="code" value="${code}" maxlength="4" autocapitalize="characters" autocomplete="off" placeholder="ABCD" data-entree="rejoindre">
        </label>
        <button class="bouton cyan" data-action="rejoindre">Rejoindre</button>
        <p class="aide">Ou scanne le QR code de l’hôte avec l’appareil photo.</p>
      </div>`;
  // Lien d'invitation : le code est déjà là, on rejoint directement. Sinon : Créer et Rejoindre côte à côte.
  const actions = codeLien || voirCode
    ? `${caseCode}<button class="bouton discret" data-action="creer">Créer ma propre partie</button>`
    : `<div class="duo-accueil"><button class="bouton jaune" data-action="creer">Créer</button><button class="bouton cyan" data-action="montrerCode">Rejoindre</button></div>`;
  return `<section class="ecran accueil">
    <div class="haut-accueil"><span class="pilule">3–6 JOUEURS</span>${boutonSon(sonActif())}</div>
    <div class="titre">
      ${mallowAccueil()}
      ${logo()}
      <p class="pitch-accueil">Missions secrètes et mini-jeux, chacun sur son téléphone.</p>
      ${compteurAccueil()}
    </div>
    ${(() => { const r = retourJoueur(); return r ? blocRetour(r) : ''; })()}
    ${cartesAccueil()}
    <div class="pile bas">
      <label class="champ">
        <span>Ton prénom</span>
        <input name="prenom" value="${prenom}" maxlength="16" autocomplete="given-name" placeholder="Ex. : Léa" data-entree="${codeLien ? 'rejoindre' : 'creer'}">
      </label>
      ${erreur(S.erreur)}
      ${actions}
      ${codeLien || voirCode ? '' : boutonVolonte()}
      ${BOUTON_LISTE}
    </div>
  </section>`;
}
