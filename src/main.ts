import './style.css';
import QRCode from 'qrcode';
import { ref, update } from 'firebase/database';
import { connexion, configManquante, db } from './firebase';
import { S, brancherAffichage, demanderAffichage, ecouterSalon, estHote, quitterEcoute } from './etat';
import { action, afficher, brouillons, installer } from './ui';
import { garderEcranAllume } from './veille';
import { normaliserCode, nettoyerPrenom } from './outils';
import { ErreurSalon, MIN_JOUEURS, changerReglages, creerSalon, quitterSalon, rejoindreSalon } from './salon';
import { ecranAccueil } from './ecrans/accueil';
import { ecranSalon, lienSalon } from './ecrans/salon';
import { ecranPartie } from './ecrans/partie';
import type { Duree, ModeChoix } from './types';

const app = document.getElementById('app')!;
installer(app);

/** Code présent dans le lien (QR code) : https://…/#ABCD */
const codeDuLien = (): string | null => normaliserCode(location.hash.slice(1)) || null;

let qr = { code: '', svg: '' };
function qrDuSalon(code: string): string {
  if (qr.code !== code) {
    qr = { code, svg: '' };
    void QRCode.toString(lienSalon(code), { type: 'svg', margin: 1, color: { dark: '#15112E', light: '#F6F3FF' } }).then((svg) => {
      if (qr.code === code) {
        qr.svg = svg;
        demanderAffichage();
      }
    });
  }
  return qr.svg;
}

function rendu(): void {
  if (configManquante) {
    afficher(`<section class="ecran"><h1 class="logo">Grillé !</h1><p class="erreur">La configuration Firebase n’est pas encore collée dans <code>src/firebase-config.ts</code> (voir README).</p></section>`);
    return;
  }
  if (!S.uid) {
    afficher(`<section class="ecran centre"><p class="attente">Connexion…</p></section>`);
    return;
  }
  if (!S.code) {
    afficher(ecranAccueil(codeDuLien()));
    return;
  }
  if (!S.charge || !S.infos || !S.deroule) {
    afficher(`<section class="ecran centre"><p class="attente">Connexion au salon ${S.code}…</p></section>`);
    return;
  }
  if (!S.joueurs[S.uid]) {
    // On a été retiré du salon (ou il a été remplacé par une nouvelle partie).
    quitterEcoute();
    S.erreur = 'Tu ne fais plus partie de ce salon.';
    rendu();
    return;
  }
  afficher(S.deroule.phase === 'salon' ? ecranSalon(qrDuSalon(S.code)) : ecranPartie());
}
brancherAffichage(rendu);

function prenomSaisi(): string | null {
  const prenom = nettoyerPrenom(brouillons.prenom ?? localStorage.getItem('grille:prenom') ?? '');
  if (!prenom) {
    S.erreur = 'Dis-nous d’abord ton prénom.';
    demanderAffichage();
    return null;
  }
  localStorage.setItem('grille:prenom', prenom);
  return prenom;
}

async function entrer(code: string): Promise<void> {
  S.erreur = null;
  history.replaceState(null, '', `#${code}`);
  ecouterSalon(code);
  garderEcranAllume(true);
}

function signalerErreur(e: unknown): void {
  S.erreur = e instanceof ErreurSalon ? e.message : 'Oups, la connexion a échoué. Réessaie.';
  if (!(e instanceof ErreurSalon)) console.error(e);
  demanderAffichage();
}

action('creer', async (el) => {
  const prenom = prenomSaisi();
  if (!prenom) return;
  (el as HTMLButtonElement).disabled = true;
  try {
    await entrer(await creerSalon(S.uid, prenom, 6, 'roue'));
  } catch (e) {
    signalerErreur(e);
  }
});

action('rejoindre', async (el) => {
  const prenom = prenomSaisi();
  if (!prenom) return;
  const code = normaliserCode(brouillons.code ?? codeDuLien() ?? '');
  if (code.length !== 4) {
    S.erreur = 'Le code fait 4 lettres.';
    demanderAffichage();
    return;
  }
  (el as HTMLButtonElement).disabled = true;
  try {
    await rejoindreSalon(S.uid, code, prenom);
    await entrer(code);
  } catch (e) {
    signalerErreur(e);
  }
});

action('duree', (el) => changerReglages(S.code!, { duree: Number(el.dataset.valeur) as Duree }));
action('mode', (el) => changerReglages(S.code!, { modeChoix: el.dataset.valeur as ModeChoix }));

action('lancer', async () => {
  if (!estHote() || Object.keys(S.joueurs).length < MIN_JOUEURS) return;
  await update(ref(db, `salons/${S.code}/deroule`), { phase: 'missions', numeroJeu: 0 });
});

action('quitter', async () => {
  if (!S.code) return;
  if (S.deroule?.phase !== 'salon' && !confirm('Quitter la partie ? Tu pourras revenir avec le même code.')) return;
  await quitterSalon(S.uid, S.code, S.infos, S.joueurs, S.deroule?.phase);
  quitterEcoute();
  garderEcranAllume(false);
  history.replaceState(null, '', location.pathname);
  demanderAffichage();
});

action('onglet', (el) => {
  S.onglet = el.dataset.valeur as typeof S.onglet;
  if (S.onglet === 'partie') S.masque = false;
  demanderAffichage();
});
action('masquer', () => {
  S.masque = !S.masque;
  demanderAffichage();
});

window.addEventListener('hashchange', () => {
  if (!S.code) demanderAffichage();
});

// Démarrage : connexion anonyme puis, si on était dans un salon (rechargement), on y retourne.
rendu();
if (!configManquante) {
  connexion()
    .then(async (u) => {
      S.uid = u.uid;
      const precedent = localStorage.getItem('grille:salon');
      const lien = codeDuLien();
      const prenom = localStorage.getItem('grille:prenom');
      const code = lien ?? precedent;
      if (code && prenom && (code === precedent || lien)) {
        try {
          await rejoindreSalon(S.uid, code, prenom);
          await entrer(code);
        } catch {
          // Pas grave : on reste sur l'accueil avec le code pré-rempli.
          if (code === precedent) localStorage.removeItem('grille:salon');
        }
      }
      demanderAffichage();
    })
    .catch((e) => {
      console.error(e);
      S.erreur = 'Connexion à Firebase impossible. Vérifie la configuration et ta connexion.';
      afficher(`<section class="ecran"><h1 class="logo">Grillé !</h1><p class="erreur">${S.erreur}</p></section>`);
    });
}
