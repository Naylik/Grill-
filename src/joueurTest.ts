// Table virtuelle (table.html) : plusieurs « téléphones » dans une seule page, chacun dans son cadre avec ?joueur=N.
// Chaque cadre doit être un joueur à part : sa propre mémoire (localStorage préfixé) et sa propre connexion
// Firebase (voir firebase.ts). Ce module doit être chargé AVANT tout le reste (1re ligne de main.ts).
// Sans ?joueur=…, il ne fait rien : l'appli normale n'est pas touchée.

const PRENOMS = ['Kilyan', 'Manon', 'Cassie', 'Yanis', 'Lou', 'Sacha', 'Nina', 'Tom'];

function lireNumero(): number | null {
  if (typeof location === 'undefined' || typeof Storage === 'undefined') return null; // tests (Node) : pas de page
  const n = Number(new URLSearchParams(location.search).get('joueur'));
  return Number.isInteger(n) && n >= 1 && n <= PRENOMS.length ? n : null;
}

/** Numéro du joueur de la table virtuelle (1 à 8), ou null sur un vrai téléphone. */
export const joueurTest = lireNumero();

if (joueurTest !== null) {
  const prefixe = `table${joueurTest}:`;
  const proto = Storage.prototype;
  const lire = proto.getItem;
  const ecrire = proto.setItem;
  const effacer = proto.removeItem;
  proto.getItem = function (cle: string) {
    return lire.call(this, prefixe + cle);
  };
  proto.setItem = function (cle: string, valeur: string) {
    ecrire.call(this, prefixe + cle, valeur);
  };
  proto.removeItem = function (cle: string) {
    effacer.call(this, prefixe + cle);
  };
  try {
    // Prénom tout prêt, tuto déjà vu ; le son seulement sur le 1er téléphone (sinon 4 sons à la fois).
    if (!localStorage.getItem('grille:prenom')) localStorage.setItem('grille:prenom', PRENOMS[joueurTest - 1]);
    localStorage.setItem('grille:tuto-vu', '1');
    if (joueurTest > 1 && localStorage.getItem('grille:son') === null) localStorage.setItem('grille:son', 'coupe');
  } catch {
    // stockage bloqué : tant pis, le joueur tapera son prénom
  }
}
