// Polices hébergées avec l'appli (alphabet latin seulement) : pas d'appel à Google, et elles marchent hors connexion.
import '@fontsource/unbounded/latin-600.css';
import '@fontsource/unbounded/latin-800.css';
import '@fontsource/unbounded/latin-900.css';
import '@fontsource/plus-jakarta-sans/latin-500.css';
import '@fontsource/plus-jakarta-sans/latin-700.css';
import '@fontsource/plus-jakarta-sans/latin-800.css';
import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { ref, runTransaction, set, update } from 'firebase/database';
import { accusationEnCours, liste as listeAccusations } from './accusations';
import { accusationPossible } from './ecrans/accusation';
import { connexion, configManquante, db, maintenant } from './firebase';
import { S, brancherAffichage, demanderAffichage, ecouterSalon, estHote, memoireDuGroupe, quandCaChange, quitterEcoute } from './etat';
import { commandeHote, commandeJeu, piloter } from './hote';
import { effetsJoueur, momentsForts, repondre } from './effets';
import { basculerSon, debloquer, sons } from './son';
import { choisirMission, prendreMissionVengeance } from './missions';
import { ouvrirStudio, videosAutomatiques } from './ecrans/video';
import { vengeancesVues } from './ecrans/missions';
import { nouvelIdSaison, retenirSaison, saisonsConnues, tirerVengeance } from './saison';
import { jeuParId } from './games';
import { vueJeu } from './ecrans/deroule';
import { localJeu } from './memoireJeu';
import { animerCompteurs, animerCourses, animerLoupes } from './animations';
import { ecranTuto, marquerTutoVu, tutoDejaVu } from './ecrans/tuto';
import { action, afficher, brouillons, installer, vibrer } from './ui';
import { garderEcranAllume } from './veille';
import { installerGlisser } from './glisser';
import { annuler, brancherHeure, effacer, installerDessin, outil, peindreLesToiles } from './dessin';
import { animerFusees } from './fusee';
import { animerRoues, brancherRoue } from './roue';
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

// Première visite sur ce téléphone : le tutoriel s'affiche avant l'accueil.
if (!tutoDejaVu()) S.vueAccueil = 'tuto';

const app = document.getElementById('app')!;
installer(app);
installerGlisser();
installerDessin();
brancherHeure(() => maintenant() - Date.now());
brancherRoue(maintenant, () => sons.cran());

/** Code présent dans le lien (QR code) : https://…/#ABCD */
const codeDuLien = (): string | null => normaliserCode(location.hash.slice(1)) || null;

let qr = { code: '', svg: '' };
function qrDuSalon(code: string): string {
  if (qr.code !== code) {
    qr = { code, svg: '' };
    // Le générateur de QR code n'est chargé que pour l'afficher (salon d'attente).
    void import('qrcode').then(({ default: QRCode }) => QRCode.toString(lienSalon(code), { type: 'svg', margin: 1, color: { dark: '#15112E', light: '#F6F3FF' } }).then((svg) => {
      if (qr.code === code) {
        qr.svg = svg;
        demanderAffichage();
      }
    }));
  }
  return qr.svg;
}

/** Identifie l'écran affiché : quand elle change, le nouvel écran arrive avec une transition. */
function cleEcran(): string {
  const d = S.deroule!;
  const sousEtape = d.phase === 'jeu' ? (S.jeu as { phase?: string } | null)?.phase : d.phase === 'flash' ? d.flash?.etape : d.phase === 'revelation' ? `${d.revelation?.index}-${d.revelation?.etape}` : '';
  return [S.onglet, d.phase, d.numeroJeu, d.jeuEnCours ?? '', sousEtape ?? ''].join('|');
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
    if (S.vueAccueil === 'tuto') afficher(ecranTuto(), `tuto-${S.etapeTuto}`);
    else afficher(S.vueAccueil === 'jeux' ? ecranListeJeux() : ecranAccueil(codeDuLien()), `accueil-${S.vueAccueil}`);
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
  afficher((S.deroule.phase === 'salon' ? ecranSalon(qrDuSalon(S.code)) : ecranPartie()) + surcouches(), cleEcran());
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

action('reglages', () => {
  S.reglagesOuverts = !S.reglagesOuverts;
  demanderAffichage();
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

// Tutoriel : « Suivant », puis « C'est parti ! » (ou « Passer ») le marque comme vu sur ce téléphone.
action('tuto', (el) => {
  if (el.dataset.valeur === 'suivant') S.etapeTuto++;
  else {
    marquerTutoVu();
    S.vueAccueil = 'accueil';
  }
  scrollTo(0, 0);
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
  scrollTo(0, 0);
  demanderAffichage();
});

// ——— Pendant la partie ———

action('choisirMission', async (el) => {
  (el as HTMLButtonElement).disabled = true;
  if (await choisirMission(S.code!, S.uid, S.joueurs, S.secrets, Number(el.dataset.index))) {
    vibrer(80);
    sons.ding();
    await repondre('mission1');
  }
});

// Dessin à la chaîne : couleur, épaisseur, gomme, annuler, effacer.
action('outil', (el) => {
  const d = el.dataset;
  if (d.couleur) outil.couleur = d.couleur;
  if (d.epaisseur) outil.epaisseur = Number(d.epaisseur);
  if (d.annuler) annuler(d.annuler);
  if (d.effacer) effacer(d.effacer);
  demanderAffichage();
});

action('video', (el) => {
  void ouvrirStudio(el.dataset.valeur!);
});
action('passerGrillage', async () => {
  const f = S.deroule?.flash;
  if (S.deroule?.phase !== 'flash' || f?.etape !== 'grillage') return;
  vibrer(30);
  await repondre(`grille-${f.numero}`);
});
action('pret', async (el) => {
  if (S.deroule?.phase !== 'regles') return;
  (el as HTMLButtonElement).disabled = true;
  vibrer(40);
  sons.ding();
  await repondre(`pret-${S.deroule.numeroJeu}`);
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
      // Un geste peut répondre à une autre étape que celle du jeu (ex. le piège de Réflexe Mallow).
      return repondre(typeof valeurs.etape === 'string' ? valeurs.etape : etape, valeurs);
    },
    incrementer: async (compteur) => {
      await runTransaction(ref(db, `salons/${S.code}/compteurs/${compteur}`), (n: number | null) => (n ?? 0) + 1);
    },
    local: localJeu,
    rafraichir: demanderAffichage,
  }, vueJeu());
});

action('hote', (el) => commandeHote(el.dataset.valeur!));
action('finRecit', () => {
  const r = S.deroule?.revelation;
  if (r?.etape === 'recit' && r.ordre[r.index] === S.uid) void repondre(`recit-${r.index}`);
});
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
  const mission = await prendreMissionVengeance(S.code, S.uid, S.joueurs, choix, memoireDuGroupe());
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
    // Plusieurs accusations par jeu : la 1re dans « 3 », les suivantes dans « 3_2 », « 3_3 »…
    const n = S.deroule!.numeroJeu;
    const deja = listeAccusations(S.accusations).filter((x) => x.de === S.uid && x.numeroJeu === n).length;
    await set(ref(db, `salons/${S.code}/accusations/${deja ? `${n}_${deja + 1}` : n}/${S.uid}`), { cible, texte: texte.slice(0, 160), le: maintenant() });
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
  const chemin = `salons/${S.code}/accusations/${a.slot}/${a.de}`;
  if (el.dataset.valeur === 'eu') {
    const numero = Number(el.dataset.numero);
    const flash = numero >= 100 ? S.secrets.flash?.[`j${numero - 100}`] : undefined;
    const m = numero === 1 ? S.secrets.mission1 : flash ? { texte: flash.texte, difficulte: 'facile' as const } : undefined;
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
// Vidéos automatiques (moment GRILLÉ !, générique de fin) : chaque téléphone vérifie chaque seconde.
setInterval(videosAutomatiques, 1000);

// Horloge des jeux d'action (Réflexe Mallow, Le bon timing) : le feu, les éternuements et le décompte
// apparaissent à l'heure du serveur, donc au même instant sur tous les téléphones.
const sonsJoues = new Set<string>();
const debutsAttente = new WeakMap<HTMLElement, number>();
function horloge(): void {
  const t = maintenant();
  document.querySelectorAll<HTMLElement>('[data-feu]').forEach((el) => {
    const feu = Number(el.dataset.feu);
    const enFeu = t >= feu;
    el.classList.toggle('en-feu', enFeu);
    // Mallow stressé : il cligne, puis tremble et transpire de plus en plus. Le stress suit le temps passé à attendre
    // (depuis l'arrivée de l'écran), jamais l'heure du feu : le regarder ne donne aucun indice.
    if (!debutsAttente.has(el)) debutsAttente.set(el, performance.now());
    const attente = performance.now() - debutsAttente.get(el)!;
    el.classList.toggle('stress-1', !enFeu && attente >= 3000 && attente < 6000);
    el.classList.toggle('stress-2', !enFeu && attente >= 6000);
    const leurre = el.dataset.leurre ? Number(el.dataset.leurre) : NaN;
    el.classList.toggle('eternue', !Number.isNaN(leurre) && t >= leurre && t < leurre + 700);
    // Leurre du vainqueur : chez la victime seulement, Mallow « chauffe » comme s'il allait prendre feu.
    const piege = el.dataset.piege ? Number(el.dataset.piege) : NaN;
    el.classList.toggle('chauffe', !Number.isNaN(piege) && t >= piege && t < piege + 650);
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
  peindreLesToiles();
  animerFusees();
  animerRoues();
  animerCompteurs();
  animerCourses();
  animerLoupes();
}
// Économie de batterie : l'horloge ne tourne à chaque image (60 fois par seconde) que si l'écran montre
// quelque chose qui bouge avec elle. Sinon, elle vérifie seulement toutes les 150 ms.
const ELEMENTS_ANIMES = '[data-compteur], [data-course], [data-loupe], [data-feu], .cadran-timing[data-depart], .stop-timing[data-depart], .cible-patate[data-depart], .consigne-patate[data-depart], canvas[data-voir], [data-fusee], canvas[data-roue]';
function boucleHorloge(): void {
  if (document.querySelector(ELEMENTS_ANIMES)) {
    horloge();
    requestAnimationFrame(boucleHorloge);
  } else setTimeout(() => requestAnimationFrame(boucleHorloge), 150);
}
requestAnimationFrame(boucleHorloge);

// Chronos : mis à jour sans redessiner l'écran. Un tic sonore pendant les 5 dernières secondes.
// La Patate : la mèche fait tic-tac tant que la patate circule.
// La mèche accélère quand le colis est sous tension (de 480 ms à 200 ms entre deux tics).
const tictacMeche = () => {
  const colis = document.querySelector<SVGElement>('.zone-patate .dessin-colis');
  if (colis) sons.meche();
  const tension = colis ? Number(colis.style.getPropertyValue('--t')) || 0 : 0;
  setTimeout(tictacMeche, 480 - tension * 280);
};
tictacMeche();

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
// L'Imposteur : la carte « TOP SECRET » suit le doigt vers le haut, puis retombe dès qu'on lâche.
let carteTenue: { el: HTMLElement; y: number } | null = null;
document.addEventListener('pointerdown', (e) => {
  const el = (e.target as HTMLElement).closest?.<HTMLElement>('[data-carte-secrete]');
  if (!el) return;
  carteTenue = { el, y: e.clientY };
  el.classList.add('tenue');
});
document.addEventListener('pointermove', (e) => {
  if (!carteTenue) return;
  const leve = Math.max(0, Math.min(170, carteTenue.y - e.clientY));
  carteTenue.el.style.setProperty('--leve', `${leve}px`);
});
['pointerup', 'pointercancel'].forEach((t) => document.addEventListener(t, () => {
  if (!carteTenue) return;
  carteTenue.el.classList.remove('tenue');
  carteTenue.el.style.setProperty('--leve', '0px');
  carteTenue = null;
}));
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
