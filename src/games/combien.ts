// « Combien ont dit oui ? » : une question gênante, chacun répond oui ou non anonymement,
// puis devine combien ont dit oui. Seul le total est révélé. 3 pts si exact, 1 pt à un près.
import questions from '../data/combien.json';
import { fraisDabord } from '../outils';
import { esc } from '../outils';
import { pointsCombien, pointsDePlace } from '../score';
import { attenteDes, bulle, chrono } from '../ecrans/commun';
import { etapeTerminee, reponsesDe, type EtatDeBase, type MiniJeu, selonFormat } from './interface';

const NB_QUESTIONS: [number, number, number] = [4, 6, 8]; // Courte, Normale, Longue
const DUREE_QUESTION = 45_000;

interface Etat extends EtatDeBase {
  phase: 'question' | 'resultat';
  numeroJeu: number;
  index: number;
  questions: string[];
  ids?: string[]; // identifiants des questions (mémoire du groupe)
  totalOui?: number;
  estimations?: Record<string, number>;
  gagnes?: Record<string, number>; // points de cette question
  cumul: Record<string, number>; // score interne du jeu
}

const etapeDe = (numeroJeu: number, i: number) => `combien-${numeroJeu}-${i}`;

export const combien: MiniJeu<Etat> = {
  id: 'combien',
  nom: 'Combien ont dit oui ?',
  accroche: 'Réponds en secret, puis devine combien ont dit oui. Seul le total est révélé.',
  explication: {
    comment: 'Une question gênante s’affiche (« As-tu déjà stalké un ex ? »). Chacun répond oui ou non en secret, puis devine combien de joueurs ont dit oui. Seul le total est révélé : personne ne sait qui a répondu quoi.',
    gagner: '3 points si tu trouves le chiffre exact, 1 point à un près. 4 à 8 questions selon le format choisi.',
  },
  icone: '<path d="M12 3a9 9 0 1 0 9 9h-9z" fill="currentColor"/><path d="M15 2.5A9 9 0 0 1 21.5 9H15z" fill="currentColor" opacity=".5"/>',
  couleur: '#FF4F8B',
  tours: (duree) => `${selonFormat(duree, NB_QUESTIONS)} questions`,
  contenus: (e) => e.ids ?? [],
  autorise: () => true,

  demarrer(ctx) {
    const tirees = fraisDabord(questions.filter((q) => q.niveau !== 'hot'), ctx.dejaVus, ctx.hasard).slice(0, selonFormat(ctx.duree, NB_QUESTIONS));
    const choix = tirees.map((q) => q.texte);
    return {
      etat: { etape: etapeDe(ctx.numeroJeu, 0), numeroJeu: ctx.numeroJeu, phase: 'question', index: 0, questions: choix, ids: tirees.map((q) => q.id), fin: ctx.maintenant + DUREE_QUESTION, cumul: Object.fromEntries(ctx.uids.map((u) => [u, 0])) },
      ecritures: { [`compteurs/${etapeDe(ctx.numeroJeu, 0)}`]: 0 },
    };
  },

  piloter(ctx, etat) {
    if (etat.phase !== 'question' || !etapeTerminee(ctx, etat.etape, etat.fin)) return null;
    const recues = reponsesDe<{ estimation: number }>(ctx, etat.etape);
    const totalOui = ctx.compteurs[etat.etape] ?? 0;
    const estimations = Object.fromEntries(Object.entries(recues).map(([u, r]) => [u, Number(r.estimation)]));
    const gagnes = Object.fromEntries(ctx.uids.map((u) => [u, u in estimations ? pointsCombien(estimations[u], totalOui) : 0]));
    const cumul = Object.fromEntries(ctx.uids.map((u) => [u, (etat.cumul[u] ?? 0) + gagnes[u]]));
    return { etat: { ...etat, phase: 'resultat', totalOui, estimations, gagnes, cumul, fin: undefined } as Etat };
  },

  commande(ctx, etat, valeur) {
    if (valeur !== 'suivant' || etat.phase !== 'resultat') return null;
    const index = etat.index + 1;
    if (index >= etat.questions.length) {
      return { etat, fin: { points: pointsDePlace(etat.cumul), sorte: 'place' } };
    }
    const etape = etapeDe(etat.numeroJeu, index);
    return {
      etat: { ...etat, etape, index, phase: 'question', fin: ctx.maintenant + DUREE_QUESTION, totalOui: undefined, estimations: undefined, gagnes: undefined },
      ecritures: { [`compteurs/${etape}`]: 0 },
    };
  },

  ecran(v) {
    const e = v.etat;
    const n = v.uids.length;
    const titre = `<p class="petit">Question ${e.index + 1}/${e.questions.length}</p><h2 class="question">${esc(e.questions[e.index])}</h2>`;
    if (e.phase === 'question') {
      const dejaRepondu = v.maReponse?.etape === e.etape;
      const monOui = v.local[e.etape] as 'oui' | 'non' | undefined;
      let corps: string;
      if (dejaRepondu) corps = `<p class="attente">C’est noté. On attend les autres…</p>`;
      else if (!monOui) {
        corps = `<p class="aide">Ta réponse reste anonyme : seul le total sera affiché.</p>
          <div class="options deux grosses">
            <button class="bouton vert" data-action="jeu" data-geste="ouiNon" data-valeur="oui">Oui</button>
            <button class="bouton rose" data-action="jeu" data-geste="ouiNon" data-valeur="non">Non</button>
          </div>`;
      } else {
        corps = `<p class="intitule">Combien ont dit oui, à ton avis ? <span class="petit">(toi compris)</span></p>
          <div class="grille-nombres">${Array.from({ length: n + 1 }, (_, i) => `<button class="option" data-action="jeu" data-geste="estimer" data-valeur="${i}">${i}</button>`).join('')}</div>
          <button class="bouton discret" data-action="jeu" data-geste="annulerOuiNon">Changer ma réponse (${monOui})</button>`;
      }
      return `${chrono(e.fin)}${titre}${corps}${attenteDes(v.uids, v.joueurs, (u) => v.ontRepondu.includes(u) || (u === v.uid && dejaRepondu))}`;
    }
    // Résultat
    const lignes = v.uids
      .map((u) => {
        const j = v.joueurs[u];
        const est = e.estimations?.[u];
        const pts = e.gagnes?.[u] ?? 0;
        return `<div class="ligne-resultat"><span class="pastille" style="--c:${j.couleur};width:26px;height:26px"></span><strong>${esc(j.prenom)}</strong><span>${est ?? '—'}</span><span class="pts ${pts ? 'gagne' : ''}">${pts ? `+${pts}` : '0'}</span></div>`;
      })
      .join('');
    const total = e.totalOui ?? 0;
    return `${titre}
      <div class="gros-chiffre"><strong>${total}</strong><span>sur ${n} ont dit oui</span></div>
      ${bulle(total === 0 ? 'Personne ? Vous mentez tous, c’est mignon.' : total === n ? 'Tout le monde. Je ne vous juge pas. Si, un peu.' : 'Intéressant… Très intéressant.')}
      <div class="pile">${lignes}</div>
      ${v.estHote ? `<button class="bouton jaune bas" data-action="hote-jeu" data-valeur="suivant">${e.index + 1 < e.questions.length ? 'Question suivante' : 'Voir le classement'}</button>` : `<p class="attente bas">L’hôte passe à la suite.</p>`}`;
  },

  gestes: {
    ouiNon(el, o, v) {
      o.local[v.etat.etape] = el.dataset.valeur;
      o.rafraichir();
    },
    annulerOuiNon(_el, o, v) {
      delete o.local[v.etat.etape];
      o.rafraichir();
    },
    async estimer(el, o, v) {
      const etape = v.etat.etape;
      if (v.maReponse?.etape === etape || o.local[`${etape}:envoye`]) return;
      o.local[`${etape}:envoye`] = true;
      // Le « oui » est compté sans dire de qui il vient.
      if (o.local[etape] === 'oui') await o.incrementer(etape);
      await o.repondre({ estimation: Number(el.dataset.valeur) });
    },
  },
};
