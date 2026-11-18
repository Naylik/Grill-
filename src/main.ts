import './style.css';
import { registerSW } from 'virtual:pwa-register';
import QRCode from 'qrcode';
import { ref, runTransaction, set, update } from 'firebase/database';
import { accusationEnCours } from './accusations';
import { accusationPossible } from './ecrans/accusation';
import { connexion, configManquante, db, maintenant } from './firebase';
import { S, brancherAffichage, demanderAffichage, ecouterSalon, estHote, quandCaChange, quitterEcoute } from './etat';
import { commandeHote, commandeJeu, piloter } from './hote';
import { effetsJoueur, momentsForts, repondre } from './effets';
import { basculerSon, debloquer, sons } from './son';
import { choisirMission, prendreMissionVengeance } from './missions';
import { vengeancesVues } from './ecrans/missions';
import { nouvelIdSaison, retenirSaison, saisonsConnues, tirerVengeance } from './saison';
import { jeuParId } from './games';
import { localJeu, vueJeu } from './ecrans/deroule';
import { action, afficher, brouillons, installer, vibrer } from './ui';
import { garderEcranAllume } from './veille';
import { installerGlisser } from './glisser';
import { mettreAJour, retenirEnregistrement } from './version';
import { esc, normaliserCode, nettoyerPrenom } from './outils';
import { copier, imagePodium, partager } from './partage';
import { totalFinal } from './score';
import { ErreurSalon, MIN_JOUEURS, changerReglages, creerSalon, quitterSalon, rejoindreSalon } from './salon';
import { ecranAccueil } from './ecrans/accueil';
import { ecranListeJeux } from './ecrans/jeux';
import { ecranSalon, lienSalon } from './ecrans/salon';
import { ecranPartie } from './ecrans/partie';
import type { Duree, ModeChoix } from './types';

const app = document.getElementById('app')!;
installer(app);
installerGlisser();

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
    afficher(S.vueAccueil === 'jeux' ? ecranListeJeux() : ecranAccueil(codeDuLien()));
    return;
  }
  if (!S.charge || !S.infos || !S.deroule) {
    afficher(`<section class="ecran centre"><p class="attente">Connexion au salon ${S.code}…</p>
      <button class="bouton discret" data-action="abandonner">Revenir à l’accueil</button></section>`);
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
  // Saison : au plus une vengeance par partie, tirée au hasard parmi les joueurs grillés la dernière fois.
  const offre = tirerVengeance(S.saison, Object.keys(S.joueurs));
  await update(ref(db, `salons/${S.code}`), {
    vengeance: offre ? { offre: { [offre.de]: { choix: Object.fromEntries(offre.choix.map((u) => [u, true])) } } } : null,
    deroule: { phase: 'missions', numeroJeu: 0, partieId: `${S.code}-${Date.now()}` },
  });
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

// Sortie de secours : revenir à l'accueil sans attendre le réseau.
action('vueAccueil', (el) => {
  S.vueAccueil = el.dataset.valeur === 'jeux' ? 'jeux' : 'accueil';
  scrollTo(0, 0);
  demanderAffichage();
});

action('abandonner', () => {
  quitterEcoute();
  garderEcranAllume(false);
  history.replaceState(null, '', location.pathname);
  demanderAffichage();
});

action('son', () => {
  if (basculerSon()) sons.ding();
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
    sons.ding();
    await repondre(`mission${numero}`);
  }
});

action('voterJeu', (el) => {
  sons.ding();
  return repondre(`choix-${S.deroule!.numeroJeu}`, { jeu: el.dataset.valeur });
});

action('jeu', async (el) => {
  const jeu = jeuParId(S.deroule?.jeuEnCours);
  const geste = jeu?.gestes?.[el.dataset.geste!];
  if (!jeu || !geste || !S.jeu || (S.jeu as { jeuId?: string }).jeuId !== jeu.id) return;
  const etape = (S.jeu as { etape: string }).etape;
  await geste(el, {
    repondre: (valeurs) => {
      sons.ding();
      return repondre(etape, valeurs);
    },
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
  sons.ding();
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
  sons.ding();
  vibrer(30);
});

// ——— Vengeance (saisons) ———

action('vengeance', async (el) => {
  const choix = el.dataset.valeur!;
  if (!S.code || !S.offreVengeance || S.secrets.vengeanceChoix) return;
  (el as HTMLButtonElement).disabled = true;
  if (choix === 'non' || !S.offreVengeance.choix[choix]) {
    await set(ref(db, `secrets/${S.code}/${S.uid}/vengeanceChoix`), 'non');
    return;
  }
  const mission = await prendreMissionVengeance(S.code, S.uid, S.joueurs, choix);
  if (!mission) {
    await set(ref(db, `secrets/${S.code}/${S.uid}/vengeanceChoix`), 'non');
    montrerToast('Pas de mission de vengeance disponible, désolé !');
    return;
  }
  // La cible est prévenue (sans savoir comment).
  await set(ref(db, `salons/${S.code}/vengeance/annonce/${choix}`), { de: S.uid });
  vibrer([100, 50, 200]);
  sons.ding();
  await repondre('mission1');
});

action('majAppli', (el) => {
  (el as HTMLButtonElement).disabled = true;
  void mettreAJour();
});

action('vuVengeance', (el) => {
  vengeancesVues.add(el.dataset.valeur!);
  demanderAffichage();
});

// ——— Saison (salon, hôte) ———

action('menuSaison', () => {
  S.menuSaison = !S.menuSaison;
  demanderAffichage();
});
action('creerSaison', async (el) => {
  const nom = (brouillons.nomSaison ?? '').trim().slice(0, 30);
  if (!estHote() || !S.code) return;
  if (nom.length < 2) {
    montrerToast('Donne un nom à la saison.');
    return;
  }
  (el as HTMLButtonElement).disabled = true;
  const id = nouvelIdSaison();
  const j = S.joueurs[S.uid];
  try {
    await set(ref(db, `saisons/${id}`), {
      infos: { nom, createur: S.uid, creeLe: maintenant() },
      membres: { [S.uid]: { prenom: j.prenom, couleur: j.couleur, points: 0, missions: 0, parties: 0 } },
    });
    await update(ref(db, `salons/${S.code}/infos`), { saison: id, nomSaison: nom });
    retenirSaison(id, nom);
    S.menuSaison = false;
    brouillons.nomSaison = '';
  } catch (e) {
    console.error(e);
    montrerToast('Impossible de créer la saison.');
  } finally {
    (el as HTMLButtonElement).disabled = false;
    demanderAffichage();
  }
});
action('choisirSaison', async (el) => {
  if (!estHote() || !S.code) return;
  const id = el.dataset.valeur!;
  const connue = saisonsConnues().find((s) => s.id === id);
  await update(ref(db, `salons/${S.code}/infos`), id === 'aucune' ? { saison: null, nomSaison: null } : { saison: id, nomSaison: connue?.nom ?? 'Saison' });
  S.menuSaison = false;
  demanderAffichage();
});

// ——— Bouton GRILLÉ ! ———

action('ouvrirAccuser', () => {
  if (!accusationPossible()) return;
  S.accuser = true;
  brouillons.accuse = '';
  brouillons.accusation = '';
  vibrer(40);
  demanderAffichage();
});
action('fermerAccuser', () => {
  S.accuser = false;
  demanderAffichage();
});
action('choisirAccuse', (el) => {
  brouillons.accuse = el.dataset.valeur!;
  demanderAffichage();
});
action('accuser', async (el) => {
  const cible = brouillons.accuse;
  const texte = (brouillons.accusation ?? '').trim();
  if (!cible || !S.joueurs[cible] || cible === S.uid) return;
  if (texte.length < 3) {
    montrerToast('Écris ce que tu crois être sa mission.');
    return;
  }
  if (!accusationPossible()) {
    S.accuser = false;
    montrerToast('Trop tard : une accusation est déjà en cours.');
    return;
  }
  (el as HTMLButtonElement).disabled = true;
  try {
    await set(ref(db, `salons/${S.code}/accusations/${S.deroule!.numeroJeu}/${S.uid}`), { cible, texte: texte.slice(0, 160), le: maintenant() });
    S.accuser = false;
    brouillons.accusation = '';
  } catch (e) {
    console.error(e);
    montrerToast('Accusation impossible, réessaie.');
  } finally {
    (el as HTMLButtonElement).disabled = false;
    demanderAffichage();
  }
});
action('repondreAccusation', async (el) => {
  const a = accusationEnCours(S.accusations);
  if (!a || a.cible !== S.uid || a.reponse) return;
  const chemin = `salons/${S.code}/accusations/${a.numeroJeu}/${a.de}`;
  if (el.dataset.valeur === 'eu') {
    const numero = Number(el.dataset.numero);
    const m = numero === 1 ? S.secrets.mission1 : S.secrets.mission2;
    if (!m) return;
    // Seul cas où une mission quitte le téléphone avant la fin : l'accusé avoue.
    await update(ref(db, chemin), { mission: { numero, texte: m.texte, difficulte: m.difficulte }, reponse: 'eu' });
  } else {
    await set(ref(db, `${chemin}/reponse`), 'rate');
  }
  vibrer(60);
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
  momentsForts();
  void piloter();
});
setInterval(() => void piloter(), 500);

// Horloge des jeux d'action (Réflexe Mallow, Le bon timing) : le feu, les éternuements et le décompte
// apparaissent à l'heure du serveur, donc au même instant sur tous les téléphones.
const sonsJoues = new Set<string>();
function horloge(): void {
  const t = maintenant();
  document.querySelectorAll<HTMLElement>('[data-feu]').forEach((el) => {
    const feu = Number(el.dataset.feu);
    const enFeu = t >= feu;
    el.classList.toggle('en-feu', enFeu);
    const leurre = el.dataset.leurre ? Number(el.dataset.leurre) : NaN;
    el.classList.toggle('eternue', !Number.isNaN(leurre) && t >= leurre && t < leurre + 700);
    if (enFeu && t < feu + 1000 && !sonsJoues.has(`feu-${feu}`)) {
      sonsJoues.add(`feu-${feu}`);
      sons.pschhh();
    }
  });
  document.querySelectorAll<HTMLElement>('.cadran-timing[data-depart]').forEach((el) => {
    const reste = Number(el.dataset.depart) - t;
    const texte = reste > 3000 ? 'Prêts ?' : reste > 2000 ? '3' : reste > 1000 ? '2' : reste > 0 ? '1' : reste > -1200 ? 'Partez !' : '';
    const span = el.querySelector('.decompte');
    if (span && span.textContent !== texte) {
      span.textContent = texte;
      const cle = `${el.dataset.depart}-${texte}`;
      if (texte && texte !== 'Prêts ?' && !sonsJoues.has(cle)) {
        sonsJoues.add(cle);
        if (texte === 'Partez !') sons.ding();
        else sons.tic();
      }
    }
    el.classList.toggle('en-cours', reste <= 0);
  });
  document.querySelectorAll<HTMLElement>('.stop-timing[data-depart], .cible-patate[data-depart], .consigne-patate[data-depart]').forEach((b) => {
    b.classList.toggle('pas-encore', t < Number(b.dataset.depart));
  });
  requestAnimationFrame(horloge);
}
requestAnimationFrame(horloge);

// Chronos : mis à jour sans redessiner l'écran. Un tic sonore pendant les 5 dernières secondes.
// La Patate : la mèche fait tic-tac tant que la patate circule.
setInterval(() => {
  if (document.querySelector('.zone-patate')) sons.meche();
}, 480);

const ticsJoues = new Map<string, number>();
setInterval(() => {
  document.querySelectorAll<HTMLElement>('.chrono[data-fin]').forEach((el) => {
    const reste = Math.max(0, Number(el.dataset.fin) - maintenant());
    const s = Math.ceil(reste / 1000);
    if (s >= 1 && s <= 5 && ticsJoues.get(el.dataset.fin!) !== s) {
      ticsJoues.set(el.dataset.fin!, s);
      sons.tic(s === 1);
    }
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
// Les téléphones n'autorisent le son qu'après un appui : on le débloque dès le premier.
document.addEventListener('pointerdown', () => void debloquer(), { once: true });
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

// Mises à jour : l'appli vérifie s'il existe une nouvelle version à chaque retour sur l'écran (et toutes les heures)
// et se recharge toute seule pour l'installer. La partie reprend ensuite automatiquement (tout est dans Firebase).
registerSW({
  immediate: true,
  onRegisteredSW(_url, enregistrement) {
    retenirEnregistrement(enregistrement);
    if (!enregistrement) return;
    const verifier = () => void enregistrement.update().catch(() => undefined);
    setInterval(verifier, 60 * 60 * 1000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') verifier();
    });
  },
});
