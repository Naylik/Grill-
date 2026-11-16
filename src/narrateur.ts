// Le narrateur : des vannes gentilles, jamais méchantes.
import vannes from './data/vannes.json';
import { auHasard } from './outils';

export function vanneDuClassement(
  classement: { prenom: string; points: number }[], // du premier au dernier
  hasard: () => number = Math.random,
): string {
  if (classement.length < 2) return auHasard(vannes.general, hasard);
  const premier = classement[0];
  const dernier = classement[classement.length - 1];
  const tirage = hasard();
  if (tirage < 0.45 && dernier.points < premier.points) {
    return auHasard(vannes.dernier, hasard)
      .replaceAll('{prenom}', dernier.prenom)
      .replaceAll('{points}', String(dernier.points))
      .replaceAll('{s}', dernier.points > 1 ? 's' : '');
  }
  if (tirage < 0.8 && premier.points > classement[1].points) return auHasard(vannes.premier, hasard).replaceAll('{prenom}', premier.prenom);
  return auHasard(vannes.general, hasard);
}

export const RAPPELS_MISSION = [
  'N’oublie pas ta mission 👀',
  'Ta mission ne va pas se faire toute seule 👀',
  'Psst… ta mission 👀',
  'Quelqu’un avance sur sa mission. Et toi ? 👀',
];
