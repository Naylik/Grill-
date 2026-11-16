// Connexion à Firebase : base temps réel + connexion anonyme (aucun compte à créer).
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, connectAuthEmulator, type User } from 'firebase/auth';
import { getDatabase, connectDatabaseEmulator, ref, onValue } from 'firebase/database';
import { configFirebase } from './firebase-config';

// Mode « émulateur » (tests locaux, sans vrai projet Firebase) : VITE_EMULATEUR=1 au lancement.
const emulateur = import.meta.env.VITE_EMULATEUR === '1';

export const configManquante = !emulateur && configFirebase.apiKey === 'A_REMPLACER';

const app = initializeApp(
  emulateur
    ? { apiKey: 'demo', projectId: 'demo-grille', databaseURL: `http://${location.hostname}:9000?ns=demo-grille` }
    : configFirebase,
);
export const auth = getAuth(app);
export const db = getDatabase(app);

if (emulateur) {
  connectAuthEmulator(auth, `http://${location.hostname}:9099`, { disableWarnings: true });
  connectDatabaseEmulator(db, location.hostname, 9000);
}

/** Décalage entre l'horloge du téléphone et celle du serveur, pour des chronos identiques partout. */
let decalage = 0;
onValue(ref(db, '.info/serverTimeOffset'), (s) => {
  decalage = s.val() ?? 0;
});
export const maintenant = (): number => Date.now() + decalage;

/** Connexion anonyme : le même téléphone garde le même identifiant, même après un rechargement. */
export function connexion(): Promise<User> {
  return new Promise((resolve, reject) => {
    const stop = onAuthStateChanged(auth, (u) => {
      if (u) {
        stop();
        resolve(u);
      }
    });
    signInAnonymously(auth).catch(reject);
  });
}
