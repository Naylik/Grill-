// « Le Parieur » : chacun est défié une fois. Les autres misent 1 à 3 vrais points en secret sur sa réussite
// ou son échec, puis le groupe valide le défi par vote. Pari mutuel (voir score.ts). Jamais dans les 2 premiers jeux.
import defis from '../data/defis.json';
import { esc, fraisDabord, melanger } from '../outils';
import { borneParieur, majoriteOui, pariMutuel, PARIEUR_MAX, PARIEUR_MIN, type Mise } from '../score';
import { attenteDes, bulle, chrono } from '../ecrans/commun';
import { etapeTerminee, reponsesDe, type EtatDeBase, type MiniJeu } from './interface';

const DUREE_VOTE = 30_000;
const DUREE_LECTURE = 5_000; // le défié lit son défi (et tout le monde avec lui) avant que le chrono parte

interface Etat extends EtatDeBase {
  phase: 'mises' | 'lecture' | 'defi' | 'vote' | 'resultat';
  numeroJeu: number;
  ordre: string[];
  tour: number;
  defis: { id?: string; texte: string; duree: number }[];
  reussi?: boolean;
  gains?: Record<string, number>; // gains de ce tour
  mises?: Mise[]; // révélées au résultat
  cumul: Record<string, number>; // vrais points gagnés/perdus dans ce jeu
}

const etapeDe = (e: Pick<Etat, 'numeroJeu' | 'tour'>, phase: string) => `parieur-${e.numeroJeu}-${e.tour}-${phase}`;

export const parieur: MiniJeu<Etat> = {
  id: 'parieur',
  nom: 'Le Parieur',
  accroche: 'Chacun est défié une fois. Mise tes vrais points sur sa réussite… ou son échec.',
  explication: {
    comment: 'Chaque joueur reçoit un défi à relever à voix haute (« Cite 5 joueurs du PSG en 15 secondes »). Avant, les autres misent en secret 1 à 3 de leurs vrais points sur sa réussite ou son échec. Puis le groupe vote : défi réussi ou raté ?',
    gagner: 'Les gagnants se partagent les mises des perdants. Le joueur défié gagne 1 point par personne qui a parié sur lui, s’il réussit.',
    note: 'Jamais dans les 2 premiers jeux, pour que tout le monde ait des points à miser.',
  },
  icone: '<rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="none" stroke="currentColor" stroke-width="2.5"/><circle cx="8.5" cy="8.5" r="1.8" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/>',
  couleur: '#5BE37D',
  contenus: (e) => (e.defis ?? []).map((d) => d.id).filter((id): id is string => !!id),
  autorise: (numeroJeu) => numeroJeu > 2,

  demarrer(ctx) {
    const ordre = melanger(ctx.uids, ctx.hasard);
    const choix = fraisDabord(defis.filter((d) => d.niveau !== 'hot'), ctx.dejaVus, ctx.hasard).slice(0, ordre.length).map(({ id, texte, duree }) => ({ id, texte, duree }));
    const base = { numeroJeu: ctx.numeroJeu, tour: 0 };
    return {
      etat: { ...base, etape: etapeDe(base, 'mises'), phase: 'mises', ordre, defis: choix, fin: undefined, cumul: Object.fromEntries(ctx.uids.map((u) => [u, 0])) },
    };
  },

  piloter(ctx, etat) {
    const defie = etat.ordre[etat.tour];
    const autres = ctx.uids.filter((u) => u !== defie);
    if (etat.phase === 'mises' && etapeTerminee(ctx, etat.etape, etat.fin, autres)) {
      // Les mises restent secrètes jusqu'au résultat : on les range dans le coffre de l'hôte.
      const mises: Mise[] = Object.entries(reponsesDe<{ cote: string; mise: number }>(ctx, etat.etape))
        .filter(([u, r]) => autres.includes(u) && (r.cote === 'reussite' || r.cote === 'echec'))
        .map(([uid, r]) => ({ uid, cote: r.cote as Mise['cote'], mise: Math.min(3, Math.max(1, Math.round(Number(r.mise) || 1))) }));
      return {
        etat: { ...etat, phase: 'lecture', etape: etapeDe(etat, 'lecture'), fin: ctx.maintenant + DUREE_LECTURE },
        ecritures: { 'prive/mises': mises },
      };
    }
    if (etat.phase === 'lecture' && ctx.maintenant >= (etat.fin ?? 0)) {
      return { etat: { ...etat, phase: 'defi', etape: etapeDe(etat, 'defi'), fin: ctx.maintenant + etat.defis[etat.tour].duree * 1000 } }; // pile la durée annoncée
    }
    if (etat.phase === 'defi' && ctx.maintenant >= (etat.fin ?? 0)) {
      return { etat: { ...etat, phase: 'vote', etape: etapeDe(etat, 'vote'), fin: ctx.maintenant + DUREE_VOTE } };
    }
    if (etat.phase === 'vote' && etapeTerminee(ctx, etat.etape, etat.fin, autres)) {
      const votes = Object.values(reponsesDe<{ reussi: boolean }>(ctx, etat.etape)).map((r) => r.reussi === true);
      const reussi = majoriteOui(votes);
      const mises = ((ctx.prive.mises ?? []) as Mise[]).filter((m) => m && m.uid);
      const gains = pariMutuel(mises, reussi, defie);
      const cumul = { ...etat.cumul };
      for (const [u, g] of Object.entries(gains)) cumul[u] = (cumul[u] ?? 0) + g;
      return { etat: { ...etat, phase: 'resultat', reussi, gains, mises, cumul, fin: undefined }, ecritures: { 'prive/mises': null } };
    }
    return null;
  },

  commande(ctx, etat, valeur) {
    if (valeur === 'finDefi' && etat.phase === 'defi') return { etat: { ...etat, fin: ctx.maintenant } };
    // Pas de chrono pour miser : si quelqu'un ne mise jamais, l'hôte lance le défi quand même.
    if (valeur === 'forcerMises' && etat.phase === 'mises') return { etat: { ...etat, fin: ctx.maintenant } };
    if (valeur !== 'suivant' || etat.phase !== 'resultat') return null;
    const tour = etat.tour + 1;
    if (tour >= etat.ordre.length) {
      // Vrais points, mais bornés : un seul jeu ne doit pas décider de la soirée.
      return { etat, fin: { points: Object.fromEntries(Object.entries(etat.cumul).map(([u, n]) => [u, borneParieur(n)])), sorte: 'reels', resume: `Au Parieur, on gagne et on perd de vrais points (entre ${PARIEUR_MIN} et +${PARIEUR_MAX}).` } };
    }
    const suite = { ...etat, tour };
    return { etat: { ...suite, phase: 'mises', etape: etapeDe(suite, 'mises'), fin: undefined, reussi: undefined, gains: undefined, mises: undefined } };
  },

  ecran(v) {
    const e = v.etat;
    const defie = e.ordre[e.tour];
    const nomDefie = esc(v.joueurs[defie].prenom);
    const moiDefie = defie === v.uid;
    const autres = v.uids.filter((u) => u !== defie);
    const defi = e.defis[e.tour];
    // Pendant les mises, le défié ne voit pas encore son défi : sinon il réfléchit pendant que les autres parient.
    const cache = moiDefie && e.phase === 'mises';
    const entete = `<p class="petit">Défi ${e.tour + 1}/${e.ordre.length}</p>
      <h2 class="question">${moiDefie ? 'À toi' : nomDefie}${moiDefie ? ' ! Ton défi' : ' doit…'}</h2>
      ${cache
        ? '<div class="boite defi defi-cache"><p class="texte-defi">🔒 Encore secret</p><span class="petit">Tu le découvres dès que tout le monde a parié.</span></div>'
        : `<div class="boite defi ${e.phase === 'lecture' ? 'defi-revele' : ''}"><p class="texte-defi">${esc(defi.texte)}</p><span class="petit">${defi.duree} secondes</span></div>`}`;
    const attente = (u: string) => v.ontRepondu.includes(u) || (u === v.uid && v.maReponse?.etape === e.etape);

    if (e.phase === 'mises') {
      // Pas de chrono : on attend que tout le monde ait misé (l'hôte peut forcer en cas de souci).
      const forcer = v.estHote ? '<button class="bouton discret" data-action="hote-jeu" data-valeur="forcerMises">Lancer le défi sans attendre</button>' : '';
      if (moiDefie) return `${entete}${bulle('Les autres parient sur toi en secret. Pas de pression.')}${attenteDes(autres, v.joueurs, attente)}${forcer}`;
      const deja = v.maReponse?.etape === e.etape;
      const cote = v.local[`${e.etape}:cote`] as string | undefined;
      const mise = v.local[`${e.etape}:mise`] as number | undefined;
      // Le tapis : un jeton par point misé ; une fois la mise envoyée, la pile file vers le camp choisi.
      const jetons = (n: number) => Array.from({ length: n }, (_, i) => `<span class="jeton" style="--i:${i}"></span>`).join('');
      const envoye = deja ? { mise: Number(v.maReponse!.mise), cote: String(v.maReponse!.cote) } : null;
      const camp = (valeur: string, texte: string, couleur: string) => {
        const actif = (envoye?.cote ?? cote) === valeur;
        return `<button class="option camp-pari ${actif ? `actif ${couleur}` : ''}" ${envoye ? 'disabled' : `data-action="jeu" data-geste="cote" data-valeur="${valeur}"`}>${texte}${envoye && actif ? `<span class="recu-pari">+${envoye.mise}</span>` : ''}</button>`;
      };
      const tapis = `<div class="tapis-pari" aria-hidden="true"><div class="pile-jetons ${envoye ? `part ${envoye.cote === 'reussite' ? 'vers-gauche' : 'vers-droite'}` : ''}">${jetons(envoye?.mise ?? mise ?? 0)}</div></div>`;
      const choix = deja
        ? `<div class="mise-zone"><div class="options deux">${camp('reussite', 'Il ou elle réussit', 'vert')}${camp('echec', 'Il ou elle rate', 'rose')}</div>${tapis}
          <p class="attente">Mise enregistrée : ${envoye!.mise} pt${envoye!.mise > 1 ? 's' : ''} sur ${envoye!.cote === 'reussite' ? 'la réussite' : 'l’échec'}.</p></div>`
        : `<div class="mise-zone">
          <div class="options deux">${camp('reussite', 'Il ou elle réussit', 'vert')}${camp('echec', 'Il ou elle rate', 'rose')}</div>
          ${tapis}
          <div class="options trois">${[1, 2, 3].map((n) => `<button class="option ${mise === n ? 'actif jaune' : ''}" data-action="jeu" data-geste="mise" data-valeur="${n}">${n} pt${n > 1 ? 's' : ''}</button>`).join('')}</div>
          <button class="bouton jaune" data-action="jeu" data-geste="miser" ${cote && mise ? '' : 'disabled'}>${cote && mise ? `Miser ${mise} pt${mise > 1 ? 's' : ''}` : 'Choisis ton camp et ta mise'}</button>
          </div>`;
      return `${entete}${choix}${attenteDes(autres, v.joueurs, attente)}${forcer}`;
    }
    if (e.phase === 'lecture') {
      return `${entete}<div class="lecture-defi"><span>Le chrono démarre dans</span>${chrono(e.fin)}</div>
        ${bulle(moiDefie ? 'Lis bien ton défi. Respire. Ça part dans quelques secondes.' : `${nomDefie} découvre son défi… Les paris sont faits.`)}`;
    }
    if (e.phase === 'defi') {
      return `${chrono(e.fin)}${entete}${bulle(moiDefie ? 'Go ! À voix haute, tout le monde t’écoute.' : `Silence, ${nomDefie} se concentre. Ou panique.`)}
        ${v.estHote ? '<button class="bouton discret bas" data-action="hote-jeu" data-valeur="finDefi">Défi terminé</button>' : ''}`;
    }
    if (e.phase === 'vote') {
      if (moiDefie) return `${chrono(e.fin)}${entete}${bulle('Le groupe délibère. Souris, ça aide.')}${attenteDes(autres, v.joueurs, attente)}`;
      const monVote = v.maReponse?.etape === e.etape ? v.maReponse.reussi : undefined;
      return `${chrono(e.fin)}${entete}<p class="intitule">Défi réussi ?</p>
        <div class="options deux grosses">
          <button class="bouton vert ${monVote === true ? 'choisi' : ''}" data-action="jeu" data-geste="voter" data-valeur="oui" aria-label="Pouce en haut">Réussi</button>
          <button class="bouton rose ${monVote === false ? 'choisi' : ''}" data-action="jeu" data-geste="voter" data-valeur="non" aria-label="Pouce en bas">Raté</button>
        </div>
        ${monVote !== undefined ? `<p class="attente">Vote : ${monVote ? 'réussi' : 'raté'} (tu peux changer)</p>` : ''}
        ${attenteDes(autres, v.joueurs, attente)}`;
    }
    const lignes = v.uids
      .map((u) => {
        const g = e.gains?.[u] ?? 0;
        const m = e.mises?.find((x) => x.uid === u);
        return `<div class="ligne-resultat"><span class="pastille" style="--c:${v.joueurs[u].couleur};width:26px;height:26px"></span><strong>${esc(v.joueurs[u].prenom)}</strong>
          <span class="petit">${u === defie ? 'défié' : m ? `${m.mise} sur ${m.cote === 'reussite' ? 'réussite' : 'échec'}` : 'pas de mise'}</span>
          <span class="pts ${g > 0 ? 'gagne' : g < 0 ? 'perdu' : ''}">${g > 0 ? `+${g}` : g}</span></div>`;
      })
      .join('');
    return `<p class="petit">Défi ${e.tour + 1}/${e.ordre.length}</p>
      <div class="piece-parieur ${e.reussi ? 'reussi' : 'rate'}" aria-hidden="true"><div class="piece"><span class="face ok">✔</span><span class="face ko">✘</span></div></div>
      <div class="apres-jauge" style="--d:1900ms">
        <div class="gros-verdict ${e.reussi ? 'ok' : 'ko'}">${nomDefie} : ${e.reussi ? 'réussi !' : 'raté !'}</div>
        <div class="pile">${lignes}</div>
      </div>
      ${v.estHote ? `<button class="bouton jaune bas" data-action="hote-jeu" data-valeur="suivant">${e.tour + 1 < e.ordre.length ? 'Défi suivant' : 'Voir le classement'}</button>` : '<p class="attente bas">L’hôte passe à la suite.</p>'}`;
  },

  gestes: {
    cote(el, o, v) {
      o.local[`${v.etat.etape}:cote`] = el.dataset.valeur;
      o.rafraichir();
    },
    mise(el, o, v) {
      o.local[`${v.etat.etape}:mise`] = Number(el.dataset.valeur);
      o.rafraichir();
    },
    async miser(_el, o, v) {
      const cote = o.local[`${v.etat.etape}:cote`];
      const mise = o.local[`${v.etat.etape}:mise`];
      if (!cote || !mise) return;
      await o.repondre({ cote, mise });
    },
    async voter(el, o) {
      await o.repondre({ reussi: el.dataset.valeur === 'oui' });
    },
  },
};
