// L'accueil vivant : Mallow qu'on grille à coups de taps, la carte « TOP SECRET » à gratter, et le retour du joueur
// (cuisson de son Mallow dans sa dernière saison, et revanche s'il s'est fait griller). Validé par Kilyan le 27/11.
// Mallow et la carte sont marqués data-garder : le rafraîchissement de l'écran ne les touche pas (ui.ts › harmoniser).
import { get, ref } from 'firebase/database';
import { db } from './firebase';
import { mallow, mallowGrille, NOMS_CUISSON } from './mallow';
import { sons } from './son';
import { vibrer } from './ui';
import { esc } from './outils';
import { avantPalierSuivant, niveauCuisson, PALIERS_CUISSON, saisonsConnues, type Saison } from './saison';
import missions from './data/missions.json';

// ——— Mallow à griller ———

/** Taps pour passer d'un stade de cuisson au suivant. */
export const TAPS_PAR_STADE = 4;
/** Stades sur l'accueil : Doré (son état habituel), Caramel, Flambé, puis Carbonisé (jamais cru). */
const STADES = [2, 3, 4];

let stade = 0; // index dans STADES ; STADES.length = carbonisé
let taps = 0;
/** Après « Carbonisé ! », Mallow ne réagit plus pendant 1 s : on voit l'animation même en tapant très vite. */
const PAUSE_CARBONISE = 1000;
let bloqueJusqua = 0;
/** Vibration à jouer quand le doigt se lève : Chrome (Android) ne l'autorise pas toujours au moment du toucher. */
let vibrationEnAttente: number | number[] | null = null;
const vibrerAuRelacher = (motif: number | number[]) => {
  vibrationEnAttente = motif;
};

export function mallowAccueil(): string {
  return `<div class="flotte mallow-griller" data-griller data-garder role="button" aria-label="Griller Mallow">
    <div class="corps-griller">${mallow({ taille: 132, cuisson: STADES[0] })}</div>
    <div class="jauge-cuisson" aria-hidden="true"><i></i></div>
  </div>`;
}

function braises(zone: HTMLElement, nb: number): void {
  for (let k = 0; k < nb; k++) {
    const a = Math.random() * Math.PI * 2;
    const d = 30 + Math.random() * 40;
    const b = document.createElement('span');
    b.className = 'braise';
    b.style.setProperty('--dx', `${Math.cos(a) * d}px`);
    b.style.setProperty('--dy', `${Math.sin(a) * d - 30}px`);
    b.addEventListener('animationend', () => b.remove());
    zone.appendChild(b);
  }
}

function bulle(zone: HTMLElement, texte: string, classe = 'etiq-cuisson'): void {
  const e = document.createElement('span');
  e.className = classe;
  e.textContent = texte;
  e.addEventListener('animationend', () => e.remove());
  zone.appendChild(e);
}

function taperMallow(zone: HTMLElement): void {
  if (performance.now() < bloqueJusqua) return;
  const corps = zone.querySelector<HTMLElement>('.corps-griller')!;
  const jauge = zone.querySelector<HTMLElement>('.jauge-cuisson')!;
  const ecraser = () => {
    corps.classList.remove('tape');
    void corps.offsetWidth; // relance l'animation
    corps.classList.add('tape');
  };
  // Carbonisé : le tap suivant l'éteint, il redevient Doré.
  if (stade >= STADES.length) {
    stade = 0;
    taps = 0;
    zone.style.setProperty('--lueur', '0');
    jauge.style.setProperty('--j', '0%');
    jauge.classList.remove('on');
    corps.innerHTML = mallow({ taille: 132, cuisson: STADES[0] });
    ecraser();
    bulle(zone, '', 'fumee-griller');
    bulle(zone, 'PFFF…', 'pfff-griller');
    sons.pschhh();
    vibrerAuRelacher(80);
    return;
  }
  taps++;
  jauge.classList.add('on');
  zone.style.setProperty('--lueur', String(Math.min(0.6, (stade * TAPS_PAR_STADE + taps) * 0.045)));
  jauge.style.setProperty('--j', `${(taps / TAPS_PAR_STADE) * 100}%`);
  if (taps < TAPS_PAR_STADE) {
    ecraser();
    braises(zone, 2);
    sons.gresille(stade);
    vibrerAuRelacher(35);
    return;
  }
  taps = 0;
  stade++;
  jauge.style.setProperty('--j', '0%');
  if (stade < STADES.length) {
    corps.innerHTML = mallow({ taille: 132, cuisson: STADES[stade] });
    braises(zone, 7);
    bulle(zone, NOMS_CUISSON[STADES[stade]]);
    sons.cuit();
    vibrerAuRelacher(60);
  } else {
    corps.innerHTML = mallowGrille({ taille: 132 });
    braises(zone, 14);
    jauge.classList.remove('on');
    bulle(zone, 'Carbonisé !', 'etiq-cuisson carbonise');
    bloqueJusqua = performance.now() + PAUSE_CARBONISE;
    sons.cuit();
    sons.gresille(3);
    vibrerAuRelacher([60, 40, 120]);
  }
  ecraser();
}

// ——— Carte à gratter ———

/** Missions qu'on peut montrer sur l'accueil : douces, assez courtes, {cible} remplacé par « ton voisin de droite ». */
const MISSIONS_ACCUEIL = (missions as { texte: string; niveau: string }[])
  .filter((m) => m.niveau === 'soft' && m.texte.length <= 100)
  .map((m) => m.texte.replaceAll('{cible}', 'ton voisin de droite'));

const ICONE_CADENAS = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';

export function cartesAccueil(): string {
  return `<div class="cartes-secretes" data-garder>
  <div class="cartes">
    <div class="carte-s g" aria-hidden="true"><i></i><i style="width:70%"></i><i style="width:50%"></i></div>
    <button class="carte-s c" data-gratter aria-label="Gratter une mission secrète">${ICONE_CADENAS}<span>TOP SECRET</span></button>
    <div class="carte-s d" aria-hidden="true"><i></i><i style="width:60%"></i><i style="width:80%"></i></div>
  </div>
  <p class="legende-cartes">1 grosse mission + des missions flash t’attendent</p>
</div>`;
}

function ouvrirCarte(carte: HTMLElement): void {
  const mission = MISSIONS_ACCUEIL[Math.floor(Math.random() * MISSIONS_ACCUEIL.length)] ?? '';
  carte.classList.add('grat');
  carte.removeAttribute('data-gratter');
  carte.innerHTML = `<span class="mission-grat"><small>MISSION SECRÈTE</small><b>${esc(mission)}</b></span><canvas width="500" height="300" aria-hidden="true"></canvas>`;
  const cv = carte.querySelector('canvas')!;
  const g = cv.getContext('2d');
  if (!g) return;
  const fond = g.createLinearGradient(0, 0, 0, 300);
  fond.addColorStop(0, '#FFE97A');
  fond.addColorStop(1, '#FFC93C');
  g.fillStyle = fond;
  g.fillRect(0, 0, 500, 300);
  g.fillStyle = '#120D26';
  g.textAlign = 'center';
  g.font = '900 44px Unbounded, "Arial Black", sans-serif';
  g.fillText('TOP SECRET', 250, 140);
  g.font = '800 22px "Plus Jakarta Sans", system-ui, sans-serif';
  g.fillText('Gratte avec ton doigt', 250, 190);
  for (let i = 0; i < 400; i++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.25})`;
    g.fillRect(Math.random() * 500, Math.random() * 300, 2, 2);
  }
  g.globalCompositeOperation = 'destination-out';
  g.lineCap = 'round';
  g.lineWidth = 46;
  let dernier: [number, number] | null = null;
  let dernierSon = 0;
  const legende = carte.closest('.cartes-secretes')?.querySelector<HTMLElement>('.legende-cartes');
  if (legende) legende.textContent = 'Gratte la carte…';
  const pos = (e: PointerEvent): [number, number] => {
    const r = cv.getBoundingClientRect();
    return [((e.clientX - r.left) * 500) / r.width, ((e.clientY - r.top) * 300) / r.height];
  };
  const gratter = (e: PointerEvent) => {
    if (cv.classList.contains('fini')) return;
    const [x, y] = pos(e);
    g.beginPath();
    g.moveTo(...(dernier ?? [x, y]));
    g.lineTo(x, y);
    g.stroke();
    dernier = [x, y];
    if (performance.now() - dernierSon > 90) {
      dernierSon = performance.now();
      sons.gratte();
    }
    const d = g.getImageData(0, 0, 500, 300).data;
    let vide = 0;
    for (let i = 3; i < d.length; i += 40) if (d[i] === 0) vide++;
    if (vide / (d.length / 40) > 0.55) {
      cv.classList.add('fini');
      sons.ding();
      vibrer(50);
      if (legende) legende.textContent = 'Une des 100 missions du jeu… Qui va se faire griller ce soir ?';
    }
  };
  cv.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    dernier = null;
    cv.setPointerCapture?.(e.pointerId);
    gratter(e);
  });
  cv.addEventListener('pointermove', (e) => {
    if (e.buttons || e.pointerType === 'touch') gratter(e);
  });
  cv.addEventListener('pointerup', () => {
    dernier = null;
  });
}

// ——— Retour du joueur ———

export interface RetourJoueur {
  prenom: string;
  nomSaison: string;
  missions: number;
  revanche: string | null; // prénom de celui qui l'a grillé à la dernière partie
}

let retour: RetourJoueur | null = null;
export const retourJoueur = (): RetourJoueur | null => retour;

/** Va chercher, pour la saison la plus récente de ce téléphone, la cuisson du joueur et une éventuelle revanche. */
export async function chargerRetour(uid: string, rafraichir: () => void): Promise<void> {
  const derniere = saisonsConnues()[0];
  if (!derniere) return;
  try {
    const s = (await get(ref(db, `saisons/${derniere.id}`))).val() as Saison | null;
    const moi = s?.membres?.[uid];
    if (!moi) return;
    const grilleur = Object.keys(s?.rancunes?.[uid] ?? {}).find((u) => s?.membres?.[u]);
    retour = { prenom: moi.prenom, nomSaison: derniere.nom, missions: moi.missions, revanche: grilleur ? s!.membres![grilleur].prenom : null };
    rafraichir();
  } catch {
    // Pas de réseau ou pas d'accès : l'accueil reste celui de d'habitude.
  }
}

export function blocRetour(r: RetourJoueur): string {
  const n = niveauCuisson(r.missions);
  const reste = avantPalierSuivant(r.missions);
  const prochain = reste !== null ? NOMS_CUISSON[n + 1] : null;
  // Avancement vers le palier suivant (plein au maximum).
  const paliers = PALIERS_CUISSON;
  const part = reste === null ? 1 : (r.missions - paliers[n]) / (paliers[n + 1] - paliers[n]);
  return `<div class="retour-joueur">
    <div class="carte-retour">
      <span class="tete-retour">${mallow({ vue: 'tete', taille: 52, cuisson: n })}</span>
      <b>Salut ${esc(r.prenom)} ! Ton Mallow est <em>${NOMS_CUISSON[n]}</em></b>
      <div class="jauge-retour" style="--w:${Math.round(part * 100)}%"><i></i></div>
      <small>${prochain ? `Plus que ${reste} mission${reste! > 1 ? 's' : ''} réussie${reste! > 1 ? 's' : ''} pour passer <strong>${prochain}</strong>` : 'Cuisson maximale atteinte !'} · Saison « ${esc(r.nomSaison)} »</small>
    </div>
    ${r.revanche ? `<div class="revanche-retour"><span aria-hidden="true">😤</span><div>La dernière fois, <strong>${esc(r.revanche)}</strong> t’a grillé… Revanche ce soir ?</div></div>` : ''}
  </div>`;
}

// ——— Branchement ———

document.addEventListener('pointerup', () => {
  if (vibrationEnAttente === null) return;
  vibrer(vibrationEnAttente);
  vibrationEnAttente = null;
});

document.addEventListener('pointerdown', (e) => {
  const cible = e.target as HTMLElement;
  const mallowZone = cible.closest?.<HTMLElement>('[data-griller]');
  if (mallowZone) {
    e.preventDefault();
    taperMallow(mallowZone);
    return;
  }
  const carte = cible.closest?.<HTMLElement>('[data-gratter]');
  if (carte) {
    e.preventDefault();
    ouvrirCarte(carte);
  }
});
