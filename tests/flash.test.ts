// Missions flash : tirage reproductible (même résultat sur tous les téléphones), jamais deux fois la même,
// cible jamais le coéquipier, toutes les missions validées présentes pour chaque jeu.
import { describe, expect, it } from 'vitest';
import { FLASH, flashReussie, hacher, nbPorteurs, porteursFlash, tirerFlash } from '../src/flash';
import { JEUX } from '../src/games';
import banque from '../src/data/missions.json';

describe('missions flash', () => {
  it('chaque jeu a ses missions flash (au moins 5), sans doublon', () => {
    for (const j of JEUX) expect(FLASH.filter((m) => m.jeu === j.id).length, j.id).toBeGreaterThanOrEqual(5);
    expect(new Set(FLASH.map((m) => m.id)).size).toBe(FLASH.length);
    expect(new Set(FLASH.map((m) => m.texte)).size).toBe(FLASH.length);
    for (const m of FLASH) expect(JEUX.some((j) => j.id === m.jeu), m.id).toBe(true);
  });

  it('1 ou 2 porteurs au hasard (dès 3 joueurs) ; même tirage sur tous les téléphones', () => {
    expect(nbPorteurs(2, () => 0)).toBe(1);
    expect(nbPorteurs(4, () => 0.1)).toBe(2);
    expect(nbPorteurs(4, () => 0.9)).toBe(1);
    expect(nbPorteurs(6, () => 0.5)).toBe(2);
    const uids = ['a', 'b', 'c', 'd', 'e'];
    const p = porteursFlash(42, uids, 2);
    expect(p).toHaveLength(2);
    expect(porteursFlash(42, [...uids].reverse(), 2)).toEqual(p);
    // Selon la graine, ce n'est pas toujours le même joueur.
    const premiers = new Set(Array.from({ length: 30 }, (_, g) => porteursFlash(g, uids, 1)[0]));
    expect(premiers.size).toBeGreaterThan(2);
    expect(hacher('x')).toBe(hacher('x'));
  });

  it('deux porteurs du même jeu n’ont jamais la même mission ; la cible est un autre joueur', () => {
    for (let g = 1; g < 60; g++) {
      for (const j of JEUX) {
        const cibles = [{ uid: 'c', prenom: 'Léo' }];
        const m0 = tirerFlash({ jeu: j.id, graine: g, rang: 0, cibles })!;
        const m1 = tirerFlash({ jeu: j.id, graine: g, rang: 1, cibles })!;
        expect(m0.id).not.toBe(m1.id);
        expect(m0.texte).not.toContain('{cible}');
        if (m0.cible) expect(m0.cible).toBe('c');
      }
    }
  });

  it('sans cible possible, pas de mission avec {cible} ; les missions déjà vues passent après', () => {
    const m = tirerFlash({ jeu: 'mines', graine: 3, rang: 0, cibles: [] })!;
    expect(m.cible).toBeUndefined();
    const vues = Object.fromEntries(FLASH.filter((x) => x.jeu === 'mines').slice(1).map((x) => [x.id, true]));
    const libre = FLASH.filter((x) => x.jeu === 'mines')[0];
    expect(tirerFlash({ jeu: 'mines', graine: 9, rang: 0, dejaVus: vues, cibles: [{ uid: 'c', prenom: 'Léo' }] })!.id).toBe(libre.id);
  });

  it('verdict : grillée = ratée, majorité, pas de vote = réussie', () => {
    expect(flashReussie([true, true, false], false)).toBe(true);
    expect(flashReussie([true, false], false)).toBe(false);
    expect(flashReussie([], false)).toBe(true); // aucun vote exprimé : bénéfice du doute (23/11)
    expect(flashReussie([true, true], true)).toBe(false);
  });

  it('grosses missions : les doublons et les missions impossibles ont été retirés', () => {
    const ids = new Set((banque as { id: string }[]).map((m) => m.id));
    for (const id of ['v01', 'v06', 'v12', 'v29', 'v42', 'j27', 'j41']) expect(ids.has(id), id).toBe(false);
    for (const id of ['g01', 'g02', 'g05', 'g06', 'g09', 'g10', 'g11', 'g13', 'g15', 'g16', 'g17', 'g18']) expect(ids.has(id), id).toBe(true);
  });
});

import { borneParieur, pointsGrosse } from '../src/score';
describe('équilibre du barème', () => {
  it('grosse mission selon le format : une longue ≈ gagner la moitié des jeux', () => {
    expect(pointsGrosse('longue', 6)).toBe(15);
    expect(pointsGrosse('longue', 4)).toBe(10);
    expect(pointsGrosse('longue', 8)).toBe(20);
    expect(pointsGrosse('facile', 4)).toBe(4);
    expect(pointsGrosse('longue', 6, true)).toBe(23);
  });
  it('le Parieur ne peut pas décider seul de la soirée', () => {
    expect(borneParieur(15)).toBe(8);
    expect(borneParieur(-12)).toBe(-6);
    expect(borneParieur(3)).toBe(3);
  });
});

describe('au moins une mission flash par jeu, chez un joueur présent', () => {
  it('le porteur est toujours tiré parmi les présents', () => {
    for (let graine = 1; graine < 300; graine++) {
      const presents = ['a', 'c', 'd'];
      const p = porteursFlash(graine, presents, 1);
      expect(p).toHaveLength(1);
      expect(presents).toContain(p[0]);
    }
  });
  it('il y a toujours au moins un porteur', () => {
    for (let n = 1; n <= 6; n++) for (let i = 0; i < 50; i++) expect(nbPorteurs(n, () => i / 50)).toBeGreaterThanOrEqual(1);
  });
});
