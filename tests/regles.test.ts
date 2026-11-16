// Vérifie les règles de sécurité Firebase sur l'émulateur local (npm run emulateur dans un autre terminal).
// Ignoré automatiquement si l'émulateur ne tourne pas.
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { get, ref, set, update, runTransaction } from 'firebase/database';

const emulateurDispo = await fetch('http://127.0.0.1:9000/.json?ns=demo-grille').then(() => true, () => false);

describe.skipIf(!emulateurDispo)('règles de sécurité', () => {
  let env: RulesTestEnvironment;
  const C = 'ABCD';
  const joueur = (prenom: string, connecte = true) => ({ prenom, nomCode: 'Agent X', couleur: '#FF8A3D', rejointLe: 1, connecte });
  const bd = (uid: string) => env.authenticatedContext(uid).database();

  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: 'demo-grille',
      database: { host: '127.0.0.1', port: 9000, rules: readFileSync('database.rules.json', 'utf8') },
    });
  });
  afterAll(() => env?.cleanup());

  beforeEach(async () => {
    await env.clearDatabase();
    // L'hôte crée le salon comme le fait l'appli.
    const h = bd('hote');
    await assertSucceeds(set(ref(h, `salons/${C}/infos`), { hote: 'hote', duree: 6, modeChoix: 'roue', creeLe: Date.now() }));
    await assertSucceeds(update(ref(h, `salons/${C}`), { deroule: { phase: 'salon', numeroJeu: 0 }, joueurs: { hote: joueur('Kilyan') } }));
    await assertSucceeds(set(ref(bd('manon'), `salons/${C}/joueurs/manon`), joueur('Manon')));
    await assertSucceeds(set(ref(bd('cassie'), `salons/${C}/joueurs/cassie`), joueur('Cassie')));
  });

  it("personne ne lit les missions d'un autre, pas même l'hôte", async () => {
    await assertSucceeds(set(ref(bd('manon'), `secrets/${C}/manon/mission1`), { texte: 'secret' }));
    await assertSucceeds(get(ref(bd('manon'), `secrets/${C}/manon`)));
    await assertFails(get(ref(bd('cassie'), `secrets/${C}/manon`)));
    await assertFails(get(ref(bd('hote'), `secrets/${C}/manon`)));
    await assertFails(get(ref(bd('hote'), `secrets/${C}`)));
    await assertFails(set(ref(bd('cassie'), `secrets/${C}/manon/mission1`), { texte: 'sabotage' }));
    await assertFails(get(ref(env.unauthenticatedContext().database(), `secrets/${C}/manon`)));
  });

  it("le mot de l'Imposteur et les réponses ne sont lisibles que par leur joueur (et l'hôte pour les réponses)", async () => {
    await assertSucceeds(set(ref(bd('hote'), `salons/${C}/motsImposteur/manon`), 'Mbappé'));
    await assertSucceeds(get(ref(bd('manon'), `salons/${C}/motsImposteur/manon`)));
    await assertFails(get(ref(bd('cassie'), `salons/${C}/motsImposteur/manon`)));
    await assertSucceeds(set(ref(bd('manon'), `salons/${C}/reponses/manon`), { estimation: 2 }));
    await assertFails(set(ref(bd('cassie'), `salons/${C}/reponses/manon`), { estimation: 0 }));
    await assertFails(get(ref(bd('cassie'), `salons/${C}/reponses`)));
    await assertSucceeds(get(ref(bd('hote'), `salons/${C}/reponses`)));
  });

  it("seul l'hôte pilote la partie et les scores", async () => {
    await assertFails(set(ref(bd('manon'), `salons/${C}/deroule/phase`), 'fin'));
    await assertFails(set(ref(bd('manon'), `salons/${C}/scores/manon/jeux`), 99));
    await assertSucceeds(set(ref(bd('hote'), `salons/${C}/deroule/phase`), 'missions'));
    await assertFails(set(ref(bd('manon'), `salons/${C}/joueurs/cassie/prenom`), 'Nul'));
  });

  it('on ne rejoint plus une partie lancée, mais on peut se reconnecter', async () => {
    await set(ref(bd('hote'), `salons/${C}/deroule/phase`), 'missions');
    await assertFails(set(ref(bd('intrus'), `salons/${C}/joueurs/intrus`), joueur('Intrus')));
    await assertSucceeds(set(ref(bd('manon'), `salons/${C}/joueurs/manon/connecte`), true));
  });

  it("un joueur ne prend la main que si l'hôte est déconnecté", async () => {
    await assertFails(runTransaction(ref(bd('manon'), `salons/${C}/infos/hote`), () => 'manon'));
    await set(ref(bd('hote'), `salons/${C}/joueurs/hote/connecte`), false);
    await assertFails(set(ref(bd('manon'), `salons/${C}/infos/hote`), 'cassie'));
    await assertSucceeds(set(ref(bd('manon'), `salons/${C}/infos/hote`), 'manon'));
    await assertSucceeds(set(ref(bd('manon'), `salons/${C}/deroule/phase`), 'missions'));
  });

  it("une mission ne peut être réservée qu'une fois et une cible pas plus de 2 fois", async () => {
    await assertSucceeds(set(ref(bd('manon'), `salons/${C}/tirage/prises/abc`), true));
    await assertFails(set(ref(bd('cassie'), `salons/${C}/tirage/prises/abc`), true));
    await assertSucceeds(set(ref(bd('cassie'), `salons/${C}/tirage/cibles/hote`), 2));
    await assertFails(set(ref(bd('cassie'), `salons/${C}/tirage/cibles/hote`), 3));
    await assertFails(set(ref(bd('intrus'), `salons/${C}/tirage/prises/xyz`), true));
  });
});
