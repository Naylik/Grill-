// Noms de code et couleurs tirés au hasard pour chaque joueur.
import { auHasard } from './outils';

export const COULEURS = ['#FF8A3D', '#FF4F8B', '#3DDCFF', '#5BE37D', '#FFD23F', '#B18CFF'] as const;

export const NOMS_DE_CODE = [
  'Faucon', 'Panda', 'Comète', 'Renard', 'Cobra', 'Hibou', 'Lynx', 'Requin', 'Pingouin', 'Koala',
  'Ninja', 'Moustache', 'Tornade', 'Caméléon', 'Chaussette', 'Croissant', 'Gecko', 'Raclette',
  'Pélican', 'Météore', 'Fantôme', 'Licorne', 'Bulldog', 'Mojito', 'Cactus', 'Wasabi',
];

export function tirerIdentite(dejaPris: { nomCode: string; couleur: string }[], hasard = Math.random) {
  const couleursLibres = COULEURS.filter((c) => !dejaPris.some((j) => j.couleur === c));
  const nomsLibres = NOMS_DE_CODE.filter((n) => !dejaPris.some((j) => j.nomCode === `Agent ${n}`));
  return {
    couleur: auHasard(couleursLibres.length ? couleursLibres : [...COULEURS], hasard),
    nomCode: `Agent ${auHasard(nomsLibres.length ? nomsLibres : NOMS_DE_CODE, hasard)}`,
  };
}
