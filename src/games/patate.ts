// « Colis piégé » (identifiant interne « patate », son premier nom) : un colis piégé passe de téléphone en
// téléphone. Celui qui l'a dit à voix haute un mot qui répond à la consigne (« Un animal en B »), puis le renvoie
// (glisser vers un joueur, ou toucher son nom). Le colis tremble un peu plus à chaque passe. Il « explose » à un
// moment caché (entre 10 et 55 s) : KABOOM, celui qui l'a est éliminé. On continue jusqu'au dernier.
// Le moment de l'explosion n'est connu que de l'hôte (prive/patate) : personne ne peut tricher en le lisant.
import { hacher, hasardDe } from '../flash';
import { maintenant } from '../firebase';
import { mallow } from '../mallow';
import { esc } from '../outils';
import { pointsDePlace } from '../score';
import { reponsesDe, type EtatDeBase, type MiniJeu } from './interface';
import { classementBarres, hud, introArene } from './arene';

const DUREE_INTRO = 7000;
const PRETS = 3000; // « La patate arrive… »
const EXPLOSION_MIN = 10_000;
const EXPLOSION_MAX = 55_000;
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
  tour?: number; // 0 puis 1 : le colis se joue en 2 tours, tout le monde repart en vie au 2e
  cumul?: Record<string, number>; // classement interne cumulé des tours (plus grand = mieux)
  places?: Record<string, number[]>; // place de chacun à chaque tour (1 = survivant)
}

const NB_TOURS = 2;

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

const T = '#24123A';

/**
 * Le colis piégé : un carton « FRAGILE » avec un réveil scotché dessus.
 * tension (0 à 1) : il tremble plus fort et le couvercle se bombe à chaque passe (sans dire quand il va sauter).
 */
export function dessinColis(taille = 150, tension = 0): string {
  return `<svg class="dessin-colis" style="--t:${Math.max(0, Math.min(1, tension)).toFixed(2)}" width="${taille}" viewBox="0 0 220 200" aria-hidden="true">
    <ellipse cx="110" cy="190" rx="84" ry="8" fill="#000" opacity=".3"/>
    <path d="M30 70 L190 70 L190 180 Q190 186 184 186 L36 186 Q30 186 30 180 Z" fill="#C8925A" stroke="${T}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M168 70 L190 70 L190 180 Q190 186 184 186 L168 186 Z" fill="#A9743F"/>
    <rect x="96" y="70" width="28" height="116" fill="#E7C089" opacity=".9"/>
    <g class="couvercle">
      <path d="M22 50 L198 50 L198 74 L22 74 Z" fill="#D8A066" stroke="${T}" stroke-width="5" stroke-linejoin="round"/>
      <rect x="96" y="50" width="28" height="24" fill="#E7C089"/>
      <path d="M26 54 L120 54" stroke="#fff" stroke-width="3" opacity=".5" stroke-linecap="round"/>
    </g>
    <g transform="rotate(-6 70 128)">
      <rect x="40" y="100" width="62" height="52" rx="6" fill="#FFF6EA" stroke="${T}" stroke-width="3.5"/>
      <text x="71" y="122" text-anchor="middle" font-family="Bungee, Unbounded, Arial Black, sans-serif" font-size="11" font-weight="900" fill="#E2344C">FRAGILE</text>
      <path d="M50 132 h42 M50 142 h30" stroke="#C4BCE6" stroke-width="3" stroke-linecap="round"/>
    </g>
    <circle cx="140" cy="132" r="26" fill="#FFF6EA" stroke="${T}" stroke-width="4.5"/>
    <circle cx="140" cy="132" r="20" fill="none" stroke="#E2344C" stroke-width="2" stroke-dasharray="2 8.5"/>
    <path class="aiguille" d="M140 132 L140 116" stroke="${T}" stroke-width="4" stroke-linecap="round"/>
    <circle cx="140" cy="132" r="3.5" fill="${T}"/>
    <path d="M124 108 l-6 -8 M156 108 l6 -8" stroke="${T}" stroke-width="5" stroke-linecap="round"/>
  </svg>`;
}

/** L'explosion : bulle « KABOOM », morceaux de carton qui volent, réveil projeté en l'air, fumée. */
const KABOOM = `<svg class="bulle-kaboom" viewBox="0 0 240 200" aria-hidden="true">
  <path d="M120 6 L140 54 L190 26 L176 78 L232 86 L186 116 L222 160 L166 150 L160 196 L122 160 L84 196 L80 150 L22 162 L58 118 L8 88 L64 78 L48 26 L100 54 Z" fill="#FFD84A" stroke="${T}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M120 40 L134 70 L168 56 L158 88 L194 96 L162 112 L184 140 L148 134 L142 162 L120 140 L98 162 L92 134 L56 140 L78 112 L46 96 L82 88 L72 56 L106 70 Z" fill="#FF8A3D"/>
  <text x="120" y="112" text-anchor="middle" font-family="Bungee, Unbounded, Arial Black, sans-serif" font-weight="900" font-size="34" fill="#FFF6EA" stroke="${T}" stroke-width="5" paint-order="stroke">KABOOM</text>
</svg>`;
const PANNEAUX = ['-130px,-150px,-200deg', '130px,-140px,220deg', '-140px,110px,-260deg', '140px,120px,280deg', '0px,-170px,160deg']
  .map((v) => { const [dx, dy, r] = v.split(','); return `<span class="panneau" style="--dx:${dx};--dy:${dy};--r:${r}"></span>`; }).join('');

/** Tension du colis : elle monte avec le nombre de passes de la manche (0 à 1). */
const tensionDe = (passe: number) => Math.min(1, passe / 8);
/**
 * Fausse alerte : environ une passe sur trois, le colis se met à trembler très fort un instant… puis se calme.
 * Tirée à partir de la passe : la même sur tous les téléphones. Elle ne dit rien du vrai moment de l'explosion.
 */
function fausseAlerte(e: { etape: string; passe: number }): string {
  const h = hasardDe(hacher(`alerte:${e.etape}:${e.passe}`));
  if (h() > 0.35) return '';
  return `alerte-${e.passe % 2 ? 'a' : 'b'}" style="--da:${(1.5 + h() * 4).toFixed(1)}s`;
}

export const patate: MiniJeu<Etat> = {
  id: 'patate',
  nom: 'Colis piégé',
  accroche: 'Dis un mot, renvoie le colis. Il va sauter…',
  explication: {
    comment: 'Le colis piégé arrive sur le téléphone de quelqu’un avec une consigne (« Un animal en B »). Il dit un mot à voix haute, puis renvoie le colis au joueur de son choix en le faisant glisser. Le colis tremble de plus en plus. Il saute à un moment caché, entre 10 et 55 secondes : celui qui l’a est éliminé.',
    gagner: 'On joue 2 tours : à chaque tour, on élimine jusqu’au dernier survivant, puis tout le monde repart en vie. Le classement additionne les places des 2 tours.',
    note: 'Le groupe juge le mot dit à voix haute : pas de mot, pas de lancer !',
  },
  icone: '<path d="M3 8h18v12H3z" fill="currentColor"/><path d="M2 5h20v4H2z" fill="currentColor" opacity=".7"/><path d="M10 5h4v15h-4z" fill="#fff" opacity=".45"/>',
  couleur: '#E0A060',
  autorise: (_n, nb) => nb >= 3,

  demarrer(ctx) {
    const base: Etat = {
      etape: `patate-${ctx.numeroJeu}-intro`, phase: 'intro', numeroJeu: ctx.numeroJeu, manche: 0, vivants: [...ctx.uids], elimines: [],
      porteur: ctx.uids[0], passe: 0, consigne: '', depart: 0, fin: ctx.maintenant + DUREE_INTRO,
    };
    // Les règles se lisent avant (écran « Je suis prêt ») : on commence directement par le premier colis.
    return nouvelleManche(ctx, base, 0);
  },

  regles: () => {
    return introArene('COLIS PIÉGÉ', `${NB_TOURS} TOURS`, dessinColis(150), [
      ['1', 'Quand le colis arrive chez toi, dis à voix haute un mot qui répond à la consigne.'],
      ['2', 'Puis fais-le glisser vers un joueur pour le lui renvoyer.'],
      ['!', 'Il saute entre 10 et 55 s. Celui qui l’a est éliminé. 2 tours : tout le monde repart en vie au 2e.'],
    ]);
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
      // Fin du tour : on note la place de chacun (1 = survivant) et on cumule.
      const scoreTour = classementPatate(etat.elimines, etat.vivants);
      const ordre = [...etat.vivants, ...[...etat.elimines].reverse()];
      const cumul = Object.fromEntries(ctx.uids.map((u) => [u, (etat.cumul?.[u] ?? 0) + (scoreTour[u] ?? 0)]));
      const places = Object.fromEntries(ctx.uids.map((u) => [u, [...(etat.places?.[u] ?? []), ordre.indexOf(u) + 1 || ordre.length]]));
      return { etat: { ...etat, phase: 'bilan', cumul, places, fin: now + DUREE_BILAN } };
    }
    if (etat.phase === 'bilan' && now >= (etat.fin ?? 0)) {
      const tour = etat.tour ?? 0;
      if (tour + 1 < NB_TOURS) {
        // 2e tour : tout le monde repart en vie.
        return nouvelleManche(ctx, { ...etat, tour: tour + 1, vivants: [...ctx.uids], elimines: [], explose: undefined }, etat.manche + 1);
      }
      const cumul = etat.cumul ?? classementPatate(etat.elimines, etat.vivants);
      const meilleur = Math.max(...Object.values(cumul));
      const gagnants = Object.keys(cumul).filter((u) => cumul[u] === meilleur).map((u) => ctx.joueurs[u]?.prenom);
      return { etat, fin: { points: pointsDePlace(cumul), sorte: 'place', resume: `${gagnants.join(' et ')} : le meilleur survivant des ${NB_TOURS} tours.` } };
    }
    return null;
  },

  ecran(v) {
    const e = complet(v.etat);
    const total = Math.max(1, v.uids.length - 1);
    const nom = (u: string) => esc(v.joueurs[u]?.prenom ?? '?');
    if (e.phase === 'intro') {
      return introArene('COLIS PIÉGÉ', `${NB_TOURS} TOURS`, dessinColis(150), [
        ['1', 'Quand le colis arrive chez toi, dis à voix haute un mot qui répond à la consigne.'],
        ['2', 'Puis fais-le glisser vers un joueur pour le lui renvoyer.'],
        ['!', 'Il saute entre 10 et 55 s. Celui qui l’a est éliminé. 2 tours : tout le monde repart en vie au 2e.'],
      ], e.fin);
    }
    const bandeJoueurs = `<div class="joueurs-arene">${v.uids.map((u) => {
      const elimine = e.elimines.includes(u);
      return `<div class="${u === v.uid ? 'moi' : ''} ${elimine ? 'elimine' : ''} ${u === e.porteur && e.phase === 'jeu' ? 'porteur' : ''}"><span class="pastille" style="--c:${v.joueurs[u].couleur};width:24px;height:24px"></span>${nom(u)}<em>${elimine ? 'éliminé' : u === e.porteur && e.phase === 'jeu' ? 'colis !' : 'en vie'}</em></div>`;
    }).join('')}</div>`;
    const tete = hud(`COLIS PIÉGÉ · TOUR ${(e.tour ?? 0) + 1}/${NB_TOURS}`, e.elimines.length, total, e.phase === 'jeu');

    if (e.phase === 'bilan') {
      const tour = e.tour ?? 0;
      const dernier = tour + 1 >= NB_TOURS;
      const placeTexte = (p: number) => (p === 1 ? '1er' : `${p}e`);
      if (!dernier) {
        // Fin du 1er tour : qui a survécu, et on repart.
        const ordre = [...e.vivants, ...[...e.elimines].reverse()];
        return `${tete}
          <div class="vainqueur-arene">${dessinColis(90)}<p><strong>${nom(ordre[0])}</strong> survit au tour ${tour + 1}</p></div>
          <div class="pile">${classementBarres(ordre.map((u, i) => ({ joueur: v.joueurs[u], texte: i === 0 ? 'survivant' : placeTexte(i + 1), part: 1 - i / ordre.length, moi: u === v.uid })))}</div>
          <p class="attente">Tour ${tour + 2} dans un instant : tout le monde repart en vie…</p>`;
      }
      // Fin du jeu : classement sur les ${NB_TOURS} tours.
      const cumul = e.cumul ?? {};
      const ordre = [...v.uids].sort((a, b) => (cumul[b] ?? 0) - (cumul[a] ?? 0));
      const max = Math.max(1, ...Object.values(cumul));
      return `${tete}
        <div class="vainqueur-arene">${mallow({ taille: 90, couronne: true })}<p><strong>${nom(ordre[0])}</strong> survit le mieux au colis piégé</p></div>
        <div class="pile">${classementBarres(ordre.map((u) => ({ joueur: v.joueurs[u], texte: (e.places?.[u] ?? []).map(placeTexte).join(' · '), part: (cumul[u] ?? 0) / max, moi: u === v.uid })))}</div>
        <p class="aide">Place à chaque tour. Le classement additionne les ${NB_TOURS} tours.</p>`;
    }
    if (e.phase === 'boum') {
      const moi = e.explose === v.uid;
      return `${tete}
        <div class="boum-colis" aria-live="assertive">
          ${PANNEAUX}
          ${KABOOM}
          <div class="colis-charge">${dessinColis(190, 1)}</div>
          <div class="flash-blanc"></div>
        </div>
        <h2 class="question centre-texte">${moi ? 'Tu es éliminé…' : `${nom(e.explose!)} est éliminé`}</h2>
        ${bandeJoueurs}
        <p class="attente">${e.vivants.length >= 2 ? 'Nouveau colis dans un instant…' : 'C’est fini !'}</p>`;
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
        <div class="zone-patate ${fausseAlerte(e)}"><div class="patate-a-lancer" data-glisser-patate>${dessinColis(190, tensionDe(e.passe))}</div></div>
        <p class="aide">Fais glisser le colis vers un joueur (ou touche son nom).</p>`;
    }
    return `${tete}
      <div class="zone-patate spectateur ${fausseAlerte(e)}"><div class="patate-chez">${dessinColis(170, tensionDe(e.passe))}</div></div>
      <h2 class="question centre-texte">${lanceVers ? `Renvoyé à ${nom(lanceVers)} !` : `Le colis est chez <span style="color:${v.joueurs[e.porteur]?.couleur}">${nom(e.porteur)}</span>`}</h2>
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
