// « Télépathie » (jeu d'équipe), ambiance voyance : des duos tirés au sort. À chaque manche, l'appli fait 3-2-1 et
// chaque duo CRIE un mot en même temps à table, puis le tape pour valider. 1re manche : n'importe quel mot ; ensuite,
// un mot « entre » les deux derniers mots du duo, jusqu'à dire le même. L'équipe qui y arrive en le moins de manches
// gagne. Mots presque pareils (voiture / auto) : le duo conteste et le groupe vote. Une fois par partie, chaque équipe
// peut saboter une équipe adverse en lui imposant un mot interdit pour la manche suivante.
// Avec un nombre impair de joueurs, il reste un arbitre, qui parie au début sur l'équipe gagnante et son nombre de manches.
import { esc, melanger, pts } from '../outils';
import { majoriteOui, pointsDePlace } from '../score';
import { maintenant } from '../firebase';
import { attenteDes, chrono } from '../ecrans/commun';
import { brouillons } from '../ui';
import { etapeTerminee, reponsesDe, type EtatDeBase, type MiniJeu, DUREE_BILAN, avecSuiteBilan } from './interface';
import { classementBarres, hud } from './arene';

export const MAX_MANCHES = 8;
export const DUREE_DECOMPTE = 4_500; // 3, 2, 1 puis « CRIEZ ! »
const DUREE_MOT = 12_000;
const DUREE_REVELE = 7_500;

interface Interdit {
  mot: string;
  par: number; // équipe qui a saboté
}

interface Etat extends EtatDeBase {
  phase: 'pari' | 'decompte' | 'mot' | 'revele' | 'vote' | 'sabotage' | 'bilan';
  numeroJeu: number;
  equipes: string[][]; // des duos
  arbitre?: string;
  pari?: { equipe: number; manches: number };
  manche: number; // 0, 1, 2…
  mots: Record<string, string[][]>; // équipe → [motA, motB] à chaque manche
  trouve: Record<string, number>; // équipe → nombre de manches pour trouver
  sabotes?: Record<string, boolean>; // équipes qui ont déjà utilisé leur sabotage
  interdits?: Record<string, Interdit[]>; // mots interdits pour la manche en cours
  rates?: Record<string, string>; // équipe → mot interdit prononcé (manche ratée)
  contestes?: number[]; // équipes dont le groupe vote les mots
  score?: Record<string, number>;
}

const etapeDe = (n: number, quoi: string) => `tele-${n}-${quoi}`;

/** Deux mots identiques ? Sans majuscules, accents, article devant, ni pluriel (« Les Tigres » = « tigre »). */
export function normaliser(mot: string): string {
  return mot
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, ' ')
    .replace(/^\s*(le|la|les|l|un|une|des|du|de)\s+/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/([a-z]{3,})[sx]\b/g, '$1');
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
  const manches = (t: number) => e.trouve?.[t] ?? MAX_MANCHES + 1;
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

/** Valeurs par défaut (Firebase efface les listes et objets vides). */
function complet(etat: Etat): Etat {
  return { ...etat, mots: etat.mots ?? {}, trouve: etat.trouve ?? {}, sabotes: etat.sabotes ?? {}, interdits: etat.interdits ?? {}, rates: etat.rates ?? {}, contestes: etat.contestes ?? [] };
}
const enJeu = (e: Etat, t: number) => e.trouve[t] === undefined;
/** Équipes qui peuvent encore saboter : sabotage pas utilisé, et au moins une autre équipe encore en jeu. */
const sabotagesPossibles = (e: Etat) =>
  e.equipes.map((_, t) => t).filter((t) => !e.sabotes?.[t] && e.equipes.some((_, c) => c !== t && enJeu(e, c)));

export const telepathie: MiniJeu<Etat> = {
  id: 'telepathie',
  nom: 'Télépathie',
  categorie: 'equipe',
  accroche: 'En duo : 3, 2, 1… criez le même mot en le moins de manches.',
  explication: {
    comment: 'Des duos sont tirés au sort. À chaque manche, l’appli fait 3-2-1 et chaque duo crie un mot en même temps, puis le tape. D’abord n’importe quel mot ; ensuite, un mot « entre » vos deux derniers mots (chat + lion → tigre ?), jusqu’à dire le même. Une fois par partie, chaque équipe peut saboter une autre équipe en lui imposant un mot interdit.',
    gagner: 'L’équipe qui trouve en le moins de manches gagne (8 maximum). Mots presque pareils : le groupe vote. Avec un nombre impair de joueurs, l’arbitre parie au début sur l’équipe gagnante (+2) et son nombre de manches (+2, ou +1 à une manche près).',
  },
  icone: '<circle cx="12" cy="10" r="7.5" fill="currentColor"/><path d="M6 21h12l-2-3.5H8z" fill="currentColor" opacity=".6"/><path d="M10 6.5l.8 1.8 1.8.8-1.8.8-.8 1.8-.8-1.8-1.8-.8 1.8-.8z" fill="#fff" opacity=".8"/><circle cx="14.5" cy="12" r="1" fill="#fff" opacity=".6"/>',
  couleur: '#FF8FC8',
  autorise: (_n, nb) => nb >= 4,
  tours: () => `jusqu’à ${MAX_MANCHES} manches`,

  demarrer(ctx) {
    const { equipes, arbitre } = formerEquipes(ctx.uids, ctx.hasard);
    const base = { numeroJeu: ctx.numeroJeu, equipes, ...(arbitre ? { arbitre } : {}), manche: 0, mots: {}, trouve: {} };
    return arbitre
      ? { etat: { ...base, etape: etapeDe(ctx.numeroJeu, 'pari'), phase: 'pari', fin: undefined } }
      : { etat: { ...base, etape: etapeDe(ctx.numeroJeu, 'd0'), phase: 'decompte', fin: ctx.maintenant + DUREE_DECOMPTE } };
  },

  piloter(ctx, etat) {
    const now = ctx.maintenant;
    const e = complet(etat);
    const decompte = (x: Etat, manche: number, interdits: Record<string, Interdit[]> = {}): Etat => ({
      ...x, phase: 'decompte', manche, interdits, rates: {}, contestes: [], etape: etapeDe(x.numeroJeu, `d${manche}`), fin: now + DUREE_DECOMPTE,
    });
    // Après la révélation (et l'éventuel vote) : fin du jeu, sabotage, ou manche suivante.
    const apres = (x: Etat) => {
      const fini = x.equipes.every((_, t) => !enJeu(x, t)) || x.manche + 1 >= MAX_MANCHES;
      if (fini) return { etat: { ...x, phase: 'bilan' as const, score: scoreTelepathie(x), fin: now + DUREE_BILAN } };
      if (sabotagesPossibles(x).length) return { etat: { ...x, phase: 'sabotage' as const, interdits: {}, etape: etapeDe(x.numeroJeu, `s${x.manche}`), fin: undefined } };
      return { etat: decompte(x, x.manche + 1) };
    };

    if (e.phase === 'pari' && etapeTerminee(ctx, e.etape, e.fin, e.arbitre ? [e.arbitre] : [])) {
      const r = e.arbitre ? reponsesDe<{ equipe: number; manches: number }>(ctx, e.etape)[e.arbitre] : undefined;
      const pari = r ? { equipe: Number(r.equipe), manches: Number(r.manches) } : undefined;
      return { etat: decompte({ ...e, ...(pari ? { pari } : {}) }, 0) };
    }
    if (e.phase === 'decompte' && now >= (e.fin ?? 0)) {
      return { etat: { ...e, phase: 'mot', etape: etapeDe(e.numeroJeu, `m${e.manche}`), fin: now + DUREE_MOT } };
    }
    if (e.phase === 'mot') {
      const joueurs = e.equipes.filter((_, t) => enJeu(e, t)).flat();
      if (!etapeTerminee(ctx, e.etape, e.fin, joueurs)) return null;
      const recues = reponsesDe<{ mot: string }>(ctx, e.etape);
      const mots = { ...e.mots };
      const trouve = { ...e.trouve };
      const rates: Record<string, string> = {};
      e.equipes.forEach((duo, t) => {
        if (!enJeu(e, t)) return;
        const paire = duo.map((u) => String(recues[u]?.mot ?? '').trim().slice(0, 30) || '…');
        mots[t] = [...(mots[t] ?? []), paire];
        const interdit = (e.interdits?.[t] ?? []).find((i) => paire.some((m) => memeMot(m, i.mot)));
        if (interdit) rates[t] = interdit.mot;
        else if (memeMot(paire[0], paire[1])) trouve[t] = e.manche + 1;
      });
      return { etat: { ...e, mots, trouve, rates, phase: 'revele', etape: etapeDe(e.numeroJeu, `r${e.manche}`), fin: now + DUREE_REVELE } };
    }
    if (e.phase === 'revele' && now >= (e.fin ?? 0)) {
      // Les duos qui ont « contesté » (mots presque pareils) passent au vote du groupe.
      const recues = reponsesDe<{ conteste?: boolean }>(ctx, e.etape);
      const contestes = e.equipes
        .map((_, t) => t)
        .filter((t) => enJeu(e, t) && !e.rates?.[t] && e.equipes[t].some((u) => recues[u]?.conteste));
      if (contestes.length) return { etat: { ...e, phase: 'vote', contestes, etape: etapeDe(e.numeroJeu, `v${e.manche}`), fin: undefined } };
      return apres(e);
    }
    if (e.phase === 'vote') {
      const contestes = e.contestes ?? [];
      const votants = ctx.uids.filter((u) => contestes.some((t) => !e.equipes[t].includes(u)));
      if (!etapeTerminee(ctx, e.etape, e.fin, votants)) return null;
      const recues = reponsesDe<{ votes?: Record<string, boolean> }>(ctx, e.etape);
      const trouve = { ...e.trouve };
      for (const t of contestes) {
        const votes = Object.entries(recues)
          .filter(([u]) => !e.equipes[t].includes(u))
          .map(([, r]) => r?.votes?.[t])
          .filter((x): x is boolean => typeof x === 'boolean');
        // Personne n'a voté : pas d'objection, ça compte.
        if (!votes.length || majoriteOui(votes)) trouve[t] = e.manche + 1;
      }
      return apres({ ...e, trouve });
    }
    if (e.phase === 'sabotage') {
      const possibles = sabotagesPossibles(e);
      const recues = reponsesDe<{ cible?: number; mot?: string }>(ctx, e.etape);
      const valide = (u: string, t: number) => {
        const r = recues[u];
        return !!r && r.cible !== undefined && Number(r.cible) !== t && !!e.equipes[Number(r.cible)] && enJeu(e, Number(r.cible)) && !!String(r.mot ?? '').trim();
      };
      // Une équipe a fini quand un des deux a saboté, ou quand les deux ont passé (les absents ne comptent pas).
      const finie = (t: number) => e.equipes[t].some((u) => valide(u, t)) || e.equipes[t].every((u) => recues[u] || !ctx.connectes.includes(u));
      if (!possibles.every(finie) && now < (e.fin ?? Infinity)) return null;
      const interdits: Record<string, Interdit[]> = {};
      const sabotes = { ...e.sabotes };
      for (const t of possibles) {
        const u = e.equipes[t].find((x) => valide(x, t));
        if (!u) continue;
        const cible = Number(recues[u].cible);
        interdits[cible] = [...(interdits[cible] ?? []), { mot: String(recues[u].mot).trim().slice(0, 30), par: t }];
        sabotes[t] = true;
      }
      return { etat: decompte({ ...e, sabotes }, e.manche + 1, interdits) };
    }
    if (e.phase === 'bilan' && now >= (e.fin ?? 0)) {
      return { etat: e, fin: { points: pointsDePlace(e.score ?? scoreTelepathie(e)), sorte: 'place' } };
    }
    return null;
  },

  ecran(v) {
    const e = complet(v.etat);
    const nom = (u: string) => esc(v.joueurs[u]?.prenom ?? '?');
    const couleur = (u: string) => v.joueurs[u]?.couleur ?? '#fff';
    const monEquipe = e.equipes.findIndex((d) => d.includes(v.uid));
    const nomEquipe = (t: number) => e.equipes[t].map(nom).join(' & ');
    const duo = (t: number) => `<div class="duo-tele">${e.equipes[t].map((u) => `<span style="color:${couleur(u)}">${nom(u)}</span>`).join('<i>✦</i>')}</div>`;
    const tete = hud('TÉLÉPATHIE', e.manche, MAX_MANCHES, e.phase !== 'bilan');
    const fait = v.maReponse?.etape === e.etape || v.local[e.etape] !== undefined;
    const allumee = Object.values(e.trouve).some((m) => m === e.manche + 1);
    const boule = (contenu = '', classe = 'petite') =>
      `<div class="scene-tele"><div class="boule-tele ${classe} ${allumee ? 'allumee' : ''}"><span class="brume"></span><span class="brume b2"></span><span class="reflet"></span><div class="contenu-boule">${contenu}</div></div><div class="socle-tele"></div></div>`;
    // Une carte de tarot : dos étoilé qui se retourne sur le mot.
    const tarot = (u: string, mot: string, delai: number) =>
      `<div class="tarot" style="--d:${delai}ms"><div class="flip"><span class="dos">☾</span><span class="face"><b>${esc(mot)}</b><small style="color:${couleur(u)}">${nom(u)}</small></span></div></div>`;
    const derniers = (t: number) => (e.mots[t] ?? []).slice(-1)[0];
    const avertissement = (t: number) =>
      (e.interdits?.[t] ?? []).map((i) => `<p class="interdit-tele">💣 Mot interdit : <b>« ${esc(i.mot)} »</b> <span>(sabotage de ${nomEquipe(i.par)})</span></p>`).join('');

    if (e.phase === 'pari') {
      const choix = (v.local[`${e.etape}-choix`] as { equipe?: number; manches?: number }) ?? {};
      if (v.uid !== e.arbitre) {
        return `${tete}${chrono(e.fin)}${boule('<b class="mini-boule">?</b>')}
          <h2 class="question centre-texte">Les duos</h2>
          <div class="pile">${e.equipes.map((_, t) => duo(t)).join('')}</div>
          <p class="aide">${nom(e.arbitre!)} est l’arbitre : il prédit en secret l’équipe gagnante…</p>`;
      }
      return `${tete}${chrono(e.fin)}<h2 class="question">Tu es l’arbitre</h2>
        <p class="aide gauche">Lis l’avenir : quelle équipe trouvera le même mot en premier, et en combien de manches ?</p>
        ${fait ? '<p class="attente">Prédiction enregistrée.</p>' : `
          <div class="pile">${e.equipes.map((_, t) => `<button class="option ${choix.equipe === t ? 'actif jaune' : ''}" data-action="jeu" data-geste="pariEquipe" data-valeur="${t}">${nomEquipe(t)}</button>`).join('')}</div>
          <div class="manches-pari">${Array.from({ length: MAX_MANCHES }, (_, i) => `<button class="${choix.manches === i + 1 ? 'actif' : ''}" data-action="jeu" data-geste="pariManches" data-valeur="${i + 1}">${i + 1}</button>`).join('')}</div>
          <button class="bouton jaune" data-action="jeu" data-geste="parier" ${choix.equipe === undefined || !choix.manches ? 'disabled' : ''}>Valider ma prédiction</button>`}`;
    }

    if (e.phase === 'decompte') {
      const ecoule = Math.max(0, maintenant() - ((e.fin ?? 0) - DUREE_DECOMPTE));
      const chiffres = ['3', '2', '1'].map((c, k) => `<b class="chiffre-tele" style="animation-delay:${k * 1000 - ecoule}ms">${c}</b>`).join('')
        + `<b class="crie-tele" style="animation-delay:${3000 - ecoule}ms">CRIEZ !</b>`;
      const joue = monEquipe >= 0 && enJeu(e, monEquipe);
      const d = joue ? derniers(monEquipe) : undefined;
      const consigne = !joue
        ? (monEquipe < 0 ? 'Tu arbitres : écoute bien les duos.' : 'Vous êtes connectés : écoutez les autres.')
        : d
          ? `Un mot entre <strong>« ${esc(d[0])} »</strong> et <strong>« ${esc(d[1])} »</strong>`
          : 'N’importe quel mot !';
      return `${tete}<p class="petit centre-texte">MANCHE ${e.manche + 1}${joue ? ` · AVEC ${e.equipes[monEquipe].filter((u) => u !== v.uid).map(nom).join('')}` : ''}</p>
        ${boule(chiffres, 'grande')}
        <p class="consigne-tele">${consigne}</p>
        ${joue ? avertissement(monEquipe) : ''}`;
    }

    if (e.phase === 'mot') {
      const joueurs = e.equipes.filter((_, t) => enJeu(e, t)).flat();
      const attente = attenteDes(joueurs, v.joueurs, (u) => v.ontRepondu.includes(u) || (u === v.uid && fait));
      if (monEquipe < 0 || !enJeu(e, monEquipe)) {
        return `${tete}${chrono(e.fin)}${boule('<b class="mini-boule">…</b>')}
          <p class="consigne-tele">Les duos tapent le mot qu’ils viennent de crier…</p>${attente}`;
      }
      const champ = `mot-${e.etape}`;
      return `${tete}${chrono(e.fin)}${boule('<b class="mini-boule">✦</b>')}
        <h2 class="question centre-texte">Tape le mot que tu as crié</h2>
        <div class="connexion-tele" aria-hidden="true">${duo(monEquipe)}<span class="onde-tele"></span></div>
        ${avertissement(monEquipe)}
        ${fait ? '<p class="attente">Mot envoyé… les esprits se concentrent.</p>' : `
          <input class="champ-texte" name="${champ}" maxlength="30" placeholder="Ton mot" autocomplete="off" value="${esc(brouillons[champ] ?? '')}">
          <button class="bouton jaune" data-action="jeu" data-geste="envoyer" data-envoi-auto="${e.fin}">Valider mon mot</button>`}
        ${attente}`;
    }

    // Une rangée par équipe : deux cartes qui se retournent, et ce qui s'est passé.
    const rangee = (t: number) => {
      const d = derniers(t);
      const ok = e.trouve[t] === e.manche + 1;
      const fini = e.trouve[t] !== undefined && !ok;
      const statut = ok
        ? '<p class="statut-tele ok">LES ESPRITS ONT PARLÉ !</p>'
        : e.rates?.[t]
          ? `<p class="statut-tele sabote">SABOTÉ ! « ${esc(e.rates[t])} » était interdit</p>`
          : fini ? `<p class="statut-tele">Connectés en ${e.trouve[t]} manche${e.trouve[t] > 1 ? 's' : ''}</p>` : '';
      const contester = t === monEquipe && !ok && !fini && !e.rates?.[t]
        ? (fait ? '<p class="attente">Contestation envoyée : le groupe votera.</p>' : '<button class="bouton discret" data-action="jeu" data-geste="contester">On a dit pareil ! (le groupe vote)</button>')
        : '';
      return `<div class="rangee-tele ${ok ? 'connectee' : ''} ${e.rates?.[t] ? 'sabotee' : ''} ${t === monEquipe ? 'moi' : ''}">
        ${d && !fini ? `<div class="tarots">${e.equipes[t].map((u, k) => tarot(u, d[k], t * 500 + k * 250)).join('')}</div>` : duo(t)}
        ${statut}${contester}
      </div>`;
    };

    if (e.phase === 'revele') {
      return `${tete}<p class="petit centre-texte">MANCHE ${e.manche + 1} · LES CARTES</p>
        ${boule()}
        <div class="pile">${e.equipes.map((_, t) => rangee(t)).join('')}</div>`;
    }

    if (e.phase === 'vote') {
      const contestes = e.contestes ?? [];
      const aVoter = contestes.filter((t) => !e.equipes[t].includes(v.uid));
      const choix = (v.local[`${e.etape}-choix`] as Record<string, boolean>) ?? {};
      return `${tete}${chrono(e.fin)}<h2 class="question centre-texte">Ça compte ?</h2>
        <p class="aide">Ces duos disent avoir dit la même chose. À vous de juger.</p>
        <div class="pile">${contestes.map((t) => {
          const d = derniers(t);
          const boutons = aVoter.includes(t) && !fait
            ? `<div class="vote-tele"><button class="option ${choix[t] === true ? 'actif jaune' : ''}" data-action="jeu" data-geste="choixVote" data-valeur="${t}-1">Oui, pareil</button><button class="option ${choix[t] === false ? 'actif' : ''}" data-action="jeu" data-geste="choixVote" data-valeur="${t}-0">Non</button></div>`
            : '';
          return `<div class="rangee-tele"><div class="tarots">${e.equipes[t].map((u, k) => tarot(u, d?.[k] ?? '…', 0)).join('')}</div>${boutons}</div>`;
        }).join('')}</div>
        ${!aVoter.length ? '<p class="attente">Le groupe vote…</p>' : fait ? '<p class="attente">Vote envoyé.</p>' : `<button class="bouton jaune" data-action="jeu" data-geste="voter" ${aVoter.every((t) => choix[t] !== undefined) ? '' : 'disabled'}>Valider mon vote</button>`}`;
    }

    if (e.phase === 'sabotage') {
      const possibles = sabotagesPossibles(e);
      const cibles = e.equipes.map((_, t) => t).filter((t) => t !== monEquipe && enJeu(e, t));
      if (monEquipe < 0 || !possibles.includes(monEquipe)) {
        return `${tete}${chrono(e.fin)}${boule('<b class="mini-boule">💣</b>')}
          <h2 class="question centre-texte">Sabotages en préparation…</h2>
          <p class="aide">Certaines équipes peuvent encore imposer un mot interdit à une autre.</p>`;
      }
      const choix = v.local[`${e.etape}-choix`] as number | undefined;
      const champ = `sab-${e.etape}`;
      return `${tete}${chrono(e.fin)}<h2 class="question">💣 Sabotage</h2>
        <p class="aide gauche">Une fois par partie : impose un mot interdit à une équipe pour la prochaine manche. S’ils le disent, leur manche est ratée. Un seul de vous deux suffit.</p>
        ${fait ? '<p class="attente">C’est noté.</p>' : `
          <div class="pile">${cibles.map((t) => {
            const d = derniers(t);
            return `<button class="option ${choix === t ? 'actif jaune' : ''}" data-action="jeu" data-geste="cibler" data-valeur="${t}">${nomEquipe(t)}${d ? `<small> · ${esc(d[0])} / ${esc(d[1])}</small>` : ''}</button>`;
          }).join('')}</div>
          <input class="champ-texte" name="${champ}" maxlength="30" placeholder="Le mot interdit" autocomplete="off" value="${esc(brouillons[champ] ?? '')}">
          <button class="bouton jaune" data-action="jeu" data-geste="saboter" ${choix === undefined ? 'disabled' : ''}>Saboter</button>
          <button class="bouton discret" data-action="jeu" data-geste="passer">Garder mon sabotage</button>`}`;
    }

    // Bilan : le « film » de chaque duo, puis le classement.
    const score = e.score ?? {};
    const ordre = [...v.uids].sort((a, b) => (score[b] ?? 0) - (score[a] ?? 0));
    const max = Math.max(1, ...ordre.map((u) => score[u] ?? 0));
    const film = (t: number) => `<div class="rangee-tele film-tele ${e.trouve[t] !== undefined ? 'connectee' : ''}">
      ${duo(t)}
      <div class="chemin-tele">${(e.mots[t] ?? []).map((p) => `<span>${memeMot(p[0], p[1]) ? `<b>${esc(p[0])}</b>` : `${esc(p[0])} + ${esc(p[1])}`}</span>`).join('<i>→</i>')}</div>
      <p class="statut-tele ${e.trouve[t] !== undefined ? 'ok' : ''}">${e.trouve[t] !== undefined ? `Connectés en ${e.trouve[t]} manche${e.trouve[t] > 1 ? 's' : ''}` : 'Pas connectés'}</p>
    </div>`;
    return `${tete}${boule()}<h2 class="question centre-texte">Les esprits ont parlé</h2>
      <div class="pile">${e.equipes.map((_, t) => film(t)).join('')}</div>
      <div class="pile">${classementBarres(ordre.map((u) => ({ joueur: v.joueurs[u], texte: `${pts(score[u] ?? 0)}${u === e.arbitre ? ' (arbitre)' : ''}`, part: (score[u] ?? 0) / max, moi: u === v.uid })))}</div>`;
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
    async contester(_el, o, v) {
      const e = v.etat;
      if (e.phase !== 'revele' || o.local[e.etape] !== undefined) return;
      o.local[e.etape] = true;
      o.rafraichir();
      await o.repondre({ conteste: true });
    },
    choixVote(el, o, v) {
      const [t, oui] = String(el.dataset.valeur).split('-');
      const cle = `${v.etat.etape}-choix`;
      o.local[cle] = { ...(o.local[cle] as object), [t]: oui === '1' };
      o.rafraichir();
    },
    async voter(_el, o, v) {
      const e = v.etat;
      if (e.phase !== 'vote' || o.local[e.etape] !== undefined) return;
      const votes = (o.local[`${e.etape}-choix`] as Record<string, boolean>) ?? {};
      o.local[e.etape] = true;
      o.rafraichir();
      await o.repondre({ votes });
    },
    cibler(el, o, v) {
      o.local[`${v.etat.etape}-choix`] = Number(el.dataset.valeur);
      o.rafraichir();
    },
    async saboter(_el, o, v) {
      const e = v.etat;
      const cible = o.local[`${e.etape}-choix`] as number | undefined;
      const mot = (document.querySelector<HTMLInputElement>(`input[name="sab-${e.etape}"]`)?.value ?? '').trim().slice(0, 30);
      if (e.phase !== 'sabotage' || o.local[e.etape] !== undefined || cible === undefined || !mot) return;
      o.local[e.etape] = true;
      o.rafraichir();
      await o.repondre({ cible, mot });
    },
    async passer(_el, o, v) {
      const e = v.etat;
      if (e.phase !== 'sabotage' || o.local[e.etape] !== undefined) return;
      o.local[e.etape] = true;
      o.rafraichir();
      await o.repondre({ passe: true });
    },
  },
};

// Pas de chrono pour pari, vote, sabotage : on attend tout le monde. L'hôte peut lancer la suite si quelqu'un bloque.
const PHASES_SANS_CHRONO: string[] = ['pari', 'vote', 'sabotage'];
const ecranDeBase = telepathie.ecran;
telepathie.ecran = (v) => ecranDeBase(v) + (v.estHote && PHASES_SANS_CHRONO.includes(v.etat.phase) ? '<button class="bouton discret" data-action="hote-jeu" data-valeur="forcerEtape">Passer à la suite sans attendre</button>' : '');
const commandeDeBase = telepathie.commande;
telepathie.commande = (ctx, etat, valeur) =>
  valeur === 'forcerEtape' && PHASES_SANS_CHRONO.includes(etat.phase) ? { etat: { ...etat, fin: ctx.maintenant } } : commandeDeBase ? commandeDeBase(ctx, etat, valeur) : null;

avecSuiteBilan(telepathie);
