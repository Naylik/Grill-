// Vidéos « Grillé ! » à partager (format story 9:16) : fabriquées sur le téléphone, sans serveur.
// Une toile est dessinée image par image, filmée (MediaRecorder) avec les bruitages de l'appli, puis partagée.
//  - A · Récap de la soirée (≈ 35 s) : logo, podium, missions principales révélées, titres, fin.
//  - B · Moment GRILLÉ ! (≈ 12 s) : l'accusation, Mallow qui prend feu, la mission démasquée.
import { mallow, mallowGrille } from './mallow';
import { formatVideo } from './formatVideo';
import { fermerSortieVideo, ouvrirSortieVideo, sons } from './son';

const L = 720;
const H = 1280;
const K = L / 432; // les maquettes étaient dessinées en 432 × 768

export interface JoueurVideo {
  prenom: string;
  couleur: string;
}

export interface DonneesRecap {
  sousTitre: string; // « Soirée du 18 novembre · 5 joueurs · 6 jeux »
  podium: { joueur: JoueurVideo; points: number; cuisson: number }[]; // 1er, 2e, 3e
  missions: { joueur: JoueurVideo; texte: string; reussie: boolean }[]; // 3 au maximum
  titres: { joueur: JoueurVideo; titre: string; pourquoi: string }[]; // 3 au maximum
}

export interface DonneesMoment {
  accuseur: JoueurVideo;
  accuse: JoueurVideo;
  proposition: string;
  mission: string;
  vol: number;
}

// ——— Petits outils de dessin ———

const borne = (x: number) => Math.max(0, Math.min(1, x));
/** Apparition « pop » (léger rebond) : 0 → 1 en 0,5 s à partir de « debut ». */
function pop(t: number, debut: number): number {
  const p = borne((t - debut) / 0.5);
  const c = 1.70158 * 1.6;
  return p === 0 ? 0 : 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2);
}
const DM = 4.5; // durée d'une mission révélée dans le récap
const montee = (t: number, debut: number) => 1 - Math.pow(1 - borne((t - debut) / 0.6), 3);

function image(svg: string): Promise<HTMLImageElement> {
  return new Promise((ok, ko) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = ko;
    i.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

function rectArrondi(c: CanvasRenderingContext2D, x: number, y: number, l: number, h: number, r: number): void {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + l, y, x + l, y + h, r);
  c.arcTo(x + l, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + l, y, r);
  c.closePath();
}

/** Coupe un texte en lignes qui tiennent dans « largeur ». */
function lignes(c: CanvasRenderingContext2D, texte: string, largeur: number): string[] {
  const res: string[] = [];
  let ligne = '';
  for (const mot of texte.split(' ')) {
    const essai = ligne ? `${ligne} ${mot}` : mot;
    if (c.measureText(essai).width > largeur && ligne) {
      res.push(ligne);
      ligne = mot;
    } else ligne = essai;
  }
  if (ligne) res.push(ligne);
  return res;
}

function texte(c: CanvasRenderingContext2D, t: string, x: number, y: number, o: { taille: number; police?: 'titre' | 'corps'; couleur?: string; lueur?: string; largeur?: number; interligne?: number }): number {
  c.font = `${o.police === 'corps' ? '800' : '900'} ${o.taille * K}px ${o.police === 'corps' ? '"Plus Jakarta Sans"' : 'Unbounded'}, sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = o.couleur ?? '#F4F0FF';
  c.shadowColor = o.lueur ?? 'transparent';
  c.shadowBlur = o.lueur ? 24 : 0;
  const ls = lignes(c, t, (o.largeur ?? 380) * K);
  const pas = o.taille * K * (o.interligne ?? 1.25);
  const y0 = y - ((ls.length - 1) * pas) / 2;
  ls.forEach((l, i) => c.fillText(l, x, y0 + i * pas));
  c.shadowBlur = 0;
  return ls.length * pas;
}

function fond(c: CanvasRenderingContext2D): void {
  const g = c.createRadialGradient(L / 2, 0, 40, L / 2, H * 0.2, H * 0.85);
  g.addColorStop(0, '#3B2A7A');
  g.addColorStop(1, '#0D0A1E');
  c.fillStyle = g;
  c.fillRect(0, 0, L, H);
  c.font = `800 ${12 * K}px "Plus Jakarta Sans", sans-serif`;
  c.fillStyle = '#ffffff66';
  c.textAlign = 'center';
  c.fillText('GRILLÉ !', L / 2, H - 22 * K);
}

/** Opacité d'une scène : fondu d'entrée et de sortie. */
const opaciteScene = (t: number, debut: number, duree: number) => (t < debut || t > debut + duree ? 0 : Math.min(borne((t - debut) / 0.25), borne((debut + duree - t) / 0.3)));

function dessinerAvec(c: CanvasRenderingContext2D, alpha: number, echelle: number, cx: number, cy: number, f: () => void): void {
  if (alpha <= 0 || echelle <= 0) return;
  c.save();
  c.globalAlpha = alpha;
  c.translate(cx, cy);
  c.scale(echelle, echelle);
  c.translate(-cx, -cy);
  f();
  c.restore();
}

function carteMission(c: CanvasRenderingContext2D, cy: number, titre: string, mission: string): { haut: number } {
  const l = 330 * K;
  const x = (L - l) / 2;
  c.font = `800 ${21 * K}px "Plus Jakarta Sans", sans-serif`;
  const ls = lignes(c, mission, l - 68 * K);
  const hm = ls.length * 21 * K * 1.3 + 28 * K;
  const h = hm + 80 * K;
  const y = cy - h / 2;
  rectArrondi(c, x, y, l, h, 22 * K);
  c.fillStyle = '#1A1532';
  c.fill();
  c.strokeStyle = '#FFD84A66';
  c.lineWidth = 3;
  c.stroke();
  texte(c, titre, L / 2, y + 34 * K, { taille: 18, couleur: '#F4F0FF' });
  rectArrondi(c, x + 20 * K, y + 60 * K, l - 40 * K, hm, 14 * K);
  c.fillStyle = '#FFF6EA';
  c.fill();
  texte(c, mission, L / 2, y + 60 * K + hm / 2, { taille: 21, police: 'corps', couleur: '#1A1438', largeur: (l - 68 * K) / K, interligne: 1.3 });
  return { haut: y };
}

function tampon(c: CanvasRenderingContext2D, t: number, debut: number, x: number, y: number, mot: string, couleur: string): void {
  const p = borne((t - debut) / 0.35);
  if (p <= 0) return;
  c.save();
  c.translate(x, y);
  c.rotate(0.21);
  c.scale(1 + 2 * (1 - p), 1 + 2 * (1 - p));
  c.globalAlpha *= p;
  c.font = `900 ${22 * K}px Unbounded, sans-serif`;
  const l = c.measureText(mot).width + 28 * K;
  rectArrondi(c, -l / 2, -24 * K, l, 48 * K, 12 * K);
  c.fillStyle = '#0D0A1E';
  c.fill();
  c.lineWidth = 6;
  c.strokeStyle = couleur;
  c.stroke();
  c.fillStyle = couleur;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(mot, 0, 2);
  c.restore();
}

// ——— Les deux vidéos ———

interface Video {
  duree: number;
  dessiner: (c: CanvasRenderingContext2D, t: number) => void;
  /** Bruitages : [instant (s), son]. */
  sons: [number, () => void][];
}

async function videoRecap(d: DonneesRecap): Promise<Video> {
  const mallows = await Promise.all(d.podium.map((p) => image(mallow({ taille: 200, cuisson: p.cuisson }))));
  const flambe = await image(mallow({ taille: 200, cuisson: 4 }));
  const missions = d.missions.slice(0, 3);
  const titres = d.titres.slice(0, 3);
  // Rythme lent : chaque scène reste assez longtemps pour être lue.
  const tM = 9.5; // début des missions (logo 4 s, podium 5,5 s)
  const tT = tM + DM * missions.length; // début des titres
  const tF = tT + (titres.length ? 5 : 0); // fin
  const duree = tF + 3.5;
  const ordre = [1, 0, 2]; // 2e, 1er, 3e
  // Peu de bruitages : seulement le tampon de chaque mission.
  const sonsRecap: [number, () => void][] = missions.map((m, i) => [tM + i * DM + 2, m.reussie ? () => sons.ding() : () => sons.rate()]);
  return {
    duree,
    sons: sonsRecap,
    dessiner(c, t) {
      fond(c);
      // Logo et date.
      let a = opaciteScene(t, 0, 4);
      dessinerAvec(c, a, pop(t, 0.1), L / 2, H * 0.44, () => texte(c, 'GRILLÉ !', L / 2, H * 0.44, { taille: 62, couleur: '#FFD84A', lueur: '#FF7A3D' }));
      dessinerAvec(c, a * montee(t, 0.6), 1, L / 2, H * 0.53, () => texte(c, d.sousTitre, L / 2, H * 0.53, { taille: 17, police: 'corps', couleur: '#BDB3E6' }));
      // Podium.
      a = opaciteScene(t, 4, 5.5);
      if (a > 0) {
        texte(c, 'LE PODIUM', L / 2, H * 0.27, { taille: 17, police: 'corps', couleur: '#BDB3E6' });
        const base = H * 0.74;
        ordre.forEach((rang, k) => {
          const p = d.podium[rang];
          if (!p) return;
          const debut = 4 + [0.6, 1.4, 0][k];
          const m = montee(t, debut);
          if (m <= 0) return;
          c.save();
          c.globalAlpha = a * m;
          c.translate(0, (1 - m) * 100);
          const lx = 118 * K;
          const x = L / 2 + (k - 1) * (lx + 10 * K) - lx / 2;
          const h = [90, 130, 60][k] * K;
          c.fillStyle = ['#C9D2E3', '#FFD84A', '#E0A35C'][k];
          rectArrondi(c, x, base - h, lx, h + 20, 14 * K);
          c.fill();
          texte(c, String(rang + 1), x + lx / 2, base - h / 2, { taille: 30, couleur: '#1A1438' });
          texte(c, `${p.points} pts`, x + lx / 2, base - h - 22 * K, { taille: 13, police: 'corps', couleur: '#BDB3E6' });
          texte(c, p.joueur.prenom, x + lx / 2, base - h - 48 * K, { taille: 15 });
          const tm = (rang === 0 ? 110 : 86) * K;
          c.drawImage(mallows[rang], x + lx / 2 - tm / 2, base - h - 64 * K - tm * 1.25, tm, tm * 1.25);
          c.restore();
        });
      }
      // Missions principales.
      missions.forEach((m, i) => {
        const debut = tM + i * DM;
        const am = opaciteScene(t, debut, DM);
        if (am <= 0) return;
        c.save();
        c.globalAlpha = am;
        texte(c, 'LES MISSIONS SECRÈTES', L / 2, H * 0.33, { taille: 17, police: 'corps', couleur: '#BDB3E6' });
        c.translate(0, (1 - montee(t, debut + 0.2)) * 100);
        const { haut } = carteMission(c, H * 0.5, `${m.joueur.prenom} devait…`, m.texte);
        tampon(c, t, debut + 2, L / 2 + 120 * K, haut, m.reussie ? 'RÉUSSIE' : 'RATÉE', m.reussie ? '#5CF2C2' : '#FF5A6E');
        c.restore();
      });
      // Titres.
      a = opaciteScene(t, tT, 5);
      if (a > 0) {
        c.save();
        c.globalAlpha = a;
        texte(c, 'LES TITRES', L / 2, H * 0.33, { taille: 17, police: 'corps', couleur: '#BDB3E6' });
        titres.forEach((ti, i) => {
          const m = montee(t, tT + 0.4 + i * 0.8);
          if (m <= 0) return;
          c.save();
          c.globalAlpha = a * m;
          c.translate(0, (1 - m) * 60);
          const y = H * 0.42 + i * 78 * K;
          const l = 330 * K;
          const x = (L - l) / 2;
          rectArrondi(c, x, y, l, 64 * K, 16 * K);
          c.fillStyle = '#ffffff14';
          c.fill();
          c.beginPath();
          c.arc(x + 30 * K, y + 32 * K, 13 * K, 0, Math.PI * 2);
          c.fillStyle = ti.joueur.couleur;
          c.fill();
          c.textAlign = 'left';
          c.textBaseline = 'middle';
          c.font = `900 ${15 * K}px Unbounded, sans-serif`;
          c.fillStyle = '#FFD84A';
          c.fillText(ti.titre, x + 54 * K, y + 22 * K);
          c.font = `800 ${14 * K}px "Plus Jakarta Sans", sans-serif`;
          c.fillStyle = '#F4F0FF';
          c.fillText(`${ti.joueur.prenom} · ${ti.pourquoi}`.slice(0, 40), x + 54 * K, y + 44 * K);
          c.restore();
        });
        c.restore();
      }
      // Fin.
      a = opaciteScene(t, tF, 3.5);
      dessinerAvec(c, a, pop(t, tF), L / 2, H * 0.36, () => c.drawImage(flambe, L / 2 - 75 * K, H * 0.36 - 94 * K, 150 * K, 188 * K));
      dessinerAvec(c, a, pop(t, tF + 0.3), L / 2, H * 0.58, () => texte(c, 'Qui va se faire griller ?', L / 2, H * 0.58, { taille: 36, couleur: '#FFD84A', lueur: '#FFD84A88', largeur: 360 }));
      dessinerAvec(c, a * montee(t, tF + 0.7), 1, L / 2, H * 0.68, () => texte(c, 'Grillé ! · le jeu de soirée à missions secrètes', L / 2, H * 0.68, { taille: 15, police: 'corps', couleur: '#BDB3E6' }));
    },
  };
}

async function videoMoment(d: DonneesMoment): Promise<Video> {
  const normal = await image(mallow({ taille: 200, cuisson: 1 }));
  const grille = await image(mallowGrille({ taille: 200 }));
  return {
    duree: 11.5,
    sons: [[3.2, () => sons.boum()]], // un seul bruitage : l'explosion au moment du GRILLÉ !
    dessiner(c, t) {
      fond(c);
      // L'accusation (l'écran tremble).
      let a = opaciteScene(t, 0, 3.2);
      if (a > 0) {
        c.save();
        c.globalAlpha = a;
        c.translate(Math.sin(t * 60) * 3, 0);
        texte(c, 'EN DIRECT DE LA SOIRÉE', L / 2, H * 0.38, { taille: 17, police: 'corps', couleur: '#BDB3E6' });
        texte(c, `${d.accuseur.prenom} accuse ${d.accuse.prenom}…`, L / 2, H * 0.46, { taille: 26, largeur: 380 });
        c.restore();
        dessinerAvec(c, a * montee(t, 0.8), 1, L / 2, H * 0.56, () => texte(c, `« ${d.proposition} »`, L / 2, H * 0.56, { taille: 17, police: 'corps', couleur: '#BDB3E6', largeur: 360 }));
      }
      // GRILLÉ ! : flash blanc, Mallow prend feu.
      a = opaciteScene(t, 3.2, 3.3);
      if (a > 0) {
        const p = t - 3.2;
        c.save();
        c.globalAlpha = a;
        const img = p < 0.9 ? normal : grille;
        const tr = p < 0.9 ? Math.sin(t * 70) * 6 : 0;
        const tm = 200 * K;
        c.drawImage(img, L / 2 - tm / 2 + tr, H * 0.42 - tm * 0.62, tm, tm * 1.25);
        // Flammes qui dansent.
        if (p > 0.3) {
          for (let k = 0; k < 5; k++) {
            const x = L / 2 + (k - 2) * 46 * K;
            const h = (60 + 30 * Math.sin(t * 14 + k * 1.7)) * K * Math.min(1, (p - 0.3) * 3);
            c.beginPath();
            c.moveTo(x - 20 * K, H * 0.33);
            c.quadraticCurveTo(x - 24 * K, H * 0.33 - h * 0.6, x, H * 0.33 - h);
            c.quadraticCurveTo(x + 24 * K, H * 0.33 - h * 0.6, x + 20 * K, H * 0.33);
            c.closePath();
            c.fillStyle = k % 2 ? '#FFD84A' : '#FF7A3D';
            c.globalAlpha = a * 0.85;
            c.fill();
          }
          c.globalAlpha = a;
        }
        c.restore();
        dessinerAvec(c, a, pop(t, 3.7), L / 2, H * 0.72, () => texte(c, 'GRILLÉ !', L / 2, H * 0.72, { taille: 64, couleur: '#FF5A6E', lueur: '#FF5A6E' }));
        const blanc = 1 - borne(p / 0.5);
        if (blanc > 0) {
          c.fillStyle = `rgba(255,255,255,${0.9 * blanc})`;
          c.fillRect(0, 0, L, H);
        }
      }
      // La mission démasquée.
      a = opaciteScene(t, 6.5, 5);
      if (a > 0) {
        c.save();
        c.globalAlpha = a;
        texte(c, `${d.accuseur.prenom} a grillé ${d.accuse.prenom}`, L / 2, H * 0.3, { taille: 24, largeur: 380 });
        c.translate(0, (1 - montee(t, 6.8)) * 100);
        carteMission(c, H * 0.48, 'Sa mission secrète', d.mission);
        c.restore();
        dessinerAvec(c, a, pop(t, 8), L / 2, H * 0.66, () => texte(c, `+${d.vol} pts volés`, L / 2, H * 0.66, { taille: 30, couleur: '#FFD84A', lueur: '#FFD84A88' }));
      }
    },
  };
}

// ——— Enregistrement et partage ———

/** Le meilleur format que le téléphone sait enregistrer (mp4 de préférence : WhatsApp, Instagram, TikTok). */

/**
 * Fabrique la vidéo en la jouant sur la toile donnée (elle s'affiche pendant l'enregistrement).
 * « progres » reçoit le temps écoulé (0 → 1).
 */
export async function fabriquerVideo(toile: HTMLCanvasElement, sorte: 'recap' | 'moment', donnees: DonneesRecap | DonneesMoment, progres: (p: number) => void): Promise<File | null> {
  // Sans enregistreur vidéo (vieux téléphone) : la vidéo est seulement jouée, sans fichier à partager.
  const format = formatVideo() && typeof toile.captureStream === 'function' ? formatVideo() : null;
  await Promise.all(['900 20px Unbounded', '800 20px "Plus Jakarta Sans"'].map((f) => document.fonts?.load(f).catch(() => undefined)));
  const video = sorte === 'recap' ? await videoRecap(donnees as DonneesRecap) : await videoMoment(donnees as DonneesMoment);
  toile.width = L;
  toile.height = H;
  const c = toile.getContext('2d')!;
  video.dessiner(c, 0);
  const flux = format ? toile.captureStream(30) : null;
  const audio = format ? ouvrirSortieVideo() : null;
  const enregistreur = format && flux ? new MediaRecorder(new MediaStream([...flux.getVideoTracks(), ...(audio?.getAudioTracks() ?? [])]), { mimeType: format.mime, videoBitsPerSecond: 4_000_000 }) : null;
  const morceaux: Blob[] = [];
  const fini = new Promise<void>((ok) => {
    if (!enregistreur) return ok();
    enregistreur.ondataavailable = (e) => e.data.size && morceaux.push(e.data);
    enregistreur.onstop = () => ok();
  });
  enregistreur?.start(250);
  const debut = performance.now();
  const aJouer = [...video.sons].sort((x, y) => x[0] - y[0]);
  await new Promise<void>((ok) => {
    const image = () => {
      const t = (performance.now() - debut) / 1000;
      while (aJouer.length && aJouer[0][0] <= t) aJouer.shift()![1]();
      video.dessiner(c, Math.min(t, video.duree));
      progres(Math.min(1, t / video.duree));
      if (t < video.duree + 0.2) requestAnimationFrame(image);
      else ok();
    };
    requestAnimationFrame(image);
  });
  enregistreur?.stop();
  await fini;
  if (!format || !flux) return null;
  fermerSortieVideo();
  flux.getTracks().forEach((p) => p.stop());
  const nom = sorte === 'recap' ? 'grille-recap' : 'grille-moment';
  return new File(morceaux, `${nom}.${format.extension}`, { type: format.mime.split(';')[0] });
}

/** Partage (WhatsApp, Instagram…) si le téléphone le permet, sinon téléchargement. */
export async function partagerVideo(fichier: File): Promise<'partage' | 'telecharge'> {
  if (navigator.canShare?.({ files: [fichier] })) {
    try {
      await navigator.share({ files: [fichier], title: 'Grillé !', text: 'Notre soirée Grillé ! 🔥' });
      return 'partage';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'partage';
    }
  }
  const url = URL.createObjectURL(fichier);
  const a = document.createElement('a');
  a.href = url;
  a.download = fichier.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return 'telecharge';
}
