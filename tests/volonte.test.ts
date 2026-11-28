// Mode À volonté : quels jeux sont jouables, et quand les missions sont actives.
import { describe, expect, it } from 'vitest';
import { S } from '../src/etat';
import { jeuParId } from '../src/games';
import { avecMissions, enVolonte, jeuxVolonte, jouableEnVolonte } from '../src/volonte';

describe('À volonté', () => {
  it('le Parieur est jouable dès le premier jeu, seule la limite de joueurs compte', () => {
    expect(jouableEnVolonte(jeuParId('parieur')!, 3)).toBe(true);
    expect(jouableEnVolonte(jeuParId('imposteur')!, 3)).toBe(false);
    expect(jouableEnVolonte(jeuParId('imposteur')!, 4)).toBe(true);
    expect(jeuxVolonte(3).map((j) => j.id)).not.toContain('telepathie');
    expect(jeuxVolonte(4)).toHaveLength(12);
  });

  it('missions : toujours en soirée, au choix de l’hôte en À volonté', () => {
    S.infos = { hote: 'a', duree: 6, modeChoix: 'roue', creeLe: 0 };
    expect(enVolonte()).toBe(false);
    expect(avecMissions()).toBe(true);
    S.infos = { ...S.infos, mode: 'volonte' };
    expect(enVolonte()).toBe(true);
    expect(avecMissions()).toBe(true);
    S.infos = { ...S.infos, missions: false };
    expect(avecMissions()).toBe(false);
    S.infos = null;
  });
});
