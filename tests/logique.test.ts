import { describe, expect, it } from 'vitest';
import { codeAleatoire, esc, melanger, normaliserCode, nettoyerPrenom } from '../src/outils';
import { majoriteOui, missionTrouvee, places, pointsCombien, pointsDeFin, pointsDePlace, titres, scoreVide } from '../src/score';
import { BANQUE, choisirPropositions } from '../src/missions';
import { vanneDuClassement } from '../src/narrateur';
import { tirerIdentite, COULEURS } from '../src/identite';
import { jeuxPossibles } from '../src/games';
import combien from '../src/data/combien.json';
import vannes from '../src/data/vannes.json';

describe('outils', () => {
  it('code de 4 lettres sans lettres ambiguës', () => {
    for (let i = 0; i < 200; i++) expect(codeAleatoire()).toMatch(/^[A-HJKMNP-Z]{4}$/);
    expect(normaliserCode(' ab-cd9 ')).toBe('ABCD');
  });
  it('échappe le HTML saisi par les joueurs', () => {
    expect(esc('<img onerror="x">')).toBe('&lt;img onerror=&quot;x&quot;&gt;');
    expect(nettoyerPrenom('  manon   la  ')).toBe('Manon la');
  });
  it('mélange sans perdre d’éléments', () => {
    expect(melanger([1, 2, 3, 4]).sort()).toEqual([1, 2, 3, 4]);
  });
  it('identités différentes', () => {
    const pris = [{ nomCode: 'Agent Faucon', couleur: COULEURS[0] }];
    for (let i = 0; i < 50; i++) expect(tirerIdentite(pris).couleur).not.toBe(COULEURS[0]);
  });
});

describe('barème', () => {
  it('points de place 5/3/2/1 avec ex aequo', () => {
    expect(pointsDePlace({ a: 9, b: 7, c: 4, d: 1, e: 0 })).toEqual({ a: 5, b: 3, c: 2, d: 1, e: 1 });
    expect(pointsDePlace({ a: 3, b: 3, c: 1 })).toEqual({ a: 5, b: 5, c: 2 });
    expect(places({ a: 10, b: 2 }, false)).toEqual({ b: 1, a: 2 });
  });
  it('Combien ont dit oui : 3 si exact, 1 à un près', () => {
    expect(pointsCombien(3, 3)).toBe(3);
    expect(pointsCombien(2, 3)).toBe(1);
    expect(pointsCombien(0, 3)).toBe(0);
  });
  it('vote : plus de la moitié, égalité = raté', () => {
    expect(majoriteOui([true, true, false])).toBe(true);
    expect(majoriteOui([true, false])).toBe(false);
    expect(majoriteOui([])).toBe(false);
  });
  it('pari détective : vote du groupe', () => {
    expect(missionTrouvee([1, 1, 0])).toBe(1);
    expect(missionTrouvee([2, 0])).toBe(0);
    expect(missionTrouvee([2, 2, 1])).toBe(2);
    expect(missionTrouvee([0])).toBe(0);
  });
  it('missions, vol et pari raté', () => {
    const r = pointsDeFin(
      { a: [{ difficulte: 'facile', reussie: true }, { difficulte: 'difficile', reussie: true }], b: [{ difficulte: 'difficile', reussie: false }], c: [] },
      [{ de: 'b', cible: 'a', trouvee: 'difficile' }, { de: 'c', cible: 'b', trouvee: null }],
    );
    expect(r.missions).toEqual({ a: 16, b: 0, c: 0 });
    expect(r.detective).toEqual({ a: -6, b: 6, c: -2 });
  });
  it('titres fun', () => {
    const scores = { a: { ...scoreVide(), jeux: 10 }, b: { ...scoreVide(), jeux: 4 } };
    const t = titres(scores, { a: [{ difficulte: 'difficile', reussie: true }, { difficulte: 'difficile', reussie: true }], b: [] }, [{ de: 'b', cible: 'a', trouvee: 'difficile' }]);
    expect(t.map((x) => `${x.uid}:${x.titre}`).sort()).toEqual(['a:Agent secret', 'a:Casse-cou', 'a:Champion des mini-jeux', 'a:Grillé', 'b:Sherlock'].sort());
  });
});

describe('banques de contenu', () => {
  it('missions équilibrées (au moins 15 par type et difficulté), ids uniques, {cible} bien écrit', () => {
    expect(BANQUE.length).toBeGreaterThanOrEqual(60);
    expect(new Set(BANQUE.map((m) => m.id)).size).toBe(BANQUE.length);
    for (const type of ['vie', 'jeu']) for (const d of ['facile', 'difficile']) expect(BANQUE.filter((m) => m.type === type && m.difficulte === d).length).toBeGreaterThanOrEqual(15);
    for (const m of BANQUE) {
      expect(['soft', 'epice', 'hot']).toContain(m.niveau);
      expect(m.texte.replaceAll('{cible}', '')).not.toMatch(/[{}]/);
      expect(m.texte.toLowerCase()).not.toMatch(/\b(bois|boire|verre|shot|alcool)\b/);
    }
  });
  it('40 questions et 50 vannes', () => {
    expect(combien).toHaveLength(40);
    expect(vannes.dernier.length + vannes.premier.length + vannes.general.length).toBe(50);
  });
});

describe('tirage des missions', () => {
  const cibles = [{ uid: 'b', prenom: 'Manon', fois: 0 }, { uid: 'c', prenom: 'Cassie', fois: 1 }];
  it('une facile et une difficile du bon type, cible remplacée', () => {
    for (let i = 0; i < 100; i++) {
      const p = choisirPropositions({ type: 'vie', niveau: 'epice', prises: new Set(), exclues: [], cibles });
      expect(p.map((m) => m.difficulte)).toEqual(['facile', 'difficile']);
      expect(p.every((m) => m.type === 'vie' && !m.texte.includes('{cible}'))).toBe(true);
      for (const m of p) if (m.cible) expect(m.texte).toContain(m.cible === 'b' ? 'Manon' : 'Cassie');
    }
  });
  it('respecte les missions prises, le niveau et la limite de 2 par cible', () => {
    const prises = new Set(BANQUE.filter((m) => m.type === 'jeu' && m.difficulte === 'facile').slice(1).map((m) => m.id));
    const p = choisirPropositions({ type: 'jeu', niveau: 'soft', prises, exclues: [], cibles: [{ uid: 'b', prenom: 'Manon', fois: 2 }] });
    for (const m of p) {
      expect(prises.has(m.id)).toBe(false);
      expect(BANQUE.find((x) => x.id === m.id)!.niveau).toBe('soft');
      expect(m.cible).toBeUndefined();
    }
  });
});

describe('narrateur et choix des jeux', () => {
  it('vanne avec le prénom', () => {
    const v = vanneDuClassement([{ prenom: 'Kilyan', points: 9 }, { prenom: 'Manon', points: 0 }], () => 0.1);
    expect(v).toContain('Manon');
  });
  it('jeux possibles non vides', () => {
    expect(jeuxPossibles(1, 3, []).length).toBeGreaterThan(0);
  });
});
