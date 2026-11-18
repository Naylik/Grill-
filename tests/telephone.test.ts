// Dessin téléphone arabe : chacun passe par toutes les chaînes sans voir la sienne, et le score suit les votes.
import { describe, expect, it } from 'vitest';
import { chaineDe, scoreTelephone, telephone } from '../src/games/telephone';

describe('Dessin téléphone arabe', () => {
  it('à chaque étape, chacun a une chaîne différente, et jamais la même deux fois', () => {
    for (const n of [3, 4, 6]) {
      for (let s = 0; s < n; s++) expect(new Set(Array.from({ length: n }, (_, p) => chaineDe(p, s, n))).size).toBe(n);
      for (let p = 0; p < n; p++) expect(new Set(Array.from({ length: n }, (_, s) => chaineDe(p, s, n))).size).toBe(n);
    }
  });

  it('partie complète : étapes, révélation pas à pas, votes, points', () => {
    const uids = ['a', 'b', 'c'];
    let t = 0;
    const ctx = (reponses: Record<string, unknown> = {}) => ({ joueurs: {}, uids, connectes: uids, maintenant: t, numeroJeu: 4, duree: 6, reponses: reponses as never, compteurs: {}, totaux: {}, prive: {}, hasard: Math.random }) as never;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let e: any = telephone.demarrer(ctx()).etat;
    expect(e.total).toBe(3); // format Normale = 4 étapes, mais seulement 3 joueurs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const av = (rep = {}): any => { const r = telephone.piloter(ctx(rep), e); if (r && !r.fin) e = r.etat; return r; };
    const tous = (val: object) => Object.fromEntries(uids.map((u) => [u, { etape: e.etape, ...val }]));
    av(tous({ dessin: [{ c: '#24123A', w: 2, p: [1, 2, 3, 4] }] }));
    expect(e.etapeN).toBe(1);
    av(tous({ texte: 'un chat' }));
    av(tous({ dessin: [] }));
    expect(e.phase).toBe('revue');
    expect(e.chaines.every((ch: unknown[]) => ch.length === 3)).toBe(true);
    // Pas de vote tant que l'hôte n'a pas tout dévoilé.
    expect(av(tous({ sens: true }))).toBeNull();
    for (let c = 0; c < 3; c++) {
      for (let i = 0; i < 3; i++) e = telephone.commande!(ctx(), e, 'suivant')!.etat;
      expect(e.fin).toBeGreaterThan(0);
      av(tous({ sens: c === 0, favori: c === 0 ? '0-0' : undefined }));
    }
    expect(e.phase).toBe('bilan');
    const auteur = e.chaines[0][0].auteur;
    expect(e.score[auteur]).toBeGreaterThanOrEqual(4); // 3 (le plus drôle) + 1 (sens gardé)
    expect(scoreTelephone({ ordre: uids, chaines: [], favoris: {}, sens: {} })).toEqual({ a: 0, b: 0, c: 0 });
  });
});
