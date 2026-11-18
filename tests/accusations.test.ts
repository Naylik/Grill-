// Bouton GRILLÉ ! : qui peut accuser, et comment l'hôte tranche.
import { describe, expect, it } from 'vitest';
import { accusationEnCours, missionsGrillees, peutAccuser, piloterAccusations, type Accusations } from '../src/accusations';

const ctx = { phase: 'classement' as const, numeroJeu: 2 };
const base = { cible: 'b', texte: 'Il me fait dire franchement', le: 1000 };

describe('bouton GRILLÉ !', () => {
  it('une accusation par manche, pas avant le 1er jeu, pas pendant une autre accusation', () => {
    expect(peutAccuser('a', ctx, {}, 3)).toBe(true);
    expect(peutAccuser('a', { ...ctx, numeroJeu: 0, phase: 'missions' }, {}, 3)).toBe(false);
    expect(peutAccuser('a', { ...ctx, phase: 'detective' }, {}, 3)).toBe(false);
    const deja: Accusations = { 2: { a: { ...base, statut: 'close', verdict: 'rate' } } };
    expect(peutAccuser('a', ctx, deja, 3)).toBe(false); // déjà accusé à cette manche
    expect(peutAccuser('a', { ...ctx, numeroJeu: 3 }, deja, 3)).toBe(true); // manche suivante
    const enCours: Accusations = { 2: { c: { ...base } } };
    expect(peutAccuser('a', ctx, enCours, 3)).toBe(false);
  });

  it('caché pendant les manches des jeux d’action', () => {
    expect(peutAccuser('a', { phase: 'jeu', numeroJeu: 2, jeuEnCours: 'reflexe', phaseJeu: 'attente' }, {}, 3)).toBe(false);
    expect(peutAccuser('a', { phase: 'jeu', numeroJeu: 2, jeuEnCours: 'reflexe', phaseJeu: 'resultat' }, {}, 3)).toBe(true);
    expect(peutAccuser('a', { phase: 'jeu', numeroJeu: 2, jeuEnCours: 'combien', phaseJeu: 'question' }, {}, 3)).toBe(true);
  });

  const piloter = (accs: Accusations, maintenant: number, votes = {}, scores = {}) =>
    piloterAccusations({ accs, votes, connectes: ['a', 'b', 'c', 'd'], maintenant, scores });

  it('« Raté » : l’accuseur perd 2 points, la mission reste secrète', () => {
    const e = piloter({ 2: { a: { ...base, reponse: 'rate' } } }, 5000, {}, { a: { jeux: 5, parieur: 0, missions: 0, detective: 0 } })!;
    expect(e['accusations/2/a/statut']).toBe('rate');
    expect(e['scores/a/grille']).toBe(-2);
    expect(Object.keys(e).some((k) => k.includes('mission'))).toBe(false);
  });

  it('« Il m’a eu » puis vote du groupe : mission grillée et points volés', () => {
    const avoue: Accusations = { 2: { a: { ...base, reponse: 'eu', mission: { numero: 1, texte: 'Fais dire franchement', difficulte: 'difficile' } } } };
    expect(piloter(avoue, 5000)!['accusations/2/a/statut']).toBe('vote');
    const enVote: Accusations = { 2: { a: { ...avoue[2].a, statut: 'vote', fin: 40000 } } };
    expect(piloter(enVote, 6000, { 'g-2-a': { c: true } })).toBeNull(); // d n'a pas encore voté
    const e = piloter(enVote, 7000, { 'g-2-a': { c: true, d: true } })!;
    expect(e['accusations/2/a/statut']).toBe('grille');
    expect(e['scores/a/grille']).toBe(6);
    expect(e['scores/b/grille']).toBe(-6);
    // Le groupe n'est pas convaincu : raté pour l'accuseur.
    expect(piloter(enVote, 7000, { 'g-2-a': { c: false, d: false } })!['accusations/2/a/statut']).toBe('rate');
  });

  it('pendant une manche d’action, les délais sont repoussés', () => {
    const e = piloterAccusations({ accs: { 2: { a: { ...base } } }, votes: {}, connectes: ['a', 'b'], maintenant: 1000 + 40000, scores: {}, pause: true })!;
    expect(e['accusations/2/a/le']).toBe(41000 + 25000 - 45000);
    expect(piloterAccusations({ accs: { 2: { a: { ...base } } }, votes: {}, connectes: ['a', 'b'], maintenant: 2000, scores: {}, pause: true })).toBeNull();
  });

  it('pas de réponse : annulée ; verdict affiché puis fermé ; mission grillée mémorisée', () => {
    expect(piloter({ 2: { a: { ...base } } }, 1000 + 46000)!['accusations/2/a/statut']).toBe('annulee');
    const affiche: Accusations = { 2: { a: { ...base, reponse: 'eu', mission: { numero: 2, texte: 'x', difficulte: 'facile' }, statut: 'grille', fin: 9000 } } };
    expect(piloter(affiche, 8000)).toBeNull();
    const e = piloter(affiche, 9000)!;
    expect(e).toEqual({ 'accusations/2/a/statut': 'close', 'accusations/2/a/verdict': 'grille' });
    const close: Accusations = { 2: { a: { ...affiche[2].a, statut: 'close', verdict: 'grille' } } };
    expect(accusationEnCours(close)).toBeNull();
    expect(missionsGrillees(close, 'b')).toEqual({ 2: 'a' });
  });
});
