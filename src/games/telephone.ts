// « Dessin à la chaîne » : chaque joueur reçoit une phrase et la dessine au doigt. Le dessin passe au suivant,
// qui devine ce que c'est ; sa réponse passe au suivant, qui la dessine… Personne ne voit sa propre chaîne.
// À la fin, on déroule chaque chaîne : chacun dit quelles devinettes sont justes et vote pour le dessin le plus drôle.
// Points internes : devinette juste = 1 pt au dessinateur et 1 pt au devineur ; 1 pt au dessin le plus drôle de chaque chaîne.
import phrases from '../data/dessins.json';
import { esc, fraisDabord, melanger } from '../outils';
import { pointsDePlace } from '../score';
import { attenteDes, chrono } from '../ecrans/commun';
import { brouillons } from '../ui';
import { COULEURS, GOMME, outil, sablier, toileAVoir, traitsDe, type Trait } from '../dessin';
import { etapeTerminee, reponsesDe, selonFormat, type ContexteHote, type EtatDeBase, type MiniJeu } from './interface';
import { classementBarres, hud } from './arene';

const NB_ETAPES: [number, number, number] = [3, 4, 5]; // Courte, Normale, Longue (jamais plus que de joueurs)
const DUREE_PHRASE = 40_000;
export const REACTIONS = ['😂', '🔥', '💀', '👏'];
const DUREE_DESSIN = 60_000;
const DUREE_DEVINETTE = 35_000;
const DUREE_VOTE = 45_000;
const DUREE_BILAN = 7_000;

interface Maillon {
  auteur: string;
  dessin?: Trait[];
  texte?: string;
}

interface Etat extends EtatDeBase {
  phase: 'phrase' | 'etape' | 'revue' | 'bilan';
  numeroJeu: number;
  ordre: string[]; // les joueurs, dans l'ordre de passage des chaînes
  total: number; // nombre d'étapes
  etapeN: number; // étape en cours (paire : dessin, impaire : devinette)
  phrases: { id?: string; texte: string; auteur?: string }[]; // une phrase de départ par chaîne (écrite par un joueur, ou du jeu)
  chaines: Maillon[][]; // chaines[c][s]
  revue?: number; // chaîne en cours de révélation
  affiches?: number; // maillons déjà dévoilés de cette chaîne (1 = la phrase de départ ; l'hôte appuie sur « Suivant »)
  favoris?: Record<string, number>; // « c-s » → votes « le plus drôle »
  reussis?: Record<string, boolean>; // « c-s » (une devinette) → bien devinée (vote du groupe)
  score?: Record<string, number>;
}

const etapeDe = (n: number, quoi: string) => `tel-${n}-${quoi}`;
/** On attend tout le monde jusqu'au bout du chrono, même un téléphone qui décroche un instant (mise en veille,
 *  appli en arrière-plan) : sinon sa phrase ou son dessin serait sauté. */
const tousAttendus = (ctx: ContexteHote): ContexteHote => ({ ...ctx, connectes: ctx.uids });
const estDessin = (s: number) => s % 2 === 0;
/** Chaîne sur laquelle travaille le joueur n° p à l'étape s (chacun avance d'une chaîne à chaque étape). */
export const chaineDe = (p: number, s: number, n: number): number => (((p - s) % n) + n) % n;

const toutDevoile = (e: Etat): boolean => (e.affiches ?? 1) >= (e.chaines[e.revue ?? 0]?.length ?? 0) + 1;

/** Ce que le joueur doit dessiner ou deviner : la phrase de départ, ou le maillon d'avant. */
function consigne(e: Etat, uid: string): { c: number; texte?: string; dessin?: Trait[] } {
  const p = e.ordre.indexOf(uid);
  const c = chaineDe(p, e.etapeN, e.ordre.length);
  if (e.etapeN === 0) return { c, texte: e.phrases[c].texte };
  const avant = e.chaines[c]?.[e.etapeN - 1];
  return estDessin(e.etapeN) ? { c, texte: avant?.texte || '…' } : { c, dessin: avant?.dessin ?? [] };
}

/**
 * Une devinette (étape impaire) : tout le monde la juge, sauf celui qui l'a écrite (le dessinateur d'avant vote aussi :
 * à 4 joueurs, il resterait sinon 2 juges seulement ; décision de Kilyan du 23/11).
 */
export const jugesDe = (chaine: Maillon[], s: number, votants: string[]): string[] =>
  votants.filter((u) => u !== chaine[s]?.auteur);

/** Devinette jugée juste : au moins la moitié des juges disent oui (égalité = juste). */
export const devinetteJuste = (votes: boolean[]): boolean => votes.length > 0 && votes.filter(Boolean).length * 2 >= votes.length;

/**
 * Points internes : chaque devinette jugée juste rapporte 1 pt au devineur et 1 pt au dessinateur d'avant ;
 * le dessin le plus drôle de chaque chaîne rapporte 1 pt (à tous les ex æquo).
 */
export function scoreTelephone(e: Pick<Etat, 'ordre' | 'chaines' | 'favoris' | 'reussis'>): Record<string, number> {
  const score: Record<string, number> = Object.fromEntries(e.ordre.map((u) => [u, 0]));
  const plus = (u?: string) => {
    if (u) score[u] = (score[u] ?? 0) + 1;
  };
  for (const [cle, ok] of Object.entries(e.reussis ?? {})) {
    if (!ok) continue;
    const [c, s] = cle.split('-').map(Number);
    plus(e.chaines[c]?.[s]?.auteur);
    plus(e.chaines[c]?.[s - 1]?.auteur);
  }
  e.chaines.forEach((_, c) => {
    const votes = Object.entries(e.favoris ?? {}).filter(([cle]) => Number(cle.split('-')[0]) === c);
    const max = Math.max(0, ...votes.map(([, n]) => n));
    if (max > 0) for (const [cle, n] of votes) if (n === max) plus(e.chaines[c]?.[Number(cle.split('-')[1])]?.auteur);
  });
  return score;
}

/** Le dessin qui a reçu le plus de votes « le plus drôle » de toute la partie, avec son tampon. */
function chefDoeuvre(e: Etat, joueurs: Record<string, { prenom: string }>): string {
  const [cle, votes] = Object.entries(e.favoris ?? {}).sort((a, b) => b[1] - a[1])[0] ?? [];
  if (!cle || !votes) return '';
  const [c, s] = cle.split('-').map(Number);
  const m = e.chaines[c]?.[s];
  if (!m?.dessin) return '';
  return `<div class="chef-doeuvre"><div class="cadre-album">${toileAVoir(`tel-${e.numeroJeu}-chef`, m.dessin, '', true)}</div>
    <span class="tampon-chef">CHEF-D’ŒUVRE</span>
    <p class="aide">par <strong>${esc(joueurs[m.auteur]?.prenom ?? '?')}</strong> · ${votes} vote${votes > 1 ? 's' : ''} « le plus drôle »</p></div>`;
}

export const telephone: MiniJeu<Etat> = {
  id: 'telephone',
  nom: 'Dessin à la chaîne',
  accroche: 'Dessine, devine, dessine… et regarde le sens partir en fumée.',
  explication: {
    comment: 'Chacun reçoit une phrase et la dessine au doigt. Le dessin passe au joueur suivant, qui devine ce que c’est ; sa réponse passe au suivant, qui la dessine, et ainsi de suite. À la fin, on déroule chaque chaîne sur tous les écrans.',
    gagner: 'Chaque devinette jugée juste par le groupe rapporte 1 point au devineur et 1 point au dessinateur. Le dessin le plus drôle de chaque chaîne rapporte 1 point.',
  },
  icone: '<path d="M4 20l2-6L16 4l4 4-10 10z" fill="currentColor"/><path d="M14 6l4 4" stroke="#0D0A1E" stroke-width="2"/>',
  couleur: '#3B8BFF',
  autorise: (_n, nb) => nb >= 3,
  tours: (duree) => `${selonFormat(duree, NB_ETAPES)} étapes (moins s’il y a peu de joueurs)`,
  contenus: (e) => e.phrases.filter((p) => !p.auteur && p.id).map((p) => p.id!),

  demarrer(ctx) {
    const ordre = melanger(ctx.uids, ctx.hasard);
    // Chacun écrit d'abord la phrase d'une chaîne : il reste donc un joueur de moins pour dessiner et deviner
    // (comme ça, personne ne retombe sur la phrase qu'il a écrite).
    const total = Math.min(ordre.length - 1, selonFormat(ctx.duree, NB_ETAPES));
    // Phrases du jeu, en secours pour ceux qui n'écrivent rien.
    const choisies = fraisDabord(phrases, ctx.dejaVus, ctx.hasard).slice(0, ordre.length);
    return {
      etat: {
        etape: etapeDe(ctx.numeroJeu, 'phrase'), phase: 'phrase', numeroJeu: ctx.numeroJeu, ordre, total, etapeN: 0,
        phrases: choisies, chaines: ordre.map(() => []), fin: ctx.maintenant + DUREE_PHRASE,
      },
    };
  },

  piloter(ctx, etat) {
    const now = ctx.maintenant;
    const n = etat.ordre.length;
    if (etat.phase === 'phrase' && etapeTerminee(tousAttendus(ctx), etat.etape, etat.fin)) {
      // Le joueur n° p a écrit la phrase de la chaîne p+1 (celle qu'il ne dessinera jamais).
      const recues = reponsesDe<{ texte?: string }>(ctx, etat.etape);
      const phrasesFinales = etat.phrases.map((secours, c) => {
        const auteur = etat.ordre[(c - 1 + n) % n];
        const texte = String(recues[auteur]?.texte ?? '').trim().slice(0, 80);
        return texte ? { texte, auteur } : secours;
      });
      return { etat: { ...etat, phrases: phrasesFinales, phase: 'etape', etapeN: 0, etape: etapeDe(etat.numeroJeu, 's0'), fin: now + DUREE_DESSIN } };
    }
    if (etat.phase === 'etape' && etapeTerminee(tousAttendus(ctx), etat.etape, etat.fin)) {
      // Chacun a rendu son dessin ou sa devinette : on l'ajoute à sa chaîne.
      const recues = reponsesDe<{ dessin?: Trait[]; texte?: string }>(ctx, etat.etape);
      const chaines = etat.ordre.map((_, c) => [...(etat.chaines?.[c] ?? [])]);
      etat.ordre.forEach((u, p) => {
        const c = chaineDe(p, etat.etapeN, n);
        const r = recues[u];
        chaines[c][etat.etapeN] = estDessin(etat.etapeN)
          ? { auteur: u, dessin: Array.isArray(r?.dessin) ? r.dessin : [] }
          : { auteur: u, texte: String(r?.texte ?? '').trim().slice(0, 80) || '???' };
      });
      const suivante = etat.etapeN + 1;
      if (suivante < etat.total) {
        return { etat: { ...etat, chaines, etapeN: suivante, etape: etapeDe(etat.numeroJeu, `s${suivante}`), fin: now + (estDessin(suivante) ? DUREE_DESSIN : DUREE_DEVINETTE) } };
      }
      return { etat: { ...etat, chaines, phase: 'revue', revue: 0, affiches: 1, favoris: {}, reussis: {}, etape: etapeDe(etat.numeroJeu, 'v0'), fin: undefined } };
    }
    // On ne vote qu'une fois toute la chaîne dévoilée (l'hôte la déroule étape par étape).
    if (etat.phase === 'revue' && toutDevoile(etat) && etapeTerminee(tousAttendus(ctx), etat.etape, etat.fin)) {
      const c = etat.revue ?? 0;
      const recues = reponsesDe<{ favori?: string; bons?: number[] }>(ctx, etat.etape);
      const favoris = { ...(etat.favoris ?? {}) };
      for (const r of Object.values(recues)) if (r.favori) favoris[r.favori] = (favoris[r.favori] ?? 0) + 1;
      // Chaque devinette : au moins la moitié de ceux qui la jugent (tous sauf son devineur) dit qu'elle est juste.
      const reussis = { ...(etat.reussis ?? {}) };
      const chaine = etat.chaines[c] ?? [];
      for (let s = 1; s < chaine.length; s += 2) {
        const juges = jugesDe(chaine, s, Object.keys(recues));
        reussis[`${c}-${s}`] = devinetteJuste(juges.map((u) => (recues[u]?.bons ?? []).includes(s)));
      }
      if (c + 1 < n) return { etat: { ...etat, favoris, reussis, revue: c + 1, affiches: 1, etape: etapeDe(etat.numeroJeu, `v${c + 1}`), fin: undefined } };
      const fini = { ...etat, favoris, reussis };
      return { etat: { ...fini, phase: 'bilan', score: scoreTelephone(fini), fin: now + DUREE_BILAN } };
    }
    if (etat.phase === 'bilan' && now >= (etat.fin ?? 0)) {
      const score = etat.score ?? scoreTelephone(etat);
      return { etat, fin: { points: pointsDePlace(score), sorte: 'place' } };
    }
    return null;
  },

  // L'hôte dévoile la chaîne étape par étape ; quand tout est dévoilé, le vote commence (45 s).
  commande(ctx, etat, valeur) {
    if (valeur !== 'suivant' || etat.phase !== 'revue' || toutDevoile(etat)) return null;
    const affiches = (etat.affiches ?? 1) + 1;
    const fini = affiches >= (etat.chaines[etat.revue ?? 0]?.length ?? 0) + 1;
    return { etat: { ...etat, affiches, fin: fini ? ctx.maintenant + DUREE_VOTE : undefined } };
  },

  ecran(v) {
    const e = v.etat;
    const n = e.ordre.length;
    const nom = (u: string) => esc(v.joueurs[u]?.prenom ?? '?');

    if (e.phase === 'bilan') {
      const score = e.score ?? {};
      const ordre = [...v.uids].sort((a, b) => (score[b] ?? 0) - (score[a] ?? 0));
      const max = Math.max(1, ...ordre.map((u) => score[u] ?? 0));
      return `${hud('DESSIN À LA CHAÎNE', e.total, e.total, false)}
        ${chefDoeuvre(e, v.joueurs)}
        <h2 class="question centre-texte">Les meilleurs artistes</h2>
        <div class="pile">${classementBarres(ordre.map((u) => ({ joueur: v.joueurs[u], texte: `${score[u] ?? 0} pts`, part: (score[u] ?? 0) / max, moi: u === v.uid })))}</div>
        <p class="aide">Devinette juste : 1 pt au devineur et 1 pt au dessinateur. Dessin le plus drôle de chaque chaîne : 1 pt.</p>`;
    }

    const avatar = (u: string) => `<span class="avatar-album" style="--c:${v.joueurs[u]?.couleur ?? '#888'}">${esc((v.joueurs[u]?.prenom ?? '?').slice(0, 1))}</span>`;
    // À qui part ma feuille : le joueur suivant dans l'ordre (sauf à la dernière étape : elle rejoint l'album).
    const suivant = () => {
      const p = e.ordre.indexOf(v.uid);
      const dernier = e.phase === 'etape' && e.etapeN + 1 >= e.total;
      return dernier ? '' : nom(e.ordre[(p + 1) % n]);
    };
    const envolee = (titre: string) => `<div class="feuille-envolee" aria-hidden="true"><i></i></div>
      <h2 class="question centre-texte">${titre}</h2>
      <p class="attente">${suivant() ? `Ta feuille part chez <strong>${suivant()}</strong>…` : 'Ta feuille rejoint l’album…'}</p>`;

    if (e.phase === 'revue') {
      const c = e.revue ?? 0;
      const chaine = e.chaines[c] ?? [];
      const ma = v.local[e.etape] as { envoye?: boolean } | undefined;
      const envoye = v.maReponse?.etape === e.etape || !!ma?.envoye;
      const choix = (v.local[`${e.etape}-choix`] as { favori?: string; bons?: number[] } | undefined) ?? {};
      const devoile = Math.max(0, (e.affiches ?? 1) - 1); // maillons visibles (sans la phrase de départ)
      const complet = toutDevoile(e);
      const depart = e.phrases[c];
      const album = `<div class="album">
        <div class="bulle-album ecrit">${depart?.auteur ? avatar(depart.auteur) : '<span class="avatar-album jeu">?</span>'}
          <div class="contenu-album"><span class="qui-album">${depart?.auteur ? `${nom(depart.auteur)} a écrit` : 'Phrase du jeu'}</span><p class="texte-album">« ${esc(depart?.texte ?? '')} »</p></div></div>
        ${chaine.slice(0, devoile).map((m, s) => {
          const cle = `${c}-${s}`;
          const peutVoter = complet && m.dessin && m.auteur !== v.uid && !envoye;
          const peutJuger = (i: number) => complet && !m.dessin && !envoye && jugesDe(chaine, i, [v.uid]).length > 0;
          return `<div class="bulle-album ${m.dessin ? 'dessine' : 'devine'} ${s === devoile - 1 && !complet ? 'nouveau' : ''}">${avatar(m.auteur)}
            <div class="contenu-album"><span class="qui-album">${nom(m.auteur)} ${m.dessin ? 'a dessiné' : 'a deviné'}</span>
            ${m.dessin ? `<div class="cadre-album">${toileAVoir(`tel-${e.numeroJeu}-${cle}`, m.dessin, '', true)}</div>` : `<p class="texte-album">« ${esc(m.texte ?? '')} »</p>`}
            ${peutVoter ? `<button class="vote-drole ${choix.favori === cle ? 'actif' : ''}" data-action="jeu" data-geste="favori" data-valeur="${cle}">${choix.favori === cle ? '★ Le plus drôle' : '☆ Le plus drôle'}</button>` : ''}
            ${peutJuger(s) ? `<button class="vote-bien ${(choix.bons ?? []).includes(s) ? 'actif' : ''}" data-action="jeu" data-geste="bien" data-valeur="${s}">${(choix.bons ?? []).includes(s) ? '👍 Bien deviné !' : '👍 Bien deviné ?'}</button>` : ''}
            ${complet && !m.dessin && m.auteur === v.uid ? '<span class="pas-de-vote">Ta devinette : les autres jugent</span>' : ''}</div></div>`;
        }).join('')}
      </div>`;
      const reactions = `<div class="reactions" aria-label="Réagir">${REACTIONS.map((r, i) => `<button class="reaction" data-action="jeu" data-geste="reagir" data-valeur="${i}" aria-label="Réagir ${r}">${r}</button>`).join('')}</div>`;
      if (!complet) {
        return `${hud('DESSIN À LA CHAÎNE', c, n, true)}
          <p class="petit centre-texte">L’ALBUM · CHAÎNE ${c + 1}/${n}</p>
          ${album}${reactions}
          <div class="pile bas">${v.estHote
            ? `<p class="aide">C’est toi qui tournes les pages de l’album, pour tout le monde. Les votes s’ouvrent à la dernière page.</p><button class="bouton jaune" data-action="hote-jeu" data-valeur="suivant">Montrer la suite (${devoile + 1}/${chaine.length})</button>`
            : `<p class="attente">C’est l’hôte qui tourne les pages de l’album (${devoile}/${chaine.length})… Le vote arrive à la fin de la chaîne.</p>`}</div>`;
      }
      return `${hud('DESSIN À LA CHAÎNE', c, n, true)}${chrono(e.fin)}
        <p class="petit centre-texte">L’ALBUM · CHAÎNE ${c + 1}/${n} · À VOUS DE VOTER</p>
        ${album}${reactions}
        ${envoye
          ? '<p class="attente">Vote envoyé. On attend les autres…</p>'
          : `<p class="aide gauche">Touche 👍 sous chaque devinette juste, et ☆ sur le dessin le plus drôle.</p>
            <button class="bouton jaune" data-action="jeu" data-geste="voter" data-envoi-auto="${e.fin}">Valider mon vote</button>`}
        ${attenteDes(v.uids, v.joueurs, (u) => v.ontRepondu.includes(u) || (u === v.uid && envoye))}`;
    }

    if (e.phase === 'phrase') {
      const fait = v.maReponse?.etape === e.etape || v.local[e.etape] !== undefined;
      const attente = attenteDes(v.uids, v.joueurs, (u) => v.ontRepondu.includes(u) || (u === v.uid && fait));
      const tete = hud('DESSIN À LA CHAÎNE', 0, e.total + 1, true);
      if (fait) return `${tete}${envolee('Phrase envoyée !')}${attente}`;
      return `${tete}
        <div class="atelier-papier">
          <div class="entete-atelier">${sablier(e.fin, DUREE_PHRASE)}<div class="consigne-atelier"><span>À TOI D’ÉCRIRE</span><strong>Une phrase à faire dessiner</strong></div></div>
          <div class="feuille note arrive"><i class="scotch g"></i><i class="scotch d"></i>
            <textarea class="ecriture" name="phrase-${e.etape}" maxlength="80" rows="3" placeholder="Kilyan qui fait du ski sur une pizza">${esc(brouillons[`phrase-${e.etape}`] ?? '')}</textarea>
          </div>
          <p class="aide">Drôle, absurde, sur quelqu’un de la table… Sans phrase, le jeu en choisit une.</p>
        </div>
        <button class="bouton discret" data-action="jeu" data-geste="idee">Une idée au hasard</button>
        <button class="bouton jaune" data-action="jeu" data-geste="envoyerPhrase" data-envoi-auto="${e.fin}">Valider ma phrase</button>
        ${attente}`;
    }

    // Une étape : dessiner, ou deviner.
    const moi = consigne(e, v.uid);
    const fait = v.maReponse?.etape === e.etape || v.local[e.etape] !== undefined;
    const tete = hud('DESSIN À LA CHAÎNE', e.etapeN, e.total, true);
    const attente = attenteDes(v.uids, v.joueurs, (u) => v.ontRepondu.includes(u) || (u === v.uid && fait));
    if (fait) return `${tete}${envolee(estDessin(e.etapeN) ? 'Dessin envoyé !' : 'Réponse envoyée !')}${attente}`;
    if (estDessin(e.etapeN)) {
      const cle = e.etape;
      return `${tete}
        <div class="atelier-papier">
          <div class="entete-atelier">${sablier(e.fin, DUREE_DESSIN)}<div class="consigne-atelier"><span>À DESSINER · SANS ÉCRIRE</span><strong>« ${esc(moi.texte ?? '')} »</strong></div></div>
          <div class="feuille arrive"><i class="scotch g"></i><i class="scotch d"></i>
            <canvas class="toile-dessin" width="600" height="600" data-dessiner="${cle}" aria-label="Zone de dessin"></canvas></div>
          <div class="trousse">${COULEURS.map((c) => `<button class="feutre ${outil.couleur === c ? 'actif' : ''}" style="--k:${c}" data-action="outil" data-couleur="${c}" aria-label="Feutre"><i></i></button>`).join('')}</div>
          <div class="reglages-atelier">
            <div class="epaisseurs">${[1, 2, 3].map((w) => `<button class="epaisseur ${outil.epaisseur === w ? 'actif' : ''}" style="--t:${6 + w * 5}px" data-action="outil" data-epaisseur="${w}" aria-label="${['Fin', 'Moyen', 'Gros'][w - 1]}"><i></i></button>`).join('')}</div>
            <div class="actions-dessin">
              <button class="outil-dessin ${outil.couleur === GOMME ? 'actif' : ''}" data-action="outil" data-couleur="${GOMME}">Gomme</button>
              <button class="outil-dessin" data-action="outil" data-annuler="${cle}">Annuler</button>
              <button class="outil-dessin" data-action="outil" data-effacer="${cle}">Effacer</button>
            </div>
          </div>
        </div>
        <button class="bouton jaune" data-action="jeu" data-geste="envoyerDessin" data-envoi-auto="${e.fin}">J’ai fini</button>
        ${attente}`;
    }
    return `${tete}
      <div class="atelier-papier">
        <div class="entete-atelier">${sablier(e.fin, DUREE_DEVINETTE)}<div class="consigne-atelier"><span>À DEVINER</span><strong>Qu’est-ce que c’est ?</strong></div></div>
        <div class="feuille arrive"><i class="scotch g"></i><i class="scotch d"></i>${toileAVoir(`tel-${e.numeroJeu}-${moi.c}-${e.etapeN - 1}`, moi.dessin)}</div>
        <input class="champ-texte etiquette-devinette" name="devinette-${e.etape}" maxlength="80" placeholder="Un chat qui fait du ski…" autocomplete="off" value="${esc(brouillons[`devinette-${e.etape}`] ?? '')}">
      </div>
      <button class="bouton jaune" data-action="jeu" data-geste="envoyerTexte" data-envoi-auto="${e.fin}">Valider</button>
      ${attente}`;
  },

  gestes: {
    // Réaction en direct : un compteur partagé ; chaque téléphone fait s'envoler l'emoji quand il augmente.
    async reagir(el, o, v) {
      await o.incrementer(`reac-${v.etat.etape}-${el.dataset.valeur}`);
    },
    idee(_el, _o, v) {
      const champ = document.querySelector<HTMLTextAreaElement>(`textarea[name="phrase-${v.etat.etape}"]`);
      const idee = phrases[Math.floor(Math.random() * phrases.length)].texte;
      brouillons[`phrase-${v.etat.etape}`] = idee;
      if (champ) champ.value = idee;
    },
    async envoyerPhrase(_el, o, v) {
      const e = v.etat;
      if (e.phase !== 'phrase' || o.local[e.etape] !== undefined) return;
      const texte = (document.querySelector<HTMLTextAreaElement>(`textarea[name="phrase-${e.etape}"]`)?.value ?? '').trim().slice(0, 80);
      o.local[e.etape] = true;
      o.rafraichir();
      await o.repondre({ texte });
    },
    async envoyerDessin(_el, o, v) {
      const e = v.etat;
      if (e.phase !== 'etape' || o.local[e.etape] !== undefined) return;
      o.local[e.etape] = true;
      o.rafraichir();
      await o.repondre({ dessin: traitsDe(e.etape) });
    },
    async envoyerTexte(_el, o, v) {
      const e = v.etat;
      if (e.phase !== 'etape' || o.local[e.etape] !== undefined) return;
      const champ = document.querySelector<HTMLInputElement>(`input[name="devinette-${e.etape}"]`);
      const texte = (champ?.value ?? '').trim().slice(0, 80);
      o.local[e.etape] = true;
      o.rafraichir();
      await o.repondre({ texte: texte || '???' });
    },
    favori(el, o, v) {
      const cle = `${v.etat.etape}-choix`;
      const choix = (o.local[cle] as Record<string, unknown>) ?? {};
      o.local[cle] = { ...choix, favori: choix.favori === el.dataset.valeur ? undefined : el.dataset.valeur };
      o.rafraichir();
    },
    bien(el, o, v) {
      const cle = `${v.etat.etape}-choix`;
      const choix = (o.local[cle] as { bons?: number[] }) ?? {};
      const s = Number(el.dataset.valeur);
      const bons = choix.bons ?? [];
      o.local[cle] = { ...choix, bons: bons.includes(s) ? bons.filter((x) => x !== s) : [...bons, s] };
      o.rafraichir();
    },
    async voter(_el, o, v) {
      const e = v.etat;
      if (e.phase !== 'revue' || (o.local[e.etape] as { envoye?: boolean } | undefined)?.envoye) return;
      const choix = (o.local[`${e.etape}-choix`] as { favori?: string; bons?: number[] }) ?? {};
      o.local[e.etape] = { envoye: true };
      o.rafraichir();
      await o.repondre({ ...(choix.favori ? { favori: choix.favori } : {}), bons: choix.bons ?? [] });
    },
  },
};
