// Dessin à la chaîne : chacun passe par toutes les chaînes sans voir la sienne, et le score suit les votes.
import { describe, expect, it } from 'vitest';
import { chaineDe, devinetteJuste, jugesDe, scoreTelephone, telephone } from '../src/games/telephone';

describe('Dessin à la chaîne', () => {
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
    expect(e.phase).toBe('phrase');
    expect(e.total).toBe(2); // à 3 joueurs : chacun écrit, puis 2 étapes (personne ne retombe sur sa phrase)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const av = (rep = {}): any => { const r = telephone.piloter(ctx(rep), e); if (r && !r.fin) e = r.etat; return r; };
    const tous = (val: object) => Object.fromEntries(uids.map((u) => [u, { etape: e.etape, ...val }]));
    // a écrit une phrase, b et c n'écrivent rien : le jeu met les siennes.
    const phraseDeA = { a: { etape: e.etape, texte: 'Kilyan qui fait du ski' } };
    expect(av(phraseDeA)).toBeNull(); // on attend les autres…
    t += 41000; av(phraseDeA); // … ou la fin du temps
    expect(e.phase).toBe('etape');
    const cA = (e.ordre.indexOf('a') + 1) % 3;
    expect(e.phrases[cA]).toEqual({ texte: 'Kilyan qui fait du ski', auteur: 'a' });
    expect(telephone.contenus!(e)).toHaveLength(2); // seules les phrases du jeu vont dans la mémoire
    // Personne ne dessine ni ne devine la chaîne dont il a écrit la phrase.
    for (let s = 0; s < e.total; s++) for (let p = 0; p < 3; p++) expect(chaineDe(p, s, 3)).not.toBe((p + 1) % 3);
    av(tous({ dessin: [{ c: '#24123A', w: 2, p: [1, 2, 3, 4] }] }));
    expect(e.etapeN).toBe(1);
    av(tous({ texte: 'un chat' }));
    expect(e.phase).toBe('revue');
    expect(e.chaines.every((ch: unknown[]) => ch.length === 2)).toBe(true);
    // Pas de vote tant que l'hôte n'a pas tout dévoilé.
    expect(av(tous({ bons: [1] }))).toBeNull();
    for (let c = 0; c < 3; c++) {
      for (let i = 0; i < 2; i++) e = telephone.commande!(ctx(), e, 'suivant')!.etat;
      expect(e.fin).toBeGreaterThan(0);
      av(tous({ bons: c === 0 ? [1] : [], favori: c === 0 ? '0-0' : undefined }));
    }
    expect(e.phase).toBe('bilan');
    const dessinateur = e.chaines[0][0].auteur;
    const devineur = e.chaines[0][1].auteur;
    // Chaîne 0 : devinette jugée juste (+1 au devineur, +1 au dessinateur) et dessin le plus drôle (+1).
    expect(e.reussis['0-1']).toBe(true);
    expect(e.reussis['1-1']).toBe(false);
    expect(e.score[dessinateur]).toBeGreaterThanOrEqual(2);
    expect(e.score[devineur]).toBeGreaterThanOrEqual(1);
    // Le devineur et le dessinateur ne jugent pas leur propre devinette.
    expect(jugesDe(e.chaines[0], 1, uids)).toEqual(uids.filter((u) => u !== devineur)); // le dessinateur vote aussi (23/11)
    expect(scoreTelephone({ ordre: uids, chaines: [], favoris: {}, reussis: {} })).toEqual({ a: 0, b: 0, c: 0 });
  });
});

describe('Dessin à la chaîne : devinette jugée juste', () => {
  it('égalité = juste ; aucun juge = ratée', () => {
    expect(devinetteJuste([true, false])).toBe(true);
    expect(devinetteJuste([true, false, false])).toBe(false);
    expect(devinetteJuste([true, true, false])).toBe(true);
    expect(devinetteJuste([])).toBe(false);
  });
});
