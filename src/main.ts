import './style.css';
import QRCode from 'qrcode';
import { ref, runTransaction, set, update } from 'firebase/database';
import { connexion, configManquante, db, maintenant } from './firebase';
import { S, brancherAffichage, demanderAffichage, ecouterSalon, estHote, quandCaChange, quitterEcoute } from './etat';
import { commandeHote, commandeJeu, piloter } from './hote';
import { effetsJoueur, repondre } from './effets';
import { choisirMission } from './missions';
import { jeuParId } from './games';
import { localJeu, vueJeu } from './ecrans/deroule';
import { action, afficher, brouillons, installer, vibrer } from './ui';
import { garderEcranAllume } from './veille';
import { esc, normaliserCode, nettoyerPrenom } from './outils';
import { copier, imagePodium, partager } from './partage';
import { totalFinal } from './score';
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
  afficher((S.deroule.phase === 'salon' ? ecranSalon(qrDuSalon(S.code)) : ecranPartie()) + surcouches());
}
// Un écran qui plante ne doit jamais bloquer la partie : on garde l'écran précédent et on réessaie au prochain changement.
/** Le petit message temporaire et l'aperçu de l'image à enregistrer. */
function surcouches(): string {
  const toast = S.toast ? `<div class="toast" role="status">${esc(S.toast)}</div>` : '';
  const apercu = S.apercuImage
    ? `<div class="apercu-image" role="dialog" aria-label="Image du podium">
        <img src="${S.apercuImage}" alt="Le podium de la partie">
        <p class="aide">Appuie longuement sur l’image pour l’enregistrer, ou utilise le bouton.</p>
        <a class="bouton jaune" href="${S.apercuImage}" download="grille-podium.png">Enregistrer l’image</a>
        <button class="bouton discret" data-action="fermerApercu">Fermer</button>
      </div>`
    : '';
  return toast + apercu;
}

let minuterieToast: ReturnType<typeof setTimeout> | null = null;
function montrerToast(texte: string): void {
  S.toast = texte;
  demanderAffichage();
  if (minuterieToast) clearTimeout(minuterieToast);
  minuterieToast = setTimeout(() => {
    S.toast = null;
    demanderAffichage();
  }, 2600);
}

brancherAffichage(() => {
  try {
    rendu();
  } catch (e) {
    console.warn('affichage', e);
  }
});

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
  S.confirmerQuitter = false;
  await quitterSalon(S.uid, S.code, S.infos, S.joueurs, S.deroule?.phase);
  quitterEcoute();
  garderEcranAllume(false);
  history.replaceState(null, '', location.pathname);
  demanderAffichage();
});

action('demanderQuitter', () => {
  S.confirmerQuitter = true;
  demanderAffichage();
});
action('annulerQuitter', () => {
  S.confirmerQuitter = false;
  demanderAffichage();
});

action('onglet', (el) => {
  S.onglet = el.dataset.valeur as typeof S.onglet;
  if (S.onglet === 'missions' && S.secrets.mission2 && !S.secrets.nouvelleMissionVue) {
    void set(ref(db, `secrets/${S.code}/${S.uid}/nouvelleMissionVue`), true);
  }
  scrollTo(0, 0);
  demanderAffichage();
});

// ——— Pendant la partie ———

action('choisirMission', async (el) => {
  const numero = Number(el.dataset.numero) as 1 | 2;
  (el as HTMLButtonElement).disabled = true;
  if (await choisirMission(S.code!, S.uid, S.joueurs, S.secrets, numero, Number(el.dataset.index))) {
    vibrer(80);
    await repondre(`mission${numero}`);
  }
});

action('voterJeu', (el) => repondre(`choix-${S.deroule!.numeroJeu}`, { jeu: el.dataset.valeur }));

action('jeu', async (el) => {
  const jeu = jeuParId(S.deroule?.jeuEnCours);
  const geste = jeu?.gestes?.[el.dataset.geste!];
  if (!jeu || !geste || !S.jeu || (S.jeu as { jeuId?: string }).jeuId !== jeu.id) return;
  const etape = (S.jeu as { etape: string }).etape;
  await geste(el, {
    repondre: (valeurs) => repondre(etape, valeurs),
    incrementer: async (compteur) => {
      await runTransaction(ref(db, `salons/${S.code}/compteurs/${compteur}`), (n: number | null) => (n ?? 0) + 1);
    },
    local: localJeu,
    rafraichir: demanderAffichage,
  }, vueJeu());
});

action('hote', (el) => commandeHote(el.dataset.valeur!));
action('hote-jeu', (el) => commandeJeu(el.dataset.valeur!));

action('choisirCible', (el) => {
  brouillons.cible = el.dataset.valeur!;
  demanderAffichage();
});
action('parier', async () => {
  const texte = (brouillons.pari ?? '').trim();
  if (!brouillons.cible || texte.length < 3) {
    alert('Écris ce que tu crois être sa mission.');
    return;
  }
  await set(ref(db, `salons/${S.code}/paris/${S.uid}`), { cible: brouillons.cible, texte: texte.slice(0, 160) });
  await repondre('detective');
});
action('pasDePari', async () => {
  await set(ref(db, `salons/${S.code}/paris/${S.uid}`), { passe: true });
  await repondre('detective');
});

action('voter', async (el) => {
  const v = el.dataset.valeur!;
  const valeur = v === 'true' ? true : v === 'false' ? false : Number(v);
  await set(ref(db, `salons/${S.code}/votes/${el.dataset.sujet}/${S.uid}`), valeur);
  vibrer(30);
});

// ——— Partage ———

action('inviter', async () => {
  if (!S.code) return;
  const url = lienSalon(S.code);
  const texte = `${S.joueurs[S.uid]?.prenom ?? 'On'} t’invite à une partie de Grillé ! Code : ${S.code}`;
  if (await partager({ titre: 'Grillé !', texte, url })) return;
  montrerToast((await copier(`${texte} ${url}`)) ? 'Lien copié : colle-le dans ta conversation' : `Envoie ce lien : ${url}`);
});

action('partagerPodium', async (el) => {
  if (!S.code) return;
  (el as HTMLButtonElement).disabled = true;
  try {
    const classement = Object.entries(S.joueurs)
      .map(([u, joueur]) => ({ joueur, points: totalFinal(S.scores[u]) }))
      .sort((a, b) => b.points - a.points);
    const date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    // Un titre de chaque sorte, dans cet ordre, 3 au maximum.
    const tous = S.deroule?.bilan?.titres ?? [];
    const titres = ['Grillé', 'Sherlock', 'Agent secret', 'Casse-cou', 'Champion des mini-jeux']
      .map((nom) => tous.find((t) => t.titre === nom))
      .filter((t): t is NonNullable<typeof t> => !!t)
      .slice(0, 3)
      .map((t) => `${t.titre} : ${S.joueurs[t.uid]?.prenom ?? '?'}`)
      .join(' · ');
    const image = await imagePodium(classement, `Partie ${S.code} · ${date}`, titres);
    const fichier = new File([image], 'grille-podium.png', { type: 'image/png' });
    if (!(await partager({ titre: 'Grillé !', texte: 'Notre soirée Grillé ! 🔥', fichier }))) {
      if (S.apercuImage) URL.revokeObjectURL(S.apercuImage);
      S.apercuImage = URL.createObjectURL(image);
      demanderAffichage();
    }
  } catch (e) {
    console.error(e);
    montrerToast('Impossible de créer l’image, réessaie.');
  } finally {
    (el as HTMLButtonElement).disabled = false;
  }
});

action('fermerApercu', () => {
  if (S.apercuImage) URL.revokeObjectURL(S.apercuImage);
  S.apercuImage = null;
  demanderAffichage();
});

// L'hôte fait avancer la partie ; chaque téléphone fait ses propres tâches.
quandCaChange(() => {
  effetsJoueur();
  void piloter();
});
setInterval(() => void piloter(), 500);

// Chronos : mis à jour sans redessiner l'écran.
setInterval(() => {
  document.querySelectorAll<HTMLElement>('.chrono[data-fin]').forEach((el) => {
    const reste = Math.max(0, Number(el.dataset.fin) - maintenant());
    const s = Math.ceil(reste / 1000);
    const span = el.querySelector('span')!;
    if (span.textContent !== `${s}`) span.textContent = `${s}`;
    el.classList.toggle('urgent', s <= 5);
  });
}, 250);

// Appui long pour lire une mission secrète.
const reveler = (e: Event, oui: boolean) => {
  const el = (e.target as HTMLElement).closest?.('[data-appui]');
  if (el) el.classList.toggle('revele', oui);
  else if (!oui) document.querySelectorAll('[data-appui].revele').forEach((x) => x.classList.remove('revele'));
};
document.addEventListener('pointerdown', (e) => reveler(e, true));
['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => document.addEventListener(t, (e) => reveler(e, false)));
document.addEventListener('contextmenu', (e) => {
  if ((e.target as HTMLElement).closest?.('[data-appui]')) e.preventDefault();
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
