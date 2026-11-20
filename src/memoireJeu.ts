// Mémoire des choix secrets de ce téléphone pendant les jeux : ma mine, la clé de mon détecteur,
// un piège ou une mise pas encore envoyés… Elle est enregistrée sur le téléphone (jamais envoyée sur internet),
// survit à un rechargement de la page, et s'efface quand on quitte la partie.
const CLE = 'grille:memoire-jeu';
let salon: string | null = null;
const donnees: Record<string, unknown> = {};

function stockage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // navigation privée stricte : on garde la mémoire en RAM seulement
  }
}

function enregistrer(): void {
  try {
    stockage()?.setItem(CLE, JSON.stringify({ salon, donnees }));
  } catch {
    /* stockage plein ou bloqué : tant pis, la mémoire reste en RAM */
  }
}

/** Les jeux lisent et écrivent ici (`v.local`) ; chaque changement est enregistré. */
export const localJeu: Record<string, unknown> = new Proxy(donnees, {
  set(cible, cle, valeur) {
    cible[cle as string] = valeur;
    enregistrer();
    return true;
  },
  deleteProperty(cible, cle) {
    delete cible[cle as string];
    enregistrer();
    return true;
  },
});

/** À appeler quand on entre dans un salon (code) ou qu'on le quitte (null). */
export function memoireDuSalon(code: string | null): void {
  if (code === salon) return;
  for (const cle of Object.keys(donnees)) delete donnees[cle];
  salon = code;
  if (!code) {
    try {
      stockage()?.removeItem(CLE);
    } catch {
      /* rien à effacer */
    }
    return;
  }
  try {
    const lu = JSON.parse(stockage()?.getItem(CLE) ?? 'null') as { salon?: string; donnees?: Record<string, unknown> } | null;
    // La mémoire d'un autre salon (partie précédente jamais quittée) est ignorée, puis remplacée.
    if (lu?.salon === code && lu.donnees) Object.assign(donnees, lu.donnees);
  } catch {
    /* mémoire illisible : on repart de zéro */
  }
}
