// « L'Imposteur » : chacun voit son mot en secret, sauf l'imposteur qui en a un autre (et ne le sait pas).
// Indices à l'oral, puis vote secret. 3 pts à l'imposteur s'il survit, sinon 1 pt à chaque bon vote.
// 2 à 4 manches selon le format. Retiré automatiquement à 3 joueurs.
import paires from '../data/imposteur.json';
import { auHasard, esc, melanger } from '../outils';
import { pointsDePlace, resultatImposteur } from '../score';
import { attenteDes, bulle, chrono } from '../ecrans/commun';
import { etapeTerminee, reponsesDe, type ContexteHote, type EtatDeBase, type MiniJeu, selonFormat } from './interface';

const NB_MANCHES: [number, number, number] = [2, 3, 4]; // Courte, Normale, Longue
const DUREE_INDICES = 150_000;
const DUREE_VOTE = 45_000;

interface Etat extends EtatDeBase {
  phase: 'indices' | 'vote' | 'resultat';
  numeroJeu: number;
  manche: number;
  total?: number; // nombre de manches (selon le format)
  theme: string;
  ordre: string[]; // ordre de parole
  dejaImposteurs: string[];
  pairesJouees: string[];
  // Révélé au résultat seulement :
  imposteur?: string;
  mots?: { groupe: string; imposteur: string };
  votes?: Record<string, string>;
  gagnes?: Record<string, number>;
  cumul: Record<string, number>;
}

const etapeDe = (e: Pick<Etat, 'numeroJeu' | 'manche'>, phase: string) => `imposteur-${e.numeroJeu}-${e.manche}-${phase}`;

/** Prépare une manche : tire la paire et l'imposteur, distribue les mots en secret. */
function nouvelleManche(ctx: ContexteHote, base: Omit<Etat, 'etape' | 'phase' | 'theme' | 'ordre'>) {
  const paire = auHasard(paires.filter((p) => !base.pairesJouees.includes(p.id)), ctx.hasard);
  const [groupe, autre] = melanger(paire.mots, ctx.hasard);
  const candidats = ctx.uids.filter((u) => !base.dejaImposteurs.includes(u));
  const imposteur = auHasard(candidats.length ? candidats : ctx.uids, ctx.hasard);
  const ecritures: Record<string, unknown> = { 'prive/imposteur': { uid: imposteur, groupe, imposteur: autre } };
  for (const u of ctx.uids) ecritures[`motsImposteur/${u}`] = u === imposteur ? autre : groupe;
  const etat: Etat = {
    ...base,
    etape: etapeDe(base, 'indices'),
    phase: 'indices',
    theme: paire.theme,
    ordre: melanger(ctx.uids, ctx.hasard),
    pairesJouees: [...base.pairesJouees, paire.id],
    dejaImposteurs: [...base.dejaImposteurs, imposteur],
    fin: ctx.maintenant + DUREE_INDICES,
  };
  return { etat, ecritures };
}

export const imposteur: MiniJeu<Etat> = {
  id: 'imposteur',
  nom: 'L’Imposteur',
  accroche: 'Un seul joueur n’a pas le même mot. Donnez des indices, puis démasquez-le.',
  explication: {
    comment: 'Chacun lit son mot en secret (jeux vidéo, foot, cinéma, séries). Un joueur a un mot différent, et il ne sait pas qu’il est l’imposteur. À tour de rôle, chacun donne un indice à voix haute, puis tout le monde vote en secret.',
    gagner: 'Si l’imposteur s’en sort, il gagne 3 points. S’il est démasqué, chaque joueur qui a voté contre lui gagne 1 point. 2 à 4 manches selon le format.',
    note: 'À partir de 4 joueurs.',
  },
  icone: '<path d="M3 9c3-3 15-3 18 0-1 6-4 9-9 9S4 15 3 9z" fill="currentColor"/><ellipse cx="8.5" cy="11" rx="2" ry="1.4" fill="#0D0A1E"/><ellipse cx="15.5" cy="11" rx="2" ry="1.4" fill="#0D0A1E"/>',
  couleur: '#B18CFF',
  tours: (duree) => `${selonFormat(duree, NB_MANCHES)} manches`,
  autorise: (_n, nbJoueurs) => nbJoueurs >= 4,

  demarrer(ctx) {
    return nouvelleManche(ctx, {
      numeroJeu: ctx.numeroJeu, manche: 0, total: selonFormat(ctx.duree, NB_MANCHES), dejaImposteurs: [], pairesJouees: [],
      cumul: Object.fromEntries(ctx.uids.map((u) => [u, 0])),
    });
  },

  piloter(ctx, etat) {
    if (etat.phase === 'indices' && ctx.maintenant >= (etat.fin ?? 0)) {
      return { etat: { ...etat, phase: 'vote', etape: etapeDe(etat, 'vote'), fin: ctx.maintenant + DUREE_VOTE } };
    }
    if (etat.phase === 'vote' && etapeTerminee(ctx, etat.etape, etat.fin)) {
      const secret = ctx.prive.imposteur as { uid: string; groupe: string; imposteur: string } | undefined;
      if (!secret) return null;
      const votes = Object.fromEntries(
        Object.entries(reponsesDe<{ cible: string }>(ctx, etat.etape)).filter(([u, r]) => r.cible !== u && ctx.uids.includes(r.cible)).map(([u, r]) => [u, r.cible]),
      );
      const gagnes = resultatImposteur(votes, secret.uid, ctx.uids);
      const cumul = { ...etat.cumul };
      for (const [u, g] of Object.entries(gagnes)) cumul[u] = (cumul[u] ?? 0) + g;
      return {
        etat: { ...etat, phase: 'resultat', imposteur: secret.uid, mots: { groupe: secret.groupe, imposteur: secret.imposteur }, votes, gagnes, cumul, fin: undefined },
      };
    }
    return null;
  },

  commande(ctx, etat, valeur) {
    if (valeur === 'voter' && etat.phase === 'indices') return { etat: { ...etat, fin: ctx.maintenant } };
    if (valeur !== 'suivant' || etat.phase !== 'resultat') return null;
    if (etat.manche + 1 >= (etat.total ?? NB_MANCHES[0])) {
      const nettoyage = Object.fromEntries([...ctx.uids.map((u) => [`motsImposteur/${u}`, null]), ['prive/imposteur', null]]);
      return { etat, ecritures: nettoyage, fin: { points: pointsDePlace(etat.cumul), sorte: 'place' } };
    }
    const { imposteur: _i, mots: _m, votes: _v, gagnes: _g, ...reste } = etat;
    return nouvelleManche(ctx, { ...reste, manche: etat.manche + 1 });
  },

  ecran(v) {
    const e = v.etat;
    const prenom = (u: string) => esc(v.joueurs[u]?.prenom ?? '?');
    const entete = `<p class="petit">Manche ${e.manche + 1}/${e.total ?? NB_MANCHES[0]} · thème : <strong>${esc(e.theme)}</strong></p>`;
    if (e.phase === 'indices') {
      return `${chrono(e.fin)}${entete}
        <div class="mission"><p class="petit">Ton mot (appui long pour le lire)</p><p class="texte-secret gros-mot" data-appui>${esc(v.monMot ?? '…')}</p></div>
        ${bulle('Un indice chacun, à voix haute, dans l’ordre. Ni trop clair, ni trop flou. L’un de vous n’a pas le même mot…')}
        <ol class="ordre">${e.ordre.map((u) => `<li style="--c:${v.joueurs[u].couleur}">${prenom(u)}</li>`).join('')}</ol>
        ${v.estHote ? '<button class="bouton jaune bas" data-action="hote-jeu" data-valeur="voter">Passer au vote</button>' : '<p class="attente bas">Quand tout le monde a parlé, l’hôte lance le vote.</p>'}`;
    }
    if (e.phase === 'vote') {
      const monVote = v.maReponse?.etape === e.etape ? (v.maReponse.cible as string) : null;
      return `${chrono(e.fin)}${entete}<h2 class="question">Qui est l’imposteur ?</h2>
        <div class="options deux">${v.uids.filter((u) => u !== v.uid).map((u) => `<button class="option ${monVote === u ? 'actif rose' : ''}" data-action="jeu" data-geste="voter" data-valeur="${u}">${prenom(u)}</button>`).join('')}</div>
        <p class="aide">Vote secret. Tu peux changer d’avis jusqu’à la fin.</p>
        ${attenteDes(v.uids, v.joueurs, (u) => v.ontRepondu.includes(u) || (u === v.uid && !!monVote))}`;
    }
    const imp = e.imposteur!;
    const compte: Record<string, number> = {};
    for (const c of Object.values(e.votes ?? {})) compte[c] = (compte[c] ?? 0) + 1;
    const survit = (e.gagnes?.[imp] ?? 0) > 0;
    const lignes = v.uids
      .sort((a, b) => (compte[b] ?? 0) - (compte[a] ?? 0))
      .map((u) => `<div class="ligne-resultat ${u === imp ? 'imposteur' : ''}"><span class="pastille" style="--c:${v.joueurs[u].couleur};width:26px;height:26px"></span><strong>${prenom(u)}${u === imp ? ' · imposteur' : ''}</strong><span>${compte[u] ?? 0} vote${(compte[u] ?? 0) > 1 ? 's' : ''}</span><span class="pts ${e.gagnes?.[u] ? 'gagne' : ''}">${e.gagnes?.[u] ? `+${e.gagnes[u]}` : '0'}</span></div>`)
      .join('');
    return `${entete}
      <div class="gros-verdict ${survit ? 'ko' : 'ok'}">${prenom(imp)} était l’imposteur${survit ? ' et s’en sort !' : ', démasqué !'}</div>
      <div class="mots"><div><span class="petit">Le groupe</span><strong>${esc(e.mots?.groupe)}</strong></div><div><span class="petit">L’imposteur</span><strong>${esc(e.mots?.imposteur)}</strong></div></div>
      <div class="pile">${lignes}</div>
      ${bulle(survit ? `Bravo ${prenom(imp)}. Menteur professionnel, c’est noté.` : 'Bien joué les détectives. Pour une fois.')}
      ${v.estHote ? `<button class="bouton jaune bas" data-action="hote-jeu" data-valeur="suivant">${e.manche + 1 < (e.total ?? NB_MANCHES[0]) ? 'Manche suivante' : 'Voir le classement'}</button>` : '<p class="attente bas">L’hôte passe à la suite.</p>'}`;
  },

  gestes: {
    async voter(el, o) {
      await o.repondre({ cible: el.dataset.valeur });
    },
  },
};
