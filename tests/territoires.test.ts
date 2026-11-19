// Roue des territoires : la roue s'arrête bien sur la part tirée, et les actions suivent la règle.
import { describe, expect, it } from 'vitest';
import { partSousCurseur, tirerArret } from '../src/roue';
import { appliquerActions, segments, territoires } from '../src/games/territoires';

describe('Roue des territoires', () => {
  it('la roue s’arrête toujours sous le curseur dans la part du gagnant tiré', () => {
    for (let i = 0; i < 300; i++) {
      const parts = [1 + (i % 4), 3, 2 + (i % 3), 5];
      const rotation0 = (i * 1.7) % 10;
      const { gagnant, rotation1 } = tirerArret(parts, rotation0, Math.random);
      expect(partSousCurseur(parts, rotation1)).toBe(gagnant);
      expect(rotation1 - rotation0).toBeGreaterThan(Math.PI * 2 * 6);
    }
  });

  it('agrandir coûte 1 pt ; voler un joueur protégé fait donner 1 pt ; voler sinon prend une part', () => {
    const e = { ordre: ['a', 'b', 'c', 'd'], parts: { a: 3, b: 3, c: 3, d: 3 }, points: { a: 5, b: 5, c: 5, d: 0 }, pot: 6 };
    const noms = { a: 'A', b: 'B', c: 'C', d: 'D' };
    const r = appliquerActions(e, { a: { a: 'agrandir' }, b: { a: 'voler', c: 'c' }, c: { a: 'proteger' }, d: { a: 'voler', c: 'a' } }, noms);
    expect(r.parts).toEqual({ a: 3, b: 3, c: 3, d: 4 }); // a +1 puis volé par d
    expect(r.points).toEqual({ a: 4, b: 4, c: 6, d: 0 }); // a paie 1, b donne 1 à c
    expect(r.pot).toBe(7);
    expect(r.badges.b.type).toBe('rate');
    expect(r.badges.c.texte).toContain('Bloque');
    expect(r.badges.a.vise).toBe(true);
  });

  it('partie : choix, révélation, roue, gain, et le gagnant touche la cagnotte', () => {
    const uids = ['a', 'b', 'c'];
    let t = 0;
    const ctx = (reponses: Record<string, unknown> = {}) => ({ joueurs: {}, uids, connectes: uids, maintenant: t, numeroJeu: 2, duree: 4, reponses: reponses as never, compteurs: {}, totaux: {}, prive: {}, hasard: Math.random }) as never;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let e: any = territoires.demarrer(ctx()).etat;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const av = (rep = {}): any => { const r = territoires.piloter(ctx(rep), e); if (r && !r.fin) e = r.etat; return r; };
    av(Object.fromEntries(uids.map((u) => [u, { etape: e.etape, a: 'proteger' }])));
    expect(e.phase).toBe('revelation');
    t += 5000; av();
    expect(e.phase).toBe('roue');
    const { gagnant, gain } = e.spin;
    const avant = e.points[gagnant];
    t += 7000; av();
    expect(e.phase).toBe('gain');
    expect(e.points[gagnant]).toBe(avant + gain);
  });
});

describe('Roue des territoires · Pacte', () => {
  const noms = { a: 'A', b: 'B', c: 'C', d: 'D' };
  const base = { ordre: ['a', 'b', 'c', 'd'], parts: { a: 3, b: 3, c: 3, d: 3 }, points: { a: 5, b: 5, c: 5, d: 5 }, pot: 6 };
  it('pacte réciproque : scellé, une seule part sur la roue', () => {
    const r = appliquerActions(base, { a: { a: 'pacte', c: 'b' }, b: { a: 'pacte', c: 'a' }, c: { a: 'proteger' }, d: { a: 'proteger' } }, noms);
    expect(r.pactes).toEqual([['a', 'b']]);
    expect(r.badges.a.type).toBe('pacte');
    expect(segments(base.ordre, r.pactes)).toEqual([['a', 'b'], ['c'], ['d']]);
  });
  it('trahison : le traître prend 2 parts à celui qui proposait le pacte', () => {
    const r = appliquerActions(base, { a: { a: 'pacte', c: 'b' }, b: { a: 'voler', c: 'a' }, c: { a: 'proteger' }, d: { a: 'proteger' } }, noms);
    expect(r.parts.a).toBe(1);
    expect(r.parts.b).toBe(5);
    expect(r.badges.a.type).toBe('trahi');
    expect(r.pactes).toEqual([]);
  });
  it('double trahison : chacun perd 1 part, la cagnotte grossit', () => {
    const r = appliquerActions(base, { a: { a: 'voler', c: 'b' }, b: { a: 'voler', c: 'a' }, c: { a: 'proteger' }, d: { a: 'proteger' } }, noms);
    expect(r.parts.a).toBe(2);
    expect(r.parts.b).toBe(2);
    expect(r.pot).toBe(8);
  });
  it('pacte refusé : rien ne se passe', () => {
    const r = appliquerActions(base, { a: { a: 'pacte', c: 'b' }, b: { a: 'agrandir' }, c: { a: 'proteger' }, d: { a: 'proteger' } }, noms);
    expect(r.parts.a).toBe(3);
    expect(r.badges.a.type).toBe('rate');
  });
});
