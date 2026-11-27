// Missions flash : la fenêtre « MISSION FLASH » quand on en reçoit une, et l'étape de vote après chaque jeu.
import { liste as listeAccusations } from '../accusations';
import { S, estHote } from '../etat';
import { esc } from '../outils';
import { POINTS_FLASH, delaiCarteFlash } from '../flash';
import { attenteDes, chrono, pastille } from './commun';

const nom = (u: string) => esc(S.joueurs[u]?.prenom ?? '?');

/** Ma mission flash pour le jeu en cours (tant qu'il n'est pas fini). */
export function maFlashEnCours(): { numero: number; texte: string } | null {
  const d = S.deroule;
  const t = d?.flashTirage;
  const dernierChance = d?.phase === 'flash' && d.flash?.etape === 'grillage';
  if (!d || !t || t.numero !== d.numeroJeu || !(['regles', 'jeu'].includes(d.phase) || dernierChance)) return null;
  const m = S.secrets.flash?.[`j${t.numero}`];
  return m ? { numero: t.numero, texte: m.texte } : null;
}

/** Encart de l'écran des règles, identique pour tout le monde : le même texte flou chez tous (sa longueur ne trahit rien),
 *  le vrai texte n'apparaît qu'en appuyant longtemps, dans un cadre de taille fixe.
 *  Le porteur y lit sa mission ; les autres lisent qu'ils n'en ont pas. Personne ne peut savoir qui en a une. */
export function blocFlash(): string {
  const d = S.deroule;
  if (!d?.flashTirage || d.flashTirage.numero !== d.numeroJeu) return '';
  const f = maFlashEnCours();
  const texte = f ? f.texte : 'Pas de mission flash pour toi ce coup-ci. Ouvre l’œil : quelqu’un en a peut-être une…';
  return `<article class="mission flash bloc-flash"><div class="tags"><span class="tag eclair">⚡ Mission flash</span></div>
    <p class="texte-secret texte-flash-cache" data-appui><span class="flou-commun" aria-hidden="true">Mission flash secrète : cache ton écran avant de la lire, personne ne doit voir</span><span class="vrai-texte">${esc(texte)}</span></p><p class="aide">Cache ton écran et appuie longtemps pour lire</p></article>`;
}

/** Après chaque jeu : les missions flash révélées, le vote du groupe, puis le verdict. */
export function ecranFlash(): string {
  const f = S.deroule?.flash;
  const forcer = estHote() ? '<button class="bouton discret" data-action="hote" data-valeur="forcer">Continuer sans attendre</button>' : '';
  if (f?.etape === 'grillage') {
    const etape = `grille-${f.numero}`;
    const passe = S.maReponse?.etape === etape;
    const ont = S.attente?.etape === etape ? S.attente.uids ?? [] : [];
    const uids = Object.entries(S.joueurs).sort((a, b) => a[1].rejointLe - b[1].rejointLe).map(([u]) => u);
    return `<h2 class="titre-flash">Dernière chance !</h2>
      ${chrono(f.fin)}
      <p class="consigne-tele">Quelqu’un avait peut-être une mission flash pendant ce jeu… ou fait sa mission principale en douce.</p>
      <p class="aide">Appuie sur <strong>GRILLÉ !</strong> en bas à droite pour l’accuser. Vu juste : tu lui voles des points. Raté : −2 pts.</p>
      <div class="pile bas">
        ${passe ? '<p class="attente">Rien à signaler. On attend les autres…</p>' : '<button class="bouton discret" data-action="passerGrillage">Rien à signaler</button>'}
        <p class="compte-rien">${uids.filter((u) => ont.includes(u) || (u === S.uid && passe)).length}/${uids.length} ont dit « Rien à signaler »</p>
        ${attenteDes(uids, S.joueurs, (u) => ont.includes(u) || (u === S.uid && passe))}
        ${forcer}
      </div>`;
  }
  if (!f || f.etape === 'collecte') {
    return `<h2 class="titre-flash">⚡ Missions flash</h2>
      <p class="attente">Qui avait une mission flash pendant ce jeu ?…</p>
      <div class="pile bas">${forcer}</div>`;
  }
  const porteurs = f.porteurs ?? [];
  const devoile = f.etape === 'vote';
  const cartes = porteurs.map((u, rang) => {
    const m = S.revelation[u]?.flash?.[`j${f.numero}`];
    const sujet = `f${f.numero}-${u}`;
    const mon = S.votes[sujet]?.[S.uid];
    const grillee = listeAccusations(S.accusations).some((a) => a.numeroJeu === f.numero && a.cible === u && a.mission?.numero === 100 + f.numero && (a.statut === 'grille' || a.verdict === 'grille'));
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
    return `<article class="carte-flash ${f.etape === 'resultat' ? (f.resultats?.[u] ? 'ok' : 'rate') : ''} ${devoile ? 'devoile' : ''}" style="--delai:${delaiCarteFlash(rang)}ms">
      <div class="proces-qui">${pastille(S.joueurs[u], 34)}<span><strong>${nom(u)}</strong> avait une mission flash</span></div>
      <p class="proces-mission">« ${esc(m?.texte ?? '…')} »</p>
      ${bas}
    </article>`;
  }).join('');
  return `<h2 class="titre-flash">⚡ Missions flash</h2>
    ${f.etape === 'vote' ? '<p class="aide">Pas de chrono : débattez, puis votez. On continue quand tout le monde a voté.</p>' : ''}
    ${devoile ? '<p class="tambour-flash" aria-hidden="true">🥁 Qui avait une mission flash ?…</p>' : ''}
    <div class="pile">${cartes}</div>
    ${f.etape === 'vote' ? `<div class="pile bas">${forcer}</div>` : ''}`;
}
