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

  it('bouton GRILLÉ ! : une accusation par manche, seul l’accusé répond, personne ne triche', async () => {
    const acc = `salons/${C}/accusations/2/manon`;
    const base = { cible: 'cassie', texte: 'Elle me fait dire franchement', le: Date.now() };
    // On ne peut pas accuser au nom d'un autre, ni s'accuser soi-même, ni répondre à sa place.
    await assertFails(set(ref(bd('cassie'), acc), base));
    await assertFails(set(ref(bd('manon'), `salons/${C}/accusations/2/manon`), { ...base, cible: 'manon' }));
    await assertFails(set(ref(bd('manon'), acc), { ...base, reponse: 'eu' }));
    await assertSucceeds(set(ref(bd('manon'), acc), base));
    // Une seule accusation par manche : pas de seconde écriture.
    await assertFails(set(ref(bd('manon'), acc), { ...base, cible: 'hote' }));
    // Tout le monde peut lire l'accusation.
    await assertSucceeds(get(ref(bd('hote'), `salons/${C}/accusations`)));
    // Seule l'accusée répond, une seule fois.
    await assertFails(set(ref(bd('manon'), `${acc}/reponse`), 'eu'));
    await assertFails(set(ref(bd('hote'), `${acc}/reponse`), 'bof'));
    await assertSucceeds(update(ref(bd('cassie'), acc), { reponse: 'eu', mission: { numero: 1, texte: 'Fais dire franchement', difficulte: 'facile' } }));
    await assertFails(set(ref(bd('cassie'), `${acc}/reponse`), 'rate'));
    // Le verdict et les points restent à l'hôte.
    await assertFails(set(ref(bd('manon'), `${acc}/statut`), 'grille'));
    await assertSucceeds(set(ref(bd('hote'), `${acc}/statut`), 'vote'));
  });

  it('vengeance : seul le joueur tiré voit son offre et ne prévient que sa cible ; saisons protégées', async () => {
    await assertSucceeds(set(ref(bd('hote'), `salons/${C}/vengeance/offre/manon`), { choix: { cassie: true } }));
    await assertSucceeds(get(ref(bd('manon'), `salons/${C}/vengeance/offre/manon`)));
    await assertFails(get(ref(bd('cassie'), `salons/${C}/vengeance/offre/manon`)));
    await assertFails(set(ref(bd('manon'), `salons/${C}/vengeance/annonce/hote`), { de: 'manon' })); // pas dans ses choix
    await assertFails(set(ref(bd('cassie'), `salons/${C}/vengeance/annonce/cassie`), { de: 'cassie' }));
    await assertSucceeds(set(ref(bd('manon'), `salons/${C}/vengeance/annonce/cassie`), { de: 'manon' }));
    await assertSucceeds(get(ref(bd('cassie'), `salons/${C}/vengeance/annonce/cassie`)));
    await assertFails(get(ref(bd('hote'), `salons/${C}/vengeance/annonce/cassie`)));
    await assertFails(get(ref(bd('manon'), `salons/${C}/vengeance/annonce/cassie`)));
    const id = 'abcdefghjk23';
    await assertSucceeds(set(ref(bd('manon'), `saisons/${id}`), { infos: { nom: 'Coloc', createur: 'manon', creeLe: 1 }, membres: { manon: { points: 0 } } }));
    await assertFails(set(ref(bd('cassie'), `saisons/${id}/membres/cassie`), { points: 999 })); // pas membre
    await assertSucceeds(set(ref(bd('manon'), `saisons/${id}/membres/cassie`), { points: 10 }));
    await assertSucceeds(get(ref(bd('cassie'), `saisons/${id}`)));
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
