// Connexion à Firebase : base temps réel + connexion anonyme (aucun compte à créer).
import { initializeApp } from 'firebase/app';
import { initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, signInAnonymously, onAuthStateChanged, connectAuthEmulator, type User } from 'firebase/auth';
import { getDatabase, connectDatabaseEmulator, ref, onValue } from 'firebase/database';
import { configFirebase } from './firebase-config';
import { joueurTest } from './joueurTest';

// Mode « émulateur » (tests locaux, sans vrai projet Firebase) : VITE_EMULATEUR=1 au lancement.
const emulateur = import.meta.env.VITE_EMULATEUR === '1';

export const configManquante = !emulateur && configFirebase.apiKey === 'A_REMPLACER';

const app = initializeApp(
  emulateur
    ? { apiKey: 'demo', projectId: 'demo-grille', databaseURL: `http://${location.hostname}:9000?ns=demo-grille` }
    : configFirebase,
  // Table virtuelle : un nom d'appli par téléphone de test = une connexion (donc un joueur) différente.
  joueurTest !== null ? `table-${joueurTest}` : undefined,
);
// Connexion anonyme seulement : sans le code des fenêtres de connexion Google/Facebook (plus léger).
// Identité gardée d'abord dans le stockage simple du navigateur (localStorage) : lecture immédiate, jamais bloquée,
// même quand plusieurs pages de l'appli se rechargent en même temps (table virtuelle, appli + onglet ouverts).
// Une identité déjà rangée dans IndexedDB (anciennes versions) est retrouvée et recopiée automatiquement par Firebase.
export const auth = initializeAuth(app, { persistence: [browserLocalPersistence, indexedDBLocalPersistence] });
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
