// Quitte ou Double : la cagnotte double, une erreur fait tout perdre, on peut encaisser, la bonne réponse reste cachée.
import { describe, expect, it } from 'vitest';
import { doubler, niveauDe, quitteOuDouble } from '../src/games/quitteOuDouble';
import quiz from '../src/data/quiz.json';

describe('Quitte ou Double', () => {
  it('questions : 4 choix, une bonne réponse, 10 par niveau', () => {
    for (const q of quiz) {
      expect(q.choix).toHaveLength(4);
      expect(q.bonne).toBeGreaterThanOrEqual(0);
      expect(q.bonne).toBeLessThan(4);
    }
    for (const n of [1, 2, 3, 4]) expect(quiz.filter((q) => q.niveau === n).length).toBeGreaterThanOrEqual(10);
    expect([0, 1, 2, 3, 4].map((i) => niveauDe(i, 5))).toEqual([1, 1, 2, 3, 4]);
    expect([0, 1, 2, 4].map(doubler)).toEqual([1, 2, 4, 8]);
  });

  it('partie complète : doubler, encaisser, perdre', () => {
    const uids = ['a', 'b', 'c'];
    const joueurs = Object.fromEntries(uids.map((u) => [u, { prenom: u.toUpperCase() }])) as never;
    let t = 0;
    let prive: Record<string, unknown> = {};
    const ctx = (reponses: Record<string, unknown> = {}) => ({ joueurs, uids, connectes: uids, maintenant: t, numeroJeu: 2, duree: 4, reponses: reponses as never, compteurs: {}, totaux: {}, prive, hasard: Math.random }) as never;
    const debut = quitteOuDouble.demarrer(ctx());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let e: any = debut.etat;
    prive = { quitte: (debut.ecritures as Record<string, unknown>)['prive/quitte'] };
    const bonnes = (prive.quitte as { bonnes: number[] }).bonnes;
    expect(JSON.stringify(e)).not.toContain('bonne'); // la bonne réponse n'est pas publique
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const av = (rep = {}): any => { const r = quitteOuDouble.piloter(ctx(rep), e); if (r && !r.fin) e = r.etat; return r; };
    // Q1 : a et b justes, c faux.
    const faux = (bonnes[0] + 1) % 4;
    av({ a: { etape: e.etape, choix: bonnes[0] }, b: { etape: e.etape, choix: bonnes[0] }, c: { etape: e.etape, choix: faux } });
    expect(e.phase).toBe('resultat');
    expect(e.cagnotte).toEqual({ a: 1, b: 1, c: 0 });
    expect(e.statut.c).toBe('perdu');
    t += 7000; av();
    expect(e.phase).toBe('choix');
    // a encaisse, b double.
    av({ a: { etape: e.etape, decision: 'encaisser' }, b: { etape: e.etape, decision: 'doubler' } });
    expect(e.phase).toBe('question');
    expect(e.statut.a).toBe('encaisse');
    // Q2 : b juste → 2 points ; puis b n'a pas répondu au choix → il encaisse : fin.
    av({ b: { etape: e.etape, choix: bonnes[1] } });
    expect(e.cagnotte.b).toBe(2);
    t += 7000; av();
    t += 13000; av();
    expect(e.phase).toBe('bilan');
    t += 7000;
    const fin = av().fin;
    expect(fin.points.b).toBe(5);
    expect(fin.points.a).toBe(3);
    expect(quitteOuDouble.contenus!(e)).toHaveLength(5);
  });
});
