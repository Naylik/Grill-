// Boutons et « studio » des vidéos Grillé ! : récap de la soirée (écran de fin) et moments GRILLÉ ! (classement, fin).
import { S } from '../etat';
import { esc } from '../outils';
import { liste as listeAccusations, type AccusationListee } from '../accusations';
import { VOL_FLASH } from '../flash';
import { totalFinal, VOL_DETECTIVE } from '../score';
import { fabriquerVideo, partagerVideo, videoPossible, type DonneesMoment, type DonneesRecap, type JoueurVideo } from '../video';

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

/** Ouvre le « studio » par-dessus l'appli : la vidéo se joue pendant qu'elle s'enregistre, puis on la partage. */
export async function ouvrirStudio(valeur: string): Promise<void> {
  if (ouvert) return;
  const recap = valeur === 'recap';
  const a = recap ? undefined : grilles().find((x) => `moment:${x.cle}` === valeur);
  if (!recap && !a) return;
  ouvert = true;
  const fond = document.createElement('div');
  fond.className = 'studio-video';
  fond.innerHTML = `<div class="studio-carte">
    <canvas class="studio-toile" aria-label="Aperçu de la vidéo"></canvas>
    <div class="studio-barre"><span></span></div>
    <p class="studio-etat">Fabrication de la vidéo… laisse l’appli ouverte.</p>
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
    const fichier = await fabriquerVideo(toile, recap ? 'recap' : 'moment', recap ? donneesRecap() : donneesMoment(a!), (p) => (barre.style.width = `${Math.round(p * 100)}%`));
    etat.textContent = 'Ta vidéo est prête !';
    boutons.innerHTML = '<button class="bouton jaune" data-studio="partager">Partager</button><button class="bouton discret" data-studio="fermer">Fermer</button>';
    boutons.querySelector('[data-studio="partager"]')!.addEventListener('click', async () => {
      const r = await partagerVideo(fichier);
      if (r === 'telecharge') etat.textContent = 'Vidéo enregistrée dans tes téléchargements.';
    });
  } catch (e) {
    console.warn('vidéo', e);
    etat.textContent = 'Ce téléphone ne sait pas fabriquer la vidéo. Essaie depuis un autre téléphone.';
    boutons.innerHTML = '<button class="bouton discret" data-studio="fermer">Fermer</button>';
  }
  boutons.querySelector('[data-studio="fermer"]')?.addEventListener('click', fermer);
}
