// « Télépathie » (jeu d'équipe) : des duos tirés au sort. À la 1re manche, chacun écrit un mot en secret ;
// ensuite, chaque duo voit ses deux derniers mots et doit écrire un mot « entre les deux », jusqu'à ce que les deux
// écrivent le même. L'équipe qui y arrive en le moins de manches gagne. Avec un nombre impair de joueurs,
// il reste un arbitre, qui parie en secret au début sur l'équipe gagnante et son nombre de manches.
import { esc, melanger } from '../outils';
import { pointsDePlace } from '../score';
import { attenteDes, chrono } from '../ecrans/commun';
import { brouillons } from '../ui';
import { etapeTerminee, reponsesDe, type EtatDeBase, type MiniJeu } from './interface';
import { classementBarres, hud } from './arene';

const MAX_MANCHES = 8;
const DUREE_PARI = 25_000;
const DUREE_MOT = 35_000;
const DUREE_REVELE = 5_500;
const DUREE_BILAN = 7_000;

interface Etat extends EtatDeBase {
  phase: 'pari' | 'mot' | 'revele' | 'bilan';
  numeroJeu: number;
  equipes: string[][]; // des duos
  arbitre?: string;
  pari?: { equipe: number; manches: number };
  manche: number; // 0, 1, 2…
  mots: Record<string, string[][]>; // équipe → [motA, motB] à chaque manche
  trouve: Record<string, number>; // équipe → nombre de manches pour trouver
  score?: Record<string, number>;
}

const etapeDe = (n: number, quoi: string) => `tele-${n}-${quoi}`;

/** Deux mots identiques ? Sans majuscules, accents, espaces ni article devant (« Le Tigre » = « tigre »). */
export function normaliser(mot: string): string {
  return mot
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, ' ')
    .replace(/^\s*(le|la|les|l|un|une|des|du|de)\s+/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
export const memeMot = (a: string, b: string): boolean => !!normaliser(a) && normaliser(a) === normaliser(b);

/** Duos tirés au sort ; s'il reste quelqu'un, c'est l'arbitre. */
export function formerEquipes(uids: string[], hasard: () => number): { equipes: string[][]; arbitre?: string } {
  const m = melanger(uids, hasard);
  const arbitre = m.length % 2 ? m.pop() : undefined;
  const equipes: string[][] = [];
  for (let i = 0; i < m.length; i += 2) equipes.push([m[i], m[i + 1]]);
  return { equipes, arbitre };
}

/** Scores internes : rang des équipes (moins de manches = mieux), et pari de l'arbitre. */
export function scoreTelepathie(e: Pick<Etat, 'equipes' | 'trouve' | 'arbitre' | 'pari'>): Record<string, number> {
  const manches = (t: number) => e.trouve[t] ?? MAX_MANCHES + 1;
  const valeurs = [...new Set(e.equipes.map((_, t) => manches(t)))].sort((a, b) => a - b);
  const score: Record<string, number> = {};
  e.equipes.forEach((duo, t) => {
    const rang = valeurs.indexOf(manches(t));
    for (const u of duo) score[u] = (valeurs.length - rang) * 2;
  });
  if (e.arbitre) {
    let s = 0;
    const meilleure = valeurs[0];
    if (e.pari && manches(e.pari.equipe) === meilleure && meilleure <= MAX_MANCHES) s += 2;
    if (e.pari && meilleure <= MAX_MANCHES) s += e.pari.manches === meilleure ? 2 : Math.abs(e.pari.manches - meilleure) === 1 ? 1 : 0;
    score[e.arbitre] = s;
  }
  return score;
}

export const telepathie: MiniJeu<Etat> = {
  id: 'telepathie',
  nom: 'Télépathie',
  categorie: 'equipe',
  accroche: 'En duo : trouvez le même mot en le moins de manches.',
  explication: {
    comment: 'Des duos sont tirés au sort. D’abord, chacun écrit un mot en secret. Ensuite, chaque duo voit ses deux mots et doit écrire un mot « entre les deux » (chat + lion → tigre ?), jusqu’à ce que les deux écrivent le même mot. Tous les duos jouent en même temps.',
    gagner: 'L’équipe qui trouve en le moins de manches gagne (8 manches maximum). Avec un nombre impair de joueurs, l’arbitre parie au début sur l’équipe gagnante (+2) et son nombre de manches (+2, ou +1 à une manche près).',
  },
  icone: '<circle cx="8" cy="9" r="5" fill="currentColor"/><circle cx="16" cy="9" r="5" fill="currentColor" opacity=".6"/><path d="M6 16h4v3H6zM14 16h4v3h-4z" fill="currentColor"/>',
  couleur: '#FF8FC8',
  autorise: (_n, nb) => nb >= 4,
  tours: () => `jusqu’à ${MAX_MANCHES} manches`,

  demarrer(ctx) {
    const { equipes, arbitre } = formerEquipes(ctx.uids, ctx.hasard);
    const base = { numeroJeu: ctx.numeroJeu, equipes, ...(arbitre ? { arbitre } : {}), manche: 0, mots: {}, trouve: {} };
    return arbitre
      ? { etat: { ...base, etape: etapeDe(ctx.numeroJeu, 'pari'), phase: 'pari', fin: ctx.maintenant + DUREE_PARI } }
      : { etat: { ...base, etape: etapeDe(ctx.numeroJeu, 'm0'), phase: 'mot', fin: ctx.maintenant + DUREE_MOT } };
  },

  piloter(ctx, etat) {
    const now = ctx.maintenant;
    const e = { ...etat, mots: etat.mots ?? {}, trouve: etat.trouve ?? {} };
    const enJeu = (t: number) => e.trouve[t] === undefined;
    if (e.phase === 'pari' && etapeTerminee(ctx, e.etape, e.fin, e.arbitre ? [e.arbitre] : [])) {
      const r = e.arbitre ? reponsesDe<{ equipe: number; manches: number }>(ctx, e.etape)[e.arbitre] : undefined;
      const pari = r ? { equipe: Number(r.equipe), manches: Number(r.manches) } : undefined;
      return { etat: { ...e, ...(pari ? { pari } : {}), phase: 'mot', etape: etapeDe(e.numeroJeu, 'm0'), fin: now + DUREE_MOT } };
    }
    if (e.phase === 'mot') {
      const joueurs = e.equipes.filter((_, t) => enJeu(t)).flat();
      if (!etapeTerminee(ctx, e.etape, e.fin, joueurs)) return null;
      const recues = reponsesDe<{ mot: string }>(ctx, e.etape);
      const mots = { ...e.mots };
      const trouve = { ...e.trouve };
      e.equipes.forEach((duo, t) => {
        if (!enJeu(t)) return;
        const paire = duo.map((u) => String(recues[u]?.mot ?? '').trim().slice(0, 30) || '…');
        mots[t] = [...(mots[t] ?? []), paire];
        if (memeMot(paire[0], paire[1])) trouve[t] = e.manche + 1;
      });
      return { etat: { ...e, mots, trouve, phase: 'revele', fin: now + DUREE_REVELE } };
    }
    if (e.phase === 'revele' && now >= (e.fin ?? 0)) {
      const fini = e.equipes.every((_, t) => !enJeu(t)) || e.manche + 1 >= MAX_MANCHES;
      if (fini) return { etat: { ...e, phase: 'bilan', score: scoreTelepathie(e), fin: now + DUREE_BILAN } };
      const manche = e.manche + 1;
      return { etat: { ...e, phase: 'mot', manche, etape: etapeDe(e.numeroJeu, `m${manche}`), fin: now + DUREE_MOT } };
    }
    if (e.phase === 'bilan' && now >= (e.fin ?? 0)) {
      return { etat: e, fin: { points: pointsDePlace(e.score ?? scoreTelepathie(e)), sorte: 'place' } };
    }
    return null;
  },

  ecran(v) {
    const e = { ...v.etat, mots: v.etat.mots ?? {}, trouve: v.etat.trouve ?? {} };
    const nom = (u: string) => esc(v.joueurs[u]?.prenom ?? '?');
    const monEquipe = e.equipes.findIndex((d) => d.includes(v.uid));
    const tete = hud('TÉLÉPATHIE', e.manche, MAX_MANCHES, e.phase !== 'bilan');
    const nomEquipe = (t: number) => e.equipes[t].map(nom).join(' & ');
    // Une carte d'équipe : deux ampoules aux couleurs des joueurs, et leurs mots.
    const carte = (t: number, toutes = false) => {
      const duo = e.equipes[t];
      const hist = e.mots[t] ?? [];
      const dernier = hist[hist.length - 1];
      const ok = e.trouve[t] !== undefined;
      const montrer = toutes ? hist : dernier ? [dernier] : [];
      return `<div class="equipe-tele ${ok ? 'connectee' : ''} ${t === monEquipe ? 'moi' : ''}">
        <div class="ampoules">${duo.map((u, k) => `<div class="ampoule" style="--k:${v.joueurs[u]?.couleur}"><span class="bulbe"></span><b>${nom(u)}</b>${dernier ? `<em>${esc(dernier[k])}</em>` : ''}</div>`).join('<span class="arc-tele" aria-hidden="true"></span>')}</div>
        ${ok ? `<p class="tele-ok">TÉLÉPATHIE ! en ${e.trouve[t]} manche${e.trouve[t] > 1 ? 's' : ''}</p>` : ''}
        ${toutes && montrer.length > 1 ? `<div class="histo-tele">${montrer.slice(0, -1).map((p, i) => `<span>${i + 1}. ${esc(p[0])} · ${esc(p[1])}</span>`).join('')}</div>` : ''}
      </div>`;
    };

    if (e.phase === 'bilan') {
      const score = e.score ?? {};
      const ordre = [...v.uids].sort((a, b) => (score[b] ?? 0) - (score[a] ?? 0));
      const max = Math.max(1, ...ordre.map((u) => score[u] ?? 0));
      return `${tete}<h2 class="question centre-texte">Les esprits connectés</h2>
        <div class="pile">${e.equipes.map((_, t) => carte(t, true)).join('')}</div>
        <div class="pile">${classementBarres(ordre.map((u) => ({ joueur: v.joueurs[u], texte: `${score[u] ?? 0} pts${u === e.arbitre ? ' (arbitre)' : ''}`, part: (score[u] ?? 0) / max, moi: u === v.uid })))}</div>`;
    }

    if (e.phase === 'pari') {
      const fait = v.maReponse?.etape === e.etape || v.local[e.etape] !== undefined;
      const choix = (v.local[`${e.etape}-choix`] as { equipe?: number; manches?: number }) ?? {};
      if (v.uid !== e.arbitre) {
        return `${tete}${chrono(e.fin)}<h2 class="question">Les équipes</h2>
          <div class="pile">${e.equipes.map((_, t) => carte(t)).join('')}</div>
          <p class="aide">${nom(e.arbitre!)} est l’arbitre : il parie en secret sur l’équipe gagnante…</p>`;
      }
      return `${tete}${chrono(e.fin)}<h2 class="question">Tu es l’arbitre</h2>
        <p class="aide gauche">Parie en secret : quelle équipe trouvera le même mot en premier, et en combien de manches ?</p>
        ${fait ? '<p class="attente">Pari enregistré.</p>' : `
          <div class="pile">${e.equipes.map((_, t) => `<button class="option ${choix.equipe === t ? 'actif jaune' : ''}" data-action="jeu" data-geste="pariEquipe" data-valeur="${t}">${nomEquipe(t)}</button>`).join('')}</div>
          <div class="manches-pari">${Array.from({ length: MAX_MANCHES }, (_, i) => `<button class="${choix.manches === i + 1 ? 'actif' : ''}" data-action="jeu" data-geste="pariManches" data-valeur="${i + 1}">${i + 1}</button>`).join('')}</div>
          <button class="bouton jaune" data-action="jeu" data-geste="parier" ${choix.equipe === undefined || !choix.manches ? 'disabled' : ''}>Valider mon pari</button>`}`;
    }

    if (e.phase === 'revele') {
      return `${tete}<p class="petit centre-texte">MANCHE ${e.manche + 1} · LES MOTS</p>
        <div class="pile">${e.equipes.map((_, t) => carte(t)).join('')}</div>
        ${e.arbitre ? `<p class="aide">${nom(e.arbitre)} arbitre la partie.</p>` : ''}`;
    }

    // Écrire un mot.
    const fait = v.maReponse?.etape === e.etape || v.local[e.etape] !== undefined;
    const joueurs = e.equipes.filter((_, t) => e.trouve[t] === undefined).flat();
    const attente = attenteDes(joueurs, v.joueurs, (u) => v.ontRepondu.includes(u) || (u === v.uid && fait));
    if (monEquipe < 0 || e.trouve[monEquipe] !== undefined) {
      return `${tete}${chrono(e.fin)}<h2 class="question">${monEquipe < 0 ? 'Tu arbitres' : 'Vous êtes connectés !'}</h2>
        <p class="aide gauche">${monEquipe < 0 ? 'Les duos écrivent en secret…' : 'Regardez les autres équipes galérer.'}</p>
        <div class="pile">${e.equipes.map((_, t) => carte(t, true)).join('')}</div>${attente}`;
    }
    const dernier = (e.mots[monEquipe] ?? []).slice(-1)[0];
    const consigne = dernier
      ? `Trouve un mot entre <strong>« ${esc(dernier[0])} »</strong> et <strong>« ${esc(dernier[1])} »</strong>. Ton partenaire cherche aussi !`
      : `Écris n’importe quel mot. Ton partenaire aussi, en même temps.`;
    const champ = `mot-${e.etape}`;
    return `${tete}${chrono(e.fin)}
      <p class="petit">MANCHE ${e.manche + 1} · AVEC ${e.equipes[monEquipe].filter((u) => u !== v.uid).map(nom).join('')}</p>
      ${carte(monEquipe, true)}
      <p class="aide gauche">${consigne}</p>
      ${fait ? '<p class="attente">Mot envoyé… concentre-toi fort.</p>' : `
        <input class="champ-texte" name="${champ}" maxlength="30" placeholder="Ton mot" autocomplete="off" value="${esc(brouillons[champ] ?? '')}">
        <button class="bouton jaune" data-action="jeu" data-geste="envoyer" data-envoi-auto="${e.fin}">Envoyer mon mot</button>`}
      ${attente}`;
  },

  gestes: {
    pariEquipe(el, o, v) {
      const cle = `${v.etat.etape}-choix`;
      o.local[cle] = { ...(o.local[cle] as object), equipe: Number(el.dataset.valeur) };
      o.rafraichir();
    },
    pariManches(el, o, v) {
      const cle = `${v.etat.etape}-choix`;
      o.local[cle] = { ...(o.local[cle] as object), manches: Number(el.dataset.valeur) };
      o.rafraichir();
    },
    async parier(_el, o, v) {
      const e = v.etat;
      const choix = (o.local[`${e.etape}-choix`] as { equipe?: number; manches?: number }) ?? {};
      if (e.phase !== 'pari' || v.uid !== e.arbitre || o.local[e.etape] !== undefined || choix.equipe === undefined || !choix.manches) return;
      o.local[e.etape] = true;
      o.rafraichir();
      await o.repondre({ equipe: choix.equipe, manches: choix.manches });
    },
    async envoyer(_el, o, v) {
      const e = v.etat;
      if (e.phase !== 'mot' || o.local[e.etape] !== undefined) return;
      const mot = (document.querySelector<HTMLInputElement>(`input[name="mot-${e.etape}"]`)?.value ?? '').trim().slice(0, 30);
      o.local[e.etape] = true;
      o.rafraichir();
      await o.repondre({ mot });
    },
  },
};
