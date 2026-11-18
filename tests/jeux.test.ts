import { describe, expect, it } from 'vitest';
import { pariMutuel, plusProches, resultatImposteur } from '../src/score';
import { lireNombre } from '../src/games/justePrix';
import { JEUX, jeuxPourVote, jeuxPossibles } from '../src/games';
import justeprix from '../src/data/justeprix.json';
import defis from '../src/data/defis.json';
import imposteur from '../src/data/imposteur.json';

describe('Le Parieur (pari mutuel)', () => {
  // Exemple du cahier des charges : 3 joueurs misent 3 sur la réussite de Manon, Kilyan mise 3 sur l'échec.
  const mises = [
    { uid: 'a', mise: 3, cote: 'reussite' as const },
    { uid: 'b', mise: 3, cote: 'reussite' as const },
    { uid: 'c', mise: 3, cote: 'reussite' as const },
    { uid: 'kilyan', mise: 3, cote: 'echec' as const },
  ];
  it('Manon réussit : 1 pt chacun pour les gagnants, Manon gagne 3', () => {
    expect(pariMutuel(mises, true, 'manon')).toEqual({ manon: 3, a: 1, b: 1, c: 1, kilyan: -3 });
  });
  it('Manon rate : Kilyan gagne 6 (plafond), 3 pts rendus aux perdants', () => {
    expect(pariMutuel(mises, false, 'manon')).toEqual({ manon: 0, a: -2, b: -2, c: -2, kilyan: 6 });
  });
  it('tout le monde du même côté : personne ne gagne ni ne perd (le défié garde son bonus)', () => {
    const r = pariMutuel([{ uid: 'a', mise: 2, cote: 'reussite' }, { uid: 'b', mise: 1, cote: 'reussite' }], true, 'm');
    expect(r).toEqual({ m: 2, a: 0, b: 0 });
  });
  it('bonus du défié plafonné à 5', () => {
    const six = Array.from({ length: 6 }, (_, i) => ({ uid: `j${i}`, mise: 1, cote: 'reussite' as const }));
    expect(pariMutuel(six, true, 'm').m).toBe(5);
  });
});

describe('Le Juste Prix', () => {
  it('le plus proche gagne, ex aequo compris', () => {
    expect(plusProches({ a: 300, b: 330, c: 360 }, 330)).toEqual(['b']);
    expect(plusProches({ a: 320, b: 340 }, 330).sort()).toEqual(['a', 'b']);
  });
  it('lit les nombres tapés au téléphone', () => {
    expect(lireNombre('42 195')).toBe(42195);
    expect(lireNombre('3,5')).toBe(3.5);
    expect(lireNombre('abc')).toBeNull();
  });
});

describe("L'Imposteur", () => {
  const uids = ['a', 'b', 'c', 'd'];
  it('démasqué : 1 pt par bon vote', () => {
    expect(resultatImposteur({ a: 'd', b: 'd', c: 'a', d: 'a' }, 'd', uids)).toEqual({ a: 0, b: 0, c: 0, d: 3 }); // égalité : il survit
    expect(resultatImposteur({ a: 'd', b: 'd', c: 'd', d: 'a' }, 'd', uids)).toEqual({ a: 1, b: 1, c: 1, d: 0 });
  });
  it("survit (pas le plus voté, ou égalité) : 3 pts à l'imposteur", () => {
    expect(resultatImposteur({ a: 'b', b: 'c', c: 'b', d: 'b' }, 'd', uids)).toEqual({ a: 0, b: 0, c: 0, d: 3 });
  });
});

describe('règles de tirage des jeux', () => {
  it('Le Parieur jamais dans les 2 premiers jeux, L’Imposteur jamais à 3', () => {
    for (const n of [1, 2]) expect(jeuxPossibles(n, 5, []).map((j) => j.id)).not.toContain('parieur');
    for (let n = 1; n <= 8; n++) {
      expect(jeuxPossibles(n, 3, []).map((j) => j.id)).not.toContain('imposteur');
      expect(jeuxPourVote(n, 3, []).map((j) => j.id)).not.toContain('imposteur');
    }
    expect(JEUX.find((j) => j.id === 'parieur')!.autorise(3, 3)).toBe(true);
  });
  it('le vote propose 2 jeux différents, sans le dernier joué', () => {
    for (let i = 0; i < 50; i++) {
      const v = jeuxPourVote(4, 5, ['combien', 'justeprix', 'imposteur']).map((j) => j.id);
      expect(v).toHaveLength(2);
      expect(new Set(v).size).toBe(2);
      expect(v).not.toContain('imposteur');
    }
  });
});

describe('banques', () => {
  it('40 questions de Juste Prix (moitié culture, moitié fun), 30 défis, 30 paires', () => {
    expect(justeprix).toHaveLength(40);
    expect(justeprix.filter((q) => q.categorie === 'culture')).toHaveLength(20);
    expect(justeprix.every((q) => typeof q.reponse === 'number')).toBe(true);
    expect(defis).toHaveLength(30);
    expect(imposteur).toHaveLength(30);
    expect(new Set(imposteur.map((p) => p.theme))).toEqual(new Set(['jeux vidéo', 'foot', 'cinéma', 'séries']));
    for (const d of defis) expect(d.texte.toLowerCase()).not.toMatch(/\b(bois|boire|verre|shot|alcool)\b/);
  });
});

describe('Réflexe Mallow et Le bon timing', async () => {
  const { tempsCompte } = await import('../src/games/reflexe');
  const { ecartCompte, formaterSecondes } = await import('../src/games/timing');
  it('réflexe : faux départ et absence pénalisés', () => {
    expect(tempsCompte(250)).toBe(250);
    expect(tempsCompte(-1)).toBe(1000);
    expect(tempsCompte(undefined)).toBe(1500);
    expect(tempsCompte(9000)).toBe(1500);
  });
  it('timing : écart au temps demandé', () => {
    expect(ecartCompte(10120, 10)).toBe(120);
    expect(ecartCompte(9800, 10)).toBe(200);
    expect(ecartCompte(undefined, 5)).toBe(5000);
    expect(formaterSecondes(4870)).toBe('4,87 s');
  });
  it('déroulé complet : intro, manches, piste, bilan, puis points de place', async () => {
    const { reflexe } = await import('../src/games/reflexe');
    const { timing } = await import('../src/games/timing');
    const uids = ['a', 'b', 'c'];
    const joueurs = Object.fromEntries(uids.map((u, i) => [u, { prenom: `J${i}`, couleur: '#fff' }])) as never;
    for (const [jeu, valeurs] of [[reflexe, { a: 200, b: 300, c: -1 }], [timing, { a: 5100, b: 6000, c: 4000 }]] as const) {
      let t = 1000;
      const ctx = () => ({ joueurs, uids, connectes: uids, maintenant: t, numeroJeu: 1, reponses: {} as Record<string, never>, compteurs: {}, totaux: {}, prive: {}, hasard: () => 0.5 });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let etat: any = jeu.demarrer(ctx() as never).etat;
      expect(etat.phase).toBe('intro');
      const phases: string[] = [];
      for (let i = 0; i < 40; i++) {
        t += 20000;
        const c = ctx();
        if (etat.phase === 'attente' || etat.phase === 'chrono') {
          for (const u of uids) c.reponses[u] = { etape: etat.etape, temps: valeurs[u as 'a'] } as never;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const av: any = jeu.piloter(c as never, etat);
        if (!av) continue;
        if (av.fin) {
          expect(av.fin.points.a).toBeGreaterThan(av.fin.points.c);
          break;
        }
        etat = av.etat;
        phases.push(etat.phase);
      }
      expect(phases).toContain('resultat');
      expect(phases.at(-1)).toBe('bilan');
    }
  });
  it('les deux jeux sont dans la liste et peuvent sortir dès le 1er jeu', () => {
    const ids = jeuxPossibles(1, 3, []).map((j) => j.id);
    expect(ids).toContain('reflexe');
    expect(ids).toContain('timing');
  });
});
