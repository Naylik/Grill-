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

  it('partie complète : doubler, encaisser (banque), perdre la cagnotte en jeu, cumul', () => {
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
    const tous = (_i: number, choix: Record<string, number>) => Object.fromEntries(Object.entries(choix).map(([u, c]) => [u, { etape: e.etape, choix: c }]));
    const faux = (i: number) => (bonnes[i] + 1) % 4;
    // Q1 : a et b justes (1 pt en jeu), c faux.
    av(tous(0, { a: bonnes[0], b: bonnes[0], c: faux(0) }));
    expect(e.cagnotte).toEqual({ a: 1, b: 1, c: 0 });
    t += 7000; av();
    expect(e.phase).toBe('choix');
    // a encaisse (banque 1, repart de 0), b double.
    av({ a: { etape: e.etape, decision: 'encaisser' }, b: { etape: e.etape, decision: 'doubler' } });
    expect(e.phase).toBe('question');
    expect(e.banque.a).toBe(1);
    expect(e.cagnotte.a).toBe(0);
    // Q2 : tout le monde rejoue ; a et c justes, b se trompe et perd son point en jeu.
    av(tous(1, { a: bonnes[1], b: faux(1), c: bonnes[1] }));
    expect(e.cagnotte).toEqual({ a: 1, b: 0, c: 1 });
    expect(e.perdus).toEqual(['b']);
    t += 7000; av();
    // a et c doublent (pas de réponse = encaisse : on répond « doubler »).
    av({ a: { etape: e.etape, decision: 'doubler' }, c: { etape: e.etape, decision: 'doubler' } });
    // Q3 à Q5 : tout le monde juste ; à la fin, ce qui est en jeu est encaissé.
    for (let i = 2; i < 5; i++) {
      av(tous(i, { a: bonnes[i], b: bonnes[i], c: bonnes[i] }));
      t += 7000; av();
      if (e.phase === 'choix') av({ a: { etape: e.etape, decision: 'doubler' }, b: { etape: e.etape, decision: 'doubler' }, c: { etape: e.etape, decision: 'doubler' } });
    }
    expect(e.phase).toBe('bilan');
    expect(e.banque).toEqual({ a: 1 + 8, b: 4, c: 8 }); // a : 1 encaissé + 8 en jeu à la fin
    t += 7000;
    const fin = av().fin;
    expect(fin.points.a).toBe(5);
    expect(quitteOuDouble.contenus!(e)).toHaveLength(5);
  });
});
