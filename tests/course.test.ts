// Réflexe Mallow : la course rejouée. Même vitesse pour tous, ralenti seulement quand les deux premiers sont collés.
import { describe, expect, it } from 'vitest';
import { minutageCourse } from '../src/course';

describe('course du Réflexe', () => {
  it('le premier arrêté est le plus rapide, et le chrono suit tout le monde au même rythme', () => {
    const m = minutageCourse([412, 268, 350]);
    expect(m.serre).toBe(false);
    expect(m.ralenti).toBeNull();
    expect(m.arrets[1]).toBeLessThan(m.arrets[2]);
    expect(m.arrets[2]).toBeLessThan(m.arrets[0]);
    expect(m.fin).toBe(m.arrets[0]);
    for (const [i, t] of [412, 268, 350].entries()) expect(m.chrono(m.arrets[i])).toBeCloseTo(t, 5);
  });

  it('arrivée serrée : ralenti entre les deux premiers, et la course reste courte même avec un joueur lent', () => {
    const m = minutageCourse([268, 291, 900]);
    expect(m.serre).toBe(true);
    expect(m.ralenti![0]).toBeLessThan(m.arrets[0]);
    expect(m.ralenti![1]).toBeGreaterThan(m.arrets[1]);
    expect(m.fin).toBeLessThan(7000);
    expect(m.chrono(m.fin)).toBeCloseTo(900, 5);
  });
});
