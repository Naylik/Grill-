// Saisons : cuisson, tirage de la vengeance (une seule par partie) et cumul des points.
import { describe, expect, it } from 'vitest';
import { avantPalierSuivant, classementSaison, majSaison, niveauCuisson, nouvelIdSaison, tirerVengeance, type Saison } from '../src/saison';
import { pointsDeFin } from '../src/score';

describe('saisons', () => {
  it('la cuisson dépend des missions réussies : Cru 0, Tiède 3, Doré 8, Caramel 15, Flambé 25', () => {
    expect([0, 2, 3, 7, 8, 15, 24, 25, 99].map(niveauCuisson)).toEqual([0, 0, 1, 1, 2, 3, 3, 4, 4]);
    expect(avantPalierSuivant(5)).toBe(3);
    expect(avantPalierSuivant(30)).toBeNull();
    expect(nouvelIdSaison()).toMatch(/^[a-z0-9]{12}$/);
  });

  const saison: Saison = {
    infos: { nom: 'Test', createur: 'a', creeLe: 1 },
    rancunes: { a: { b: true }, b: { c: true, z: true }, c: { a: true }, d: { d: true } },
  };

  it('au plus UNE vengeance par partie, tirée au hasard, contre quelqu’un de présent', () => {
    const presents = ['a', 'b', 'c', 'd'];
    const tirages = [0, 0.3, 0.6, 0.99].map((h) => tirerVengeance(saison, presents, () => h));
    for (const t of tirages) expect(t).not.toBeNull();
    expect(new Set(tirages.map((t) => t!.de))).toEqual(new Set(['a', 'b', 'c'])); // d s'est « grillé » lui-même : exclu
    expect(tirerVengeance(saison, presents, () => 0.4)!.choix).toEqual(['c']); // z n'est pas là ce soir
    expect(tirerVengeance(saison, ['a', 'd'], () => 0)).toBeNull(); // b absent : pas de vengeance possible
    expect(tirerVengeance(null, presents)).toBeNull();
  });

  it('fin de partie : points cumulés, missions réussies, rancune remplacée, partie comptée une seule fois', () => {
    const s: Saison = { ...saison, membres: { a: { prenom: 'A', couleur: '#fff', points: 40, missions: 4, parties: 2 } } };
    const joueurs = { a: { prenom: 'A', nomCode: '', couleur: '#fff', rejointLe: 1, connecte: true }, b: { prenom: 'B', nomCode: '', couleur: '#000', rejointLe: 2, connecte: true } };
    const e = majSaison({ saison: s, partieId: 'p1', joueurs, points: { a: 30, b: 25 }, missionsReussies: { a: 2, b: 1 }, grilleurs: { b: ['a', 'a'] } })!;
    expect(e['membres/a']).toMatchObject({ points: 70, missions: 6, parties: 3 });
    expect(e['membres/b']).toMatchObject({ points: 25, missions: 1, parties: 1 });
    expect(e['rancunes/a']).toBeNull();
    expect(e['rancunes/b']).toEqual({ a: true });
    expect(majSaison({ saison: { ...s, parties: { p1: true } }, partieId: 'p1', joueurs, points: {}, missionsReussies: {}, grilleurs: {} })).toBeNull();
    expect(classementSaison({ ...s, membres: { x: { prenom: 'X', couleur: '', points: 5, missions: 0, parties: 1 }, y: { prenom: 'Y', couleur: '', points: 9, missions: 0, parties: 1 } } }).map(([u]) => u)).toEqual(['y', 'x']);
  });

  it('une mission de vengeance réussie vaut le double', () => {
    const r = pointsDeFin({ a: [{ difficulte: 'facile', reussie: true, vengeance: true }, { difficulte: 'difficile', reussie: true }] }, []);
    expect(r.missions.a).toBe(12 + 10);
  });
});
