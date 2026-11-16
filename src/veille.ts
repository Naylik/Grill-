// Empêche l'écran de se mettre en veille pendant la partie (Wake Lock).
// Un téléphone qui se verrouille coupe sa connexion : on garde donc l'écran allumé.

let verrou: WakeLockSentinel | null = null;
let voulu = false;

async function demander(): Promise<void> {
  if (!voulu || verrou || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  try {
    verrou = await navigator.wakeLock.request('screen');
    verrou.addEventListener('release', () => {
      verrou = null;
    });
  } catch {
    // Refusé (batterie faible, navigateur ancien…) : on réessaiera au prochain retour sur la page.
  }
}

// Le verrou saute quand on change d'appli : on le redemande au retour.
document.addEventListener('visibilitychange', () => void demander());

export function garderEcranAllume(oui: boolean): void {
  voulu = oui;
  if (oui) void demander();
  else {
    void verrou?.release();
    verrou = null;
  }
}
