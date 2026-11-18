// Mémoire du groupe : ce qui a déjà été joué ne revient pas tant qu'il reste du nouveau.
import { describe, expect, it } from 'vitest';
import { fraisDabord } from '../src/outils';
import { combien } from '../src/games/combien';
import { justePrix } from '../src/games/justePrix';
import { parieur } from '../src/games/parieur';
import questionsCombien from '../src/data/combien.json';
import questionsPrix from '../src/data/justeprix.json';
import { BANQUE, choisirPropositions } from '../src/missions';

const uids = ['a', 'b', 'c', 'd'];
const ctx = (dejaVus: Record<string, boolean>) =>
  ({ joueurs: {}, uids, connectes: uids, maintenant: 0, numeroJeu: 3, duree: 8, dejaVus, reponses: {}, compteurs: {}, totaux: {}, prive: {}, hasard: Math.random }) as never;
const tous = (liste: { id: string }[], sauf: string[] = []) => Object.fromEntries(liste.filter((x) => !sauf.includes(x.id)).map((x) => [x.id, true]));

describe('mémoire du groupe', () => {
  it('les contenus jamais joués passent d’abord, les anciens seulement s’il en faut encore', () => {
    const liste = [{ id: 'x1' }, { id: 'x2' }, { id: 'x3' }];
    expect(fraisDabord(liste, { x1: true, x3: true })[0].id).toBe('x2');
    expect(fraisDabord(liste, { x1: true, x2: true, x3: true })).toHaveLength(3);
  });

  it('Combien ont dit oui ? et Juste Prix évitent les questions déjà jouées', () => {
    const libres = questionsCombien.filter((q) => q.niveau !== 'hot').slice(0, 8).map((q) => q.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e: any = combien.demarrer(ctx(tous(questionsCombien, libres))).etat;
    expect([...e.ids].sort()).toEqual([...libres].sort());
    expect(combien.contenus!(e)).toEqual(e.ids);
    const vus = tous(questionsPrix.filter((q) => q.id < 'p41'));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p: any = justePrix.demarrer(ctx(vus)).etat;
    for (const id of justePrix.contenus!(p)) expect(vus[id]).toBeUndefined();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d: any = parieur.demarrer(ctx({})).etat;
    expect(parieur.contenus!(d)).toHaveLength(uids.length);
  });

  it('les missions déjà jouées ne sont plus proposées', () => {
    const jouees = BANQUE.filter((m) => m.difficulte === 'longue').slice(1).map((m) => m.id);
    const restante = BANQUE.find((m) => m.difficulte === 'longue')!;
    for (let i = 0; i < 10; i++) {
      const p = choisirPropositions({ type: 'vie', niveau: 'epice', prises: new Set(), exclues: jouees, cibles: [{ uid: 'b', prenom: 'B', fois: 0 }] });
      expect(p.find((m) => m.difficulte === 'longue')?.id).toBe(restante.id);
    }
  });
});
