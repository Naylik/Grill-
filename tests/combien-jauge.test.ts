// Combien ont dit oui ? : la jauge de suspense se remplit un cran par « oui », de plus en plus lentement.
import { describe, expect, it } from 'vitest';
import { minutageJauge } from '../src/games/combien';

describe('jauge de suspense', () => {
  it('un cran par oui, de plus en plus espacés, puis le cran qui hésite et le chiffre', () => {
    const m = minutageJauge(2, 4);
    expect(m.crans).toEqual([600, 1300]);
    expect(m.hesite).toBe(2400);
    expect(m.fin).toBe(3900);
  });
  it('tout le monde a dit oui : pas d’hésitation ; personne : le 1er cran hésite', () => {
    expect(minutageJauge(4, 4).hesite).toBeNull();
    expect(minutageJauge(0, 4)).toEqual({ crans: [], hesite: 600, fin: 2100 });
  });
});
