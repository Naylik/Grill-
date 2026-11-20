import { beforeEach, describe, expect, it, vi } from 'vitest';

// Un faux stockage du téléphone (les tests tournent hors navigateur).
const faux = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => faux.get(k) ?? null,
  setItem: (k: string, v: string) => void faux.set(k, v),
  removeItem: (k: string) => void faux.delete(k),
});

describe('mémoire des choix secrets (rechargement de page)', () => {
  beforeEach(() => {
    faux.clear();
    vi.resetModules();
  });

  it('retrouve ma mine et la clé du détecteur après un rechargement', async () => {
    const avant = await import('../src/memoireJeu');
    avant.memoireDuSalon('ABCD');
    avant.localJeu['mines-2-ma-mine'] = 12;
    avant.localJeu['mines-2-cle'] = 'secret';
    vi.resetModules(); // = la page est rechargée
    const apres = await import('../src/memoireJeu');
    apres.memoireDuSalon('ABCD');
    expect(apres.localJeu['mines-2-ma-mine']).toBe(12);
    expect(apres.localJeu['mines-2-cle']).toBe('secret');
  });

  it('ignore la mémoire d’un autre salon et l’efface en quittant', async () => {
    const m = await import('../src/memoireJeu');
    m.memoireDuSalon('ABCD');
    m.localJeu.choix = 'a';
    m.memoireDuSalon('WXYZ');
    expect(m.localJeu.choix).toBeUndefined();
    m.localJeu.choix = 'b';
    m.memoireDuSalon(null);
    expect(faux.has('grille:memoire-jeu')).toBe(false);
  });

  it('suit les suppressions', async () => {
    const m = await import('../src/memoireJeu');
    m.memoireDuSalon('ABCD');
    m.localJeu.x = 1;
    delete m.localJeu.x;
    vi.resetModules();
    const apres = await import('../src/memoireJeu');
    apres.memoireDuSalon('ABCD');
    expect('x' in apres.localJeu).toBe(false);
  });
});
