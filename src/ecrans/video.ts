// Boutons et « studio » des vidéos Grillé ! : récap de la soirée (écran de fin) et moments GRILLÉ ! (classement, fin).
import { S } from '../etat';
import { esc } from '../outils';
import { liste as listeAccusations, mancheAction, type AccusationListee } from '../accusations';
import { localJeu } from '../memoireJeu';
import { VOL_FLASH } from '../flash';
import { totalFinal, VOL_DETECTIVE } from '../score';
import { videoPossible } from '../formatVideo';
import type { DonneesMoment, DonneesRecap, JoueurVideo } from '../video';

const joueur = (u: string): JoueurVideo => ({ prenom: S.joueurs[u]?.prenom ?? '?', couleur: S.joueurs[u]?.couleur ?? '#fff' });
const uids = () => Object.entries(S.joueurs).sort((a, b) => a[1].rejointLe - b[1].rejointLe).map(([u]) => u);
const grilles = () => listeAccusations(S.accusations).filter((a) => a.mission && (a.statut === 'grille' || a.verdict === 'grille'));

/** Boutons à afficher : récap (fin de partie) et moments GRILLÉ ! (tous, ou ceux d'un jeu). */
export function boutonsVideo(opts: { recap?: boolean; numeroJeu?: number }): string {
  if (!videoPossible()) return '';
  const moments = grilles().filter((a) => opts.numeroJeu === undefined || a.numeroJeu === opts.numeroJeu);
  const boutons = [
    ...(opts.recap ? ['<button class="bouton jaune" data-action="video" data-valeur="recap">🎬 Vidéo récap de la soirée</button>'] : []),
    ...moments.map((a) => `<button class="bouton discret bouton-video" data-action="video" data-valeur="moment:${a.cle}">🎬 Vidéo : ${esc(joueur(a.de).prenom)} a grillé ${esc(joueur(a.cible).prenom)}</button>`),
  ];
  return boutons.length ? `<div class="pile">${boutons.join('')}</div>` : '';
}

function donneesRecap(): DonneesRecap {
  const b = S.deroule?.bilan;
  const classes = uids().sort((a, c) => totalFinal(S.scores[c]) - totalFinal(S.scores[a]));
  const reussies = (u: string) => (b?.missions[u] ?? []).filter((m) => m.reussie).length;
  const flashs = (u: string) => Math.round((S.scores[u]?.flash ?? 0) / 3);
  const date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  // Les missions à révéler : une réussie et une ratée en priorité, puis les autres.
  const toutes = uids().flatMap((u) => (b?.missions[u] ?? []).map((m) => ({ joueur: joueur(u), texte: m.texte, reussie: m.reussie })));
  const missions = [...toutes.filter((m) => m.reussie).slice(0, 2), ...toutes.filter((m) => !m.reussie).slice(0, 1)];
  for (const m of toutes) if (missions.length < 3 && !missions.includes(m)) missions.push(m);
  return {
    sousTitre: `Soirée du ${date} · ${uids().length} joueurs · ${S.infos?.duree ?? 6} jeux`,
    podium: classes.slice(0, 3).map((u) => ({ joueur: joueur(u), points: totalFinal(S.scores[u]), cuisson: Math.min(4, reussies(u) * 2 + flashs(u)) })),
    missions,
    titres: (b?.titres ?? []).slice(0, 3).map((t) => ({ joueur: joueur(t.uid), titre: t.titre, pourquoi: t.pourquoi })),
  };
}

function donneesMoment(a: AccusationListee): DonneesMoment {
  const m = a.mission!;
  return {
    accuseur: joueur(a.de),
    accuse: joueur(a.cible),
    proposition: a.texte,
    mission: m.texte,
    vol: m.numero >= 100 ? VOL_FLASH : VOL_DETECTIVE[m.difficulte],
  };
}

let ouvert = false;

/**
 * Ouvre le « studio » par-dessus l'appli : la vidéo se joue (et s'enregistre si le téléphone sait le faire),
 * puis on la partage. `auto` : lancée toute seule (moment GRILLÉ !, générique de fin), chez tout le monde.
 */
export async function ouvrirStudio(valeur: string, auto = false): Promise<void> {
  if (ouvert) return;
  const recap = valeur === 'recap';
  const a = recap ? undefined : grilles().find((x) => `moment:${x.cle}` === valeur);
  if (!recap && !a) return;
  ouvert = true;
  const titre = recap ? '🎬 Le récap de la soirée' : `🔥 ${esc(joueur(a!.de).prenom)} a grillé ${esc(joueur(a!.cible).prenom)} !`;
  const fond = document.createElement('div');
  fond.className = 'studio-video';
  fond.innerHTML = `<div class="studio-carte">
    ${auto ? `<p class="studio-titre">${titre}</p>` : ''}
    <canvas class="studio-toile" aria-label="Vidéo"></canvas>
    <div class="studio-barre"><span></span></div>
    <p class="studio-etat">${auto ? '' : 'Fabrication de la vidéo… laisse l’appli ouverte.'}</p>
    <div class="studio-boutons"></div></div>`;
  document.body.append(fond);
  const toile = fond.querySelector('canvas')!;
  const barre = fond.querySelector<HTMLElement>('.studio-barre span')!;
  const etat = fond.querySelector('.studio-etat')!;
  const boutons = fond.querySelector('.studio-boutons')!;
  const fermer = () => {
    fond.remove();
    ouvert = false;
  };
  try {
    // Le module vidéo n'est chargé qu'ici : l'appli s'ouvre plus vite.
    const { fabriquerVideo, partagerVideo } = await import('../video');
    const fichier = await fabriquerVideo(toile, recap ? 'recap' : 'moment', recap ? donneesRecap() : donneesMoment(a!), (p) => (barre.style.width = `${Math.round(p * 100)}%`));
    if (fichier) {
      etat.textContent = 'La vidéo est prête à partager !';
      boutons.innerHTML = '<button class="bouton jaune" data-studio="partager">Partager</button><button class="bouton discret" data-studio="fermer">Fermer</button>';
      boutons.querySelector('[data-studio="partager"]')!.addEventListener('click', async () => {
        const r = await partagerVideo(fichier);
        if (r === 'telecharge') etat.textContent = 'Vidéo enregistrée dans tes téléchargements.';
      });
    } else {
      etat.textContent = 'Ce téléphone ne sait pas enregistrer la vidéo : un autre joueur pourra la partager.';
      boutons.innerHTML = '<button class="bouton jaune" data-studio="fermer">Fermer</button>';
    }
  } catch (e) {
    console.warn('vidéo', e);
    etat.textContent = 'La vidéo n’a pas pu se lancer sur ce téléphone.';
    boutons.innerHTML = '<button class="bouton discret" data-studio="fermer">Fermer</button>';
  }
  boutons.querySelector('[data-studio="fermer"]')?.addEventListener('click', fermer);
}

/** Petite pause avant le générique de fin : le temps de voir le podium. */
const ATTENTE_RECAP = 10_000;
let finVueLe = 0;

/**
 * Vidéos automatiques, sur chaque téléphone :
 * - « Moment GRILLÉ ! » dès que le verdict d'une accusation réussie est tombé (après la manche si un jeu d'action est en cours) ;
 * - le récap, comme un générique, 10 s après l'arrivée sur le podium.
 * Chaque vidéo n'est jouée qu'une fois par téléphone (mémoire de la partie).
 */
export function videosAutomatiques(): void {
  const d = S.deroule;
  if (ouvert || !S.code || !d) return;
  if (d.phase === 'fin' && d.bilan) {
    finVueLe ||= Date.now();
    if (!localJeu['video-recap'] && Date.now() - finVueLe >= ATTENTE_RECAP) {
      localJeu['video-recap'] = true;
      void ouvrirStudio('recap', true);
    }
    return;
  }
  finVueLe = 0;
  const ctx = { phase: d.phase, numeroJeu: d.numeroJeu, jeuEnCours: d.jeuEnCours, phaseJeu: d.phase === 'flash' ? d.flash?.etape : (S.jeu as { phase?: string } | null)?.phase };
  if (mancheAction(ctx)) return;
  const a = listeAccusations(S.accusations).find((x) => x.mission && x.verdict === 'grille' && x.numeroJeu === d.numeroJeu && !localJeu[`video-${x.cle}`]);
  if (!a) return;
  localJeu[`video-${a.cle}`] = true;
  void ouvrirStudio(`moment:${a.cle}`, true);
}
