// Missions flash : la fenêtre « MISSION FLASH » quand on en reçoit une, et l'étape de vote après chaque jeu.
import { S, estHote } from '../etat';
import { esc } from '../outils';
import { POINTS_FLASH, VOL_FLASH } from '../flash';
import { jeuParId } from '../games';
import { chrono, pastille } from './commun';

const nom = (u: string) => esc(S.joueurs[u]?.prenom ?? '?');

/** Ma mission flash pour le jeu en cours (tant qu'il n'est pas fini). */
export function maFlashEnCours(): { numero: number; texte: string } | null {
  const d = S.deroule;
  const t = d?.flashTirage;
  if (!d || !t || t.numero !== d.numeroJeu || !['regles', 'jeu'].includes(d.phase)) return null;
  const m = S.secrets.flash?.[`j${t.numero}`];
  return m ? { numero: t.numero, texte: m.texte } : null;
}

/** Fenêtres déjà fermées sur ce téléphone (par jeu). */
export const flashVues = new Set<string>();

/** Fenêtre montrée une fois au porteur, par-dessus tout, quand il reçoit sa mission flash. */
export function fenetreFlash(): string {
  const f = maFlashEnCours();
  const cle = `${S.deroule?.partieId}-${f?.numero}`;
  if (!f || flashVues.has(cle)) return '';
  const jeu = jeuParId(S.deroule?.jeuEnCours);
  return `<div class="proces moi flash-fenetre" role="alertdialog" aria-label="Mission flash"><div class="proces-carte">
    <p class="proces-titre eclair">⚡ MISSION FLASH</p>
    <p class="aide">Rien que pour ${jeu ? esc(jeu.nom) : 'ce jeu'}. Cache ton écran !</p>
    <article class="mission flash"><div class="tags"><span class="tag eclair">Flash · +${POINTS_FLASH} pts</span></div>
      <p class="texte-secret" data-appui>${esc(f.texte)}</p><p class="aide">Appuie longtemps pour lire</p></article>
    <p class="aide gauche">Elle sera révélée à tous juste après le jeu, et le groupe votera. Si quelqu’un te grille avant, il te vole ${VOL_FLASH} pts.</p>
    <button class="bouton jaune" data-action="vuFlash" data-valeur="${cle}">Compris</button>
  </div></div>`;
}

/** Après chaque jeu : les missions flash révélées, le vote du groupe, puis le verdict. */
export function ecranFlash(): string {
  const f = S.deroule?.flash;
  const forcer = estHote() ? '<button class="bouton discret" data-action="hote" data-valeur="forcer">Continuer sans attendre</button>' : '';
  if (!f || f.etape === 'collecte') {
    return `<h2 class="titre-flash">⚡ Missions flash</h2>
      <p class="attente">Qui avait une mission flash pendant ce jeu ?…</p>
      <div class="pile bas">${forcer}</div>`;
  }
  const porteurs = f.porteurs ?? [];
  const cartes = porteurs.map((u) => {
    const m = S.revelation[u]?.flash?.[`j${f.numero}`];
    const sujet = `f${f.numero}-${u}`;
    const mon = S.votes[sujet]?.[S.uid];
    const grillee = Object.values(S.accusations?.[f.numero] ?? {}).some((a) => a?.cible === u && a.mission?.numero === 100 + f.numero && (a.statut === 'grille' || a.verdict === 'grille'));
    let bas = '';
    if (f.etape === 'resultat') {
      const ok = f.resultats?.[u];
      bas = `<p class="verdict-flash ${ok ? 'ok' : 'rate'}">${ok ? `RÉUSSIE · +${POINTS_FLASH} pts` : grillee ? 'GRILLÉE en direct' : 'RATÉE'}</p>`;
    } else if (grillee) {
      bas = '<p class="verdict-flash rate">Grillée en direct : ratée</p>';
    } else if (u === S.uid) {
      bas = '<p class="attente">Le groupe vote…</p>';
    } else {
      bas = `<p class="aide gauche">Mission réussie ?</p>
        <div class="options deux">
          <button class="option ${mon === true ? 'actif vert' : ''}" data-action="voter" data-sujet="${sujet}" data-valeur="true">Réussie</button>
          <button class="option ${mon === false ? 'actif rose' : ''}" data-action="voter" data-sujet="${sujet}" data-valeur="false">Ratée</button></div>`;
    }
    return `<article class="carte-flash ${f.etape === 'resultat' ? (f.resultats?.[u] ? 'ok' : 'rate') : ''}">
      <div class="proces-qui">${pastille(S.joueurs[u], 34)}<span><strong>${nom(u)}</strong> avait une mission flash</span></div>
      <p class="proces-mission">« ${esc(m?.texte ?? '…')} »</p>
      ${bas}
    </article>`;
  }).join('');
  return `<h2 class="titre-flash">⚡ Missions flash</h2>
    ${f.etape === 'vote' ? chrono(f.fin) : ''}
    <div class="pile">${cartes}</div>
    ${f.etape === 'vote' ? `<div class="pile bas">${forcer}</div>` : ''}`;
}
