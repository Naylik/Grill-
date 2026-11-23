// Combien ont dit oui ? : la jauge de suspense se remplit un cran par « oui », avec une feinte qui change à chaque question.
import { describe, expect, it } from 'vitest';
import { minutageJauge } from '../src/games/combien';

describe('jauge de suspense', () => {
  it('un cran par oui, de plus en plus espacés, puis le chiffre après la feinte', () => {
    for (const graine of ['combien-1-0', 'combien-1-1', 'combien-2-3']) {
      const m = minutageJauge(2, 4, graine);
      expect(m.crans).toHaveLength(2);
      expect(m.crans[1]).toBeGreaterThan(m.crans[0]);
      expect(m.fin).toBeGreaterThan(m.crans[1]);
      if (m.feinte) expect(m.fin).toBeGreaterThanOrEqual(m.feinte.t);
    }
  });

  it('la même question donne la même jauge sur tous les téléphones, mais les questions varient', () => {
    expect(minutageJauge(2, 4, 'combien-1-0')).toEqual(minutageJauge(2, 4, 'combien-1-0'));
    const feintes = new Set(Array.from({ length: 40 }, (_, i) => minutageJauge(2, 5, `combien-1-${i}`).feinte?.type ?? 'aucune'));
    expect(feintes.size).toBeGreaterThanOrEqual(4); // hésite, faux plein, clignote, fausse fin, aucune
    const rythmes = new Set(Array.from({ length: 20 }, (_, i) => minutageJauge(2, 5, `combien-1-${i}`).crans[0]));
    expect(rythmes.size).toBeGreaterThan(5);
  });

  it('tout le monde a dit oui : pas de cran en trop ; personne : la feinte porte sur le 1er cran', () => {
    for (let i = 0; i < 20; i++) {
      const tous = minutageJauge(4, 4, `x-${i}`);
      expect(['fausseFin', undefined]).toContain(tous.feinte?.type);
      const personne = minutageJauge(0, 4, `y-${i}`);
      expect(personne.crans).toEqual([]);
      expect(personne.feinte?.cran).toBe(0);
    }
  });
});
