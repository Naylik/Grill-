// Champ de mines : mines secrètes, gains qui montent, KABOOM qui récompense le poseur.
import { describe, expect, it } from 'vitest';
import { champDeMines, gainSur, lireDetection, minesAutour } from '../src/games/mines';

describe('Champ de mines', () => {
  it('partie : un colis chacun son tour, encaisser pour sortir, KABOOM, le 1er joueur change à chaque manche', () => {
    const uids = ['a', 'b', 'c'];
    const t = 0;
    let prive: Record<string, unknown> = {};
    const ctx = (reponses: Record<string, unknown> = {}) => ({ joueurs: {}, uids, connectes: uids, maintenant: t, numeroJeu: 5, duree: 4, reponses: reponses as never, compteurs: {}, totaux: {}, prive, hasard: () => 0.5 }) as never;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let e: any = champDeMines.demarrer(ctx()).etat;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const av = (rep = {}): any => { const r = champDeMines.piloter(ctx(rep), e); if (r?.ecritures && 'prive/mines' in r.ecritures) prive = { ...prive, mines: (r.ecritures as Record<string, unknown>)['prive/mines'] }; if (r && !r.fin) e = r.etat; return r; };
    const actif = () => e.enLice[e.actif];
    // Pose : a en 0, b en 1, c en 2.
    av({ a: { etape: e.etape, case: 0 }, b: { etape: e.etape, case: 1 }, c: { etape: e.etape, case: 2 } });
    expect(e.phase).toBe('tour');
    expect(e.nbManches).toBe(2);
    expect(JSON.stringify(e)).not.toContain('"0":["a"]'); // les mines ne sont pas publiques
    const [j1, j2, j3] = e.ordre;
    expect(e.enLice).toEqual([j1, j2, j3]); // manche 1 : l'ordre de base
    // j1 ouvre UN colis (avec son détecteur), puis c'est à j2 : on alterne.
    expect(actif()).toBe(j1);
    av({ [j1]: { etape: e.etape, case: 10, detecteur: 'ma-cle-secrete' } });
    expect(e.detections[10].u).toBe(j1);
    expect(lireDetection(e.detections[10].v, 'ma-cle-secrete', 10)).toBe(minesAutour(10, { 0: ['a'], 1: ['b'], 2: ['c'] }));
    expect(e.pots[j1]).toBe(1);
    expect(actif()).toBe(j2);
    av({ [j2]: { etape: e.etape, case: 11 } });
    expect(actif()).toBe(j3);
    av({ [j3]: { etape: e.etape, case: 12 } });
    // Retour à j1 : son 2e colis rapporte 2 ; un 2e détecteur est refusé (1 seul par jeu).
    expect(actif()).toBe(j1);
    av({ [j1]: { etape: e.etape, case: 13, detecteur: 'ma-cle-secrete' } });
    expect(e.detections[13]).toBeUndefined();
    expect(e.detecteurs[j1]).toBe(1);
    expect(e.pots[j1]).toBe(3);
    // j2 encaisse et sort de la manche.
    av({ [j2]: { etape: e.etape, stop: true } });
    expect(e.banque[j2]).toBe(1);
    expect(e.enLice).not.toContain(j2);
    expect(actif()).toBe(j3);
    // j3 saute sur la mine d'un autre : KABOOM, il perd sa manche, le poseur gagne.
    const autre = ['a', 'b', 'c'].find((u) => u !== j3)!;
    const caseAutre = ['a', 'b', 'c'].indexOf(autre);
    av({ [j3]: { etape: e.etape, case: caseAutre } });
    expect(e.phase).toBe('boum');
    expect(e.bonus[autre]).toBeGreaterThanOrEqual(3);
    expect(e.poseurs[caseAutre]).toEqual([autre]);
    e = { ...e, fin: -1 };
    av();
    expect(e.enLice).toEqual([j1]);
    // j1 encaisse : tout le monde est sorti, manche 2… et c'est j2 qui commence.
    av({ [j1]: { etape: e.etape, stop: true } });
    expect(e.banque[j1]).toBe(3);
    // Manche 2 : grille neuve, chacun repose une mine… puis c'est j2 qui commence.
    expect(e.manche).toBe(1);
    expect(e.phase).toBe('pose');
    expect(e.ouvertes).toEqual({});
    av({ a: { etape: e.etape, case: 5 }, b: { etape: e.etape, case: 6 }, c: { etape: e.etape, case: 7 } });
    expect(e.phase).toBe('tour');
    expect(actif()).toBe(j2);
    expect(e.enLice).toEqual([j2, j3, j1]);
    expect([0, 1, 2].map(gainSur)).toEqual([1, 2, 3]);
  });
});

import { brouiller } from '../src/games/mines';
describe('Champ de mines · Détecteur', () => {
  it('compte les mines dans les 8 cases autour (grille 5 × 4)', () => {
    const mines = { 0: ['a'], 2: ['b'], 12: ['c'] };
    expect(minesAutour(6, mines)).toBe(3); // 0, 2 et 12 touchent la case 6 (ligne 1, colonne 1)
    expect(minesAutour(1, mines)).toBe(2); // 0 et 2
    expect(minesAutour(19, mines)).toBe(0);
    expect(minesAutour(4, mines)).toBe(0); // bord droit : pas de débordement sur la ligne suivante
    expect(minesAutour(5, { 4: ['a'] })).toBe(0); // case 4 (fin de ligne 0) n'est pas voisine de 5 (début ligne 1)
  });
});

describe('Champ de mines · Détecteur secret', () => {
  it('le chiffre brouillé ne se lit qu’avec la bonne clé', () => {
    for (let k = 0; k <= 8; k++) {
      const v = brouiller(k, 'cle-secrete-123', 7);
      expect(lireDetection(v, 'cle-secrete-123', 7)).toBe(k);
    }
    const lus = new Set(Array.from({ length: 30 }, (_, i) => lireDetection(brouiller(2, 'vraie-cle', 7), `autre-${i}`, 7)));
    expect(lus.size).toBeGreaterThan(3); // sans la clé, on lit n'importe quoi
  });
});
