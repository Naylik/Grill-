// « Dessin téléphone arabe » : chaque joueur reçoit une phrase et la dessine au doigt. Le dessin passe au suivant,
// qui devine ce que c'est ; sa réponse passe au suivant, qui la dessine… Personne ne voit sa propre chaîne.
// À la fin, on déroule chaque chaîne : chacun vote pour le dessin le plus drôle et dit si le sens est resté.
// Points internes : 3 au dessin le plus drôle de la partie, 1 à chaque joueur d'une chaîne qui a gardé le sens.
import phrases from '../data/dessins.json';
import { esc, fraisDabord, melanger } from '../outils';
import { majoriteOui, pointsDePlace } from '../score';
import { attenteDes, chrono } from '../ecrans/commun';
import { COULEURS, GOMME, outil, toileAVoir, traitsDe, type Trait } from '../dessin';
import { etapeTerminee, reponsesDe, selonFormat, type EtatDeBase, type MiniJeu } from './interface';
import { classementBarres, hud } from './arene';

const NB_ETAPES: [number, number, number] = [3, 4, 5]; // Courte, Normale, Longue (jamais plus que de joueurs)
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
  phase: 'etape' | 'revue' | 'bilan';
  numeroJeu: number;
  ordre: string[]; // les joueurs, dans l'ordre de passage des chaînes
  total: number; // nombre d'étapes
  etapeN: number; // étape en cours (paire : dessin, impaire : devinette)
  phrases: { id: string; texte: string }[]; // une phrase de départ par chaîne
  chaines: Maillon[][]; // chaines[c][s]
  revue?: number; // chaîne en cours de révélation
  affiches?: number; // maillons déjà dévoilés de cette chaîne (1 = la phrase de départ ; l'hôte appuie sur « Suivant »)
  favoris?: Record<string, number>; // « c-s » → votes « le plus drôle »
  sens?: Record<string, boolean>; // chaîne → le sens est resté (vote du groupe)
  score?: Record<string, number>;
}

const etapeDe = (n: number, quoi: string) => `tel-${n}-${quoi}`;
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

/** Points internes : 3 aux auteurs du (des) dessin(s) le(s) plus drôle(s), 1 par chaîne qui garde le sens. */
export function scoreTelephone(e: Pick<Etat, 'ordre' | 'chaines' | 'favoris' | 'sens'>): Record<string, number> {
  const score: Record<string, number> = Object.fromEntries(e.ordre.map((u) => [u, 0]));
  const fav = e.favoris ?? {};
  const max = Math.max(0, ...Object.values(fav));
  if (max > 0) {
    for (const [cle, n] of Object.entries(fav)) {
      if (n !== max) continue;
      const [c, s] = cle.split('-').map(Number);
      const auteur = e.chaines[c]?.[s]?.auteur;
      if (auteur) score[auteur] = (score[auteur] ?? 0) + 3;
    }
  }
  e.chaines.forEach((chaine, c) => {
    if (e.sens?.[c]) for (const m of chaine) score[m.auteur] = (score[m.auteur] ?? 0) + 1;
  });
  return score;
}

export const telephone: MiniJeu<Etat> = {
  id: 'telephone',
  nom: 'Dessin téléphone arabe',
  accroche: 'Dessine, devine, dessine… et regarde le sens partir en fumée.',
  explication: {
    comment: 'Chacun reçoit une phrase et la dessine au doigt. Le dessin passe au joueur suivant, qui devine ce que c’est ; sa réponse passe au suivant, qui la dessine, et ainsi de suite. À la fin, on déroule chaque chaîne sur tous les écrans.',
    gagner: '3 points au dessin le plus drôle (vote du groupe), 1 point à chaque joueur d’une chaîne qui a gardé le sens.',
  },
  icone: '<path d="M4 20l2-6L16 4l4 4-10 10z" fill="currentColor"/><path d="M14 6l4 4" stroke="#0D0A1E" stroke-width="2"/>',
  couleur: '#3B8BFF',
  autorise: (_n, nb) => nb >= 3,
  tours: (duree) => `${selonFormat(duree, NB_ETAPES)} étapes (moins s’il y a peu de joueurs)`,
  contenus: (e) => e.phrases.map((p) => p.id),

  demarrer(ctx) {
    const ordre = melanger(ctx.uids, ctx.hasard);
    const total = Math.min(ordre.length, selonFormat(ctx.duree, NB_ETAPES));
    const choisies = fraisDabord(phrases, ctx.dejaVus, ctx.hasard).slice(0, ordre.length);
    return {
      etat: {
        etape: etapeDe(ctx.numeroJeu, 's0'), phase: 'etape', numeroJeu: ctx.numeroJeu, ordre, total, etapeN: 0,
        phrases: choisies, chaines: ordre.map(() => []), fin: ctx.maintenant + DUREE_DESSIN,
      },
    };
  },

  piloter(ctx, etat) {
    const now = ctx.maintenant;
    const n = etat.ordre.length;
    if (etat.phase === 'etape' && etapeTerminee(ctx, etat.etape, etat.fin)) {
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
      return { etat: { ...etat, chaines, phase: 'revue', revue: 0, affiches: 1, favoris: {}, sens: {}, etape: etapeDe(etat.numeroJeu, 'v0'), fin: undefined } };
    }
    // On ne vote qu'une fois toute la chaîne dévoilée (l'hôte la déroule étape par étape).
    if (etat.phase === 'revue' && toutDevoile(etat) && etapeTerminee(ctx, etat.etape, etat.fin)) {
      const c = etat.revue ?? 0;
      const recues = reponsesDe<{ favori?: string; sens?: boolean }>(ctx, etat.etape);
      const favoris = { ...(etat.favoris ?? {}) };
      for (const r of Object.values(recues)) if (r.favori) favoris[r.favori] = (favoris[r.favori] ?? 0) + 1;
      const sens = { ...(etat.sens ?? {}), [c]: majoriteOui(Object.values(recues).map((r) => r.sens === true)) };
      if (c + 1 < n) return { etat: { ...etat, favoris, sens, revue: c + 1, affiches: 1, etape: etapeDe(etat.numeroJeu, `v${c + 1}`), fin: undefined } };
      const fini = { ...etat, favoris, sens };
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
      return `${hud('DESSIN TÉLÉPHONE ARABE', e.total, e.total, false)}
        <h2 class="question centre-texte">Les meilleurs artistes</h2>
        <div class="pile">${classementBarres(ordre.map((u) => ({ joueur: v.joueurs[u], texte: `${score[u] ?? 0} pts`, part: (score[u] ?? 0) / max, moi: u === v.uid })))}</div>
        <p class="aide">3 pts au dessin le plus drôle, 1 pt par chaîne qui a gardé le sens.</p>`;
    }

    if (e.phase === 'revue') {
      const c = e.revue ?? 0;
      const chaine = e.chaines[c] ?? [];
      const ma = v.local[e.etape] as { envoye?: boolean } | undefined;
      const envoye = v.maReponse?.etape === e.etape || !!ma?.envoye;
      const choix = (v.local[`${e.etape}-choix`] as { favori?: string; sens?: boolean } | undefined) ?? {};
      const devoile = Math.max(0, (e.affiches ?? 1) - 1); // maillons visibles (sans la phrase de départ)
      const complet = toutDevoile(e);
      const maillons = chaine.slice(0, devoile).map((m, s) => {
        const cle = `${c}-${s}`;
        const peutVoter = complet && m.dessin && m.auteur !== v.uid && !envoye;
        return `<div class="maillon ${s === devoile - 1 && !complet ? 'nouveau' : ''}"><span class="auteur-maillon">${nom(m.auteur)} ${m.dessin ? 'a dessiné' : 'a deviné'}</span>
          ${m.dessin ? toileAVoir(`tel-${e.numeroJeu}-${cle}`, m.dessin) : `<p class="devinette-maillon">« ${esc(m.texte ?? '')} »</p>`}
          ${peutVoter ? `<button class="option ${choix.favori === cle ? 'actif jaune' : ''}" data-action="jeu" data-geste="favori" data-valeur="${cle}">Le plus drôle</button>` : ''}</div>`;
      }).join('');
      if (!complet) {
        return `${hud('DESSIN TÉLÉPHONE ARABE', c, n, true)}
          <p class="petit centre-texte">Chaîne ${c + 1}/${n} · étape ${devoile}/${chaine.length}</p>
          <div class="maillon depart"><span class="auteur-maillon">Au départ</span><p class="devinette-maillon">« ${esc(e.phrases[c]?.texte ?? '')} »</p></div>
          ${maillons}
          <div class="pile bas">${v.estHote ? '<button class="bouton jaune" data-action="hote-jeu" data-valeur="suivant">Suivant</button>' : '<p class="attente">L’hôte dévoile la suite…</p>'}</div>`;
      }
      return `${hud('DESSIN TÉLÉPHONE ARABE', c, n, true)}${chrono(e.fin)}
        <p class="petit centre-texte">Chaîne ${c + 1}/${n} · à vous de voter</p>
        <div class="maillon depart"><span class="auteur-maillon">Au départ</span><p class="devinette-maillon">« ${esc(e.phrases[c]?.texte ?? '')} »</p></div>
        ${maillons}
        ${envoye
          ? '<p class="attente">Vote envoyé. On attend les autres…</p>'
          : `<p class="aide gauche">Le sens est resté jusqu’au bout ?</p>
            <div class="options deux">
              <button class="option ${choix.sens === true ? 'actif vert' : ''}" data-action="jeu" data-geste="sens" data-valeur="oui">Oui</button>
              <button class="option ${choix.sens === false ? 'actif rose' : ''}" data-action="jeu" data-geste="sens" data-valeur="non">Non, perdu</button></div>
            <button class="bouton jaune" data-action="jeu" data-geste="voter" data-envoi-auto="${e.fin}">Valider mon vote</button>`}
        ${attenteDes(v.uids, v.joueurs, (u) => v.ontRepondu.includes(u) || (u === v.uid && envoye))}`;
    }

    // Une étape : dessiner, ou deviner.
    const moi = consigne(e, v.uid);
    const fait = v.maReponse?.etape === e.etape || v.local[e.etape] !== undefined;
    const tete = `${hud('DESSIN TÉLÉPHONE ARABE', e.etapeN, e.total, true)}${chrono(e.fin)}`;
    const attente = attenteDes(v.uids, v.joueurs, (u) => v.ontRepondu.includes(u) || (u === v.uid && fait));
    if (fait) return `${tete}<h2 class="question centre-texte">C’est envoyé !</h2><p class="attente">On attend les autres artistes…</p>${attente}`;
    if (estDessin(e.etapeN)) {
      const cle = e.etape;
      return `${tete}
        <p class="aide gauche">Dessine, sans écrire de mots :</p>
        <h2 class="question">« ${esc(moi.texte ?? '')} »</h2>
        <div class="atelier">
          <canvas class="toile-dessin" width="600" height="600" data-dessiner="${cle}" aria-label="Zone de dessin"></canvas>
          <div class="barre-outils">
            <div class="couleurs">${COULEURS.map((c) => `<button class="couleur ${outil.couleur === c ? 'actif' : ''}" style="--k:${c}" data-action="outil" data-couleur="${c}" aria-label="Couleur"></button>`).join('')}</div>
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
      <p class="aide gauche">Qu’est-ce que c’est ? Écris ce que tu vois :</p>
      ${toileAVoir(`tel-${e.numeroJeu}-${moi.c}-${e.etapeN - 1}`, moi.dessin, 'grande')}
      <input class="champ-texte" name="devinette-${e.etape}" maxlength="80" placeholder="Un chat qui fait du ski…" autocomplete="off" data-entree="jeu">
      <button class="bouton jaune" data-action="jeu" data-geste="envoyerTexte" data-envoi-auto="${e.fin}">Valider</button>
      ${attente}`;
  },

  gestes: {
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
    sens(el, o, v) {
      const cle = `${v.etat.etape}-choix`;
      o.local[cle] = { ...((o.local[cle] as Record<string, unknown>) ?? {}), sens: el.dataset.valeur === 'oui' };
      o.rafraichir();
    },
    async voter(_el, o, v) {
      const e = v.etat;
      if (e.phase !== 'revue' || (o.local[e.etape] as { envoye?: boolean } | undefined)?.envoye) return;
      const choix = (o.local[`${e.etape}-choix`] as { favori?: string; sens?: boolean }) ?? {};
      o.local[e.etape] = { envoye: true };
      o.rafraichir();
      await o.repondre({ ...(choix.favori ? { favori: choix.favori } : {}), sens: choix.sens === true });
    },
  },
};
