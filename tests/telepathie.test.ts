// Télépathie (jeu d'équipe) : duos, arbitre, mots identiques, score par rang et pari de l'arbitre.
import { describe, expect, it } from 'vitest';
import { formerEquipes, memeMot, normaliser, scoreTelepathie, telepathie } from '../src/games/telepathie';

describe('Télépathie', () => {
  it('compare les mots sans majuscules, accents ni article', () => {
    expect(normaliser('  Le Tigre ! ')).toBe('tigre');
    expect(memeMot("L'Été", 'ete')).toBe(true);
    expect(memeMot('Une pomme', 'pommes')).toBe(false);
    expect(memeMot('', '')).toBe(false);
  });

  it('forme des duos, avec un arbitre si le nombre est impair', () => {
    const pair = formerEquipes(['a', 'b', 'c', 'd'], () => 0.3);
    expect(pair.equipes).toHaveLength(2);
    expect(pair.arbitre).toBeUndefined();
    const impair = formerEquipes(['a', 'b', 'c', 'd', 'e'], () => 0.3);
    expect(impair.equipes).toHaveLength(2);
    expect(impair.arbitre).toBeDefined();
    expect(new Set([...impair.equipes.flat(), impair.arbitre]).size).toBe(5);
    expect(telepathie.autorise(1, 3)).toBe(false);
    expect(telepathie.autorise(1, 4)).toBe(true);
  });

  it('score : moins de manches = mieux ; pari de l’arbitre', () => {
    const equipes = [['a', 'b'], ['c', 'd']];
    const s = scoreTelepathie({ equipes, trouve: { 0: 3, 1: 5 }, arbitre: 'e', pari: { equipe: 0, manches: 4 } });
    expect(s.a).toBeGreaterThan(s.c);
    expect(s.e).toBe(2 + 1); // bonne équipe, à une manche près
    expect(scoreTelepathie({ equipes, trouve: { 0: 3 }, arbitre: 'e', pari: { equipe: 0, manches: 3 } }).e).toBe(4);
    expect(scoreTelepathie({ equipes, trouve: { 1: 2 }, arbitre: 'e', pari: { equipe: 0, manches: 6 } }).e).toBe(0);
  });

  it('partie : pari, mots, connexion d’une équipe puis de l’autre', () => {
    const uids = ['a', 'b', 'c', 'd', 'e'];
    let t = 0;
    const ctx = (reponses: Record<string, unknown> = {}) => ({ joueurs: {}, uids, connectes: uids, maintenant: t, numeroJeu: 3, duree: 2, reponses: reponses as never, compteurs: {}, totaux: {}, prive: {}, hasard: () => 0.4 }) as never;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let e: any = telepathie.demarrer(ctx()).etat;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fin: any;
    const av = (rep = {}) => { const r = telepathie.piloter(ctx(rep), e); if (r?.fin) fin = r.fin; else if (r) e = r.etat; };
    expect(e.phase).toBe('pari');
    const [[p, q], [r, s]] = e.equipes;
    av({ [e.arbitre]: { etape: e.etape, equipe: 1, manches: 2 } });
    expect(e.phase).toBe('mot');
    expect(e.pari).toEqual({ equipe: 1, manches: 2 });
    // Manche 1 : l'équipe 1 trouve tout de suite, l'équipe 0 non.
    av({ [p]: { etape: e.etape, mot: 'chat' }, [q]: { etape: e.etape, mot: 'lion' }, [r]: { etape: e.etape, mot: 'Mer' }, [s]: { etape: e.etape, mot: 'la mer' } });
    expect(e.phase).toBe('revele');
    expect(e.trouve[1]).toBe(1);
    t += 6000;
    av();
    expect(e.phase).toBe('mot');
    expect(e.manche).toBe(1);
    // Manche 2 : seule l'équipe 0 joue, et trouve.
    av({ [p]: { etape: e.etape, mot: 'Tigre' }, [q]: { etape: e.etape, mot: 'tigre' } });
    expect(e.trouve[0]).toBe(2);
    t += 6000;
    av();
    expect(e.phase).toBe('bilan');
    expect(e.score[r]).toBeGreaterThan(e.score[p]);
    expect(e.score[e.arbitre]).toBe(2 + 1);
    t += 8000;
    av();
    expect(fin.sorte).toBe('place');
  });
});
