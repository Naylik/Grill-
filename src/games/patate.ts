// « La Patate » : une patate-bombe passe de téléphone en téléphone. Celui qui l'a dit à voix haute un mot qui
// répond à la consigne (« Un animal en B »), puis la lance (glisser vers un joueur, ou toucher son nom).
// Elle explose à un moment caché (entre 15 s et 1 min) : celui qui l'a est éliminé. On continue jusqu'au dernier.
// Le moment de l'explosion n'est connu que de l'hôte (prive/patate) : personne ne peut tricher en le lisant.
import { maintenant } from '../firebase';
import { mallow } from '../mallow';
import { esc } from '../outils';
import { pointsDePlace } from '../score';
import { reponsesDe, type EtatDeBase, type MiniJeu } from './interface';
import { classementBarres, hud, introArene } from './arene';

const DUREE_INTRO = 7000;
const PRETS = 3000; // « La patate arrive… »
const EXPLOSION_MIN = 15_000;
const EXPLOSION_MAX = 60_000;
const DUREE_BOUM = 4500;
const DUREE_BILAN = 6500;

const THEMES = ['Un animal', 'Un pays', 'Un prénom', 'Un fruit ou un légume', 'Une marque', 'Un métier', 'Un objet de la maison', 'Un sport', 'Une ville', 'Un film ou une série', 'Un plat', 'Une célébrité', 'Un mot anglais', 'Un instrument', 'Un vêtement'];
const LETTRES = 'ABCDEFGHJLMNPRST';

interface Etat extends EtatDeBase {
  phase: 'intro' | 'jeu' | 'boum' | 'bilan';
  numeroJeu: number;
  manche: number;
  vivants: string[];
  elimines: string[]; // dans l'ordre (le premier éliminé d'abord)
  porteur: string;
  passe: number;
  consigne: string;
  depart: number; // la patate peut être lancée à partir de cet instant
  explose?: string; // qui a explosé (phase boum)
}

const etapeDe = (n: number, m: number, p: number) => `patate-${n}-${m}-${p}`;
const consigne = (hasard: () => number) =>
  `${THEMES[Math.floor(hasard() * THEMES.length)]} en ${LETTRES[Math.floor(hasard() * LETTRES.length)]}`;

/** Firebase n'enregistre pas les listes vides : on les remet. */
const complet = (e: Etat): Etat => ({ ...e, vivants: e.vivants ?? [], elimines: e.elimines ?? [] });

/** Points de place : le dernier survivant est 1er, le premier éliminé est dernier. */
export function classementPatate(elimines: string[], survivants: string[]): Record<string, number> {
  const internes: Record<string, number> = {};
  elimines.forEach((u, i) => (internes[u] = i));
  survivants.forEach((u) => (internes[u] = elimines.length + 1));
  return internes;
}

function nouvelleManche(ctx: { maintenant: number; hasard: () => number; connectes: string[] }, base: Etat, manche: number) {
  const presents = base.vivants.filter((u) => ctx.connectes.includes(u));
  const liste = presents.length ? presents : base.vivants;
  const porteur = liste[Math.floor(ctx.hasard() * liste.length)];
  const depart = ctx.maintenant + PRETS;
  const explosion = depart + EXPLOSION_MIN + ctx.hasard() * (EXPLOSION_MAX - EXPLOSION_MIN);
  const etat: Etat = { ...base, phase: 'jeu', manche, porteur, passe: 0, consigne: consigne(ctx.hasard), depart, explose: undefined, etape: etapeDe(base.numeroJeu, manche, 0), fin: undefined };
  return { etat, ecritures: { 'prive/patate': { explosion } } };
}

/** La patate dessinée : une pomme de terre avec une mèche, qui transpire. */
export function dessinPatate(taille = 150, inquiete = true): string {
  return `<svg class="dessin-patate" width="${taille}" height="${taille}" viewBox="0 0 160 160" aria-hidden="true">
    <path d="M104 34 Q112 18 126 16" stroke="#3A2A1A" stroke-width="5" fill="none" stroke-linecap="round"/>
    <g class="etincelle"><circle cx="128" cy="15" r="8" fill="#FFD84A"/><circle cx="128" cy="15" r="4" fill="#fff"/></g>
    <path d="M30 86 C24 52 54 30 88 34 C122 38 140 62 134 96 C128 130 96 144 66 138 C40 132 34 112 30 86 Z" fill="#D9A066" stroke="#1B1233" stroke-width="5"/>
    <circle cx="52" cy="66" r="3.5" fill="#A8743F"/><circle cx="112" cy="110" r="4" fill="#A8743F"/><circle cx="98" cy="54" r="3" fill="#A8743F"/><circle cx="60" cy="118" r="3" fill="#A8743F"/>
    <ellipse cx="68" cy="88" rx="6" ry="8" fill="#1B1233"/><ellipse cx="96" cy="88" rx="6" ry="8" fill="#1B1233"/>
    <circle cx="70" cy="85" r="2.2" fill="#fff"/><circle cx="98" cy="85" r="2.2" fill="#fff"/>
    ${inquiete
      ? '<path d="M70 112 Q82 104 94 112" stroke="#1B1233" stroke-width="4.5" fill="none" stroke-linecap="round"/><path d="M118 70 Q123 80 118 85 Q113 80 118 70Z" fill="#7FD8FF" stroke="#1B1233" stroke-width="2"/>'
      : '<path d="M70 106 Q82 116 94 106" stroke="#1B1233" stroke-width="4.5" fill="none" stroke-linecap="round"/>'}
  </svg>`;
}

export const patate: MiniJeu<Etat> = {
  id: 'patate',
  nom: 'La Patate',
  accroche: 'Dis un mot, lance la patate. Elle va exploser…',
  explication: {
    comment: 'La patate arrive sur le téléphone de quelqu’un avec une consigne (« Un animal en B »). Il dit un mot à voix haute, puis la lance vers le joueur de son choix en la faisant glisser. Elle explose à un moment caché, entre 15 secondes et 1 minute : celui qui l’a est éliminé.',
    gagner: 'Le dernier survivant gagne. Les autres sont classés dans l’ordre d’élimination.',
    note: 'Le groupe juge le mot dit à voix haute : pas de mot, pas de lancer !',
  },
  icone: '<path d="M6 13c-.6-4 2.6-7 6.6-6.6 4 .4 6 3.4 5.4 7.4-.6 3.8-4 5.6-7.2 5C8 18.2 6.4 16.4 6 13z" fill="currentColor"/><path d="M15 7c.6-2 2-3 3.6-3" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
  couleur: '#FF7A3D',
  autorise: (_n, nb) => nb >= 3,

  demarrer(ctx) {
    const base: Etat = {
      etape: `patate-${ctx.numeroJeu}-intro`, phase: 'intro', numeroJeu: ctx.numeroJeu, manche: 0, vivants: [...ctx.uids], elimines: [],
      porteur: ctx.uids[0], passe: 0, consigne: '', depart: 0, fin: ctx.maintenant + DUREE_INTRO,
    };
    return { etat: base };
  },

  piloter(ctx, brut) {
    const etat = complet(brut);
    const now = ctx.maintenant;
    if (etat.phase === 'intro' && now >= (etat.fin ?? 0)) return nouvelleManche(ctx, etat, 0);
    if (etat.phase === 'jeu') {
      const explosion = Number((ctx.prive.patate as { explosion?: number } | undefined)?.explosion ?? 0);
      if (explosion && now >= explosion) {
        const vivants = etat.vivants.filter((u) => u !== etat.porteur);
        return { etat: { ...etat, phase: 'boum', explose: etat.porteur, vivants, elimines: [...etat.elimines, etat.porteur], fin: now + DUREE_BOUM }, ecritures: { 'prive/patate': null } };
      }
      // Le porteur a lancé la patate.
      const lancer = reponsesDe<{ vers: string }>(ctx, etat.etape)[etat.porteur];
      const vers = lancer?.vers;
      const passer = (cible: string) => ({ etat: { ...etat, porteur: cible, passe: etat.passe + 1, consigne: consigne(ctx.hasard), etape: etapeDe(etat.numeroJeu, etat.manche, etat.passe + 1) } });
      if (vers && vers !== etat.porteur && etat.vivants.includes(vers) && now >= etat.depart) return passer(vers);
      // Porteur parti : la patate saute toute seule chez quelqu'un d'autre.
      if (!ctx.connectes.includes(etat.porteur)) {
        const autres = etat.vivants.filter((u) => u !== etat.porteur && ctx.connectes.includes(u));
        if (autres.length) return passer(autres[Math.floor(ctx.hasard() * autres.length)]);
      }
      return null;
    }
    if (etat.phase === 'boum' && now >= (etat.fin ?? 0)) {
      if (etat.vivants.length >= 2) return nouvelleManche(ctx, etat, etat.manche + 1);
      return { etat: { ...etat, phase: 'bilan', fin: now + DUREE_BILAN } };
    }
    if (etat.phase === 'bilan' && now >= (etat.fin ?? 0)) {
      const gagnant = etat.vivants[0];
      return {
        etat,
        fin: { points: pointsDePlace(classementPatate(etat.elimines, etat.vivants)), sorte: 'place', resume: gagnant ? `${ctx.joueurs[gagnant]?.prenom} survit à la patate.` : undefined },
      };
    }
    return null;
  },

  ecran(v) {
    const e = complet(v.etat);
    const total = Math.max(1, v.uids.length - 1);
    const nom = (u: string) => esc(v.joueurs[u]?.prenom ?? '?');
    if (e.phase === 'intro') {
      return introArene('LA PATATE', `${total} EXPLOSION${total > 1 ? 'S' : ''}`, dessinPatate(120), [
        ['1', 'Quand la patate arrive chez toi, dis à voix haute un mot qui répond à la consigne.'],
        ['2', 'Puis fais-la glisser vers un joueur pour la lui lancer.'],
        ['!', 'Elle explose entre 15 s et 1 min. Celui qui l’a est éliminé.'],
      ], e.fin);
    }
    const bandeJoueurs = `<div class="joueurs-arene">${v.uids.map((u) => {
      const elimine = e.elimines.includes(u);
      return `<div class="${u === v.uid ? 'moi' : ''} ${elimine ? 'elimine' : ''} ${u === e.porteur && e.phase === 'jeu' ? 'porteur' : ''}"><span class="pastille" style="--c:${v.joueurs[u].couleur};width:24px;height:24px"></span>${nom(u)}<em>${elimine ? 'boum' : u === e.porteur && e.phase === 'jeu' ? 'patate !' : 'en vie'}</em></div>`;
    }).join('')}</div>`;
    const tete = hud('LA PATATE', e.elimines.length, total, e.phase === 'jeu');

    if (e.phase === 'bilan') {
      const ordre = [...e.vivants, ...[...e.elimines].reverse()];
      return `${tete}
        <div class="vainqueur-arene">${mallow({ taille: 90, couronne: true })}<p><strong>${nom(ordre[0])}</strong> survit à la patate</p></div>
        <div class="pile">${classementBarres(ordre.map((u, i) => ({ joueur: v.joueurs[u], texte: i === 0 ? 'survivant' : `${e.elimines.length - e.elimines.indexOf(u) + 1}e`, part: 1 - i / ordre.length, moi: u === v.uid })))}</div>`;
    }
    if (e.phase === 'boum') {
      const moi = e.explose === v.uid;
      return `${tete}
        <div class="boum-patate" aria-live="assertive"><div class="eclat"></div><p class="mot-boum">BOUM !</p></div>
        <h2 class="question centre-texte">${moi ? 'Tu as explosé…' : `${nom(e.explose!)} est éliminé`}</h2>
        ${bandeJoueurs}
        <p class="attente">${e.vivants.length >= 2 ? 'Nouvelle patate dans un instant…' : 'C’est fini !'}</p>`;
    }
    // En jeu.
    const porteur = e.porteur === v.uid;
    const elimine = e.elimines.includes(v.uid);
    const lanceVers = v.local[e.etape] as string | undefined;
    if (porteur && !lanceVers) {
      const cibles = e.vivants.filter((u) => u !== v.uid);
      return `${tete}
        <div class="consigne-patate" data-depart="${e.depart}"><span>C’EST TOI ! Dis à voix haute :</span><strong>${esc(e.consigne)}</strong></div>
        <div class="cibles-patate">${cibles.map((u) => `<button class="cible-patate" style="--c:${v.joueurs[u].couleur}" data-action="jeu" data-geste="lancer" data-valeur="${u}" data-depart="${e.depart}">${nom(u)}</button>`).join('')}</div>
        <div class="zone-patate"><div class="patate-a-lancer" data-glisser-patate>${dessinPatate(150)}</div></div>
        <p class="aide">Fais glisser la patate vers un joueur (ou touche son nom).</p>`;
    }
    return `${tete}
      <div class="zone-patate spectateur"><div class="patate-chez">${dessinPatate(130)}</div></div>
      <h2 class="question centre-texte">${lanceVers ? `Lancée vers ${nom(lanceVers)} !` : `La patate est chez <span style="color:${v.joueurs[e.porteur]?.couleur}">${nom(e.porteur)}</span>`}</h2>
      ${lanceVers ? '' : `<p class="consigne-spectateur">« ${esc(e.consigne)} »</p>`}
      ${elimine ? '<p class="aide">Tu es éliminé : profite du spectacle.</p>' : ''}
      ${bandeJoueurs}`;
  },

  gestes: {
    async lancer(el, o, v) {
      const e = complet(v.etat);
      const vers = el.dataset.valeur!;
      if (e.phase !== 'jeu' || e.porteur !== v.uid || o.local[e.etape] !== undefined || !e.vivants.includes(vers)) return;
      if (maintenant() < e.depart) return; // pas avant « Partez ! »
      o.local[e.etape] = vers;
      o.rafraichir();
      await o.repondre({ vers });
    },
  },
};
