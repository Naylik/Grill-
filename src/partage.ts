// Partage : l'image du podium (format story 1080 × 1920) et le lien d'invitation.
// L'image est dessinée dans le navigateur (canvas) puis envoyée au menu de partage du téléphone.
import { mallow } from './mallow';
import type { Joueur } from './types';

export interface LignePodium {
  joueur: Joueur;
  points: number;
}

const L = 1080;
const H = 1920;

function chargerImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((ok, ko) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = ko;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

function rectArrondi(c: CanvasRenderingContext2D, x: number, y: number, l: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + l - r, y);
  c.quadraticCurveTo(x + l, y, x + l, y + r);
  c.lineTo(x + l, y + h);
  c.lineTo(x, y + h);
  c.lineTo(x, y + r);
  c.quadraticCurveTo(x, y, x + r, y);
  c.closePath();
}

function texteAjuste(c: CanvasRenderingContext2D, texte: string, x: number, y: number, largeurMax: number) {
  let t = texte;
  while (c.measureText(t).width > largeurMax && t.length > 3) t = `${t.slice(0, -2)}…`;
  c.fillText(t, x, y);
}

/** Dessine l'image du podium et la renvoie en PNG. */
export async function imagePodium(classement: LignePodium[], sousTitre: string, titres: string): Promise<Blob> {
  await document.fonts.ready;
  const cv = document.createElement('canvas');
  cv.width = L;
  cv.height = H;
  const c = cv.getContext('2d')!;

  // Fond nuit et lueurs
  c.fillStyle = '#0D0A1E';
  c.fillRect(0, 0, L, H);
  const lueur = (x: number, y: number, r: number, couleur: string) => {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, couleur);
    g.addColorStop(1, '#0D0A1E00');
    c.fillStyle = g;
    c.fillRect(0, 0, L, H);
  };
  lueur(0, 420, 900, '#7B5CFF88');
  lueur(L, 1150, 800, '#FF5A6E66');
  lueur(L / 2, H, 700, '#7B5CFF55');

  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';

  // Logo
  c.font = "900 150px 'Unbounded', 'Arial Black', sans-serif";
  c.fillStyle = '#4B2BC9';
  c.fillText('GRILLÉ !', L / 2, 262);
  const dg = c.createLinearGradient(0, 130, 0, 260);
  dg.addColorStop(0, '#FFF3A6');
  dg.addColorStop(0.45, '#FFD84A');
  dg.addColorStop(1, '#FF7A59');
  c.fillStyle = dg;
  c.fillText('GRILLÉ !', L / 2, 250);
  c.font = "700 40px 'Plus Jakarta Sans', system-ui, sans-serif";
  c.fillStyle = '#B9B1DD';
  c.fillText(sousTitre, L / 2, 330);

  // Mallow couronné
  const img = await chargerImage(mallow({ taille: 400, couronne: true }));
  c.drawImage(img, L / 2 - 200, 380, 400, 528);

  // Le gagnant
  const premier = classement[0];
  if (premier) {
    c.font = "900 100px 'Unbounded', 'Arial Black', sans-serif";
    c.fillStyle = '#F4F1FF';
    texteAjuste(c, premier.joueur.prenom, L / 2, 1030, 960);
    c.font = "800 52px 'Unbounded', 'Arial Black', sans-serif";
    c.fillStyle = '#FFD84A';
    c.fillText('règne sur la soirée', L / 2, 1105);
  }

  // Podium : 2e à gauche, 1er au centre, 3e à droite
  const base = 1660;
  const larg = 290;
  const ecart = 30;
  const x0 = (L - (3 * larg + 2 * ecart)) / 2;
  const places = [
    { i: 1, x: x0, h: 270 },
    { i: 0, x: x0 + larg + ecart, h: 380 },
    { i: 2, x: x0 + 2 * (larg + ecart), h: 190 },
  ];
  for (const p of places) {
    const l = classement[p.i];
    if (!l) continue;
    const haut = base - p.h;
    c.fillStyle = l.joueur.couleur;
    c.shadowColor = l.joueur.couleur;
    c.shadowBlur = 60;
    rectArrondi(c, p.x, haut, larg, p.h, 28);
    c.fill();
    c.shadowBlur = 0;
    c.fillStyle = '#0D0A1E';
    c.font = "900 120px 'Unbounded', 'Arial Black', sans-serif";
    c.fillText(String(p.i + 1), p.x + larg / 2, haut + Math.min(p.h - 30, 150));
    c.fillStyle = '#F4F1FF';
    c.font = "800 44px 'Plus Jakarta Sans', system-ui, sans-serif";
    texteAjuste(c, l.joueur.prenom, p.x + larg / 2, haut - 62, larg);
    c.fillStyle = '#B9B1DD';
    c.font = "700 34px 'Plus Jakarta Sans', system-ui, sans-serif";
    c.fillText(`${l.points} pts`, p.x + larg / 2, haut - 18);
  }

  // Titres fun et adresse
  c.font = "700 36px 'Plus Jakarta Sans', system-ui, sans-serif";
  c.fillStyle = '#C8C0EA';
  if (titres) texteAjuste(c, titres, L / 2, 1750, 980);
  c.font = "800 34px 'Plus Jakarta Sans', system-ui, sans-serif";
  c.fillStyle = '#8C84B5';
  c.fillText(adresseDuSite().replace(/^https?:\/\//, ''), L / 2, 1850);

  return new Promise((ok, ko) => cv.toBlob((b) => (b ? ok(b) : ko(new Error('image'))), 'image/png'));
}

export const adresseDuSite = (): string => `${location.origin}${location.pathname}`.replace(/\/$/, '/');

/**
 * Ouvre le menu de partage du téléphone. Renvoie false si le téléphone ne sait pas partager
 * (l'appelant propose alors une autre solution : enregistrer l'image, copier le lien).
 */
export async function partager(donnees: { titre: string; texte: string; url?: string; fichier?: File }): Promise<boolean> {
  const avecFichier = donnees.fichier ? { files: [donnees.fichier] } : {};
  const objet: ShareData = { title: donnees.titre, text: donnees.texte, ...(donnees.url ? { url: donnees.url } : {}), ...avecFichier };
  if (!navigator.share || (donnees.fichier && navigator.canShare && !navigator.canShare(objet))) return false;
  try {
    await navigator.share(objet);
    return true;
  } catch (e) {
    // Le joueur a fermé le menu de partage : ce n'est pas une erreur.
    return (e as DOMException)?.name === 'AbortError';
  }
}

export async function copier(texte: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texte);
    return true;
  } catch {
    return false;
  }
}
